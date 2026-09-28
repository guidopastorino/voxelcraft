import type { Vec3 } from '../core/math'

/** Minimal world interface physics needs; implemented by World and test fakes. */
export interface CollisionWorld {
  isSolid(x: number, y: number, z: number): boolean
  isLiquid(x: number, y: number, z: number): boolean
}

/**
 * Axis-aligned box body. `pos` is the centre of the bottom face (feet).
 * Shared by the player, animals and dropped items.
 */
export interface PhysicsBody {
  pos: Vec3
  vel: Vec3
  halfWidth: number
  height: number
  onGround: boolean
  inWater: boolean
  /** Horizontal collision happened this step (used by AI to detect walls). */
  hitWall: boolean
}

export function makeBody(pos: Vec3, width: number, height: number): PhysicsBody {
  return {
    pos: { ...pos },
    vel: { x: 0, y: 0, z: 0 },
    halfWidth: width / 2,
    height,
    onGround: false,
    inWater: false,
    hitWall: false,
  }
}

const EPS = 1e-4
const MAX_SUBSTEP = 0.35

/** True if the body's box at its current position overlaps any solid block. */
export function overlapsSolid(world: CollisionWorld, b: PhysicsBody): boolean {
  const x0 = Math.floor(b.pos.x - b.halfWidth), x1 = Math.floor(b.pos.x + b.halfWidth - 1e-9)
  const y0 = Math.floor(b.pos.y), y1 = Math.floor(b.pos.y + b.height - 1e-9)
  const z0 = Math.floor(b.pos.z - b.halfWidth), z1 = Math.floor(b.pos.z + b.halfWidth - 1e-9)
  for (let y = y0; y <= y1; y++)
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) if (world.isSolid(x, y, z)) return true
  return false
}

/** True if an AABB (min/max corners) overlaps a solid block. */
export function boxOverlapsSolid(world: CollisionWorld, min: Vec3, max: Vec3): boolean {
  for (let y = Math.floor(min.y); y <= Math.floor(max.y - 1e-9); y++)
    for (let z = Math.floor(min.z); z <= Math.floor(max.z - 1e-9); z++)
      for (let x = Math.floor(min.x); x <= Math.floor(max.x - 1e-9); x++) if (world.isSolid(x, y, z)) return true
  return false
}

/**
 * Moves one axis and resolves against the *leading face* only: the slab of
 * cells the box just entered. Checking only newly entered cells means a
 * body that already overlaps a block (spawned or teleported into terrain)
 * is never snapped far away — it simply can't move further into it.
 */
function moveAxis(world: CollisionWorld, b: PhysicsBody, axis: 'x' | 'y' | 'z', delta: number): boolean {
  if (delta === 0) return false
  b.pos[axis] += delta
  const hw = b.halfWidth
  const minX = b.pos.x - hw, maxX = b.pos.x + hw
  const minY = b.pos.y, maxY = b.pos.y + b.height
  const minZ = b.pos.z - hw, maxZ = b.pos.z + hw
  let x0 = Math.floor(minX), x1 = Math.floor(maxX - 1e-9)
  let y0 = Math.floor(minY), y1 = Math.floor(maxY - 1e-9)
  let z0 = Math.floor(minZ), z1 = Math.floor(maxZ - 1e-9)
  // Restrict the scan to the leading slab along the moving axis.
  let lead: number
  if (axis === 'x') lead = x0 = x1 = delta > 0 ? x1 : x0
  else if (axis === 'y') lead = y0 = y1 = delta > 0 ? y1 : y0
  else lead = z0 = z1 = delta > 0 ? z1 : z0
  // Ignore the slab if the box was already inside it before this move.
  const before = b.pos[axis] - delta
  const prevEdge = axis === 'y' ? (delta > 0 ? before + b.height - 1e-9 : before) : delta > 0 ? before + hw - 1e-9 : before - hw
  if (Math.floor(prevEdge) === lead) return false

  for (let y = y0; y <= y1; y++) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (!world.isSolid(x, y, z)) continue
        if (axis === 'y') b.pos.y = delta > 0 ? lead - b.height - EPS : lead + 1 + EPS
        else b.pos[axis] = delta > 0 ? lead - hw - EPS : lead + 1 + hw + EPS
        return true
      }
    }
  }
  return false
}

/**
 * Moves a body by vel*dt with swept, axis-separated collision against
 * solid voxels. Sub-steps keep fast falls from tunnelling through floors.
 * Updates onGround / hitWall / inWater and zeroes blocked velocity.
 */
export function stepBody(world: CollisionWorld, b: PhysicsBody, dt: number): void {
  const dx = b.vel.x * dt, dy = b.vel.y * dt, dz = b.vel.z * dt
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / MAX_SUBSTEP))
  let grounded = false
  let wall = false
  for (let i = 0; i < steps; i++) {
    if (moveAxis(world, b, 'y', dy / steps)) {
      if (dy < 0) grounded = true
      b.vel.y = 0
    }
    if (moveAxis(world, b, 'x', dx / steps)) {
      wall = true
      b.vel.x = 0
    }
    if (moveAxis(world, b, 'z', dz / steps)) {
      wall = true
      b.vel.z = 0
    }
  }
  // Resting on the ground with zero vertical speed still counts as grounded.
  if (!grounded && dy === 0) {
    grounded = world.isSolid(Math.floor(b.pos.x), Math.floor(b.pos.y - 0.01), Math.floor(b.pos.z)) || probeGround(world, b)
  }
  b.onGround = grounded
  b.hitWall = wall
  b.inWater = world.isLiquid(Math.floor(b.pos.x), Math.floor(b.pos.y + b.height * 0.4), Math.floor(b.pos.z))
}

function probeGround(world: CollisionWorld, b: PhysicsBody): boolean {
  const y = Math.floor(b.pos.y - 0.01)
  const hw = b.halfWidth - 0.001
  for (const [ox, oz] of [[-hw, -hw], [hw, -hw], [-hw, hw], [hw, hw]]) {
    if (world.isSolid(Math.floor(b.pos.x + ox), y, Math.floor(b.pos.z + oz))) return true
  }
  return false
}

/** True if the body's feet are resting on a solid block. */
export function isOnGround(world: CollisionWorld, b: PhysicsBody): boolean {
  return probeGround(world, b)
}
