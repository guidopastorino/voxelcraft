import * as THREE from 'three'
import type { Player } from './Player'
import type { World } from '../world/World'
import { raycastVoxels } from '../world/Raycast'
import { BlockRegistry } from '../world/BlockRegistry'
import { PLAYER } from '../config/defaults'
import type { Vec3 } from '../core/math'

export type CameraMode = 'first' | 'third_back' | 'third_front'
const MODES: CameraMode[] = ['first', 'third_back', 'third_front']
const THIRD_DISTANCE = 4

/**
 * Positions the render camera from the (interpolated) player: first
 * person with view bobbing and damage shake, or third person behind /
 * in front with a raycast that pulls the camera in before walls.
 */
export class PlayerCamera {
  mode: CameraMode = 'first'
  private shake = 0
  private bobAmount = 0
  private fovBoost = 0

  cycle(): CameraMode {
    this.mode = MODES[(MODES.indexOf(this.mode) + 1) % MODES.length]
    return this.mode
  }

  hurt(): void {
    this.shake = 1
  }

  update(camera: THREE.PerspectiveCamera, player: Player, feet: Vec3, world: World, dt: number, opts: { bobbing: boolean; fov: number }): void {
    const eye = new THREE.Vector3(feet.x, feet.y + PLAYER.eyeHeight, feet.z)
    const speed = player.body.onGround ? Math.min(1, player.horizontalSpeed / PLAYER.walkSpeed) : 0
    this.bobAmount += (speed - this.bobAmount) * Math.min(1, dt * 10)
    this.shake = Math.max(0, this.shake - dt * 3)
    this.fovBoost += ((player.sprinting ? 8 : 0) - this.fovBoost) * Math.min(1, dt * 8)
    if (camera.fov !== opts.fov + this.fovBoost) {
      camera.fov = opts.fov + this.fovBoost
      camera.updateProjectionMatrix()
    }

    const euler = new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ')
    if (this.mode === 'first') {
      if (opts.bobbing) {
        const phase = player.walkDistance * Math.PI * 0.62
        const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw))
        eye.addScaledVector(right, Math.sin(phase) * 0.045 * this.bobAmount)
        eye.y += -Math.abs(Math.cos(phase)) * 0.06 * this.bobAmount
        euler.z = Math.sin(phase) * 0.006 * this.bobAmount
      }
      if (this.shake > 0) euler.z += Math.sin(this.shake * 30) * 0.06 * this.shake
      camera.position.copy(eye)
      camera.quaternion.setFromEuler(euler)
      return
    }

    // Third person: look direction, then back off along it (or in front, looking back).
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(euler)
    const back = this.mode === 'third_back' ? dir.clone().negate() : dir.clone()
    const hit = raycastVoxels(
      (x, y, z) => world.getBlock(x, y, z),
      eye,
      back,
      THIRD_DISTANCE,
      (id) => BlockRegistry.solid[id] === 1,
    )
    const dist = hit ? Math.max(0.3, hit.distance - 0.25) : THIRD_DISTANCE
    camera.position.copy(eye).addScaledVector(back, dist)
    if (this.mode === 'third_back') camera.quaternion.setFromEuler(euler)
    else camera.lookAt(eye)
  }
}
