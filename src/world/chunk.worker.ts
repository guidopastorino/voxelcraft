/// <reference lib="webworker" />
import { WorldGenerator } from './WorldGenerator'
import { buildChunkMesh, type ChunkMeshData } from './TerrainMesher'
import { buildFaceTileTable } from './atlasLayout'
import type { WorkerRequest, WorkerResponse } from './WorkerProtocol'

/**
 * Off-main-thread terrain generation and meshing. Both are pure functions
 * of their inputs, so results are identical to the synchronous fallback.
 */
let generator: WorldGenerator | null = null
const faceTiles = buildFaceTileTable()

const meshBuffers = (m: ChunkMeshData): Transferable[] =>
  [m.opaque, m.water].flatMap((d) => [d.positions.buffer, d.normals.buffer, d.uvs.buffer, d.colors.buffer, d.indices.buffer])

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data
  if (msg.type === 'generate') {
    if (!generator || generator.seed !== msg.seed) generator = new WorldGenerator(msg.seed)
    const t0 = performance.now()
    const blocks = generator.generateChunk(msg.cx, msg.cz)
    const res: WorkerResponse = { type: 'generated', id: msg.id, blocks, ms: performance.now() - t0 }
    ;(self as unknown as Worker).postMessage(res, [blocks.buffer])
  } else if (msg.type === 'mesh') {
    const t0 = performance.now()
    const data = buildChunkMesh(msg.padded, faceTiles)
    const res: WorkerResponse = { type: 'meshed', id: msg.id, data, ms: performance.now() - t0 }
    ;(self as unknown as Worker).postMessage(res, meshBuffers(data))
  }
}
