import { describe, expect, it } from 'vitest'
import { CraftingGrid } from '../src/inventory/CraftingGrid'
import { makeStack } from '../src/items/ItemStack'

function fill(grid: CraftingGrid, rows: string[], key: Record<string, string>, count = 1) {
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== ' ') grid.set(y * grid.side + x, makeStack(key[ch], count))
  }))
}

describe('crafting', () => {
  it('log → 4 planks in any cell', () => {
    const g = new CraftingGrid(2)
    g.set(3, makeStack('log', 1))
    expect(g.result()).toEqual({ itemId: 'planks', count: 4 })
  })

  it('planks stacked vertically → 4 sticks, anywhere in the grid', () => {
    const g = new CraftingGrid(3)
    fill(g, ['  P', '  P'], { P: 'planks' })
    expect(g.result()).toEqual({ itemId: 'stick', count: 4 })
  })

  it('2×2 planks → crafting table', () => {
    const g = new CraftingGrid(2)
    fill(g, ['PP', 'PP'], { P: 'planks' })
    expect(g.result()?.itemId).toBe('crafting_table')
  })

  it('tools need a 3×3 grid', () => {
    const g = new CraftingGrid(3)
    fill(g, ['PPP', ' S ', ' S '], { P: 'planks', S: 'stick' })
    expect(g.result()?.itemId).toBe('wood_pickaxe')
  })

  it('matches mirrored axe and all stone tools', () => {
    const g = new CraftingGrid(3)
    fill(g, ['MM', 'SM', 'S '], { M: 'stone', S: 'stick' })
    expect(g.result()?.itemId).toBe('stone_axe')
    const cases: [string[], string][] = [
      [['MMM', ' S ', ' S '], 'stone_pickaxe'],
      [[' M', ' S', ' S'], 'stone_shovel'],
      [['M', 'M', 'S'], 'stone_sword'],
    ]
    for (const [rows, out] of cases) {
      const grid = new CraftingGrid(3)
      fill(grid, rows, { M: 'stone', S: 'stick' })
      expect(grid.result()?.itemId).toBe(out)
    }
  })

  it('rejects invalid recipes', () => {
    const g = new CraftingGrid(3)
    fill(g, ['PP ', ' S ', ' S '], { P: 'planks', S: 'stick' })
    expect(g.result()).toBeNull()
    const h = new CraftingGrid(2)
    fill(h, ['PD'], { P: 'planks', D: 'dirt' })
    expect(h.result()).toBeNull()
  })

  it('consumes exactly one of each ingredient per craft', () => {
    const g = new CraftingGrid(2)
    g.set(0, makeStack('log', 3))
    const out = g.craft()
    expect(out).toEqual({ itemId: 'planks', count: 4 })
    expect(g.get(0)?.count).toBe(2)
    g.craft()
    g.craft()
    expect(g.get(0)).toBeNull()
    expect(g.craft()).toBeNull()
  })
})
