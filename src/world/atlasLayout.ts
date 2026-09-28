import { BlockRegistry } from './BlockRegistry'

/**
 * Tile order inside terrain atlas. Pure data (no canvas) so the mesher —
 * which also runs in a Web Worker and in tests — can compute UVs.
 */
export const ATLAS_TILES = [
  'grass_top',
  'grass_side',
  'dirt',
  'stone',
  'sand',
  'wood_side',
  'wood_top',
  'leaves',
  'planks',
  'water',
  'crafting_table_top',
  'crafting_table_side',
  'bedrock',
] as const

export type AtlasTile = (typeof ATLAS_TILES)[number]

export const TILE_PX = 16
export const ATLAS_COLS = 8
export const ATLAS_ROWS = 8

export const tileIndex = (name: string): number => {
  const i = (ATLAS_TILES as readonly string[]).indexOf(name)
  if (i < 0) throw new Error(`unknown atlas tile ${name}`)
  return i
}

/** Face order used everywhere: +X, -X, +Y, -Y, +Z, -Z. */
export const FACE_PX = 0, FACE_NX = 1, FACE_PY = 2, FACE_NY = 3, FACE_PZ = 4, FACE_NZ = 5

/** Flat table [blockId * 6 + face] → atlas tile index (-1 = none). */
export function buildFaceTileTable(): Int16Array {
  const table = new Int16Array(BlockRegistry.defs.length * 6).fill(-1)
  for (const def of BlockRegistry.defs) {
    if (!def) continue
    const t = def.textures
    const side = t.side ?? t.all
    const top = t.top ?? t.all ?? side
    const bottom = t.bottom ?? t.all ?? side
    const faces = [side, side, top, bottom, side, side]
    faces.forEach((name, f) => {
      if (name) table[def.id * 6 + f] = tileIndex(name)
    })
  }
  return table
}

/** UV rectangle [u0, v0, u1, v1] of a tile, inset slightly to avoid bleeding. */
export function tileUV(index: number): [number, number, number, number] {
  const col = index % ATLAS_COLS
  const row = Math.floor(index / ATLAS_COLS)
  const inset = 0.02 / ATLAS_COLS
  const u0 = col / ATLAS_COLS + inset
  const u1 = (col + 1) / ATLAS_COLS - inset
  // Canvas row 0 is the top of the image; flipY textures put it at v = 1.
  const v1 = 1 - row / ATLAS_ROWS - inset
  const v0 = 1 - (row + 1) / ATLAS_ROWS + inset
  return [u0, v0, u1, v1]
}
