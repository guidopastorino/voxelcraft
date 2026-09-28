import { describe, expect, it } from 'vitest'
import { breakTime, canHarvest } from '../src/items/Mining'
import { blockDrops } from '../src/items/DropSystem'
import { BlockRegistry } from '../src/world/BlockRegistry'
import { ItemRegistry } from '../src/items/ItemRegistry'

const block = (k: string) => BlockRegistry.byName(k)
const tool = (id: string) => ItemRegistry.get(id).tool

describe('mining', () => {
  it('correct tool is faster than hand', () => {
    expect(breakTime(block('dirt'), tool('wood_shovel'))).toBeLessThan(breakTime(block('dirt'), undefined))
    expect(breakTime(block('log'), tool('wood_axe'))).toBeLessThan(breakTime(block('log'), undefined))
    expect(breakTime(block('stone'), tool('wood_pickaxe'))).toBeLessThan(breakTime(block('stone'), undefined) / 3)
  })

  it('stone tier is faster than wood tier', () => {
    expect(breakTime(block('stone'), tool('stone_pickaxe'))).toBeLessThan(breakTime(block('stone'), tool('wood_pickaxe')))
  })

  it('wrong tool is slower than the correct one', () => {
    expect(breakTime(block('stone'), tool('wood_shovel'))).toBeGreaterThan(breakTime(block('stone'), tool('wood_pickaxe')))
    expect(breakTime(block('dirt'), tool('wood_pickaxe'))).toBeGreaterThan(breakTime(block('dirt'), tool('wood_shovel')))
  })

  it('swords break blocks slower than hands (except leaves)', () => {
    expect(breakTime(block('dirt'), tool('wood_sword'))).toBeGreaterThan(breakTime(block('dirt'), undefined))
    expect(breakTime(block('leaves'), tool('wood_sword'))).toBeLessThan(breakTime(block('leaves'), undefined))
  })

  it('matches the spec’s reference times', () => {
    expect(breakTime(block('dirt'), undefined)).toBeCloseTo(0.7)
    expect(breakTime(block('stone'), undefined)).toBeCloseTo(6)
    expect(breakTime(block('stone'), tool('stone_pickaxe'))).toBeCloseTo(1)
  })

  it('water and bedrock are unbreakable', () => {
    expect(breakTime(block('water'), undefined)).toBe(Infinity)
    expect(breakTime(block('bedrock'), tool('stone_pickaxe'))).toBe(Infinity)
  })

  it('required tool controls drops', () => {
    const rng = () => 0
    expect(canHarvest(block('stone'), undefined)).toBe(false)
    expect(blockDrops(block('stone'), undefined, rng)).toEqual([])
    expect(blockDrops(block('stone'), tool('wood_axe'), rng)).toEqual([])
    expect(blockDrops(block('stone'), tool('wood_pickaxe'), rng)).toEqual([{ itemId: 'stone', count: 1 }])
    expect(blockDrops(block('dirt'), undefined, rng)).toEqual([{ itemId: 'dirt', count: 1 }])
    expect(blockDrops(block('grass'), undefined, rng)).toEqual([{ itemId: 'dirt', count: 1 }])
  })

  it('leaves may drop nothing', () => {
    expect(blockDrops(block('leaves'), undefined, () => 0.99)).toEqual([])
  })
})
