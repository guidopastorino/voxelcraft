import type { GameSession } from '../app/GameSession'
import { PLAYER, SURVIVAL } from '../config/defaults'
import { raycastVoxels, type RayHit } from '../world/Raycast'
import { raycastEntities } from '../combat/AttackSystem'
import { damageAnimal } from '../combat/DamageSystem'
import { B, BlockRegistry } from '../world/BlockRegistry'
import { ItemRegistry } from '../items/ItemRegistry'
import { breakTime, toolWearOnAttack, toolWearOnBreak } from '../items/Mining'
import { blockDrops } from '../items/DropSystem'
import { HAND, type ToolDefinition } from '../items/ToolDefinition'
import type { Animal } from '../entities/Animal'
import { WORLD_MAX_Y, WORLD_MIN_Y } from '../world/constants'

export interface InteractInput {
  attack: boolean
  use: boolean
  attackPressed: boolean
  usePressed: boolean
}

export interface MiningState {
  x: number
  y: number
  z: number
  blockId: number
  elapsed: number
  requiredTime: number
  /** 0..1 */
  progress: number
}

export type Target =
  | { kind: 'block'; hit: RayHit }
  | { kind: 'entity'; animal: Animal; distance: number }
  | null

const HIT_SOUND_INTERVAL = 0.24
const PLACE_REPEAT = 0.22
const BREAK_DELAY = 0.12

/**
 * Everything the player does to the world with the mouse: targeting,
 * mining (with progress and cracks), attacking, placing, eating and
 * opening the crafting table.
 */
export class PlayerInteraction {
  target: Target = null
  mining: MiningState | null = null
  attackCooldown = 0
  eatTimer = 0
  private eatingSlot = -1
  private hitSoundTimer = 0
  private placeTimer = 0
  private breakDelay = 0
  private eatSoundTimer = 0

  constructor(private s: GameSession) {}

  private heldTool(): ToolDefinition | undefined {
    const stack = this.s.player.hotbar.stack
    return stack ? ItemRegistry.get(stack.itemId).tool : undefined
  }

  cancel(): void {
    this.mining = null
    this.eatTimer = 0
    this.eatingSlot = -1
  }

  get isEating(): boolean {
    return this.eatTimer > 0
  }

  updateTarget(): void {
    const p = this.s.player
    const eye = p.eyePosition()
    const dir = p.lookDirection()
    const world = this.s.world
    const hit = raycastVoxels(
      (x, y, z) => world.getBlock(x, y, z),
      eye,
      dir,
      PLAYER.maxReach,
      (id) => id !== B.AIR && !BlockRegistry.liquid[id],
    )
    const ent = raycastEntities(eye, dir, this.s.entities.animals, PLAYER.attackReach)
    if (ent && (!hit || ent.distance < hit.distance)) this.target = { kind: 'entity', animal: ent.entity, distance: ent.distance }
    else this.target = hit ? { kind: 'block', hit } : null
  }

  update(input: InteractInput, dt: number): void {
    const s = this.s
    this.attackCooldown = Math.max(0, this.attackCooldown - dt)
    this.placeTimer = Math.max(0, this.placeTimer - dt)
    this.breakDelay = Math.max(0, this.breakDelay - dt)
    this.updateTarget()
    const t = this.target

    // ---- Attack / mine (LMB) ----
    if (input.attack && !this.isEating) {
      if (t?.kind === 'entity') {
        this.mining = null
        if (input.attackPressed || this.attackCooldown === 0) this.attack(t.animal)
      } else if (t?.kind === 'block') {
        this.mine(t.hit, dt)
      } else {
        this.mining = null
        if (input.attackPressed) s.events.emit('player:swing', {})
      }
    } else {
      this.mining = null
    }

    // ---- Use (RMB) ----
    const stack = s.player.hotbar.stack
    const item = stack ? ItemRegistry.get(stack.itemId) : undefined

    if (input.use && item?.food && (this.isEating || s.player.stats.canEat)) {
      if (this.eatingSlot !== s.player.hotbar.selected) {
        this.eatTimer = 0
        this.eatingSlot = s.player.hotbar.selected
      }
      this.mining = null
      this.eatTimer += dt
      this.eatSoundTimer -= dt
      if (this.eatSoundTimer <= 0) {
        this.eatSoundTimer = 0.22
        s.events.emit('player:eating', {})
      }
      if (this.eatTimer >= item.food.eatTime) {
        s.player.stats.eat(item.food.hunger)
        s.player.inventory.takeFrom(s.player.hotbar.selected, 1)
        s.events.emit('player:ate', { itemId: item.id })
        this.eatTimer = 0
        this.eatingSlot = -1
      }
      return
    }
    this.eatTimer = 0
    this.eatingSlot = -1

    if (!input.use) return
    const clicked = input.usePressed
    if (t?.kind === 'block') {
      const def = BlockRegistry.get(t.hit.blockId)
      if (clicked && def.interaction === 'crafting_table') {
        s.requestOpenCraftingTable()
        return
      }
      if (item?.blockId !== undefined && (clicked || this.placeTimer === 0)) {
        if (this.place(t.hit, item.blockId)) this.placeTimer = PLACE_REPEAT
      }
    }
  }

