import type { World } from './World'
import { chunkKey, parseChunkKey, worldToChunk } from './coords'
import type { ChunkWorkerPool } from './ChunkWorkerPool'

export interface ChunkHooks {
  onLoaded(cx: number, cz: number): void
  onUnloaded(cx: number, cz: number): void
}

/**
 * Streams chunk *data* around the player: requests generation (async, in
 * workers) nearest-first, and unloads chunks that fall out of range with
 * some hysteresis to avoid thrashing at borders. Meshing is the
 * renderer's job (ChunkRenderer).
 */
export class ChunkManager {
  radius = 5
  maxInFlight = 8
  private pending = new Set<string>()
  private announced = new Set<string>()
  private disposed = false
  /** Chunks needed around the player at the last update (for loading progress). */
  private needed = 0
  private loadedNeeded = 0

  constructor(
    private world: World,
    private pool: ChunkWorkerPool,
    private hooks: ChunkHooks,
  ) {}

  get pendingCount(): number {
    return this.pending.size
  }

  /** Fraction (0..1) of chunks within `r` of (x, z) that are loaded. */
  progressAround(x: number, z: number, r: number): number {
    const cx = worldToChunk(x), cz = worldToChunk(z)
    let have = 0, total = 0
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      total++
      if (this.world.hasChunk(cx + dx, cz + dz)) have++
    }
    return have / total
  }

  update(x: number, z: number): void {
    if (this.disposed) return
    const pcx = worldToChunk(x), pcz = worldToChunk(z)
    // Data radius is one larger than the view so edge chunks can be meshed.
    const r = this.radius + 1

    // Announce chunks that were generated synchronously elsewhere (spawn search).
    for (const key of this.world.chunks.keys()) {
      if (!this.announced.has(key)) {
        this.announced.add(key)
        const [cx, cz] = parseChunkKey(key)
        this.hooks.onLoaded(cx, cz)
      }
    }

    const wanted: [number, number, number][] = []
    this.needed = 0
    this.loadedNeeded = 0
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const d = dx * dx + dz * dz
        if (d > (r + 0.5) * (r + 0.5)) continue
        this.needed++
        const cx = pcx + dx, cz = pcz + dz
        if (this.world.hasChunk(cx, cz)) {
          this.loadedNeeded++
          continue
        }
        if (!this.pending.has(chunkKey(cx, cz))) wanted.push([cx, cz, d])
      }
    }
    wanted.sort((a, b) => a[2] - b[2])
    for (const [cx, cz] of wanted) {
      if (this.pending.size >= this.maxInFlight) break
      this.request(cx, cz)
    }

    // Unload with hysteresis.
    const keep = r + 2
    for (const chunk of [...this.world.chunks.values()]) {
      const dx = chunk.cx - pcx, dz = chunk.cz - pcz
      if (dx * dx + dz * dz > keep * keep) {
        this.world.removeChunk(chunk.cx, chunk.cz)
        this.announced.delete(chunkKey(chunk.cx, chunk.cz))
        this.hooks.onUnloaded(chunk.cx, chunk.cz)
      }
    }
  }

  private request(cx: number, cz: number): void {
    const key = chunkKey(cx, cz)
    this.pending.add(key)
    this.pool
      .generate(this.world.seed, cx, cz)
      .then((blocks) => {
        this.pending.delete(key)
        if (this.disposed || this.world.hasChunk(cx, cz)) return
        this.world.addChunk(cx, cz, blocks)
        this.announced.add(key)
        this.hooks.onLoaded(cx, cz)
      })
      .catch((err) => {
        this.pending.delete(key)
        console.error('chunk generation failed', cx, cz, err)
      })
  }

  get stats() {
    return { loaded: this.world.chunks.size, pending: this.pending.size, needed: this.needed, ready: this.loadedNeeded }
  }

  dispose(): void {
    this.disposed = true
    this.pending.clear()
  }
}
