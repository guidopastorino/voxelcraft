import { describe, expect, it } from 'vitest'
import { PickupManager } from '../src/items/PickupEntity'
import { Inventory } from '../src/inventory/Inventory'
import { makeStack } from '../src/items/ItemStack'
import type { CollisionWorld } from '../src/physics/VoxelPhysics'
import { ITEM_ENTITY } from '../src/config/defaults'

const floor: CollisionWorld = { isSolid: (_x, y) => y < 10, isLiquid: () => false }
const DT = 1 / 60

describe('item pickups', () => {
  it('falls, then is picked up exactly once', () => {
    const pm = new PickupManager()
    const inv = new Inventory()
    let events = 0
    pm.onPicked = () => events++
    pm.spawn(makeStack('dirt', 3), { x: 0.5, y: 12, z: 0.5 }, { x: 0, y: 0, z: 0 })
    const collector = { pos: { x: 1.2, y: 10, z: 0.5 }, canCollect: true, give: (s: ReturnType<typeof makeStack>) => inv.add(s) }
    for (let i = 0; i < 120; i++) pm.update(DT, floor, collector)
    expect(inv.count('dirt')).toBe(3)
    expect(events).toBe(1)
    for (let i = 0; i < 120; i++) pm.update(DT, floor, collector)
    expect(inv.count('dirt')).toBe(3)
    expect(pm.items.length).toBe(0)
  })

  it('respects the pickup delay', () => {
    const pm = new PickupManager()
    const inv = new Inventory()
    pm.spawn(makeStack('dirt', 1), { x: 0.5, y: 10, z: 0.5 }, { x: 0, y: 0, z: 0 })
    const collector = { pos: { x: 0.5, y: 10, z: 0.5 }, canCollect: true, give: (s: ReturnType<typeof makeStack>) => inv.add(s) }
    pm.update(0.1, floor, collector)
    expect(inv.count('dirt')).toBe(0)
    for (let i = 0; i < 30; i++) pm.update(DT, floor, collector)
    expect(inv.count('dirt')).toBe(1)
  })

  it('stays on the ground when the inventory is full', () => {
    const pm = new PickupManager()
    const inv = new Inventory()
    for (let i = 0; i < inv.size; i++) inv.add(makeStack('wood_sword'))
    pm.spawn(makeStack('dirt', 2), { x: 0.5, y: 10, z: 0.5 }, { x: 0, y: 0, z: 0 })
    const collector = { pos: { x: 0.5, y: 10, z: 0.5 }, canCollect: true, give: (s: ReturnType<typeof makeStack>) => inv.add(s) }
    for (let i = 0; i < 120; i++) pm.update(DT, floor, collector)
    expect(pm.items.length).toBe(1)
    expect(pm.items[0].stack.count).toBe(2)
  })

  it('despawns after the timeout', () => {
    const pm = new PickupManager()
    pm.spawn(makeStack('dirt', 1), { x: 0.5, y: 10, z: 0.5 })
    pm.update(ITEM_ENTITY.despawnSeconds + 1, floor, null)
    pm.update(DT, floor, null)
    expect(pm.items.length).toBe(0)
  })

  it('is never spawned inside a solid block', () => {
    const pm = new PickupManager()
    const e = pm.spawn(makeStack('dirt', 1), { x: 0.5, y: 5.2, z: 0.5 }, { x: 0, y: 0, z: 0 }, { isSolid: (_x, y) => y < 6, isLiquid: () => false })
    expect(e.pos.y).toBeGreaterThanOrEqual(6)
  })
})
