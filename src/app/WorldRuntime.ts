import * as THREE from 'three'
import type { GameSession } from './GameSession'
import type { Renderer } from '../render/Renderer'
import type { AudioManager } from '../audio/AudioManager'
import { AmbientAudio } from '../audio/AmbientAudio'
import { materialSound } from '../audio/SoundRegistry'
import type { ChunkWorkerPool } from '../world/ChunkWorkerPool'
import { ChunkManager } from '../world/ChunkManager'
import { ChunkRenderer } from '../render/ChunkRenderer'
import { EntityRenderer } from '../render/EntityRenderer'
import { BlockHighlight } from '../render/BlockHighlight'
import { Particles } from '../render/Particles'
import { HeldItem } from '../render/HeldItem'
import { PlayerCamera } from '../player/PlayerCamera'
import { buildBoxModel, type BuiltModel } from '../render/BoxModel'
import { PLAYER_MODEL } from '../config/playerModel'
import { BlockRegistry, B } from '../world/BlockRegistry'
import { tileAverageColor } from '../assets/TerrainTextures'
import type { AtlasTile } from '../world/atlasLayout'
import type { Settings } from '../config/defaults'
import { WORLD } from '../config/defaults'
import type { HUD } from '../ui/HUD'
import type { Vec3 } from '../core/math'
import { worldToChunk } from '../world/coords'

const particleColors = new Map<number, [number, number, number]>()
function blockColor(id: number): [number, number, number] {
  let c = particleColors.get(id)
  if (!c) {
    const t = BlockRegistry.get(id).textures
    const tile = (t.side ?? t.all ?? t.top) as AtlasTile | undefined
    c = tile ? tileAverageColor(tile) : [0.5, 0.5, 0.5]
    particleColors.set(id, c)
  }
  return c
}

/**
 * Everything that presents one loaded world: chunk streaming & meshes,
 * entities, particles, held item, camera, and the event → audio/FX
 * wiring. Created when a world loads, disposed when leaving it.
 */
export class WorldRuntime {
  readonly chunks: ChunkManager
  readonly meshes: ChunkRenderer
  readonly entityView = new EntityRenderer()
  readonly highlight = new BlockHighlight()
  readonly particles = new Particles()
  readonly held = new HeldItem()
  readonly cam = new PlayerCamera()
  readonly ambient: AmbientAudio
  private playerModel: BuiltModel
  private prevFeet: Vec3
  private unsubs: (() => void)[] = []
  private clock = 0
  daylight = 1

  constructor(
    readonly session: GameSession,
    private renderer: Renderer,
    private audio: AudioManager,
    pool: ChunkWorkerPool,
    private settings: Settings,
    private hud: HUD,
  ) {
    this.chunks = new ChunkManager(session.world, pool, {
      onLoaded: (cx, cz) => session.onChunkLoaded(cx, cz),
      onUnloaded: (cx, cz) => session.onChunkUnloaded(cx, cz),
    })
    this.meshes = new ChunkRenderer(session.world, pool)
    this.playerModel = buildBoxModel('player', PLAYER_MODEL)
    this.playerModel.root.visible = false
    renderer.scene.add(this.meshes.group, this.entityView.group, this.highlight.group, this.particles.mesh, this.playerModel.root)
    this.prevFeet = { ...session.player.pos }
    this.ambient = new AmbientAudio(audio)
    this.ambient.start()
    this.applySettings(settings)
    this.wireEvents()
  }

  applySettings(s: Settings): void {
    this.settings = s
    this.chunks.radius = s.video.renderDistance
    this.session.activeRadius = s.video.renderDistance
    this.particles.level = s.video.particles
    this.renderer.setRenderDistance(s.video.renderDistance)
    this.renderer.sky.cloudsVisible = s.video.clouds
  }

