import type { Player } from './Player'
import { PLAYER, SURVIVAL } from '../config/defaults'
import { stepBody } from '../physics/VoxelPhysics'
import type { World } from '../world/World'
import { BlockRegistry } from '../world/BlockRegistry'
import type { EventBus } from '../core/EventBus'

export interface MoveInput {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  jump: boolean
  sprint: boolean
}

export const JUMP_VELOCITY = Math.sqrt(2 * PLAYER.gravity * PLAYER.jumpHeight)
const STEP_DISTANCE = 2.1

/**
 * Converts movement input into velocity and runs the physics step.
 * Returns fall damage to apply (0 if none); the caller owns damage rules.
 */
export function updatePlayerMovement(player: Player, input: MoveInput, world: World, dt: number, events: EventBus): number {
  const b = player.body
  const sinY = Math.sin(player.yaw), cosY = Math.cos(player.yaw)
  // Forward = (-sin, -cos), right = (cos, -sin) — matches the Three.js camera.
  let wx = 0, wz = 0
  if (input.forward) { wx -= sinY; wz -= cosY }
  if (input.backward) { wx += sinY; wz += cosY }
  if (input.right) { wx += cosY; wz -= sinY }
  if (input.left) { wx -= cosY; wz += sinY }
  const wl = Math.hypot(wx, wz)
  if (wl > 0) { wx /= wl; wz /= wl }

  player.sprinting = input.sprint && input.forward && !input.backward && player.stats.canSprint && !b.inWater
  let speed = player.sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed
  if (b.inWater) speed *= PLAYER.waterSpeedFactor

  if (player.debugMode) {
    // Free flight for developers: Space = up, Sprint = down.
    const fly = 12
    b.vel.x = wx * fly
    b.vel.z = wz * fly
    b.vel.y = (input.jump ? fly : 0) - (input.sprint ? fly : 0)
    stepBody(world, b, dt)
    player.fallStartY = null
    player.horizontalSpeed = Math.hypot(b.vel.x, b.vel.z)
    return 0
  }

  const accel = b.onGround || b.inWater ? PLAYER.groundAccel : PLAYER.airAccel
  const k = 1 - Math.exp(-accel * dt)
  b.vel.x += (wx * speed - b.vel.x) * k
  b.vel.z += (wz * speed - b.vel.z) * k

  if (b.inWater) {
    if (input.jump) b.vel.y = Math.min(b.vel.y + 24 * dt, PLAYER.swimUpSpeed)
    else b.vel.y = Math.max(b.vel.y - PLAYER.gravity * PLAYER.waterGravityFactor * dt, -2.5)
    // Let the player climb out onto a bank.
    if (input.jump && b.hitWall) b.vel.y = Math.max(b.vel.y, 5.5)
  } else {
    b.vel.y = Math.max(b.vel.y - PLAYER.gravity * dt, -PLAYER.terminalVelocity)
    if (input.jump && b.onGround) {
      b.vel.y = JUMP_VELOCITY
      player.stats.addExhaustion(player.sprinting ? SURVIVAL.exhaustion.sprintJump : SURVIVAL.exhaustion.jump)
      events.emit('player:jump', {})
    }
  }

  const px = b.pos.x, pz = b.pos.z
  const wasGrounded = b.onGround
  stepBody(world, b, dt)
  const moved = Math.hypot(b.pos.x - px, b.pos.z - pz)
  player.horizontalSpeed = moved / dt

  // Exhaustion from movement.
  if (b.inWater) player.stats.addExhaustion(moved * SURVIVAL.exhaustion.swimPerBlock)
  else if (b.onGround) player.stats.addExhaustion(moved * (player.sprinting ? SURVIVAL.exhaustion.sprintPerBlock : SURVIVAL.exhaustion.walkPerBlock))

  // Footsteps by material of the block underfoot.
  if (b.onGround) {
    player.walkDistance += moved
    if (player.walkDistance - player.lastFootstep > STEP_DISTANCE) {
      player.lastFootstep = player.walkDistance
      const below = world.getBlock(Math.floor(b.pos.x), Math.floor(b.pos.y - 0.05), Math.floor(b.pos.z))
      const material = BlockRegistry.defs[below]?.material ?? 'none'
      events.emit('player:footstep', { material, position: { ...b.pos } })
    }
  }

  // Fall tracking: remember the apex while airborne; water cancels the fall.
  let fallDamage = 0
  if (b.inWater) {
    player.fallStartY = null
  } else if (b.onGround) {
    if (player.fallStartY !== null && !wasGrounded) {
      const dist = player.fallStartY - b.pos.y
      if (dist > PLAYER.safeFall) fallDamage = Math.max(1, Math.round(dist - PLAYER.safeFall))
      if (dist > 0.6) {
        const below = world.getBlock(Math.floor(b.pos.x), Math.floor(b.pos.y - 0.05), Math.floor(b.pos.z))
        events.emit('player:footstep', { material: BlockRegistry.defs[below]?.material ?? 'none', position: { ...b.pos } })
      }
    }
    player.fallStartY = null
  } else {
    player.fallStartY = player.fallStartY === null ? b.pos.y : Math.max(player.fallStartY, b.pos.y)
  }
  return fallDamage
}
