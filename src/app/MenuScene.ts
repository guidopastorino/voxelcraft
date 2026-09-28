import { World } from '../world/World'
import { ChunkManager } from '../world/ChunkManager'
import { ChunkRenderer } from '../render/ChunkRenderer'
import type { ChunkWorkerPool } from '../world/ChunkWorkerPool'
import type { Renderer } from '../render/Renderer'

/** Fixed presentation seed for the title-screen background. */
export const MENU_SEED = 0x5eed_c0de

/**
 * Title-screen background: a real procedurally generated world with the
 * camera slowly orbiting a scenic point. The UI adds a light blur/overlay.
 */
export class MenuScene {
  private world = new World(MENU_SEED)
  private chunks: ChunkManager
  private meshes: ChunkRenderer
  private angle = Math.random() * Math.PI * 2
  private center = { x: 8, y: 50, z: 8 }

  constructor(private renderer: Renderer, pool: ChunkWorkerPool) {
    this.chunks = new ChunkManager(this.world, pool, { onLoaded: () => {}, onUnloaded: () => {} })
    this.chunks.radius = 4
    this.meshes = new ChunkRenderer(this.world, pool)
    renderer.scene.add(this.meshes.group)
    renderer.setRenderDistance(5)
    const h = this.world.generator.terrainHeight(8, 8)
    this.center.y = Math.max(h, 30) + 18
  }

  update(dt: number): void {
    this.angle += dt * 0.035
    this.chunks.update(this.center.x, this.center.z)
    this.meshes.update(this.center.x, this.center.z, 4)
    const cam = this.renderer.camera
    const r = 26
    cam.position.set(this.center.x + Math.cos(this.angle) * r, this.center.y, this.center.z + Math.sin(this.angle) * r)
    cam.lookAt(this.center.x, this.center.y - 10, this.center.z)
    this.renderer.setFov(70)
    // Frozen golden-hour light.
    this.renderer.updateEnvironment(0.07, performance.now() / 1000)
  }

  dispose(): void {
    this.chunks.dispose()
    this.meshes.dispose()
    this.renderer.scene.remove(this.meshes.group)
  }
}