  private attack(animal: Animal): void {
    const s = this.s
    const tool = this.heldTool()
    const damage = tool?.damage ?? HAND.damage
    const cooldown = tool?.attackCooldown ?? HAND.attackCooldown
    this.attackCooldown = cooldown
    s.events.emit('player:swing', {})
    s.player.stats.addExhaustion(SURVIVAL.exhaustion.attack)
    const died = damageAnimal(animal, damage, s.player.pos, s.rng)
    s.events.emit('animal:hurt', { kind: animal.kind, position: { ...animal.pos } })
    if (died) s.events.emit('animal:killed', { kind: animal.kind, position: { ...animal.pos } })
    this.wearTool(toolWearOnAttack(tool))
  }

  private mine(hit: RayHit, dt: number): void {
    const s = this.s
    const m = this.mining
    if (!m || m.x !== hit.x || m.y !== hit.y || m.z !== hit.z || m.blockId !== hit.blockId) {
      if (this.breakDelay > 0) return
      const def = BlockRegistry.get(hit.blockId)
      const required = s.player.debugMode ? 0 : breakTime(def, this.heldTool())
      this.mining = { x: hit.x, y: hit.y, z: hit.z, blockId: hit.blockId, elapsed: 0, requiredTime: required, progress: 0 }
      this.hitSoundTimer = 0
    }
    const cur = this.mining!
    if (!Number.isFinite(cur.requiredTime)) {
      cur.progress = 0
      return
    }
    cur.elapsed += dt
    cur.progress = cur.requiredTime <= 0 ? 1 : Math.min(1, cur.elapsed / cur.requiredTime)
    this.hitSoundTimer -= dt
    if (this.hitSoundTimer <= 0) {
      this.hitSoundTimer = HIT_SOUND_INTERVAL
      s.events.emit('block:hit', { x: cur.x, y: cur.y, z: cur.z, blockId: cur.blockId })
      s.events.emit('player:swing', {})
    }
    if (cur.progress >= 1) {
      this.breakBlock(cur.x, cur.y, cur.z)
      this.mining = null
      this.breakDelay = s.player.debugMode ? 0.15 : BREAK_DELAY
    }
  }

  /** Removes a block and spawns its drops according to the held tool. */
  breakBlock(x: number, y: number, z: number): void {
    const s = this.s
    const id = s.world.getBlock(x, y, z)
    if (id === B.AIR) return
    const def = BlockRegistry.get(id)
    const tool = this.heldTool()
    // Blocks next to water become water instead of air so seas do not get holes.
    const waterNeighbour = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]].some(
      ([dx, dy, dz]) => s.world.getBlock(x + dx, y + dy, z + dz) === B.WATER,
    )
    s.world.setBlock(x, y, z, waterNeighbour ? B.WATER : B.AIR)
    s.events.emit('block:broken', { x, y, z, blockId: id })
    for (const drop of blockDrops(def, tool, s.rng)) {
      s.pickups.spawn(drop, { x: x + 0.5 + (s.rng() - 0.5) * 0.3, y: y + 0.3, z: z + 0.5 + (s.rng() - 0.5) * 0.3 }, undefined, s.world)
    }
    s.player.stats.addExhaustion(SURVIVAL.exhaustion.mine)
    this.wearTool(toolWearOnBreak(def, tool))
  }

  private wearTool(amount: number): void {
    if (amount <= 0) return
    const p = this.s.player
    const slot = p.hotbar.selected
    const stack = p.inventory.get(slot)
    if (!stack) return
    const tool = ItemRegistry.get(stack.itemId).tool
    if (!tool) return
    stack.damage = (stack.damage ?? 0) + amount
    if (stack.damage >= tool.durability) {
      p.inventory.set(slot, null)
      this.s.events.emit('tool:broken', { itemId: stack.itemId })
    } else {
      p.inventory.touch()
    }
  }

  /** Places `blockId` against the hit face. Returns true on success. */
  place(hit: RayHit, blockId: number): boolean {
    const s = this.s
    const x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz
    if (y < WORLD_MIN_Y || y > WORLD_MAX_Y) return false
    if (!s.world.isLoadedAt(x, z)) return false
    const existing = s.world.getBlock(x, y, z)
    if (existing !== B.AIR && !BlockRegistry.liquid[existing]) return false
    const eye = s.player.eyePosition()
    if (Math.hypot(x + 0.5 - eye.x, y + 0.5 - eye.y, z + 0.5 - eye.z) > PLAYER.maxReach + 1) return false
    if (BlockRegistry.solid[blockId]) {
      const cellMin = { x, y, z }, cellMax = { x: x + 1, y: y + 1, z: z + 1 }
      const intersects = (min: { x: number; y: number; z: number }, max: { x: number; y: number; z: number }) =>
        min.x < cellMax.x && max.x > cellMin.x && min.y < cellMax.y && max.y > cellMin.y && min.z < cellMax.z && max.z > cellMin.z
      const b = s.player.body
      const pMin = { x: b.pos.x - b.halfWidth, y: b.pos.y, z: b.pos.z - b.halfWidth }
      const pMax = { x: b.pos.x + b.halfWidth, y: b.pos.y + b.height, z: b.pos.z + b.halfWidth }
      if (intersects(pMin, pMax)) return false
      for (const a of s.entities.animals) if (intersects(a.aabbMin(), a.aabbMax())) return false
    }
    const slot = s.player.hotbar.selected
    const stack = s.player.inventory.get(slot)
    if (!stack || stack.count <= 0) return false
    s.world.setBlock(x, y, z, blockId)
    s.player.inventory.takeFrom(slot, 1)
    s.events.emit('block:placed', { x, y, z, blockId })
    s.events.emit('player:swing', {})
    return true
  }
}
