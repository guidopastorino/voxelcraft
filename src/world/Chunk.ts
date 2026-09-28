import { CHUNK_HEIGHT, CHUNK_SIZE, CHUNK_VOLUME } from './constants'
import { blockIndex } from './coords'
import { assert } from '../core/assert'

/**
 * Lifecycle: UNLOADED → GENERATING → (MESHING) → READY → VISIBLE → UNLOADED.
 * A chunk with blocks but no mesh yet is READY; once a mesh is attached
 * to the scene it becomes VISIBLE.
 */
export type ChunkState = 'GENERATING' | 'READY' | 'MESHING' | 'VISIBLE'

export class Chunk {
  state: ChunkState = 'READY'
  /** Bumped on every block change; stale async mesh results are discarded. */
  version = 0
  /** Version the current mesh was built from (-1 = no mesh). */
  meshedVersion = -1
  /** Needs a (re)mesh. */
  dirty = true

  constructor(
    readonly cx: number,
    readonly cz: number,
    readonly blocks: Uint16Array,
  ) {
    assert(blocks.length === CHUNK_VOLUME, 'chunk block array has wrong size')
  }

  get(lx: number, y: number, lz: number): number {
    if (y < 0 || y >= CHUNK_HEIGHT) return 0
    return this.blocks[blockIndex(lx, y, lz)]
  }

  set(lx: number, y: number, lz: number, id: number): void {
    assert(lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE, `local coords out of range ${lx},${lz}`)
    this.blocks[blockIndex(lx, y, lz)] = id
    this.version++
    this.dirty = true
  }
}
