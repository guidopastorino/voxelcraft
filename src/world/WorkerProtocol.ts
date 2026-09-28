import type { ChunkMeshData } from './TerrainMesher'

export type WorkerRequest =
  | { type: 'generate'; id: number; seed: number; cx: number; cz: number }
  | { type: 'mesh'; id: number; padded: Uint16Array }

export type WorkerResponse =
  | { type: 'generated'; id: number; blocks: Uint16Array; ms: number }
  | { type: 'meshed'; id: number; data: ChunkMeshData; ms: number }
