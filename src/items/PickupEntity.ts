import { Entity } from '../entities/Entity'
import type { ItemStack } from './ItemStack'
import { cloneStack } from './ItemStack'
import type { Vec3 } from '../core/math'
import { ITEM_ENTITY, PLAYER } from '../config/defaults'
import { overlapsSolid, stepBody, type CollisionWorld } from '../physics/VoxelPhysics'

export interface SerializedPickup {
  itemId: string
  count: number
  damage?: number
  x: number
  y: number
  z: number
  age: number
}

/** A dropped item lying in the world. Pickups never collide with the player. */
export class PickupEntity extends Entity {
  stack: ItemStack
  /** Set once the item has been added to an inventory; it then only animates toward the collector. */
  collected = false
  collectTimer = 0
  readonly spin = Math.random() * Math.PI * 2

  constructor(stack: ItemStack, pos: Vec3, public pickupDelay: number = ITEM_ENTITY.pickupDelay) {
    super(pos, ITEM_ENTITY.size, ITEM_ENTITY.size)
    this.stack = cloneStack(stack)
  }
}

export interface Collector {
  /** Player feet position. */
  pos: Vec3
  /** Inserts a stack, returning what did not fit. */
  give(stack: ItemStack): ItemStack | null
  canCollect: boolean
}

const COLLECT_ANIM = 0.15

/** Owns all item entities: physics, magnet toward the player, pickup and despawn. */
export class PickupManager {
  items: PickupEntity[] = []
  onPicked?: (stack: ItemStack) => void

  spawn(stack: ItemStack, pos: Vec3, vel?: Vec3, world?: CollisionWorld, pickupDelay?: number): PickupEntity {
    const e = new PickupEntity(stack, pos, pickupDelay)
    if (vel) e.body.vel = { ...vel }
    else e.body.vel = { x: (Math.random() - 0.5) * 2, y: 3 + Math.random() * 1.5, z: (Math.random() - 0.5) * 2 }
    // Never start embedded in a solid block.
    if (world) for (let i = 0; i < 4 && overlapsSolid(world, e.body); i++) e.body.pos.y = Math.floor(e.body.pos.y) + 1.01
    this.items.push(e)
    return e
  }

  update(dt: number, world: CollisionWorld, collector: Collector | null): void {
    for (const e of this.items) {
      e.age += dt
      if (e.collected) {
        e.collectTimer += dt
        if (collector) {
          const t = Math.min(1, e.collectTimer / COLLECT_ANIM)
          e.body.pos.x += (collector.pos.x - e.body.pos.x) * t
          e.body.pos.y += (collector.pos.y + 0.8 - e.body.pos.y) * t
          e.body.pos.z += (collector.pos.z - e.body.pos.z) * t
        }
        if (e.collectTimer >= COLLECT_ANIM) e.removed = true
        continue
      }
      if (e.age >= ITEM_ENTITY.despawnSeconds) {
        e.removed = true
        continue
      }
      const b = e.body
      if (collector && collector.canCollect && e.age >= e.pickupDelay) {
        const dx = collector.pos.x - b.pos.x
        const dy = collector.pos.y + PLAYER.height * 0.4 - b.pos.y
        const dz = collector.pos.z - b.pos.z
        const d = Math.hypot(dx, dy, dz)
        if (d < ITEM_ENTITY.pickupRadius) {
          const rest = collector.give(e.stack)
          const pickedCount = e.stack.count - (rest?.count ?? 0)
          if (pickedCount > 0) {
            const picked = cloneStack(e.stack)
            picked.count = pickedCount
            this.onPicked?.(picked)
          }
          if (!rest) {
            e.collected = true
            continue
          }
          e.stack = rest
        } else if (d < ITEM_ENTITY.magnetRadius) {
          // Gentle pull toward the player.
          const pull = 6 / Math.max(d, 0.3)
          b.vel.x += dx * pull * dt
          b.vel.z += dz * pull * dt
        }
      }
      b.vel.y = b.inWater ? Math.min(b.vel.y + 10 * dt, 1) : Math.max(b.vel.y - PLAYER.gravity * dt, -30)
      const drag = Math.exp(-(b.onGround ? 8 : 1) * dt)
      b.vel.x *= drag
      b.vel.z *= drag
      if (Math.abs(b.vel.x) < 1e-4) b.vel.x = 0
      if (Math.abs(b.vel.z) < 1e-4) b.vel.z = 0
      stepBody(world, b, dt)
    }
    if (this.items.some((e) => e.removed)) this.items = this.items.filter((e) => !e.removed)
  }

  serialize(): SerializedPickup[] {
    return this.items
      .filter((e) => !e.collected)
      .map((e) => ({ itemId: e.stack.itemId, count: e.stack.count, damage: e.stack.damage, x: e.pos.x, y: e.pos.y, z: e.pos.z, age: e.age }))
  }

  restore(list: SerializedPickup[]): void {
    this.items = list.map((s) => {
      const stack: ItemStack = { itemId: s.itemId, count: s.count }
      if (s.damage !== undefined) stack.damage = s.damage
      const e = new PickupEntity(stack, { x: s.x, y: s.y, z: s.z }, 0)
      e.age = s.age
      e.body.vel = { x: 0, y: 0, z: 0 }
      return e
    })
  }
}
