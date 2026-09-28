import { CHUNK_HEIGHT, CHUNK_SIZE } from './constants'
import { BlockRegistry } from './BlockRegistry'
import { tileUV } from './atlasLayout'

/**
 * Chunk meshing with hidden-face culling and per-vertex ambient occlusion.
 *
 * Input is a padded block array covering the chunk plus a one-block ring
 * from its 8 neighbours (so border faces and AO are correct) — see
 * `buildPaddedBlocks`. The function is pure, so it runs identically on
 * the main thread, in a worker and in tests.
 */

export const PAD = CHUNK_SIZE + 2
export const PADDED_VOLUME = PAD * PAD * CHUNK_HEIGHT

export const paddedIndex = (px: number, y: number, pz: number): number => (y * PAD + pz) * PAD + px

export interface MeshData {
  positions: Float32Array
  normals: Float32Array
  uvs: Float32Array
  colors: Float32Array
  indices: Uint32Array
}

export interface ChunkMeshData {
  opaque: MeshData
  water: MeshData
}

interface FaceDef {
  n: [number, number, number]
  /** Corners BL, BR, TR, TL (CCW seen from outside). */
  corners: [number, number, number][]
  shade: number
}

// Order: +X, -X, +Y, -Y, +Z, -Z (matches atlasLayout FACE_* constants).
const FACES: FaceDef[] = [
  { n: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.8 },
  { n: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.8 },
  { n: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0 },
  { n: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.55 },
  { n: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.9 },
  { n: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.9 },
]
const CORNER_UV: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]]
const AO_CURVE = [0.5, 0.68, 0.84, 1.0]
/** Water surface sits slightly below the block top. */
export const WATER_SURFACE = 0.875

class Builder {
  positions: number[] = []
  normals: number[] = []
  uvs: number[] = []
  colors: number[] = []
  indices: number[] = []
  vertexCount = 0

  finish(): MeshData {
    return {
      positions: new Float32Array(this.positions),
      normals: new Float32Array(this.normals),
      uvs: new Float32Array(this.uvs),
      colors: new Float32Array(this.colors),
      indices: new Uint32Array(this.indices),
    }
  }
}

export function buildChunkMesh(padded: Uint16Array, faceTiles: Int16Array): ChunkMeshData {
  const opaque = new Builder()
  const water = new Builder()
  const { solid, transparent, liquid } = BlockRegistry

  const get = (px: number, y: number, pz: number): number => {
    if (y < 0) return 1 // treat below-world as opaque (any solid id)
    if (y >= CHUNK_HEIGHT) return 0
    return padded[paddedIndex(px, y, pz)]
  }
  /** Occluder for AO: any solid opaque-ish block. */
  const occ = (px: number, y: number, pz: number): number => {
    const id = get(px, y, pz)
    return solid[id] && !liquid[id] ? 1 : 0
  }

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const px = lx + 1, pz = lz + 1
        const id = padded[paddedIndex(px, y, pz)]
        if (id === 0) continue
        const isWater = liquid[id] === 1

        for (let f = 0; f < 6; f++) {
          const face = FACES[f]
          const [nx, ny, nz] = face.n
          const nid = get(px + nx, y + ny, pz + nz)
          if (isWater) {
            if (liquid[nid] || (solid[nid] && !transparent[nid])) continue
            if (ny === -1 && nid !== 0 && !transparent[nid]) continue
          } else {
            if (!transparent[nid]) continue
            // Same transparent block (leaves-leaves) keeps faces for a fuller canopy,
            // but never draw faces hidden by an identical opaque neighbour.
          }
          const tile = faceTiles[id * 6 + f]
          if (tile < 0) continue
          const [u0, v0, u1, v1] = tileUV(tile)
          const b = isWater ? water : opaque

          // Water: lower the surface when nothing liquid is above.
          const waterTop = isWater && !liquid[get(px, y + 1, pz)] ? WATER_SURFACE : 1

          const ao: number[] = [0, 0, 0, 0]
          for (let c = 0; c < 4; c++) {
            const [cx, cy, cz] = face.corners[c]
            let yy = cy
            if (isWater && cy === 1) yy = waterTop
            b.positions.push(lx + cx, y + yy, lz + cz)
            b.normals.push(nx, ny, nz)
            const [cu, cv] = CORNER_UV[c]
            const vScale = isWater && f !== 2 && f !== 3 && cy === 1 ? waterTop : 1
            b.uvs.push(cu ? u1 : u0, v0 + (v1 - v0) * cv * vScale)

            let light = face.shade
            if (!isWater) {
              // Neighbours in the plane in front of the face, toward this corner.
              const dx = nx !== 0 ? 0 : cx * 2 - 1
              const dy = ny !== 0 ? 0 : cy * 2 - 1
              const dz = nz !== 0 ? 0 : cz * 2 - 1
              const bx = px + nx, by = y + ny, bz = pz + nz
              let s1: number, s2: number
              if (nx !== 0) {
                s1 = occ(bx, by + dy, bz)
                s2 = occ(bx, by, bz + dz)
              } else if (ny !== 0) {
                s1 = occ(bx + dx, by, bz)
                s2 = occ(bx, by, bz + dz)
              } else {
                s1 = occ(bx + dx, by, bz)
                s2 = occ(bx, by + dy, bz)
              }
              const corner = occ(bx + dx, by + dy, bz + dz)
              const level = s1 && s2 ? 0 : 3 - (s1 + s2 + corner)
              ao[c] = level
              light *= AO_CURVE[level]
            }
            b.colors.push(light, light, light)
          }
          const base = b.vertexCount
          // Flip the quad diagonal so AO gradients interpolate symmetrically.
          if (ao[0] + ao[2] < ao[1] + ao[3]) {
            b.indices.push(base + 1, base + 2, base + 3, base + 1, base + 3, base)
          } else {
            b.indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
          }
          b.vertexCount += 4
        }
      }
    }
  }
  return { opaque: opaque.finish(), water: water.finish() }
}

/**
 * Copies a chunk and the one-block border of its 8 neighbours into a
 * padded array. Missing neighbours read as air (their chunk is not
 * meshed until neighbours exist, so this only matters for edge cases).
 */
export function buildPaddedBlocks(
  center: Uint16Array,
  neighbour: (dx: number, dz: number) => Uint16Array | undefined,
): Uint16Array {
  const out = new Uint16Array(PADDED_VOLUME)
  const S = CHUNK_SIZE
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const src = dx === 0 && dz === 0 ? center : neighbour(dx, dz)
      if (!src) continue
      // Range of local coords of `src` that land inside the padded box.
      const xs = dx === -1 ? S - 1 : 0, xe = dx === 1 ? 0 : S - 1
      const zs = dz === -1 ? S - 1 : 0, ze = dz === 1 ? 0 : S - 1
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let z = zs; z <= ze; z++) {
          const pz = z + 1 + dz * S
          const rowSrc = (y * S + z) * S
          const rowDst = (y * PAD + pz) * PAD + 1 + dx * S
          for (let x = xs; x <= xe; x++) out[rowDst + x] = src[rowSrc + x]
        }
      }
    }
  }
  return out
}
