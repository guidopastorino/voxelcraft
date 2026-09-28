import { CHUNK_HEIGHT, CHUNK_SIZE } from './constants'
import { blockIndex } from './coords'
import { B } from './BlockRegistry'
import { hash3, hashFloat } from './SeededRandom'
import type { WorldGenerator } from './WorldGenerator'

/**
 * Trees are placed on a jittered grid: each TREE_CELL×TREE_CELL cell holds
 * at most one trunk, positioned away from the cell border, so trunks are
 * never glued together. Everything derives from (seed, cell) so trees that
 * straddle chunk borders are generated identically from both sides.
 */
export const TREE_CELL = 5
/** Max horizontal distance from trunk to a leaf block. */
export const TREE_REACH = 2

export interface TreeSpec {
  x: number
  z: number
  /** Y of the ground block the trunk stands on. */
  groundY: number
  trunkHeight: number
  seed: number
}

export function treeAt(gen: WorldGenerator, gx: number, gz: number): TreeSpec | null {
  const s = gen.seed
  const x = gx * TREE_CELL + 1 + (hash3(s, gx, gz, 11) % (TREE_CELL - 2))
  const z = gz * TREE_CELL + 1 + (hash3(s, gx, gz, 12) % (TREE_CELL - 2))
  const h = gen.terrainHeight(x, z)
  const biome = gen.biomeAt(x, z, h)
  if (hashFloat(s, gx, gz, 13) >= gen.treeChance(biome)) return null
  const trunkHeight = 4 + (hash3(s, gx, gz, 14) % 3) // 4..6
  if (h + trunkHeight + 3 >= CHUNK_HEIGHT) return null
  return { x, z, groundY: h, trunkHeight, seed: hash3(s, gx, gz, 15) }
}

/** Writes the part of `tree` that falls inside the chunk whose origin is (x0, z0). */
export function placeTree(blocks: Uint16Array, x0: number, z0: number, tree: TreeSpec): void {
  const set = (x: number, y: number, z: number, id: number, onlyAir: boolean) => {
    const lx = x - x0
    const lz = z - z0
    if (lx < 0 || lz < 0 || lx >= CHUNK_SIZE || lz >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return
    const i = blockIndex(lx, y, lz)
    if (onlyAir && blocks[i] !== B.AIR) return
    blocks[i] = id
  }

  const top = tree.groundY + tree.trunkHeight // Y of highest log
  // Canopy: two wide layers (5x5 minus random corners) then two narrow ones.
  for (let dy = -2; dy <= 1; dy++) {
    const y = top + dy
    const r = dy <= -1 ? 2 : 1
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const corner = Math.abs(dx) === r && Math.abs(dz) === r
        if (corner) {
          if (dy === 1) continue
          if (hashFloat(tree.seed, dx, dz, dy + 50) < 0.5) continue
        }
        set(tree.x + dx, y, tree.z + dz, B.LEAVES, true)
      }
    }
  }
  // Trunk overwrites leaves; the dirt under it replaces the grass.
  for (let y = tree.groundY + 1; y <= top; y++) set(tree.x, y, tree.z, B.LOG, false)
  set(tree.x, tree.groundY, tree.z, B.DIRT, false)
}
