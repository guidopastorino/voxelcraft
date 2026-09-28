import { describe, expect, it } from 'vitest'
import { DT, lookAt, makeSession, mineBlock, tick } from './helpers'
import { B, BlockRegistry } from '../src/world/BlockRegistry'
import { restoreSession, serializeSession } from '../src/save/WorldSerializer'
import type { GameSession } from '../src/app/GameSession'
import { Animal } from '../src/entities/Animal'
import { EMPTY_INPUT } from '../src/app/GameSession'
import { CHUNK_SIZE } from '../src/world/constants'

/** Finds a tree trunk with a free standing spot next to it. */
function findTree(s: GameSession) {
  const w = s.world
  const p = s.player.pos
  const r = CHUNK_SIZE * 3
  const found: { x: number; y: number; z: number; sx: number; sz: number; dist: number }[] = []
  for (let x = Math.floor(p.x) - r; x < p.x + r; x++) {
    for (let z = Math.floor(p.z) - r; z < p.z + r; z++) {
      const g = w.generator.terrainHeight(x, z)
      if (w.getBlock(x, g, z) !== B.DIRT || w.getBlock(x, g + 1, z) !== B.LOG) continue
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const sx = x + dx, sz = z + dz
        if (BlockRegistry.solid[w.getBlock(sx, g, sz)] && w.getBlock(sx, g + 1, sz) === B.AIR && w.getBlock(sx, g + 2, sz) === B.AIR) {
          found.push({ x, y: g, z, sx, sz, dist: Math.hypot(x - p.x, z - p.z) })
        }
      }
    }
  }
  found.sort((a, b) => a.dist - b.dist)
  return found[0]
}

function slotOf(s: GameSession, itemId: string): number {
  return s.player.inventory.slots.findIndex((st) => st?.itemId === itemId)
}

function select(s: GameSession, itemId: string): void {
  let i = slotOf(s, itemId)
  expect(i).toBeGreaterThanOrEqual(0)
  if (i >= 9) {
    s.player.inventory.quickMove(i)
    i = slotOf(s, itemId)
  }
  s.player.hotbar.select(i)
}

/** Places single items from the inventory into grid cells using the same click API as the UI. */
function putInGrid(s: GameSession, itemId: string, cells: number[]): void {
  const inv = s.player.inventory
  const grid = s.activeGrid()
  const from = slotOf(s, itemId)
  s.clickSlot(inv, from, 'left', false) // pick up whole stack
  for (const c of cells) s.clickSlot(grid, c, 'right', false) // drop one each
  if (s.cursor) s.clickSlot(inv, from, 'left', false) // put the rest back
  expect(s.cursor).toBeNull()
}

