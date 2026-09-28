import { CHUNK_HEIGHT, CHUNK_SIZE } from './constants'

/**
 * Coordinate helpers. X = east/west, Y = height, Z = north/south.
 * All divisions are floor divisions so negative coordinates map correctly
 * (-1 → chunk -1, local 15), which a naive `%` would get wrong.
 */

export const floorDiv = (a: number, b: number): number => Math.floor(a / b)

/** Always-positive modulo. */
export const mod = (a: number, b: number): number => ((a % b) + b) % b

export const worldToChunk = (w: number): number => floorDiv(Math.floor(w), CHUNK_SIZE)

export const worldToLocal = (w: number): number => mod(Math.floor(w), CHUNK_SIZE)

export const chunkToWorld = (c: number): number => c * CHUNK_SIZE

export const chunkKey = (cx: number, cz: number): string => `${cx},${cz}`

export function parseChunkKey(key: string): [number, number] {
  const parts = key.split(',')
  if (parts.length !== 2) throw new Error(`invalid chunk key "${key}"`)
  const cx = Number(parts[0])
  const cz = Number(parts[1])
  if (!Number.isInteger(cx) || !Number.isInteger(cz)) throw new Error(`invalid chunk key "${key}"`)
  return [cx, cz]
}

/** Index into a chunk's block array. Layout: y-major, then z, then x (x fastest). */
export const blockIndex = (lx: number, y: number, lz: number): number => (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx

export function indexToLocal(i: number): [number, number, number] {
  const lx = i % CHUNK_SIZE
  const lz = Math.floor(i / CHUNK_SIZE) % CHUNK_SIZE
  const y = Math.floor(i / (CHUNK_SIZE * CHUNK_SIZE))
  return [lx, y, lz]
}

export const inHeight = (y: number): boolean => y >= 0 && y < CHUNK_HEIGHT
