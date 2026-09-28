import { describe, expect, it } from 'vitest'
import { blockIndex, chunkKey, chunkToWorld, floorDiv, indexToLocal, mod, parseChunkKey, worldToChunk, worldToLocal } from '../src/world/coords'
import { CHUNK_SIZE } from '../src/world/constants'

describe('chunk coordinates', () => {
  it('handles positive coordinates', () => {
    expect(worldToChunk(0)).toBe(0)
    expect(worldToChunk(15)).toBe(0)
    expect(worldToChunk(16)).toBe(1)
    expect(worldToLocal(17)).toBe(1)
  })

  it('handles negative coordinates with floor division', () => {
    expect(worldToChunk(-1)).toBe(-1)
    expect(worldToLocal(-1)).toBe(15)
    expect(worldToChunk(-16)).toBe(-1)
    expect(worldToLocal(-16)).toBe(0)
    expect(worldToChunk(-17)).toBe(-2)
    expect(worldToLocal(-17)).toBe(15)
  })

  it('handles fractional world positions', () => {
    expect(worldToChunk(-0.5)).toBe(-1)
    expect(worldToLocal(-0.5)).toBe(15)
    expect(worldToLocal(15.999)).toBe(15)
  })

  it('round-trips chunk → world → chunk at boundaries', () => {
    for (const c of [-3, -1, 0, 1, 5]) {
      expect(worldToChunk(chunkToWorld(c))).toBe(c)
      expect(worldToChunk(chunkToWorld(c) + CHUNK_SIZE - 1)).toBe(c)
      expect(worldToChunk(chunkToWorld(c) - 1)).toBe(c - 1)
    }
  })

  it('mod and floorDiv are consistent', () => {
    for (let a = -40; a <= 40; a++) expect(floorDiv(a, 16) * 16 + mod(a, 16)).toBe(a)
  })

  it('block index round-trips', () => {
    for (const [x, y, z] of [[0, 0, 0], [15, 127, 15], [3, 64, 9]]) {
      expect(indexToLocal(blockIndex(x, y, z))).toEqual([x, y, z])
    }
  })

  it('chunk keys parse and reject garbage', () => {
    expect(parseChunkKey(chunkKey(-3, 7))).toEqual([-3, 7])
    expect(() => parseChunkKey('abc')).toThrow()
    expect(() => parseChunkKey('1,x')).toThrow()
  })
})
