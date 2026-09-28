import { Renderer } from '../render/Renderer'
import { AudioManager } from '../audio/AudioManager'
import { AmbientAudio } from '../audio/AmbientAudio'
import { InputManager } from '../input/InputManager'
import { SaveManager } from '../save/SaveManager'
import { loadSettings, saveSettings, getLastWorld, setLastWorld } from '../save/SettingsStorage'
import { StateMachine, type GameState } from './StateMachine'
import { GameLoop } from './GameLoop'
import { GameSession, EMPTY_INPUT, type TickInput } from './GameSession'
import { WorldRuntime } from './WorldRuntime'
import { MenuScene } from './MenuScene'
import { ChunkWorkerPool } from '../world/ChunkWorkerPool'
import { restoreSession, serializeSession } from '../save/WorldSerializer'
import { WORLD, type GameRules, type Settings } from '../config/defaults'
import type { WorldMetadata } from '../save/types'
import { HUD } from '../ui/HUD'
import { InventoryUI } from '../ui/InventoryUI'
import { LoadingScreen } from '../ui/LoadingScreen'
import { createMainMenu } from '../ui/MainMenu'
import { createWorldSelect } from '../ui/WorldSelectScreen'
import { createWorldCreate } from '../ui/WorldCreateScreen'
import { createPauseMenu } from '../ui/PauseMenu'
import { createSettings } from '../ui/SettingsUI'
import { createDeathScreen } from '../ui/DeathScreen'
import { DevConsole } from '../ui/DevConsole'
import { h, setUiSound } from '../ui/dom'
import { buildTerrainAtlas, buildCrackTextures } from '../assets/TerrainTextures'
import { preloadIcons } from '../assets/ItemIcons'
import { getSharedMaterials } from '../render/Textures'
import { B } from '../world/BlockRegistry'

const VERSION = '0.1.0'
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))

/**
 * Top-level orchestrator: boots assets, drives the state machine
 * (menus ↔ loading ↔ playing ↔ paused/inventory/dead), routes input by
 * context, and handles saving. World simulation lives in GameSession;
 * world presentation in WorldRuntime.
 */
export class Game {
  readonly renderer: Renderer
  readonly audio = new AudioManager()
  readonly input: InputManager
  readonly saves = new SaveManager()
  readonly fsm = new StateMachine()
  readonly pool = new ChunkWorkerPool()
  settings: Settings
  private loop: GameLoop
  private hud = new HUD()
  private screen: HTMLElement | null = null
  private menu: MenuScene | null = null
  private menuAmbient: AmbientAudio
  private runtime: WorldRuntime | null = null
  private inventoryUI: InventoryUI | null = null
  private loading: LoadingScreen | null = null
  private console: DevConsole
  private settingsReturn: 'MAIN_MENU' | 'PAUSED' = 'MAIN_MENU'
  private autosaveTimer = 0
  private saving: Promise<void> | null = null
  private saveQueued = false
  private debugOn = false
  private debugTimer = 0
  private pendingAttack = false
  private pendingUse = false
  /** We released pointer lock on purpose (inventory, death, console) — do not auto-pause. */
  private expectUnlock = false
  private loadStart = 0

