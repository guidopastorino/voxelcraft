import type { Animal } from './Animal'
import type { Vec3 } from '../core/math'
import { stepBody, type CollisionWorld } from '../physics/VoxelPhysics'
import { PLAYER } from '../config/defaults'

export interface AIWorld extends CollisionWorld {
  getBlock(x: number, y: number, z: number): number
}

const JUMP_VELOCITY = Math.sqrt(2 * PLAYER.gravity * 1.2)
const TURN_RATE = 5 // rad/s
const MAX_SAFE_DROP = 3

const angleDiff = (a: number, b: number) => {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

function enter(a: Animal, state: Animal['state'], rng: () => number): void {
  a.state = state
  if (state === 'idle') a.stateTimer = 1 + rng() * 3
  else if (state === 'wander') {
    a.stateTimer = 2 + rng() * 4
    a.heading = rng() * Math.PI * 2
  } else a.stateTimer = 2 + rng()
}

/** Starts fleeing away from `from` (called by the damage system). */
export function startFlee(a: Animal, from: Vec3, rng: () => number): void {
  enter(a, 'flee', rng)
  a.heading = Math.atan2(a.pos.x - from.x, a.pos.z - from.z)
}

/** Would stepping forward along `heading` walk off a cliff higher than MAX_SAFE_DROP? */
function cliffAhead(a: Animal, world: AIWorld, heading: number): boolean {
  const ahead = a.body.halfWidth + 0.6
  const x = Math.floor(a.pos.x + Math.sin(heading) * ahead)
  const z = Math.floor(a.pos.z + Math.cos(heading) * ahead)
  const y = Math.floor(a.pos.y)
  for (let d = 1; d <= MAX_SAFE_DROP + 1; d++) {
    if (world.isSolid(x, y - d, z)) return false
    if (world.isLiquid(x, y - d, z)) return true // don't wander into water either
  }
  return true
}

/**
 * Idle / wander / flee state machine with simple local navigation:
 * frontal probe → hop 1-block steps, turn at walls, avoid cliffs and water.
 * No pathfinding (not needed for passive animals).
 */
export function updateAnimal(a: Animal, world: AIWorld, dt: number, rng: () => number): void {
  const b = a.body
  a.age += dt
  if (a.hurtTimer > 0) a.hurtTimer = Math.max(0, a.hurtTimer - dt)

  let speed = 0
  if (a.deathTimer >= 0) {
    a.deathTimer += dt
  } else {
    a.stateTimer -= dt
    if (a.stateTimer <= 0) enter(a, a.state === 'idle' ? 'wander' : 'idle', rng)
    if (a.state === 'wander') speed = a.def.walkSpeed
    if (a.state === 'flee') {
      speed = a.def.fleeSpeed
      if (rng() < dt * 1.5) a.heading += (rng() - 0.5) * 1.2
    }
    if (speed > 0 && a.state === 'wander' && b.onGround && cliffAhead(a, world, a.heading)) {
      a.heading += Math.PI * (0.5 + rng())
    }
    // Turn toward heading.
    const d = angleDiff(a.yaw, a.heading)
    a.yaw += Math.sign(d) * Math.min(Math.abs(d), TURN_RATE * dt)
  }

  // Knockback phase: let impulse velocity play out before steering again.
  const steering = a.hurtTimer < 0.25 && a.deathTimer < 0
  const fx = Math.sin(a.yaw), fz = Math.cos(a.yaw)
  if (steering) {
    const k = 1 - Math.exp(-(b.onGround ? 12 : 2) * dt)
    b.vel.x += (fx * speed - b.vel.x) * k
    b.vel.z += (fz * speed - b.vel.z) * k
  } else {
    const drag = Math.exp(-(b.onGround ? 6 : 1) * dt)
    b.vel.x *= drag
    b.vel.z *= drag
    if (Math.abs(b.vel.x) < 1e-4) b.vel.x = 0
    if (Math.abs(b.vel.z) < 1e-4) b.vel.z = 0
  }

  if (b.inWater) {
    b.vel.y = Math.min(b.vel.y + 18 * dt, 2)
  } else {
    b.vel.y = Math.max(b.vel.y - PLAYER.gravity * dt, -PLAYER.terminalVelocity)
  }

  const prevX = b.pos.x, prevZ = b.pos.z
  stepBody(world, b, dt)

  // Obstacle handling: hop onto 1-block steps, turn at taller walls.
  if (speed > 0 && b.hitWall && b.onGround) {
    const px = Math.floor(b.pos.x + fx * (b.halfWidth + 0.3))
    const pz = Math.floor(b.pos.z + fz * (b.halfWidth + 0.3))
    const py = Math.floor(b.pos.y)
    const climbable = !world.isSolid(px, py + 1, pz) && !world.isSolid(px, py + 2, pz) && !world.isSolid(Math.floor(b.pos.x), py + Math.ceil(b.height) + 1, Math.floor(b.pos.z))
    if (climbable) b.vel.y = JUMP_VELOCITY
    else a.heading = a.yaw + Math.PI * (0.5 + rng())
  }
  a.walkPhase += Math.hypot(b.pos.x - prevX, b.pos.z - prevZ) * 3
}
