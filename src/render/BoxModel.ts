import * as THREE from 'three'
import type { ModelPart } from '../config/animals'
import { paintPartFaces } from '../assets/SkinTextures'
import { pixelTexture } from './Textures'

const PX = 1 / 16

export interface BuiltModel {
  root: THREE.Group
  /** Pivot group for the head (parts flagged head: true). */
  head: THREE.Group
  /** Leg pivots with their swing phase. */
  legs: { pivot: THREE.Group; phase: number }[]
  materials: THREE.MeshLambertMaterial[]
}

const materialCache = new Map<string, THREE.MeshLambertMaterial[]>()

/**
 * Builds a voxel box model (animals, the third-person player) from part
 * definitions. Legs pivot at their top, head parts pivot at the head's
 * back so the head can nod/turn. Materials are cached per model+part.
 */
export function buildBoxModel(key: string, parts: ModelPart[]): BuiltModel {
  const root = new THREE.Group()
  const body = new THREE.Group()
  root.add(body)
  const headPart = parts.find((p) => p.name === 'head')
  const head = new THREE.Group()
  if (headPart) head.position.set(headPart.pos[0] * PX, headPart.pos[1] * PX, (headPart.pos[2] - headPart.size[2] / 2) * PX)
  body.add(head)
  const legs: BuiltModel['legs'] = []
  const materials: THREE.MeshLambertMaterial[] = []

  for (const part of parts) {
    const cacheKey = `${key}:${part.name}`
    let mats = materialCache.get(cacheKey)
    if (!mats) {
      mats = paintPartFaces(part, 17).map((c) => new THREE.MeshLambertMaterial({ map: pixelTexture(c) }))
      materialCache.set(cacheKey, mats)
    }
    // Per-instance material clones so hurt tint does not leak between animals.
    const own = mats.map((m) => m.clone())
    materials.push(...own)
    const geo = new THREE.BoxGeometry(part.size[0] * PX, part.size[1] * PX, part.size[2] * PX)
    const mesh = new THREE.Mesh(geo, own)
    const [x, y, z] = part.pos.map((v) => v * PX)
    if (part.swing) {
      const pivot = new THREE.Group()
      pivot.position.set(x, y + (part.size[1] / 2) * PX, z)
      mesh.position.set(0, -(part.size[1] / 2) * PX, 0)
      pivot.add(mesh)
      body.add(pivot)
      legs.push({ pivot, phase: part.swing })
    } else if (part.head && headPart) {
      mesh.position.set(x - head.position.x, y - head.position.y, z - head.position.z)
      head.add(mesh)
    } else {
      mesh.position.set(x, y, z)
      body.add(mesh)
    }
  }
  return { root, head, legs, materials }
}
