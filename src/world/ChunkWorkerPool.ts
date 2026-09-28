import type { WorkerRequest, WorkerResponse } from './WorkerProtocol'
import { WorldGenerator } from './WorldGenerator'
import { buildChunkMesh, type ChunkMeshData } from './TerrainMesher'
import { buildFaceTileTable } from './atlasLayout'

type Pending = { resolve: (r: WorkerResponse) => void; worker: number }

/**
 * Small pool of chunk workers with promise-based requests. Falls back to
 * running jobs on the main thread (one per macrotask) when workers are
 * unavailable, so the game still works — just with more hitching.
 */
export class ChunkWorkerPool {
  private workers: Worker[] = []
  private load: number[] = []
  private pending = new Map<number, Pending>()
  private nextId = 1
  private fallbackGen: WorldGenerator | null = null
  private fallbackTiles: Int16Array | null = null
  genMs = 0
  meshMs = 0

  constructor(size = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1))) {
    try {
      for (let i = 0; i < size; i++) {
        const w = new Worker(new URL('./chunk.worker.ts', import.meta.url), { type: 'module' })
        w.onmessage = (e: MessageEvent<WorkerResponse>) => this.onMessage(e.data)
        w.onerror = (err) => console.error('chunk worker error', err)
        this.workers.push(w)
        this.load.push(0)
      }
    } catch (err) {
      console.warn('Web Workers unavailable, generating on the main thread', err)
      this.workers = []
    }
  }

  get inFlight(): number {
    return this.pending.size
  }

  private onMessage(res: WorkerResponse): void {
    const p = this.pending.get(res.id)
    if (!p) return
    this.pending.delete(res.id)
    this.load[p.worker]--
    if (res.type === 'generated') this.genMs = this.genMs * 0.9 + res.ms * 0.1
    else this.meshMs = this.meshMs * 0.9 + res.ms * 0.1
    p.resolve(res)
  }

  private dispatch(req: WorkerRequest, transfer: Transferable[]): Promise<WorkerResponse> {
    if (this.workers.length === 0) return this.runLocal(req)
    let best = 0
    for (let i = 1; i < this.workers.length; i++) if (this.load[i] < this.load[best]) best = i
    this.load[best]++
    return new Promise((resolve) => {
      this.pending.set(req.id, { resolve, worker: best })
      this.workers[best].postMessage(req, transfer)
    })
  }

  private runLocal(req: WorkerRequest): Promise<WorkerResponse> {
    return new Promise((resolve) =>
      setTimeout(() => {
        if (req.type === 'generate') {
          if (!this.fallbackGen || this.fallbackGen.seed !== req.seed) this.fallbackGen = new WorldGenerator(req.seed)
          resolve({ type: 'generated', id: req.id, blocks: this.fallbackGen.generateChunk(req.cx, req.cz), ms: 0 })
        } else {
          this.fallbackTiles ??= buildFaceTileTable()
          resolve({ type: 'meshed', id: req.id, data: buildChunkMesh(req.padded, this.fallbackTiles), ms: 0 })
        }
      }, 0),
    )
  }

  async generate(seed: number, cx: number, cz: number): Promise<Uint16Array> {
    const res = await this.dispatch({ type: 'generate', id: this.nextId++, seed, cx, cz }, [])
    if (res.type !== 'generated') throw new Error('unexpected worker response')
    return res.blocks
  }

  async mesh(padded: Uint16Array): Promise<ChunkMeshData> {
    const res = await this.dispatch({ type: 'mesh', id: this.nextId++, padded }, [padded.buffer])
    if (res.type !== 'meshed') throw new Error('unexpected worker response')
    return res.data
  }

  dispose(): void {
    for (const w of this.workers) w.terminate()
    this.workers = []
    this.pending.clear()
  }
}
