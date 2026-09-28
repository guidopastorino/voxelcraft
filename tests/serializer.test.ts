import { describe, expect, it } from 'vitest'
import { makeSession } from './helpers'
import { restoreSession, serializeSession } from '../src/save/WorldSerializer'
import { B } from '../src/world/BlockRegistry'
import { makeStack } from '../src/items/ItemStack'

describe('world serialization', () => {
  it('round-trips player, inventory and block diffs through JSON', () => {
    const s = makeSession(777)
    const p = s.player
    const { x, y, z } = { x: Math.floor(p.pos.x), y: Math.floor(p.pos.y) - 1, z: Math.floor(p.pos.z) }
    s.world.setBlock(x + 2, y + 1, z, B.PLANKS)
    s.world.setBlock(x - 2, y, z, B.AIR)
    p.inventory.set(4, makeStack('stone', 17))
    p.inventory.set(5, { itemId: 'wood_pickaxe', count: 1, damage: 12 })
    p.stats.health = 13
    p.stats.hunger = 9
    p.yaw = 1.25
    p.hotbar.select(5)

    const json = JSON.stringify(serializeSession(s))
    const r = restoreSession(JSON.parse(json))
    r.loadAround(2)
    expect(r.world.getBlock(x + 2, y + 1, z)).toBe(B.PLANKS)
    expect(r.world.getBlock(x - 2, y, z)).toBe(B.AIR)
    expect(r.player.inventory.get(4)).toEqual({ itemId: 'stone', count: 17 })
    expect(r.player.inventory.get(5)).toEqual({ itemId: 'wood_pickaxe', count: 1, damage: 12 })
    expect(r.player.stats.health).toBe(13)
    expect(r.player.stats.hunger).toBe(9)
    expect(r.player.yaw).toBeCloseTo(1.25)
    expect(r.player.hotbar.selected).toBe(5)
    expect(r.player.pos).toEqual(p.pos)
    expect(r.metadata.seed).toBe(777)
  })

  it('does not duplicate drops on load', () => {
    const s = makeSession(99)
    s.pickups.spawn(makeStack('dirt', 2), { x: s.player.pos.x + 20, y: 80, z: s.player.pos.z })
    const save = serializeSession(s)
    const r = restoreSession(JSON.parse(JSON.stringify(save)))
    expect(r.pickups.items.length).toBe(1)
    const again = restoreSession(JSON.parse(JSON.stringify(serializeSession(r))))
    expect(again.pickups.items.length).toBe(1)
  })

  it('ignores garbage in saves instead of crashing', () => {
    const s = makeSession(5)
    const save = serializeSession(s)
    save.player.inventory.push({ slot: 99, stack: { itemId: 'dirt', count: 1 } }, { slot: 2, stack: { itemId: 'unobtainium', count: 1 } }, { slot: 3, stack: { itemId: 'dirt', count: -4 } })
    save.modifiedChunks.push({ key: 'bad', changes: [1, 2] }, { key: '0,0', changes: [5, 9999, -1, 3] })
    save.player.position = { x: NaN, y: 50, z: 0 }
    const r = restoreSession(save)
    expect(r.player.inventory.get(2)).toBeNull()
    expect(r.player.inventory.get(3)).toBeNull()
    expect(Number.isFinite(r.player.pos.x)).toBe(true)
    expect(r.world.diffs.get('0,0')?.get(5)).toBe(B.AIR)
  })
})
