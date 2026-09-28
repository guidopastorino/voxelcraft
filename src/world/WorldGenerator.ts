import { SimplexNoise } from './Noise'
import { hash3, hashFloat } from './SeededRandom'
import { BASE_HEIGHT, CHUNK_HEIGHT, CHUNK_SIZE, CHUNK_VOLUME, SEA_LEVEL } from './constants'
import { blockIndex } from './coords'
import { B } from './BlockRegistry'
import { placeTree, treeAt, TREE_CELL, TREE_REACH } from './TreeGenerator'

export type Biome = 'plains' | 'forest' | 'beach' | 'ocean'

/**
 * Pure, deterministic terrain generator. Given a seed, `generateChunk`
 * always returns identical block data for the same chunk coordinates, no
 * matter which chunks were generated before (features that cross chunk
 * borders — trees — are derived from world coordinates, not from
 * neighbouring chunk data).
 */
export class WorldGenerator {
  private height: SimplexNoise
  private detail: SimplexNoise
  private continent: SimplexNoise
  private forest: SimplexNoise
  private sandNoise: SimplexNoise

  constructor(readonly seed: number) {
    this.height = new SimplexNoise(hash3(seed, 1, 0))
    this.detail = new SimplexNoise(hash3(seed, 2, 0))
    this.continent = new SimplexNoise(hash3(seed, 3, 0))
    this.forest = new SimplexNoise(hash3(seed, 4, 0))
    this.sandNoise = new SimplexNoise(hash3(seed, 5, 0))
  }

  /** Y of the top solid block of the natural terrain column. */
  terrainHeight(x: number, z: number): number {
    const continent = this.continent.fbm(x * 0.0022, z * 0.0022, 2) * 9
    const hills = this.height.fbm(x * 0.008, z * 0.008, 3) * 14
    const detail = this.detail.noise2(x * 0.025, z * 0.025) * 4
    // Flatten valleys a little so plains read as plains.
    let h = BASE_HEIGHT + continent + hills + detail
    if (h > BASE_HEIGHT) h = BASE_HEIGHT + (h - BASE_HEIGHT) * 1.15
    return Math.max(4, Math.min(CHUNK_HEIGHT - 20, Math.floor(h)))
  }

  biomeAt(x: number, z: number, h = this.terrainHeight(x, z)): Biome {
    if (h < SEA_LEVEL - 1) return 'ocean'
    if (h <= SEA_LEVEL + 1) return 'beach'
    return this.forest.fbm(x * 0.005, z * 0.005, 2) > 0.12 ? 'forest' : 'plains'
  }

  /** Tree probability per tree cell in each biome. */
  treeChance(biome: Biome): number {
    return biome === 'forest' ? 0.62 : biome === 'plains' ? 0.05 : 0
  }

  generateChunk(cx: number, cz: number): Uint16Array {
    const blocks = new Uint16Array(CHUNK_VOLUME)
    const x0 = cx * CHUNK_SIZE
    const z0 = cz * CHUNK_SIZE
    const seed = this.seed

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const x = x0 + lx
        const z = z0 + lz
        const h = this.terrainHeight(x, z)
        const biome = this.biomeAt(x, z, h)
        const sandy = biome === 'beach' || (biome === 'ocean' && this.sandNoise.noise2(x * 0.05, z * 0.05) > -0.3)
        const top = sandy ? B.SAND : h < SEA_LEVEL ? B.DIRT : B.GRASS
        const filler = sandy ? B.SAND : B.DIRT
        const fillerDepth = 3 + (hash3(seed, x, z, 7) & 1)
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          let id: number
          if (y === 0 || (y <= 2 && hashFloat(seed, x, z, 100 + y) < 0.5)) id = B.BEDROCK
          else if (y < h - fillerDepth) id = B.STONE
          else if (y < h) id = filler
          else if (y === h) id = top
          else if (y <= SEA_LEVEL) id = B.WATER
          else break
          blocks[blockIndex(lx, y, lz)] = id
        }
      }
    }

    // Trees: scan every tree cell whose canopy could reach into this chunk.
    const gx0 = Math.floor((x0 - TREE_REACH) / TREE_CELL)
    const gx1 = Math.floor((x0 + CHUNK_SIZE - 1 + TREE_REACH) / TREE_CELL)
    const gz0 = Math.floor((z0 - TREE_REACH) / TREE_CELL)
    const gz1 = Math.floor((z0 + CHUNK_SIZE - 1 + TREE_REACH) / TREE_CELL)
    for (let gz = gz0; gz <= gz1; gz++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const tree = treeAt(this, gx, gz)
        if (tree) placeTree(blocks, x0, z0, tree)
      }
    }
    return blocks
  }
}
