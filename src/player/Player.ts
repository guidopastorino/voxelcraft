import { makeBody, type PhysicsBody } from '../physics/VoxelPhysics'
import { PLAYER } from '../config/defaults'
import { PlayerStats } from './PlayerStats'
import { Inventory } from '../inventory/Inventory'
import { Hotbar } from '../inventory/Hotbar'
import { CraftingGrid } from '../inventory/CraftingGrid'
import type { Vec3 } from '../core/math'
import { clamp, DEG, directionFromAngles } from '../core/math'

export const PITCH_LIMIT = 89 * DEG

export interface PlayerState {
  position: Vec3
  yaw: number
  pitch: number
  health: number
  hunger: number
  exhaustion: number
  selectedHotbarSlot: number
}

/** The player's persistent state plus transient movement bookkeeping. */
export class Player {
  readonly body: PhysicsBody
  yaw = 0
  pitch = 0
  readonly stats = new PlayerStats()
  readonly inventory = new Inventory()
  readonly hotbar = new Hotbar(this.inventory)
  /** Personal 2×2 crafting grid shown in the inventory screen. */
  readonly craftGrid = new CraftingGrid(2)
  spawnPoint: Vec3

  sprinting = false
  /** Highest Y reached since leaving the ground (for fall damage). */
  fallStartY: number | null = null
  hurtCooldown = 0
  /** Distance walked, drives footsteps and view bobbing. */
  walkDistance = 0
  lastFootstep = 0
  /** Horizontal speed this tick (for bobbing / animations). */
  horizontalSpeed = 0
  debugMode = false

  constructor(spawn: Vec3) {
    this.body = makeBody(spawn, PLAYER.width, PLAYER.height)
    this.spawnPoint = { ...spawn }
  }

  get pos(): Vec3 {
    return this.body.pos
  }

  eyePosition(): Vec3 {
    return { x: this.body.pos.x, y: this.body.pos.y + PLAYER.eyeHeight, z: this.body.pos.z }
  }

  lookDirection(): Vec3 {
    return directionFromAngles(this.yaw, this.pitch)
  }

  /** Mouse look: yaw unbounded (wrapped), pitch clamped to ±89°. */
  look(dYaw: number, dPitch: number): void {
    this.yaw = (this.yaw + dYaw) % (Math.PI * 2)
    this.pitch = clamp(this.pitch + dPitch, -PITCH_LIMIT, PITCH_LIMIT)
  }

  teleport(p: Vec3): void {
    this.body.pos = { ...p }
    this.body.vel = { x: 0, y: 0, z: 0 }
    this.fallStartY = null
  }

  getState(): PlayerState {
    return {
      position: { ...this.body.pos },
      yaw: this.yaw,
      pitch: this.pitch,
      health: this.stats.health,
      hunger: this.stats.hunger,
      exhaustion: this.stats.exhaustion,
      selectedHotbarSlot: this.hotbar.selected,
    }
  }
}
