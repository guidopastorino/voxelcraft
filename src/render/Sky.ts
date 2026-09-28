import * as THREE from 'three'
import { clamp, lerp } from '../core/math'
import { makeCanvas, ctx2d } from '../assets/PixelCanvas'
import { pixelTexture } from './Textures'
import { SimplexNoise } from '../world/Noise'

export interface SkyState {
  /** 0..1 daylight amount. */
  daylight: number
  skyColor: THREE.Color
  fogColor: THREE.Color
  sunDir: THREE.Vector3
}

const DAY = new THREE.Color('#8ec1ef')
const NIGHT = new THREE.Color('#0a0f24')
const DUSK = new THREE.Color('#f08a4b')
const FOG_DAY = new THREE.Color('#b9d7f1')

function discTexture(kind: 'sun' | 'moon'): THREE.CanvasTexture {
  const c = makeCanvas(16, 16)
  const ctx = ctx2d(c)
  if (kind === 'sun') {
    ctx.fillStyle = '#fff3b0'
    ctx.fillRect(2, 2, 12, 12)
    ctx.fillStyle = '#ffe070'
    ctx.fillRect(4, 4, 8, 8)
    ctx.fillStyle = '#fffbe0'
    ctx.fillRect(5, 5, 4, 4)
  } else {
    ctx.fillStyle = '#dfe6f2'
    ctx.fillRect(3, 3, 10, 10)
    ctx.fillStyle = '#b9c3d6'
    ctx.fillRect(5, 5, 2, 2)
    ctx.fillRect(9, 8, 3, 2)
    ctx.fillRect(6, 10, 2, 1)
  }
  return pixelTexture(c)
}

/**
 * Day/night sky: background + fog colour, sun & moon billboards, stars
 * and a drifting layer of blocky clouds. Time of day t ∈ [0,1):
 * 0 = sunrise, 0.25 = noon, 0.5 = sunset, 0.75 = midnight.
 */
export class Sky {
  readonly group = new THREE.Group()
  private sun: THREE.Mesh
  private moon: THREE.Mesh
  private stars: THREE.Points
  private clouds = new THREE.Group()
  private cloudMat: THREE.MeshLambertMaterial
  private cloudSpan: number
  readonly state: SkyState = { daylight: 1, skyColor: DAY.clone(), fogColor: FOG_DAY.clone(), sunDir: new THREE.Vector3(0, 1, 0) }

  constructor() {
    const disc = (tex: THREE.Texture, size: number) =>
      new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: false, depthWrite: false }))
    this.sun = disc(discTexture('sun'), 60)
    this.moon = disc(discTexture('moon'), 40)
    this.sun.renderOrder = -2
    this.moon.renderOrder = -2

    const starPos: number[] = []
    for (let i = 0; i < 700; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2
      const r = Math.sqrt(1 - u * u)
      starPos.push(r * Math.cos(a) * 380, Math.abs(u) * 380, r * Math.sin(a) * 380)
    }
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3))
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false }))
    this.stars.renderOrder = -3

    this.cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, depthWrite: false })
    const { geometry, span } = buildCloudGeometry()
    this.cloudSpan = span
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++) {
        const m = new THREE.Mesh(geometry, this.cloudMat)
        m.position.set(i * span, 0, j * span)
        m.renderOrder = 2
        this.clouds.add(m)
      }
    this.group.add(this.stars, this.sun, this.moon, this.clouds)
  }

  set cloudsVisible(v: boolean) {
    this.clouds.visible = v
  }

  update(t: number, camera: THREE.Camera, worldTime: number): SkyState {
    const angle = t * Math.PI * 2
    const sunDir = this.state.sunDir.set(Math.cos(angle), Math.sin(angle), 0.25).normalize()
    const height = Math.sin(angle)
    const daylight = clamp(height * 3 + 0.35, 0, 1)
    // Warm tint around sunrise/sunset.
    const dusk = clamp(1 - Math.abs(height) * 3.5, 0, 1) * 0.65
    this.state.daylight = daylight
    this.state.skyColor.copy(NIGHT).lerp(DAY, daylight).lerp(DUSK, dusk * 0.6)
    this.state.fogColor.copy(NIGHT).lerp(FOG_DAY, daylight).lerp(DUSK, dusk * 0.45)

    const cam = camera.position
    this.group.position.copy(cam)
    this.sun.position.copy(sunDir).multiplyScalar(300)
    this.sun.lookAt(0, 0, 0)
    this.moon.position.copy(sunDir).multiplyScalar(-300)
    this.moon.lookAt(0, 0, 0)
    const starMat = this.stars.material as THREE.PointsMaterial
    starMat.opacity = clamp(1 - daylight * 1.6, 0, 1)
    this.stars.visible = starMat.opacity > 0.01
    this.stars.rotation.x = angle * 0.2

    // Clouds live in world space at y = 124, drifting east, tiled around the camera.
    const drift = (worldTime * 1.2) % this.cloudSpan
    const baseX = Math.round((cam.x - drift) / this.cloudSpan) * this.cloudSpan + drift
    const baseZ = Math.round(cam.z / this.cloudSpan) * this.cloudSpan
    this.clouds.position.set(baseX - cam.x, 124 - cam.y, baseZ - cam.z)
    this.cloudMat.color.setScalar(lerp(0.25, 1, daylight))
    return this.state
  }
}

/** One tile of cloud boxes (merged, with shared faces culled). */
function buildCloudGeometry(): { geometry: THREE.BufferGeometry; span: number } {
  const N = 48, CELL = 10, H = 4
  const noise = new SimplexNoise(424242)
  const on: boolean[] = []
  for (let z = 0; z < N; z++)
    for (let x = 0; x < N; x++) {
      // Tileable: sample noise on a torus.
      const a = (x / N) * Math.PI * 2, b = (z / N) * Math.PI * 2
      const v = noise.noise2(Math.cos(a) * 3 + Math.cos(b) * 7, Math.sin(a) * 3 + Math.sin(b) * 7)
      on.push(v > 0.38)
    }
  const at = (x: number, z: number) => on[((z + N) % N) * N + ((x + N) % N)]
  const pos: number[] = [], nor: number[] = [], idx: number[] = []
  const quad = (c: number[][], n: number[]) => {
    const base = pos.length / 3
    for (const p of c) {
      pos.push(...p)
      nor.push(...n)
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  const half = (N * CELL) / 2
  for (let z = 0; z < N; z++)
    for (let x = 0; x < N; x++) {
      if (!at(x, z)) continue
      const x0 = x * CELL - half, x1 = x0 + CELL, z0 = z * CELL - half, z1 = z0 + CELL
      quad([[x0, H, z1], [x1, H, z1], [x1, H, z0], [x0, H, z0]], [0, 1, 0])
      quad([[x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1]], [0, -1, 0])
      if (!at(x + 1, z)) quad([[x1, 0, z1], [x1, 0, z0], [x1, H, z0], [x1, H, z1]], [1, 0, 0])
      if (!at(x - 1, z)) quad([[x0, 0, z0], [x0, 0, z1], [x0, H, z1], [x0, H, z0]], [-1, 0, 0])
      if (!at(x, z + 1)) quad([[x0, 0, z1], [x1, 0, z1], [x1, H, z1], [x0, H, z1]], [0, 0, 1])
      if (!at(x, z - 1)) quad([[x1, 0, z0], [x0, 0, z0], [x0, H, z0], [x1, H, z0]], [0, 0, -1])
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return { geometry: g, span: N * CELL }
}
