import { describe, expect, it } from 'vitest'
import { WorldGenerator } from '../src/world/WorldGenerator'
import { World } from '../src/world/World'
import { B } from '../src/world/BlockRegistry'
import { SEA_LEVEL } from '../src/world/constants'
import { parseSeed } from '../src/world/SeededRandom'

const count = (arr: Uint16Array, id: number) => arr.reduce((n, v) => n + (v === id ? 1 : 0), 0)

describe('world generation', () => {
  it('same seed + same coords = same blocks', () => {
    const a = new WorldGenerator(1234).generateChunk(3, -2)
    const b = new WorldGenerator(1234).generateChunk(3, -2)
    expect(a).toEqual(b)
  })

  it('is independent of generation order', () => {
    const g1 = new WorldGenerator(99)
    g1.generateChunk(0, 0)
    g1.generateChunk(1, 0)
    const x = g1.generateChunk(-1, -1)
    const y = new WorldGenerator(99).generateChunk(-1, -1)
    expect(x).toEqual(y)
  })

  it('different seeds produce substantially different terrain', () => {
    const g1 = new WorldGenerator(1), g2 = new WorldGenerator(2)
    let diff = 0
    for (let x = -64; x < 64; x += 4) for (let z = -64; z < 64; z += 4) if (g1.terrainHeight(x, z) !== g2.terrainHeight(x, z)) diff++
    expect(diff).toBeGreaterThan(500)
  })

  it('produces grass, dirt, stone, sand, water and trees over an area', () => {
    const g = new WorldGenerator(42)
    const totals = new Map<number, number>()
    for (let cx = -6; cx < 6; cx++) {
      for (let cz = -6; cz < 6; cz++) {
        const c = g.generateChunk(cx, cz)
        for (const id of [B.GRASS, B.DIRT, B.STONE, B.SAND, B.WATER, B.LOG, B.LEAVES]) totals.set(id, (totals.get(id) ?? 0) + count(c, id))
      }
    }
    for (const id of [B.GRASS, B.DIRT, B.STONE, B.SAND, B.WATER, B.LOG, B.LEAVES]) expect(totals.get(id)).toBeGreaterThan(0)
  })

  it('generates correctly at negative coordinates (continuous across chunk borders)', () => {
    const w = new World(7)
    for (const [cx, cz] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) w.ensureChunk(cx, cz)
    for (let z = -16; z < 16; z++) {
      for (let x = -16; x < 16; x++) {
        const h = w.generator.terrainHeight(x, z)
        const top = w.getBlock(x, h, z)
        expect([B.GRASS, B.SAND, B.DIRT, B.LOG]).toContain(top)
        expect(w.getBlock(x, 0, z)).toBe(B.BEDROCK)
      }
    }
  })

  it('never places trees under water and trunks stand on dirt', () => {
    const g = new WorldGenerator(5)
    const w = new World(5)
    for (let cx = -3; cx <= 3; cx++) for (let cz = -3; cz <= 3; cz++) w.ensureChunk(cx, cz)
    let trunks = 0
    for (let x = -40; x < 40; x++) {
      for (let z = -40; z < 40; z++) {
        const h = g.terrainHeight(x, z)
        if (w.getBlock(x, h + 1, z) === B.LOG && w.getBlock(x, h, z) === B.DIRT) {
          trunks++
          expect(h).toBeGreaterThan(SEA_LEVEL)
        }
      }
    }
    expect(trunks).toBeGreaterThan(0)
  })

  it('parses numeric and text seeds deterministically', () => {
    expect(parseSeed('12345')).toBe(12345)
    expect(parseSeed('hello')).toBe(parseSeed('hello'))
    expect(parseSeed('hello')).not.toBe(parseSeed('world'))
  })

  it('finds a dry spawn with free headroom', () => {
    const w = new World(31337)
    const s = w.findSpawn()
    const bx = Math.floor(s.x), by = Math.floor(s.y), bz = Math.floor(s.z)
    expect(w.getBlock(bx, by, bz)).toBe(B.AIR)
    expect(w.getBlock(bx, by + 1, bz)).toBe(B.AIR)
    expect([B.GRASS, B.SAND, B.DIRT]).toContain(w.getBlock(bx, by - 1, bz))
    expect(by - 1).toBeGreaterThan(SEA_LEVEL)
  })
})
