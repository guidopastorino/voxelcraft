import * as THREE from 'three'
import type { World } from '../world/World'
import type { ChunkWorkerPool } from '../world/ChunkWorkerPool'
import { buildChunkMesh, buildPaddedBlocks, type ChunkMeshData, type MeshData } from '../world/TerrainMesher'
import { buildFaceTileTable } from '../world/atlasLayout'
import { chunkKey, worldToChunk } from '../world/coords'
import { CHUNK_SIZE } from '../world/constants'
import type { Chunk } from '../world/Chunk'
import { getSharedMaterials } from './Textures'

interface ChunkMeshes {
  opaque: THREE.Mesh | null
  water: THREE.Mesh | null
  triangles: number
}

function toGeometry(d: MeshData): THREE.BufferGeometry | null {
  if (d.indices.length === 0) return null
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(d.positions, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(d.normals, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(d.uvs, 2))
  g.setAttribute('color', new THREE.BufferAttribute(d.colors, 3))
  g.setIndex(new THREE.BufferAttribute(d.indices, 1))
  g.computeBoundingSphere()
  return g
}

/**
 * Turns chunk data into Three.js meshes. New chunks are meshed in
 * workers; edited chunks are re-meshed synchronously on the main thread
 * so block changes appear the very next frame.
 */
export class ChunkRenderer {
  readonly group = new THREE.Group()
  private meshes = new Map<string, ChunkMeshes>()
  private inFlight = new Set<string>()
  private faceTiles = buildFaceTileTable()
  maxInFlight = 6
  lastSyncMeshMs = 0

  constructor(private world: World, private pool: ChunkWorkerPool) {}

  private neighboursReady(c: Chunk): boolean {
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) if (!this.world.hasChunk(c.cx + dx, c.cz + dz)) return false
    return true
  }

  private padded(c: Chunk): Uint16Array {
    return buildPaddedBlocks(c.blocks, (dx, dz) => this.world.getChunk(c.cx + dx, c.cz + dz)?.blocks)
  }

  update(px: number, pz: number, radius: number): void {
    const pcx = worldToChunk(px), pcz = worldToChunk(pz)
    const todo: { c: Chunk; d: number }[] = []
    for (const c of this.world.chunks.values()) {
      const dx = c.cx - pcx, dz = c.cz - pcz
      const d = dx * dx + dz * dz
      if (d > (radius + 0.5) * (radius + 0.5)) continue
      if (!c.dirty) continue
      if (!this.neighboursReady(c)) continue
      todo.push({ c, d })
    }
    todo.sort((a, b) => a.d - b.d)

    let sync = 0
    for (const { c } of todo) {
      const key = chunkKey(c.cx, c.cz)
      if (this.meshes.has(key)) {
        // Edited chunk: rebuild immediately (bounded per frame).
        if (sync >= 4) continue
        const t0 = performance.now()
        c.dirty = false
        c.meshedVersion = c.version
        this.apply(c, buildChunkMesh(this.padded(c), this.faceTiles))
        this.lastSyncMeshMs = performance.now() - t0
        sync++
      } else if (!this.inFlight.has(key) && this.inFlight.size < this.maxInFlight) {
        this.inFlight.add(key)
        c.dirty = false
        c.state = 'MESHING'
        const version = c.version
        this.pool.mesh(this.padded(c)).then((data) => {
          this.inFlight.delete(key)
          const cur = this.world.getChunk(c.cx, c.cz)
          if (cur !== c) return // unloaded meanwhile
          c.meshedVersion = version
          this.apply(c, data)
        })
      }
    }

    // Drop meshes of chunks that are gone or out of range.
    for (const [key, m] of this.meshes) {
      const c = this.world.chunks.get(key)
      let remove = !c
      if (c) {
        const dx = c.cx - pcx, dz = c.cz - pcz
        remove = dx * dx + dz * dz > (radius + 1.5) * (radius + 1.5)
        if (remove) c.dirty = true
      }
      if (remove) this.removeMeshes(key, m)
    }
  }

  private apply(c: Chunk, data: ChunkMeshData): void {
    const key = chunkKey(c.cx, c.cz)
    const old = this.meshes.get(key)
    if (old) this.removeMeshes(key, old)
    const mats = getSharedMaterials()
    const make = (d: MeshData, mat: THREE.Material, order: number) => {
      const g = toGeometry(d)
      if (!g) return null
      const m = new THREE.Mesh(g, mat)
      m.position.set(c.cx * CHUNK_SIZE, 0, c.cz * CHUNK_SIZE)
      m.matrixAutoUpdate = false
      m.updateMatrix()
      m.renderOrder = order
      this.group.add(m)
      return m
    }
    const opaque = make(data.opaque, mats.terrain, 0)
    const water = make(data.water, mats.water, 1)
    this.meshes.set(key, { opaque, water, triangles: (data.opaque.indices.length + data.water.indices.length) / 3 })
    c.state = 'VISIBLE'
  }

  private removeMeshes(key: string, m: ChunkMeshes): void {
    for (const mesh of [m.opaque, m.water]) {
      if (!mesh) continue
      this.group.remove(mesh)
      mesh.geometry.dispose()
    }
    this.meshes.delete(key)
  }

  get stats() {
    let triangles = 0
    for (const m of this.meshes.values()) triangles += m.triangles
    return { meshed: this.meshes.size, inFlight: this.inFlight.size, triangles }
  }

  /** True when every chunk within `r` of the player has a mesh (loading screen). */
  readyAround(px: number, pz: number, r: number): number {
    const pcx = worldToChunk(px), pcz = worldToChunk(pz)
    let have = 0, total = 0
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      total++
      if (this.meshes.has(chunkKey(pcx + dx, pcz + dz))) have++
    }
    return have / total
  }

  dispose(): void {
    for (const [key, m] of this.meshes) this.removeMeshes(key, m)
  }
}
