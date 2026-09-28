import * as THREE from 'three'
import type { ParticleLevel } from '../config/defaults'
import type { CollisionWorld } from '../physics/VoxelPhysics'

interface Particle {
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  life: number; maxLife: number
  size: number
  r: number; g: number; b: number
}

const MAX = 600

/**
 * Block-break debris and hit sparks: one InstancedMesh of small cubes,
 * tinted per particle, with simple gravity and floor collision.
 */
export class Particles {
  readonly mesh: THREE.InstancedMesh
  private list: Particle[] = []
  private dummy = new THREE.Object3D()
  private color = new THREE.Color()
  level: ParticleLevel = 'high'

  constructor() {
    const geo = new THREE.BoxGeometry(1, 1, 1)
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff })
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX)
    this.mesh.frustumCulled = false
    this.mesh.count = 0
  }

  private get factor(): number {
    return this.level === 'low' ? 0.35 : this.level === 'medium' ? 0.65 : 1
  }

  /** Burst of 8–16 debris cubes in the colour of a broken block. */
  burst(x: number, y: number, z: number, rgb: [number, number, number], count = 14): void {
    const n = Math.max(2, Math.round(count * this.factor))
    for (let i = 0; i < n && this.list.length < MAX; i++) {
      const shade = 0.75 + Math.random() * 0.35
      this.list.push({
        x: x + 0.2 + Math.random() * 0.6, y: y + 0.2 + Math.random() * 0.6, z: z + 0.2 + Math.random() * 0.6,
        vx: (Math.random() - 0.5) * 3, vy: Math.random() * 3.5 + 0.5, vz: (Math.random() - 0.5) * 3,
        life: 0, maxLife: 0.3 + Math.random() * 0.5,
        size: 0.06 + Math.random() * 0.06,
        r: rgb[0] * shade, g: rgb[1] * shade, b: rgb[2] * shade,
      })
    }
  }

  /** A few small chips when a block is hit. */
  chips(x: number, y: number, z: number, rgb: [number, number, number]): void {
    this.burst(x, y, z, rgb, 3)
  }

  update(dt: number, world: CollisionWorld): void {
    let w = 0
    for (const p of this.list) {
      p.life += dt
      if (p.life >= p.maxLife) continue
      p.vy -= 18 * dt
      const ny = p.y + p.vy * dt
      if (p.vy < 0 && world.isSolid(Math.floor(p.x), Math.floor(ny - p.size / 2), Math.floor(p.z))) {
        p.vy = 0
        p.vx *= 0.6
        p.vz *= 0.6
      } else p.y = ny
      p.x += p.vx * dt
      p.z += p.vz * dt
      this.list[w++] = p
    }
    this.list.length = w
    for (let i = 0; i < w; i++) {
      const p = this.list[i]
      const s = p.size * (1 - (p.life / p.maxLife) * 0.5)
      this.dummy.position.set(p.x, p.y, p.z)
      this.dummy.scale.setScalar(s)
      this.dummy.updateMatrix()
      this.mesh.setMatrixAt(i, this.dummy.matrix)
      this.mesh.setColorAt(i, this.color.setRGB(p.r, p.g, p.b, THREE.SRGBColorSpace))
    }
    this.mesh.count = w
    this.mesh.instanceMatrix.needsUpdate = true
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  get count(): number {
    return this.list.length
  }

  clear(): void {
    this.list.length = 0
    this.mesh.count = 0
  }
}
