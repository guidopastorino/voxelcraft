import { Chunk } from './Chunk'
import { CHUNK_HEIGHT, CHUNK_SIZE, SEA_LEVEL } from './constants'
import { blockIndex, chunkKey, worldToChunk, worldToLocal } from './coords'
import { B, BlockRegistry } from './BlockRegistry'
import { WorldGenerator } from './WorldGenerator'
import { assert, assertFinite } from '../core/assert'

/** Sparse record of player-made changes: chunkKey → (block index → block id). */
export type ChunkDiffs = Map<string, Map<number, number>>

/**
 * Owns loaded chunk data and the diff layer on top of procedural terrain.
 * The world is always `generate(seed) + diffs`, which is what gets saved.
 */
export class World {
  readonly generator: WorldGenerator
  readonly chunks = new Map<string, Chunk>()
  readonly diffs: ChunkDiffs = new Map()
  /** Called after any block change with the affected chunk keys (for remeshing). */
  onChunkChanged?: (chunk: Chunk) => void

  constructor(readonly seed: number, diffs?: ChunkDiffs) {
    this.generator = new WorldGenerator(seed)
    if (diffs) for (const [k, v] of diffs) this.diffs.set(k, new Map(v))
  }

  getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(chunkKey(cx, cz))
  }

  hasChunk(cx: number, cz: number): boolean {
    return this.chunks.has(chunkKey(cx, cz))
  }

  /** Inserts freshly generated block data, applying any saved diffs. */
  addChunk(cx: number, cz: number, blocks: Uint16Array): Chunk {
    const key = chunkKey(cx, cz)
    const diff = this.diffs.get(key)
    if (diff) for (const [i, id] of diff) blocks[i] = BlockRegistry.has(id) ? id : B.AIR
    const chunk = new Chunk(cx, cz, blocks)
    this.chunks.set(key, chunk)
    return chunk
  }

  /** Generates a chunk on the calling thread if it is not loaded yet. */
  ensureChunk(cx: number, cz: number): Chunk {
    return this.getChunk(cx, cz) ?? this.addChunk(cx, cz, this.generator.generateChunk(cx, cz))
  }

  removeChunk(cx: number, cz: number): void {
    this.chunks.delete(chunkKey(cx, cz))
  }

  /** Block ID at world coordinates. Unloaded chunks read as air; below the world as bedrock. */
  getBlock(x: number, y: number, z: number): number {
    if (y < 0) return B.BEDROCK
    if (y >= CHUNK_HEIGHT) return B.AIR
    const chunk = this.chunks.get(chunkKey(worldToChunk(x), worldToChunk(z)))
    if (!chunk) return B.AIR
    return chunk.blocks[blockIndex(worldToLocal(x), Math.floor(y), worldToLocal(z))]
  }

  isLoadedAt(x: number, z: number): boolean {
    return this.chunks.has(chunkKey(worldToChunk(x), worldToChunk(z)))
  }

  /** Collision query: unloaded chunks count as solid so nothing falls out of the world while loading. */
  isSolid(x: number, y: number, z: number): boolean {
    if (y < 0) return true
    if (y >= CHUNK_HEIGHT) return false
    if (!this.isLoadedAt(x, z)) return true
    return BlockRegistry.solid[this.getBlock(x, y, z)] === 1
  }

  isLiquid(x: number, y: number, z: number): boolean {
    return BlockRegistry.liquid[this.getBlock(x, y, z)] === 1
  }

  /**
   * Changes a block, records the diff for persistence and marks the chunk
   * (and any neighbour sharing the edited face) for remeshing.
   * Returns false if the target chunk is not loaded or Y is out of range.
   */
  setBlock(x: number, y: number, z: number, id: number): boolean {
    assertFinite(x, 'x')
    assertFinite(y, 'y')
    assertFinite(z, 'z')
    assert(BlockRegistry.has(id), `setBlock: undefined block id ${id}`)
    x = Math.floor(x)
    y = Math.floor(y)
    z = Math.floor(z)
    if (y < 0 || y >= CHUNK_HEIGHT) return false
    const cx = worldToChunk(x)
    const cz = worldToChunk(z)
    const chunk = this.getChunk(cx, cz)
    if (!chunk) return false
    const lx = worldToLocal(x)
    const lz = worldToLocal(z)
    chunk.set(lx, y, lz, id)

    const key = chunkKey(cx, cz)
    let diff = this.diffs.get(key)
    if (!diff) {
      diff = new Map()
      this.diffs.set(key, diff)
    }
    diff.set(blockIndex(lx, y, lz), id)

    this.onChunkChanged?.(chunk)
    // Border edits change the neighbour's visible faces / AO too.
    const touch = (ncx: number, ncz: number) => {
      const n = this.getChunk(ncx, ncz)
      if (n) {
        n.dirty = true
        this.onChunkChanged?.(n)
      }
    }
    if (lx === 0) touch(cx - 1, cz)
    if (lx === CHUNK_SIZE - 1) touch(cx + 1, cz)
    if (lz === 0) touch(cx, cz - 1)
    if (lz === CHUNK_SIZE - 1) touch(cx, cz + 1)
    if (lx === 0 && lz === 0) touch(cx - 1, cz - 1)
    if (lx === 0 && lz === CHUNK_SIZE - 1) touch(cx - 1, cz + 1)
    if (lx === CHUNK_SIZE - 1 && lz === 0) touch(cx + 1, cz - 1)
    if (lx === CHUNK_SIZE - 1 && lz === CHUNK_SIZE - 1) touch(cx + 1, cz + 1)
    return true
  }

  /** Highest non-air, non-liquid block Y in a loaded column, or -1. */
  surfaceY(x: number, z: number): number {
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      const id = this.getBlock(x, y, z)
      if (id !== B.AIR && !BlockRegistry.liquid[id]) return y
    }
    return -1
  }

  /**
   * Safe spawn near the origin: dry grass/sand with two free blocks above
   * (never in deep water, leaves or inside terrain). Loads chunks as needed.
   * Returns feet position.
   */
  findSpawn(): { x: number; y: number; z: number } {
    for (let r = 0; r < 256; r += 2) {
      const steps = Math.max(1, r * 4)
      for (let s = 0; s < steps; s++) {
        const a = (s / steps) * Math.PI * 2
        const x = Math.round(Math.cos(a) * r)
        const z = Math.round(Math.sin(a) * r)
        this.ensureChunk(worldToChunk(x), worldToChunk(z))
        const y = this.surfaceY(x, z)
        if (y <= SEA_LEVEL) continue
        const ground = this.getBlock(x, y, z)
        if (ground !== B.GRASS && ground !== B.SAND && ground !== B.DIRT) continue
        if (this.getBlock(x, y + 1, z) !== B.AIR || this.getBlock(x, y + 2, z) !== B.AIR) continue
        return { x: x + 0.5, y: y + 1, z: z + 0.5 }
      }
    }
    const y = this.surfaceY(0, 0)
    return { x: 0.5, y: Math.max(y, SEA_LEVEL) + 2, z: 0.5 }
  }
}