  constructor(canvas: HTMLCanvasElement, private ui: HTMLElement) {
    this.settings = loadSettings()
    this.renderer = new Renderer(canvas)
    this.input = new InputManager(canvas, this.settings.controls.bindings)
    this.menuAmbient = new AmbientAudio(this.audio)
    this.console = new DevConsole(() => this.runtime?.session ?? null, () => {
      if (this.fsm.state === 'PLAYING') this.lockPointer()
    })
    ui.append(this.console.root)
    setUiSound(() => this.audio.play('click'))
    this.loop = new GameLoop((dt, first) => this.tick(dt, first), (dt, alpha) => this.frame(dt, alpha))
    this.fsm.onChange((to) => this.onState(to))
    this.applySettings()

    window.addEventListener('resize', () => {
      this.renderer.resize()
      this.applyUiScale()
    })
    // Any interaction may unlock audio.
    window.addEventListener('pointerdown', () => this.audio.resume(), { capture: true })
    window.addEventListener('keydown', () => this.audio.resume(), { capture: true })
    this.input.onPointerLockChange = (locked) => this.onPointerLock(locked)
    this.input.onKey = (code, e) => this.onKey(code, e)
    canvas.addEventListener('click', () => {
      if (this.fsm.state === 'PLAYING' && !this.input.pointerLocked) this.lockPointer()
    })
    window.addEventListener('beforeunload', () => void this.saveWorld())
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.runtime) void this.saveWorld()
    })
    if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = this
  }

  // ------------------------------------------------------------ lifecycle

  async boot(): Promise<void> {
    const screen = new LoadingScreen('Loading VoxelCraft…', ['Font', 'Textures', 'Icons', 'Sounds', 'Ready'])
    this.show(screen.root)
    this.loop.start()
    screen.set('Font', 0.2)
    try {
      await Promise.race([document.fonts.load('16px "Pixelify Sans"'), new Promise((r) => setTimeout(r, 1500))])
    } catch {
      /* fall back to monospace */
    }
    await nextFrame()
    screen.set('Textures', 0.2, 'Painting textures')
    buildTerrainAtlas()
    buildCrackTextures()
    getSharedMaterials()
    await nextFrame()
    screen.set('Icons', 0.2, 'Drawing item icons')
    preloadIcons()
    await nextFrame()
    screen.set('Sounds', 0.2, 'Synthesising sounds')
    this.audio.preload()
    await nextFrame()
    screen.set('Ready', 1)
    this.fsm.go('MAIN_MENU')
  }

  private applySettings(): void {
    const s = this.settings
    this.input.bindings = { ...s.controls.bindings }
    this.audio.setVolumes(s.audio)
    this.renderer.setFov(s.video.fov)
    this.hud.setCrosshairSize(s.gameplay.crosshairSize)
    this.runtime?.applySettings(s)
    this.applyUiScale()
  }

  private applyUiScale(): void {
    const auto = Math.max(1, Math.min(4, Math.floor(Math.min(window.innerHeight / 340, window.innerWidth / 620))))
    const scale = this.settings.gameplay.uiScale || auto
    document.documentElement.style.setProperty('--u', `${scale}px`)
  }

  private show(el: HTMLElement | null): void {
    this.screen?.remove()
    this.screen = el
    if (el) this.ui.append(el)
  }

  // ------------------------------------------------------------ states

  private onState(to: GameState): void {
    const inWorld = to === 'PLAYING' || to === 'INVENTORY' || to === 'PAUSED' || to === 'DEAD' || (to === 'SETTINGS' && this.settingsReturn === 'PAUSED')
    this.input.context = to === 'PLAYING' ? 'gameplay' : 'ui'
    if (!inWorld) this.hud.root.remove()
    else if (!this.hud.root.isConnected) this.ui.prepend(this.hud.root)
    if (this.inventoryUI && to !== 'INVENTORY') {
      this.inventoryUI.root.remove()
      this.inventoryUI = null
      this.runtime?.session.closeContainer()
    }

    switch (to) {
      case 'MAIN_MENU':
        this.showMainMenu()
        break
      case 'WORLD_SELECT':
        void this.showWorldSelect()
        break
      case 'WORLD_CREATE':
        void this.saves.listWorlds().then((ws) =>
          this.show(createWorldCreate({ create: (n, seed, rules) => this.createWorld(n, seed, rules), cancel: () => this.fsm.go('WORLD_SELECT') }, ws.map((w) => w.name))),
        ).catch(() => this.show(createWorldCreate({ create: (n, seed, rules) => this.createWorld(n, seed, rules), cancel: () => this.fsm.go('WORLD_SELECT') }, [])))
        break
      case 'PLAYING':
        this.show(null)
        this.lockPointer()
        break
      case 'INVENTORY': {
        const s = this.runtime!.session
        this.inventoryUI = new InventoryUI(s, s.openContainer === 'crafting_table' ? 'crafting_table' : 'inventory')
        this.show(this.inventoryUI.root)
        this.releasePointer()
        break
      }
      case 'PAUSED':
        this.releasePointer()
        this.show(createPauseMenu({
          resume: () => this.fsm.go('PLAYING'),
          settings: () => {
            this.settingsReturn = 'PAUSED'
            this.fsm.go('SETTINGS')
          },
          save: () => void this.saveWorld(),
          mainMenu: () => void this.quitToMenu(),
        }))
        void this.saveWorld()
        break
      case 'DEAD': {
        const s = this.runtime!.session
        this.releasePointer()
        this.show(createDeathScreen(s.deathCause, s.rules.keepInventory, {
          respawn: () => {
            s.respawn()
            this.fsm.go('PLAYING')
          },
          mainMenu: () => void this.quitToMenu(),
        }))
        break
      }
      case 'SETTINGS':
        this.show(createSettings(
          this.settings,
          (s) => {
            this.settings = s
            saveSettings(s)
            this.applySettings()
          },
          () => this.fsm.go(this.settingsReturn),
        ))
        break
    }
  }

  private showMainMenu(): void {
    if (!this.menu) this.menu = new MenuScene(this.renderer, this.pool)
    this.menuAmbient.start()
    this.show(createMainMenu({
      singleplayer: () => this.fsm.go('WORLD_SELECT'),
      settings: () => {
        this.settingsReturn = 'MAIN_MENU'
        this.fsm.go('SETTINGS')
      },
      quit: () => {
        window.close()
        this.hud.toast('You can close this tab now.')
        this.show(h('div', { class: 'screen dark' }, h('h2', { class: 'title' }, 'Thanks for playing!'), h('div', { class: 'subtitle' }, 'You can close this tab now. Reload to play again.')))
      },
    }, VERSION))
  }

  private async showWorldSelect(): Promise<void> {
    let worlds: WorldMetadata[] = []
    try {
      worlds = await this.saves.listWorlds()
    } catch (err) {
      console.error(err)
      this.hud.toast('Could not open saved worlds (storage blocked?)')
    }
    if (this.fsm.state !== 'WORLD_SELECT') return
    this.show(createWorldSelect(worlds, {
      play: (id) => void this.loadWorld(id),
      create: () => this.fsm.go('WORLD_CREATE'),
      remove: (id) => this.saves.delete(id),
      back: () => this.fsm.go('MAIN_MENU'),
    }, getLastWorld()))
  }

  // ------------------------------------------------------------ worlds

  private createWorld(name: string, seed: number, rules: GameRules): void {
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `w${Date.now()}${Math.floor(Math.random() * 1e6)}`
    const now = Date.now()
    const meta: WorldMetadata = { id, name, seed, createdAt: now, updatedAt: now, version: WORLD.saveVersion }
    this.enterLoading()
    // Spawn search generates a few chunks synchronously; let the loading screen paint first.
    requestAnimationFrame(() => {
      const session = new GameSession(meta, { rules })
      this.startWorld(session, true)
    })
  }

  private async loadWorld(id: string): Promise<void> {
    this.enterLoading()
    try {
      const save = await this.saves.load(id)
      if (!save) throw new Error('World not found')
      this.startWorld(restoreSession(save), false)
    } catch (err) {
      console.error(err)
      this.fsm.go('MAIN_MENU')
      this.hud.toast('Could not load that world')
    }
  }

  private enterLoading(): void {
    this.loading = new LoadingScreen()
    this.loading.set('Terrain', 0)
    this.fsm.go('LOADING_WORLD')
    this.show(this.loading.root)
    this.menuAmbient.stop()
  }

  private startWorld(session: GameSession, isNew: boolean): void {
    this.menu?.dispose()
    this.menu = null
    setLastWorld(session.metadata.id)
    this.runtime = new WorldRuntime(session, this.renderer, this.audio, this.pool, this.settings, this.hud)
    this.runtime.setGenMsSource(() => this.pool.genMs)
    session.onOpenCraftingTable = () => {
      if (this.fsm.state === 'PLAYING') this.fsm.go('INVENTORY')
    }
    session.events.on('player:died', () => {
      if (this.fsm.can('DEAD')) this.fsm.go('DEAD')
    })
    session.events.on('world:saved', () => this.hud.showSaving('saved'))
    this.autosaveTimer = 0
    this.loadStart = performance.now()
    if (isNew) void this.saveWorld()
  }

  private async quitToMenu(): Promise<void> {
    await this.saveWorld()
    this.teardownWorld()
    this.fsm.go('MAIN_MENU')
  }

  private teardownWorld(): void {
    this.releasePointer()
    this.runtime?.dispose()
    this.runtime = null
  }

  /** Serialises and writes the world without blocking gameplay. Coalesces overlapping requests. */
  saveWorld(): Promise<void> {
    const rt = this.runtime
    if (!rt) return Promise.resolve()
    if (this.saving) {
      this.saveQueued = true
      return this.saving
    }
    this.hud.showSaving('saving')
    rt.session.events.emit('world:saving', {})
    const data = serializeSession(rt.session)
    rt.session.metadata.updatedAt = data.metadata.updatedAt
    this.saving = this.saves
      .save(data)
      .then(() => rt.session.events.emit('world:saved', {}))
      .catch((err) => {
        console.error('save failed', err)
        this.hud.showSaving('failed')
        rt.session.events.emit('world:saveFailed', { error: String(err) })
      })
      .finally(() => {
        this.saving = null
        if (this.saveQueued) {
          this.saveQueued = false
          void this.saveWorld()
        }
      })
    return this.saving
  }

  // ------------------------------------------------------------ input

  private lockPointer(): void {
    this.expectUnlock = false
    this.input.requestPointerLock()
  }

  private releasePointer(): void {
    this.expectUnlock = true
    this.input.exitPointerLock()
  }

  private onPointerLock(locked: boolean): void {
    if (!locked && this.fsm.state === 'PLAYING' && !this.expectUnlock && !this.console.open) this.fsm.go('PAUSED')
    if (locked) this.expectUnlock = false
  }

  /** Global keys that work regardless of pointer lock. Return true to swallow. */
  private onKey(code: string, e: KeyboardEvent): boolean {
    if (this.console.open) return false
    const st = this.fsm.state
    const b = this.settings.controls.bindings
    if (code === 'Escape') {
      if (st === 'INVENTORY') this.fsm.go('PLAYING')
      else if (st === 'PAUSED') this.fsm.go('PLAYING')
      else if (st === 'SETTINGS') this.fsm.go(this.settingsReturn)
      else if (st === 'PLAYING' && !this.input.pointerLocked) this.fsm.go('PAUSED')
      else if (st === 'WORLD_SELECT') this.fsm.go('MAIN_MENU')
      else if (st === 'WORLD_CREATE') this.fsm.go('WORLD_SELECT')
      return true
    }
    if (code === b.inventory && !e.repeat) {
      if (st === 'INVENTORY') {
        this.fsm.go('PLAYING')
        return true
      }
      if (st === 'PLAYING') {
        this.runtime!.session.openInventory()
        this.fsm.go('INVENTORY')
        return true
      }
    }
    if (st === 'PLAYING' && import.meta.env.DEV && (code === 'Slash' || code === 'KeyT') && !e.repeat) {
      this.expectUnlock = true
      this.input.exitPointerLock()
      this.console.show(code === 'Slash' ? '/' : '')
      return true
    }
    return false
  }

  private buildInput(first: boolean): TickInput {
    if (this.fsm.state !== 'PLAYING' || !this.input.pointerLocked) return EMPTY_INPUT
    const i = this.input
    const input: TickInput = {
      forward: i.isDown('forward'),
      backward: i.isDown('backward'),
      left: i.isDown('left'),
      right: i.isDown('right'),
      jump: i.isDown('jump'),
      sprint: i.isDown('sprint'),
      attack: i.isDown('attack'),
      use: i.isDown('use'),
      attackPressed: first && this.pendingAttack,
      usePressed: first && this.pendingUse,
    }
    if (first) {
      this.pendingAttack = false
      this.pendingUse = false
    }
    return input
  }

  // ------------------------------------------------------------ loop

  private tick(dt: number, first: boolean): void {
    const rt = this.runtime
    if (!rt || !this.fsm.simulating) return
    rt.beforeTick()
    rt.session.tick(dt, this.buildInput(first))
  }

  private frame(dt: number, alpha: number): void {
    const st = this.fsm.state
    const rt = this.runtime

    if (st === 'PLAYING' && rt) {
      const i = this.input
      if (i.wasPressed('attack')) this.pendingAttack = true
      if (i.wasPressed('use')) this.pendingUse = true
      const { dx, dy } = i.consumeMouse()
      const k = this.settings.controls.sensitivity * 0.005
      rt.session.player.look(-dx * k, -dy * k * (this.settings.controls.invertY ? -1 : 1))
      const wheel = i.consumeWheel()
      if (wheel) rt.session.player.hotbar.scroll(wheel)
      if (i.hotbarKey !== null) rt.session.player.hotbar.select(i.hotbarKey)
      if (i.wasPressed('camera')) rt.cam.cycle()
      if (i.wasPressed('debug')) this.debugOn = !this.debugOn
      if (i.wasPressed('drop')) rt.session.dropSelected()
    } else {
      this.input.consumeMouse()
      this.input.consumeWheel()
    }

    if (st === 'LOADING_WORLD' && rt) {
      this.updateLoading(rt)
      rt.frame(dt, 1, false)
    } else if (rt && st !== 'MAIN_MENU') {
      const active = st === 'PLAYING'
      rt.frame(dt, this.fsm.simulating ? alpha : 1, active)
      this.hud.update(rt.session, dt)
      this.inventoryUI?.refresh()
      if (st === 'PLAYING' || st === 'INVENTORY') {
        this.autosaveTimer += dt
        if (this.autosaveTimer >= WORLD.autosaveSeconds) {
          this.autosaveTimer = 0
          void this.saveWorld()
        }
      }
      this.debugTimer -= dt
      if (this.debugTimer <= 0) {
        this.debugTimer = 0.25
        this.hud.setDebug(this.debugOn ? rt.debugText(this.loop.fps, this.loop.frameMs) : null)
      }
    } else if (this.menu) {
      this.menu.update(dt)
      this.menuAmbient.update(dt, { daylight: 1, player: { x: 0, y: 60, z: 0 }, altitude: 60, underwater: false, active: false })
      this.renderer.render()
    } else {
      this.renderer.render()
    }
    this.hud.setClickHint(st === 'PLAYING' && !this.input.pointerLocked && !this.console.open)
    this.input.endFrame()
  }

  private updateLoading(rt: WorldRuntime): void {
    const { terrain, meshing } = rt.loadingProgress()
    const ls = this.loading!
    if (terrain < 1) ls.set('Terrain', terrain, `${rt.chunks.stats.loaded} chunks`)
    else if (meshing < 1) ls.set('Meshing', meshing)
    else {
      ls.set('Spawning entities', 1)
      const s = rt.session
      // Never start inside a block (e.g. someone built over the spawn).
      const p = s.player.pos
      for (let i = 0; i < 64; i++) {
        const feet = s.world.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z))
        const head = s.world.getBlock(Math.floor(p.x), Math.floor(p.y + 1), Math.floor(p.z))
        const free = (id: number) => id === B.AIR || id === B.WATER
        if (free(feet) && free(head)) break
        s.player.body.pos.y += 1
      }
      ls.set('Ready', 1, `${((performance.now() - this.loadStart) / 1000).toFixed(1)} s`)
      this.loading = null
      this.loop.resetClock()
      this.fsm.go(rt.session.dead ? 'DEAD' : 'PLAYING')
    }
  }
}
