import * as THREE from 'three'
import { createItemMesh, isBlockItem } from './ItemMeshes'
import { ItemRegistry } from '../items/ItemRegistry'

const SWING_TIME = 0.25
const EQUIP_TIME = 0.18

/**
 * First-person hand / held item, drawn in its own scene on top of the
 * world (depth cleared) so it never clips into terrain. Animations:
 * idle sway, walk bob, swing (rest → swing → impact → return), eating
 * and a quick lower/raise when the selection changes.
 */
export class HeldItem {
  readonly scene = new THREE.Scene()
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.01, 10)
  private holder = new THREE.Group()
  private current: THREE.Object3D | null = null
  private currentId: string | null | undefined = undefined
  private swingT = 1
  private equipT = 1
  private ambient = new THREE.AmbientLight(0xffffff, 1)
  private sun = new THREE.DirectionalLight(0xffffff, 1)
  private arm: THREE.Mesh

  constructor() {
    this.scene.add(this.holder, this.ambient, this.sun)
    this.sun.position.set(0.3, 1, 0.6)
    const armMat = new THREE.MeshLambertMaterial({ color: 0xd9a27a })
    const sleeveMat = new THREE.MeshLambertMaterial({ color: 0x2f7d7a })
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.6), [armMat, armMat, armMat, armMat, armMat, sleeveMat])
    this.arm = arm
  }

  swing(): void {
    if (this.swingT >= 0.6) this.swingT = 0
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
  }

  private setItem(itemId: string | null): void {
    if (itemId === this.currentId) return
    this.currentId = itemId
    this.equipT = 0
    if (this.current) this.holder.remove(this.current)
    if (!itemId) {
      const g = new THREE.Group()
      this.arm.position.set(0, 0, 0)
      this.arm.rotation.set(0.35, -0.25, 0.1)
      g.add(this.arm)
      g.position.set(0.42, -0.36, -0.62)
      this.current = g
    } else {
      const mesh = createItemMesh(itemId)
      const g = new THREE.Group()
      g.add(mesh)
      if (isBlockItem(itemId)) {
        mesh.scale.setScalar(0.22)
        mesh.rotation.set(0.15, Math.PI / 4, 0)
        g.position.set(0.46, -0.34, -0.7)
      } else {
        const tool = ItemRegistry.get(itemId).tool
        mesh.scale.setScalar(tool ? 0.46 : 0.34)
        // Seen three-quarter on, head up and away, like it is gripped by the handle.
        mesh.rotation.set(0.1, -0.75, tool ? 0.15 : 0)
        mesh.position.set(0, 0.1, 0)
        g.position.set(0.54, -0.4, -0.8)
      }
      this.current = g
    }
    this.holder.add(this.current)
  }

  update(dt: number, opts: { itemId: string | null; walkPhase: number; moving: number; eating: boolean; time: number; light: number; bob: boolean }): void {
    this.setItem(opts.itemId)
    this.swingT = Math.min(1, this.swingT + dt / SWING_TIME)
    this.equipT = Math.min(1, this.equipT + dt / EQUIP_TIME)
    this.ambient.intensity = 0.45 + opts.light * 0.55
    this.sun.intensity = 0.2 + opts.light * 0.9

    const h = this.holder
    h.position.set(0, 0, 0)
    h.rotation.set(0, 0, 0)
    // Idle sway + walk bob.
    h.position.y += Math.sin(opts.time * 1.6) * 0.008
    if (opts.bob) {
      const amp = Math.min(1, opts.moving)
      h.position.x += Math.sin(opts.walkPhase * Math.PI) * 0.025 * amp
      h.position.y -= Math.abs(Math.cos(opts.walkPhase * Math.PI)) * 0.03 * amp
    }
    // Equip: dip down and come back up.
    h.position.y -= (1 - this.equipT) * 0.4

    if (opts.eating) {
      h.position.x -= 0.28
      h.position.y += 0.12 + Math.abs(Math.sin(opts.time * 18)) * 0.03
      h.rotation.y = 0.6
      return
    }
    if (this.swingT < 1) {
      const t = this.swingT
      const s = Math.sin(t * Math.PI)
      const s2 = Math.sin(Math.sqrt(t) * Math.PI)
      h.position.x -= s2 * 0.18
      h.position.y += Math.sin(Math.sqrt(t) * Math.PI * 2) * 0.12
      h.position.z -= s * 0.2
      h.rotation.x = -s * 0.9
      h.rotation.y = s2 * 0.35
      h.rotation.z = s * 0.25
    }
  }
}
