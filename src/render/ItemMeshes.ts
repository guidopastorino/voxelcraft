import * as THREE from 'three'
import { ItemRegistry } from '../items/ItemRegistry'
import { buildFaceTileTable, tileUV } from '../world/atlasLayout'
import { getFlatIcon } from '../assets/ItemIcons'
import { getSharedMaterials } from './Textures'

/**
 * 3D models for items: block items become textured unit cubes, flat
 * items (tools, food…) become extruded pixel sprites — each opaque icon
 * pixel is a 1/16 voxel, with side faces only where the silhouette ends.
 * Geometries are cached per item.
 */
const faceTiles = buildFaceTileTable()
const geomCache = new Map<string, THREE.BufferGeometry>()
let flatMaterial: THREE.MeshLambertMaterial | null = null

const CUBE_FACES: { n: [number, number, number]; c: [number, number, number][]; shade: number }[] = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.8 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.8 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.55 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.9 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.9 },
]

/** Unit cube centred on the origin with the block's atlas UVs. */
export function blockGeometry(blockId: number): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = []
  CUBE_FACES.forEach((f, fi) => {
    const tile = faceTiles[blockId * 6 + fi]
    if (tile < 0) return
    const [u0, v0, u1, v1] = tileUV(tile)
    const base = pos.length / 3
    f.c.forEach(([x, y, z], k) => {
      pos.push(x - 0.5, y - 0.5, z - 0.5)
      nor.push(...f.n)
      uv.push(k === 1 || k === 2 ? u1 : u0, k >= 2 ? v1 : v0)
      col.push(f.shade, f.shade, f.shade)
    })
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  return g
}

/** Extrudes a 16×16 icon into a 1×1×(1/16) voxel sprite centred on the origin. */
function extrudedGeometry(itemId: string): THREE.BufferGeometry {
  const icon = getFlatIcon(itemId)
  const pos: number[] = [], nor: number[] = [], col: number[] = [], idx: number[] = []
  const P = 1 / 16, T = P / 2
  const solid = (x: number, y: number) => icon !== null && icon.alpha(x, y) > 128
  const quad = (corners: number[][], n: [number, number, number], rgb: number[], shade: number) => {
    const base = pos.length / 3
    for (const c of corners) {
      pos.push(c[0], c[1], c[2])
      nor.push(...n)
      col.push(rgb[0] * shade, rgb[1] * shade, rgb[2] * shade)
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  if (icon) {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (!solid(x, y)) continue
        const c = icon.get(x, y)
        // sRGB → linear so vertex colours match textured materials.
        const rgb = [c[0], c[1], c[2]].map((v) => Math.pow(v / 255, 2.2))
        const x0 = x * P - 0.5, x1 = x0 + P
        const y1 = 0.5 - y * P, y0 = y1 - P
        quad([[x0, y0, T], [x1, y0, T], [x1, y1, T], [x0, y1, T]], [0, 0, 1], rgb, 1)
        quad([[x1, y0, -T], [x0, y0, -T], [x0, y1, -T], [x1, y1, -T]], [0, 0, -1], rgb, 0.85)
        if (!solid(x - 1, y)) quad([[x0, y0, -T], [x0, y0, T], [x0, y1, T], [x0, y1, -T]], [-1, 0, 0], rgb, 0.75)
        if (!solid(x + 1, y)) quad([[x1, y0, T], [x1, y0, -T], [x1, y1, -T], [x1, y1, T]], [1, 0, 0], rgb, 0.75)
        if (!solid(x, y - 1)) quad([[x0, y1, T], [x1, y1, T], [x1, y1, -T], [x0, y1, -T]], [0, 1, 0], rgb, 0.95)
        if (!solid(x, y + 1)) quad([[x0, y0, -T], [x1, y0, -T], [x1, y0, T], [x0, y0, T]], [0, -1, 0], rgb, 0.6)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  return g
}

export function isBlockItem(itemId: string): boolean {
  return ItemRegistry.get(itemId).blockId !== undefined
}

export function itemGeometry(itemId: string): THREE.BufferGeometry {
  let g = geomCache.get(itemId)
  if (!g) {
    const item = ItemRegistry.get(itemId)
    g = item.blockId !== undefined ? blockGeometry(item.blockId) : extrudedGeometry(itemId)
    geomCache.set(itemId, g)
  }
  return g
}

export function itemMaterial(itemId: string): THREE.Material {
  if (isBlockItem(itemId)) return getSharedMaterials().terrain
  flatMaterial ??= new THREE.MeshLambertMaterial({ vertexColors: true })
  return flatMaterial
}

export function createItemMesh(itemId: string): THREE.Mesh {
  return new THREE.Mesh(itemGeometry(itemId), itemMaterial(itemId))
}
