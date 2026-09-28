import * as THREE from 'three'
import { getSharedMaterials } from './Textures'

/** Thin wireframe around the targeted block plus the crack overlay while mining. */
export class BlockHighlight {
  readonly group = new THREE.Group()
  private outline: THREE.LineSegments
  private crack: THREE.Mesh
  private crackMat: THREE.MeshBasicMaterial

  constructor() {
    const box = new THREE.BoxGeometry(1.004, 1.004, 1.004)
    this.outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(box),
      new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55 }),
    )
    this.crackMat = new THREE.MeshBasicMaterial({
      map: getSharedMaterials().cracks[0],
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
    this.crack = new THREE.Mesh(new THREE.BoxGeometry(1.002, 1.002, 1.002), this.crackMat)
    this.group.add(this.outline, this.crack)
    this.group.visible = false
  }

  /** `progress` 0..1 selects one of 8 crack stages (stage = floor(progress * 8)). */
  update(target: { x: number; y: number; z: number } | null, progress: number): void {
    if (!target) {
      this.group.visible = false
      return
    }
    this.group.visible = true
    this.group.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5)
    if (progress > 0) {
      const stage = Math.min(7, Math.floor(progress * 8))
      this.crack.visible = true
      this.crackMat.map = getSharedMaterials().cracks[stage]
    } else {
      this.crack.visible = false
    }
  }
}