  private wireEvents(): void {
    const ev = this.session.events
    const a = this.audio
    const on = <T extends Parameters<typeof ev.on>[0]>(t: T, fn: Parameters<typeof ev.on<T>>[1]) => this.unsubs.push(ev.on(t, fn))
    const center = (p: { x: number; y: number; z: number }) => ({ x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5 })
    on('block:hit', (e) => {
      const m = BlockRegistry.get(e.blockId).material
      a.play(materialSound.hit(m), { at: center(e) })
      this.particles.chips(e.x, e.y, e.z, blockColor(e.blockId))
    })
    on('block:broken', (e) => {
      a.play(materialSound.break(BlockRegistry.get(e.blockId).material), { at: center(e) })
      this.particles.burst(e.x, e.y, e.z, blockColor(e.blockId))
    })
    on('block:placed', (e) => a.play('place', { at: center(e) }))
    on('item:picked', () => a.play('pickup', { cooldown: 0.04 }))
    on('player:footstep', (e) => a.play(materialSound.step(e.material as never), { volume: 0.8, cooldown: 0.12 }))
    on('player:swing', () => this.held.swing())
    on('player:damaged', () => {
      a.play('hurt')
      this.cam.hurt()
    })
    on('player:died', () => a.play('hurt', { pitch: 0.7 }))
    on('player:eating', () => a.play('eat'))
    on('player:ate', () => a.play('ate'))
    on('animal:hurt', (e) => {
      const def = this.session.entities.animals.find((x) => x.kind === e.kind)?.def
      if (def) a.play(def.sounds.hurt, { at: e.position })
    })
    on('craft:crafted', () => a.play('craft', { cooldown: 0.05 }))
    on('inventory:click', () => a.play('click', { cooldown: 0.03 }))
    on('tool:broken', (e) => {
      a.play('tool_break')
      this.hud.toast(`Your ${e.itemId.replace('_', ' ')} broke!`)
    })
  }

  /** Call before each fixed simulation step (for render interpolation). */
  beforeTick(): void {
    const p = this.session.player.pos
    this.prevFeet = { x: p.x, y: p.y, z: p.z }
  }

  /** Streams chunks; returns loading progress info. */
  stream(): void {
    const p = this.session.player.pos
    this.chunks.update(p.x, p.z)
    this.meshes.update(p.x, p.z, this.settings.video.renderDistance)
  }

  loadingProgress(): { terrain: number; meshing: number } {
    const p = this.session.player.pos
    const r = Math.min(2, this.settings.video.renderDistance)
    return { terrain: this.chunks.progressAround(p.x, p.z, r + 1), meshing: this.meshes.readyAround(p.x, p.z, r) }
  }

  get timeOfDay(): number {
    return (((this.session.time / WORLD.dayLength) % 1) + 1) % 1
  }

  frame(dt: number, alpha: number, active: boolean): void {
    const s = this.session
    const p = s.player
    this.clock += dt
    const cur = p.pos
    const feet = {
      x: this.prevFeet.x + (cur.x - this.prevFeet.x) * alpha,
      y: this.prevFeet.y + (cur.y - this.prevFeet.y) * alpha,
      z: this.prevFeet.z + (cur.z - this.prevFeet.z) * alpha,
    }
    this.stream()
    const camera = this.renderer.camera
    this.cam.update(camera, p, feet, s.world, dt, { bobbing: this.settings.gameplay.viewBobbing, fov: this.settings.video.fov })

    // Underwater tint + fog.
    const camBlock = s.world.getBlock(Math.floor(camera.position.x), Math.floor(camera.position.y), Math.floor(camera.position.z))
    const underwater = camBlock === B.WATER
    this.renderer.underwater = underwater
    this.hud.setUnderwater(underwater)
    this.daylight = this.renderer.updateEnvironment(this.timeOfDay, s.time)

    // Target outline + cracks.
    const t = s.interaction.target
    const showTarget = active && !s.dead && t?.kind === 'block'
    this.highlight.update(showTarget ? t.hit : null, s.miningProgress)

    this.entityView.update(s.entities.animals, s.pickups.items, this.clock)
    this.particles.update(dt, s.world)

    // Third-person body.
    const third = this.cam.mode !== 'first'
    const pm = this.playerModel
    pm.root.visible = third && !s.dead
    if (third) {
      pm.root.position.set(feet.x, feet.y, feet.z)
      pm.root.rotation.y = p.yaw + Math.PI
      pm.head.rotation.x = -p.pitch
      const swing = Math.sin(p.walkDistance * 2.2) * Math.min(1, p.horizontalSpeed / 4) * 0.8
      for (const leg of pm.legs) leg.pivot.rotation.x = swing * leg.phase
    }

    const stack = p.hotbar.stack
    this.held.setAspect(camera.aspect)
    this.held.update(dt, {
      itemId: stack?.itemId ?? null,
      walkPhase: p.walkDistance * 0.62,
      moving: p.body.onGround ? Math.min(1, p.horizontalSpeed / 4.5) : 0,
      eating: s.interaction.isEating,
      time: this.clock,
      light: this.daylight,
      bob: this.settings.gameplay.viewBobbing,
    })

    // Audio: listener follows the camera; animals call now and then.
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    this.audio.setListener(camera.position, fwd)
    for (const an of s.entities.animals) {
      if (!active) break
      an.idleSoundTimer -= dt
      if (an.idleSoundTimer <= 0 && an.alive) {
        an.idleSoundTimer = 8 + Math.random() * 20
        const d = Math.hypot(an.pos.x - cur.x, an.pos.z - cur.z)
        if (d < 24) this.audio.play(an.def.sounds.idle, { at: { x: an.pos.x, y: an.pos.y + 0.8, z: an.pos.z } })
      }
    }
    this.ambient.update(dt, { daylight: this.daylight, player: cur, altitude: cur.y, underwater, active })

    const firstPerson = this.cam.mode === 'first' && !s.dead
    this.renderer.render(firstPerson ? { scene: this.held.scene, camera: this.held.camera } : undefined)
  }

