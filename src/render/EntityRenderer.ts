import * as THREE from 'three'
import type { Animal } from '../entities/Animal'
import type { PickupEntity } from '../items/PickupEntity'
import { buildBoxModel, type BuiltModel } from './BoxModel'
import { createItemMesh, isBlockItem } from './ItemMeshes'

interface AnimalView {
  model: BuiltModel
}

const HURT = new THREE.Color(0.7, 0.05, 0.05)
const NONE = new THREE.Color(0, 0, 0)

/** Syncs Three.js objects with simulated animals and dropped items. */
export class EntityRenderer {
  readonly group = new THREE.Group()
  private animals = new Map<number, AnimalView>()
  private pickups = new Map<number, THREE.Object3D>()

  update(animals: Animal[], pickups: PickupEntity[], time: number): void {
    const seen = new Set<number>()
    for (const a of animals) {
      seen.add(a.id)
      let view = this.animals.get(a.id)
      if (!view) {
        view = { model: buildBoxModel(a.kind, a.def.model) }
        this.animals.set(a.id, view)
        this.group.add(view.model.root)
      }
      const m = view.model
      m.root.position.set(a.pos.x, a.pos.y, a.pos.z)
      m.root.rotation.set(0, a.yaw, 0)
      // Legs swing with walked distance; the head bobs gently while idle.
      const swing = Math.sin(a.walkPhase) * Math.min(1, Math.hypot(a.body.vel.x, a.body.vel.z)) * 0.7
      for (const leg of m.legs) leg.pivot.rotation.x = swing * leg.phase
      m.head.rotation.x = a.state === 'idle' ? Math.sin(time * 0.8 + a.id) * 0.12 + 0.1 : 0
      // Death: tip over sideways.
      if (a.deathTimer >= 0) m.root.rotation.z = Math.min(Math.PI / 2, a.deathTimer * 4)
      const tint = a.hurtTimer > 0 || a.deathTimer >= 0 ? HURT : NONE
      for (const mat of m.materials) mat.emissive.copy(tint)
    }
    for (const [id, view] of this.animals) {
      if (!seen.has(id)) {
        this.group.remove(view.model.root)
        view.model.root.traverse((o) => {
          if (o instanceof THREE.Mesh) o.geometry.dispose()
        })
        for (const mat of view.model.materials) mat.dispose()
        this.animals.delete(id)
      }
    }

    const seenItems = new Set<number>()
    for (const p of pickups) {
      seenItems.add(p.id)
      let obj = this.pickups.get(p.id)
      if (!obj) {
        const mesh = createItemMesh(p.stack.itemId)
        const block = isBlockItem(p.stack.itemId)
        mesh.scale.setScalar(block ? 0.25 : 0.4)
        obj = new THREE.Group()
        obj.add(mesh)
        obj.userData.block = block
        this.pickups.set(p.id, obj)
        this.group.add(obj)
      }
      const bob = Math.sin(time * 2.5 + p.spin) * 0.06 + 0.18
      obj.position.set(p.pos.x, p.pos.y + bob, p.pos.z)
      obj.rotation.y = time * 1.4 + p.spin
      const shrink = p.collected ? Math.max(0.1, 1 - p.collectTimer / 0.15) : 1
      obj.scale.setScalar(shrink)
    }
    for (const [id, obj] of this.pickups) {
      if (!seenItems.has(id)) {
        this.group.remove(obj)
        this.pickups.delete(id)
      }
    }
  }

  clear(): void {
    this.update([], [], 0)
  }
}
