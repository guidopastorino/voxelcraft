import { describe, expect, it } from 'vitest'
import { Inventory, INVENTORY_SIZE } from '../src/inventory/Inventory'
import { leftClick, rightClick } from '../src/inventory/SlotActions'
import { makeStack } from '../src/items/ItemStack'
import { Hotbar } from '../src/inventory/Hotbar'

describe('inventory', () => {
  it('has 36 slots', () => {
    expect(new Inventory().size).toBe(INVENTORY_SIZE)
    expect(INVENTORY_SIZE).toBe(36)
  })

  it('merges stacks up to 64', () => {
    const inv = new Inventory()
    inv.add(makeStack('dirt', 40))
    inv.add(makeStack('dirt', 40))
    expect(inv.get(0)).toEqual({ itemId: 'dirt', count: 64 })
    expect(inv.get(1)).toEqual({ itemId: 'dirt', count: 16 })
    expect(inv.count('dirt')).toBe(80)
  })

  it('tools do not stack', () => {
    const inv = new Inventory()
    inv.add(makeStack('wood_pickaxe'))
    inv.add(makeStack('wood_pickaxe'))
    expect(inv.get(0)?.count).toBe(1)
    expect(inv.get(1)?.count).toBe(1)
  })

  it('returns the remainder when full', () => {
    const inv = new Inventory()
    for (let i = 0; i < INVENTORY_SIZE; i++) inv.add(makeStack('wood_axe'))
    const rest = inv.add(makeStack('dirt', 5))
    expect(rest).toEqual({ itemId: 'dirt', count: 5 })
    expect(inv.spaceFor(makeStack('dirt', 1))).toBe(0)
  })

  it('partially fills when only some space remains', () => {
    const inv = new Inventory()
    for (let i = 0; i < INVENTORY_SIZE - 1; i++) inv.add(makeStack('wood_axe'))
    inv.add(makeStack('dirt', 60))
    const rest = inv.add(makeStack('dirt', 10))
    expect(rest?.count).toBe(6)
    expect(inv.count('dirt')).toBe(64)
  })

  it('splits stacks with right click (half rounded up)', () => {
    const r = rightClick({ itemId: 'dirt', count: 7 }, null)
    expect(r.cursor?.count).toBe(4)
    expect(r.slot?.count).toBe(3)
  })

  it('right click with cursor places one item', () => {
    const r = rightClick(null, { itemId: 'dirt', count: 3 })
    expect(r.slot?.count).toBe(1)
    expect(r.cursor?.count).toBe(2)
  })

  it('left click swaps different items and merges same items', () => {
    const swap = leftClick({ itemId: 'dirt', count: 3 }, { itemId: 'sand', count: 2 })
    expect(swap.slot?.itemId).toBe('sand')
    expect(swap.cursor?.itemId).toBe('dirt')
    const merge = leftClick({ itemId: 'dirt', count: 60 }, { itemId: 'dirt', count: 10 })
    expect(merge.slot?.count).toBe(64)
    expect(merge.cursor?.count).toBe(6)
  })

  it('quick-moves between hotbar and main inventory', () => {
    const inv = new Inventory()
    inv.set(0, makeStack('dirt', 10))
    inv.quickMove(0)
    expect(inv.get(0)).toBeNull()
    expect(inv.get(9)?.count).toBe(10)
    inv.quickMove(9)
    expect(inv.get(0)?.count).toBe(10)
  })

  it('takeFrom never produces negative counts', () => {
    const inv = new Inventory()
    inv.set(3, makeStack('dirt', 2))
    expect(inv.takeFrom(3, 5)?.count).toBe(2)
    expect(inv.get(3)).toBeNull()
    expect(inv.takeFrom(3, 1)).toBeNull()
  })

  it('rejects invalid stacks', () => {
    const inv = new Inventory()
    expect(() => inv.set(0, { itemId: 'dirt', count: 0 })).toThrow()
    expect(() => inv.set(0, { itemId: 'dirt', count: 65 })).toThrow()
    expect(() => inv.set(0, { itemId: 'nope', count: 1 })).toThrow()
  })

  it('hotbar selection wraps with scroll', () => {
    const h = new Hotbar(new Inventory())
    h.scroll(-1)
    expect(h.selected).toBe(8)
    h.scroll(1)
    expect(h.selected).toBe(0)
  })
})