  debugText(fps: number, frameMs: number): string {
    const s = this.session
    const p = s.player.pos
    const cx = worldToChunk(p.x), cz = worldToChunk(p.z)
    const info = this.renderer.info
    const t = s.interaction.target
    const target = t?.kind === 'block' ? `${BlockRegistry.get(t.hit.blockId).name} @ ${t.hit.x} ${t.hit.y} ${t.hit.z}` : t?.kind === 'entity' ? `${t.animal.def.name} (${t.animal.health} HP)` : '—'
    const cs = this.chunks.stats
    const ms = this.meshes.stats
    const tod = this.timeOfDay
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
    const deg = ((((s.player.yaw * 180) / Math.PI) % 360) + 360) % 360
    return [
      `VoxelCraft  ${fps} fps  (${frameMs.toFixed(1)} ms render)`,
      `XYZ: ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}`,
      `Chunk: ${cx} ${cz}   local ${((Math.floor(p.x) % 16) + 16) % 16} ${Math.floor(p.y)} ${((Math.floor(p.z) % 16) + 16) % 16}`,
      `Facing: ${deg.toFixed(0)}°  pitch ${((s.player.pitch * 180) / Math.PI).toFixed(0)}°`,
      `Seed: ${s.metadata.seed}   Biome: ${s.world.generator.biomeAt(Math.floor(p.x), Math.floor(p.z))}`,
      `Chunks: ${cs.loaded} loaded, ${cs.pending} queued, ${ms.meshed} meshed (${ms.inFlight} meshing)`,
      `Triangles: ${ms.triangles.toLocaleString()}   Draw calls: ${info.calls}`,
      `Entities: ${s.entities.count} animals (${[...s.entities.dormant.values()].reduce((n, l) => n + l.length, 0)} dormant), ${s.pickups.items.length} items, ${this.particles.count} particles`,
      `Target: ${target}`,
      `Time: ${(tod * 24 + 6) % 24 | 0}h  day ${Math.floor(s.time / WORLD.dayLength) + 1}`,
      `Gen ${this.chunksGenMs().toFixed(1)} ms · mesh ${this.meshes.lastSyncMeshMs.toFixed(1)} ms (edit)`,
      mem ? `Heap: ${(mem.usedJSHeapSize / 1048576).toFixed(0)} MB` : '',
      s.player.debugMode ? 'DEBUG MODE (fly / instant break)' : '',
    ].filter(Boolean).join('\n')
  }

  private genMsRef: () => number = () => 0
  setGenMsSource(fn: () => number): void {
    this.genMsRef = fn
  }
  private chunksGenMs(): number {
    return this.genMsRef()
  }

  dispose(): void {
    for (const u of this.unsubs) u()
    this.ambient.stop()
    this.chunks.dispose()
    this.meshes.dispose()
    this.entityView.clear()
    this.particles.clear()
    this.renderer.scene.remove(this.meshes.group, this.entityView.group, this.highlight.group, this.particles.mesh, this.playerModel.root)
  }
}
