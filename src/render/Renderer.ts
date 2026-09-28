import * as THREE from 'three'
import { Sky } from './Sky'
import { CHUNK_SIZE } from '../world/constants'

/**
 * Owns the WebGL renderer, the world scene, camera and lights. Day/night
 * drives background, fog and light intensities; fog distance follows the
 * render distance so the edge of the loaded world fades out.
 */
export class Renderer {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly sky = new Sky()
  readonly ambient = new THREE.AmbientLight(0xffffff, 0.6)
  readonly hemi = new THREE.HemisphereLight(0xdfefff, 0x5a4a3a, 0.35)
  readonly sun = new THREE.DirectionalLight(0xfff4e0, 0.9)
  private fog: THREE.Fog
  private fogNear = 40
  private fogFar = 90
  /** Screen tint when the camera is under water (applied via CSS overlay by the UI). */
  underwater = false

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.autoClear = false
    // Stats cover the world + held-item passes; reset once per frame in render().
    this.renderer.info.autoReset = false
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 1000)
    this.fog = new THREE.Fog(0xb9d7f1, 40, 90)
    this.scene.fog = this.fog
    this.scene.background = new THREE.Color(0x8ec1ef)
    this.scene.add(this.ambient, this.hemi, this.sun, this.sun.target, this.sky.group)
    this.resize()
  }

  resize(): void {
    const w = window.innerWidth, h = window.innerHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  setFov(fov: number): void {
    if (this.camera.fov !== fov) {
      this.camera.fov = fov
      this.camera.updateProjectionMatrix()
    }
  }

  setRenderDistance(chunks: number): void {
    const far = chunks * CHUNK_SIZE
    this.fogNear = far * 0.55
    this.fogFar = far * 0.95
    this.camera.far = Math.max(400, far * 2)
    this.camera.updateProjectionMatrix()
  }

  /** Updates sky, fog and lights for a time of day (0..1) and returns daylight 0..1. */
  updateEnvironment(timeOfDay: number, worldTime: number): number {
    const s = this.sky.update(timeOfDay, this.camera, worldTime)
    if (this.underwater) {
      ;(this.scene.background as THREE.Color).set(0x1d3f7a)
      this.fog.color.set(0x1d3f7a)
      this.fog.near = 1
      this.fog.far = 18
    } else {
      ;(this.scene.background as THREE.Color).copy(s.skyColor)
      this.fog.color.copy(s.fogColor)
      this.fog.near = this.fogNear
      this.fog.far = this.fogFar
    }
    const d = s.daylight
    this.ambient.intensity = 0.28 + 0.5 * d
    this.hemi.intensity = 0.12 + 0.35 * d
    this.sun.intensity = 0.08 + 1.0 * d
    this.sun.color.setRGB(1, 0.92 + 0.08 * d, 0.8 + 0.2 * d)
    const c = this.camera.position
    this.sun.position.set(c.x + s.sunDir.x * 100, c.y + Math.abs(s.sunDir.y) * 100, c.z + s.sunDir.z * 100)
    this.sun.target.position.copy(c)
    return d
  }

  render(overlay?: { scene: THREE.Scene; camera: THREE.Camera }): void {
    this.renderer.info.reset()
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)
    if (overlay) {
      this.renderer.clearDepth()
      this.renderer.render(overlay.scene, overlay.camera)
    }
  }

  get info() {
    return this.renderer.info.render
  }
}