describe('golden path', () => {
  it('spawn → wood → planks → sticks → table → pickaxe → stone → stone tools → food → eat → save → reload', () => {
    const s = makeSession(20260927)
    const inv = s.player.inventory
    expect(inv.isEmpty()).toBe(true)

    // 1–4: find a tree, chop three logs, pick them up
    const tree = findTree(s)
    expect(tree).toBeDefined()
    s.player.teleport({ x: tree.sx + 0.5, y: tree.y + 1, z: tree.sz + 0.5 })
    tick(s, 0.2)
    for (let dy = 1; dy <= 3; dy++) {
      const took = mineBlock(s, tree.x, tree.y + dy, tree.z)
      expect(s.world.getBlock(tree.x, tree.y + dy, tree.z)).toBe(B.AIR)
      expect(took).toBeGreaterThan(2) // bare hands are slow on wood
    }
    tick(s, 2)
    expect(inv.count('log')).toBe(3)

    // 5: logs → planks (2×2 personal grid, shift-click output)
    s.openInventory()
    const logSlot = slotOf(s, 'log')
    s.clickSlot(inv, logSlot, 'left', false)
    s.clickSlot(s.activeGrid(), 0, 'left', false)
    s.takeCraftResult(s.activeGrid(), true)
    expect(inv.count('planks')).toBe(12)
    expect(s.activeGrid().result()).toBeNull()

    // 6: sticks
    putInGrid(s, 'planks', [0, 2])
    s.takeCraftResult(s.activeGrid(), false)
    expect(s.cursor).toEqual({ itemId: 'stick', count: 4 })
    s.clickSlot(inv, inv.slots.findIndex((x) => x === null), 'left', false)
    expect(inv.count('stick')).toBe(4)

    // 7: crafting table
    putInGrid(s, 'planks', [0, 1, 2, 3])
    s.takeCraftResult(s.activeGrid(), true)
    expect(inv.count('crafting_table')).toBe(1)
    expect(inv.count('planks')).toBe(6)
    s.closeContainer()
    expect(s.openContainer).toBeNull()

    // 8: place the crafting table on the ground next to the player
    select(s, 'crafting_table')
    const px = Math.floor(s.player.pos.x), pz = Math.floor(s.player.pos.z)
    const spot = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dz]) => ({ x: px + dx, z: pz + dz }))
      .find((c) => !(c.x === tree.x && c.z === tree.z) && BlockRegistry.solid[s.world.getBlock(c.x, tree.y, c.z)] && s.world.getBlock(c.x, tree.y + 1, c.z) === B.AIR)!
    expect(spot).toBeDefined()
    const gx = spot.x, gz = spot.z, groundY = tree.y
    lookAt(s, gx + 0.5, groundY + 0.98, gz + 0.5)
    tick(s, DT, { use: true, usePressed: true })
    const tablePos = { x: gx, y: groundY + 1, z: gz }
    expect(s.world.getBlock(tablePos.x, tablePos.y, tablePos.z)).toBe(B.CRAFTING_TABLE)
    expect(inv.count('crafting_table')).toBe(0)

    // 9: open the table with RMB and craft a wooden pickaxe (3×3)
    lookAt(s, tablePos.x + 0.5, tablePos.y + 0.5, tablePos.z + 0.5)
    s.player.hotbar.select(8)
    tick(s, DT, { use: true, usePressed: true })
    expect(s.openContainer).toBe('crafting_table')
    putInGrid(s, 'planks', [0, 1, 2])
    putInGrid(s, 'stick', [4, 7])
    expect(s.activeGrid().result()?.itemId).toBe('wood_pickaxe')
    s.takeCraftResult(s.activeGrid(), true)
    expect(inv.count('wood_pickaxe')).toBe(1)
    s.closeContainer()

    // 10: dig down to stone and mine 3 stone with the pickaxe
    select(s, 'wood_pickaxe')
    let stoneMined = 0
    for (let guard = 0; guard < 20 && stoneMined < 3; guard++) {
      const bx = Math.floor(s.player.pos.x), bz = Math.floor(s.player.pos.z)
      const by = Math.floor(s.player.pos.y - 0.01)
      const id = s.world.getBlock(bx, by, bz)
      if (id === B.STONE) {
        const took = mineBlock(s, bx, by, bz)
        expect(took).toBeLessThan(2) // pickaxe: ~1.5 s vs 6 s by hand
        stoneMined++
      } else {
        expect(BlockRegistry.get(id).hardness).toBeLessThan(3)
        mineBlock(s, bx, by, bz)
      }
      tick(s, 1)
    }
    expect(inv.count('stone')).toBe(3)
    const pick = inv.get(slotOf(s, 'wood_pickaxe'))!
    expect(pick.damage).toBeGreaterThan(0)

    // 11: stone pickaxe at the table
    s.requestOpenCraftingTable()
    putInGrid(s, 'stone', [0, 1, 2])
    putInGrid(s, 'stick', [4, 7])
    expect(s.activeGrid().result()?.itemId).toBe('stone_pickaxe')
    s.takeCraftResult(s.activeGrid(), true)
    s.closeContainer()
    expect(inv.count('stone_pickaxe')).toBe(1)

    // 12–13: kill a pig, pick up food
    select(s, 'stone_pickaxe')
    const pig = new Animal('pig', { x: s.player.pos.x, y: s.player.pos.y, z: s.player.pos.z })
    s.entities.animals.push(pig)
    let killed = false
    s.events.on('animal:killed', () => (killed = true))
    for (let i = 0; i < 20 * 60 && !killed; i++) {
      // Keep the fleeing pig in front of the player for the test.
      pig.body.pos = { x: s.player.pos.x + 1.6, y: s.player.pos.y, z: s.player.pos.z }
      lookAt(s, pig.pos.x, pig.pos.y + 0.5, pig.pos.z)
      s.tick(DT, { ...EMPTY_INPUT, attack: true, attackPressed: i % 50 === 0 })
    }
    expect(killed).toBe(true)
    pig.body.pos = { x: s.player.pos.x + 0.5, y: s.player.pos.y, z: s.player.pos.z }
    tick(s, 3)
    expect(inv.count('raw_pork')).toBeGreaterThanOrEqual(1)

    // 14–15: get hungry, then eat
    s.player.stats.addExhaustion(4.5) // e.g. a long sprint
    const hungry = s.player.stats.hunger
    expect(hungry).toBeLessThan(20)
    select(s, 'raw_pork')
    const porkBefore = inv.count('raw_pork')
    tick(s, 1.4, { use: true, usePressed: true })
    expect(s.player.stats.hunger).toBe(Math.min(20, hungry + 3))
    expect(inv.count('raw_pork')).toBe(porkBefore - 1)

    // 17–18: save and reload; the world is exactly as we left it
    const snapshot = {
      pos: { ...s.player.pos },
      hunger: s.player.stats.hunger,
      health: s.player.stats.health,
      counts: ['planks', 'stick', 'stone_pickaxe', 'wood_pickaxe', 'raw_pork', 'dirt'].map((id) => inv.count(id)),
    }
    const save = JSON.parse(JSON.stringify(serializeSession(s)))
    const r = restoreSession(save)
    r.loadAround(3)
    expect(r.player.pos).toEqual(snapshot.pos)
    expect(r.player.stats.hunger).toBe(snapshot.hunger)
    expect(r.player.stats.health).toBe(snapshot.health)
    expect(['planks', 'stick', 'stone_pickaxe', 'wood_pickaxe', 'raw_pork', 'dirt'].map((id) => r.player.inventory.count(id))).toEqual(snapshot.counts)
    expect(r.world.getBlock(tablePos.x, tablePos.y, tablePos.z)).toBe(B.CRAFTING_TABLE)
    expect(r.world.getBlock(tree.x, tree.y + 1, tree.z)).toBe(B.AIR)
  })

  it('stone mined by hand yields nothing', () => {
    const s = makeSession(4242)
    const bx = Math.floor(s.player.pos.x), bz = Math.floor(s.player.pos.z)
    const stoneY = s.world.surfaceY(bx, bz) - 6
    expect(s.world.getBlock(bx, stoneY, bz)).toBe(B.STONE)
    // Expose it: stand in a pit right above.
    for (let y = stoneY + 1; y <= stoneY + 8; y++) s.world.setBlock(bx, y, bz, B.AIR)
    s.player.teleport({ x: bx + 0.5, y: stoneY + 1, z: bz + 0.5 })
    tick(s, 0.2)
    const took = mineBlock(s, bx, stoneY, bz)
    expect(took).toBeGreaterThan(5.5)
    tick(s, 1.5)
    expect(s.player.inventory.count('stone')).toBe(0)
  })

  it('fall damage above 3 blocks, none below', () => {
    const s = makeSession(8)
    const p = s.player
    const base = { ...p.pos }
    tick(s, 0.5)
    p.teleport({ ...base, y: base.y + 2.5 })
    tick(s, 2)
    expect(p.stats.health).toBe(20)
    p.teleport({ ...base, y: base.y + 8 })
    tick(s, 3)
    expect(p.stats.health).toBeLessThan(20)
    expect(p.stats.health).toBeGreaterThan(10)
  })

  it('dies, drops nothing with keepInventory, and respawns', () => {
    const s = makeSession(8)
    s.player.inventory.add({ itemId: 'dirt', count: 5 })
    let died = false
    s.events.on('player:died', () => (died = true))
    s.damagePlayer(100, 'debug')
    expect(died).toBe(true)
    expect(s.dead).toBe(true)
    s.respawn()
    expect(s.dead).toBe(false)
    expect(s.player.stats.health).toBe(20)
    expect(s.player.inventory.count('dirt')).toBe(5)
  })

  it('cannot place a block inside the player', () => {
    const s = makeSession(8)
    s.player.inventory.add({ itemId: 'dirt', count: 5 })
    s.player.hotbar.select(0)
    tick(s, 0.5)
    const p = s.player.pos
    const fx = Math.floor(p.x), fz = Math.floor(p.z), fy = Math.floor(p.y) - 1
    lookAt(s, fx + 0.5, fy + 1, fz + 0.5) // top face of block under our feet
    tick(s, DT, { use: true, usePressed: true })
    expect(s.world.getBlock(fx, fy + 1, fz)).toBe(B.AIR)
    expect(s.player.inventory.count('dirt')).toBe(5)
  })
})
