import * as THREE from 'three'
import { buildCrackTextures, buildTerrainAtlas } from '../assets/TerrainTextures'

/** Nearest-filtered, sRGB canvas texture — the pixel-art look, no smoothing. */
export function pixelTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(canvas)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.colorSpace = THREE.SRGBColorSpace
  t.needsUpdate = true
  return t
}

let shared: { atlas: THREE.CanvasTexture; cracks: THREE.CanvasTexture[]; terrain: THREE.MeshLambertMaterial; water: THREE.MeshLambertMaterial } | null = null

/** Materials shared by chunks, dropped blocks and the held block. */
export function getSharedMaterials() {
  if (shared) return shared
  const atlas = pixelTexture(buildTerrainAtlas())
  const cracks = buildCrackTextures().map(pixelTexture)
  const terrain = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, alphaTest: 0.5 })
  const water = new THREE.MeshLambertMaterial({
    map: atlas,
    vertexColors: true,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  shared = { atlas, cracks, terrain, water }
  return shared
}
