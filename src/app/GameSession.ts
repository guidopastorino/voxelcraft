import { EventBus, type DamageCause } from '../core/EventBus'
import { World, type ChunkDiffs } from '../world/World'
import { Player } from '../player/Player'
import { PlayerInteraction, type InteractInput } from '../player/PlayerInteraction'
import { updatePlayerMovement, type MoveInput } from '../player/PlayerController'
import { EntityManager } from '../entities/EntityManager'
import { PickupManager } from '../items/PickupEntity'
import { DEFAULT_GAME_RULES, PLAYER, SURVIVAL, WORLD, type GameRules } from '../config/defaults'
import type { WorldMetadata } from '../save/types'
import { CraftingGrid } from '../inventory/CraftingGrid'
import type { Inventory, Slot } from '../inventory/Inventory'
import { leftClick, rightClick, cursorAccepts } from '../inventory/SlotActions'
import type { ItemStack } from '../items/ItemStack'
import { canMerge, cloneStack } from '../items/ItemStack'
import { worldToChunk } from '../world/coords'
import { rollDrops } from '../items/DropSystem'
import type { Vec3 } from '../core/math'

export type TickInput = MoveInput & InteractInput

export const EMPTY_INPUT: TickInput = {
  forward: false, backward: false, left: false, right: false, jump: false, sprint: false,
  attack: false, use: false, attackPressed: false, usePressed: false,
}

export type Container = 'inventory' | 'crafting_table' | null

/**
 * Headless game simulation: world, player, animals, pickups, survival
 * rules, crafting and the world clock. No rendering, DOM or audio — the
 * browser layer (Game.ts) observes it through the event bus, and tests
 * drive it directly (see tests/goldenPath.test.ts).
 */
export class GameSession {
  readonly events = new EventBus()
  readonly world: World
  readonly player: Player
  readonly interaction: PlayerInteraction
  readonly entities: EntityManager
  readonly pickups = new PickupManager()
  readonly tableGrid = new CraftingGrid(3)
  rules: GameRules
  /** World clock in seconds (drives day/night). */
  time = WORLD.dayLength * 0.04
  dead = false
  deathCause: DamageCause | null = null
  /** Item held by the mouse in inventory screens. */
  cursor: Slot = null
  openContainer: Container = null
  /** Render distance used for animal top-ups. */
  activeRadius = 4
  rng: () => number
  onOpenCraftingTable?: () => void

  constructor(readonly metadata: WorldMetadata, opts: { diffs?: ChunkDiffs; rules?: GameRules; rng?: () => number; spawn?: Vec3 } = {}) {
    this.rng = opts.rng ?? Math.random
    this.world = new World(metadata.seed, opts.diffs)
    this.rules = { ...DEFAULT_GAME_RULES, ...opts.rules }
    const spawn = opts.spawn ?? this.world.findSpawn()
    this.player = new Player(spawn)
    this.interaction = new PlayerInteraction(this)
    this.entities = new EntityManager(metadata.seed)
    this.entities.onAnimalDied = (a) => {
      for (const drop of rollDrops(a.def.drops, this.rng)) {
        this.pickups.spawn(drop, { x: a.pos.x, y: a.pos.y + 0.5, z: a.pos.z }, undefined, this.world)
      }
    }
    this.pickups.onPicked = (stack) => this.events.emit('item:picked', { itemId: stack.itemId, count: stack.count })
    this.player.inventory.onChange(() => this.events.emit('inventory:changed', {}))
  }

  get spawnPoint(): Vec3 {
    return this.player.spawnPoint
  }

  /** Synchronously loads chunks around the player (tests, headless use). */
  loadAround(radius: number): void {
    const pcx = worldToChunk(this.player.pos.x), pcz = worldToChunk(this.player.pos.z)
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (!this.world.hasChunk(pcx + dx, pcz + dz)) {
          this.world.ensureChunk(pcx + dx, pcz + dz)
          this.onChunkLoaded(pcx + dx, pcz + dz)
        }
      }
    }
  }

  onChunkLoaded(cx: number, cz: number): void {
    this.entities.onChunkLoaded(cx, cz, this.world, this.player.pos, this.rules.animalSpawning)
  }

  onChunkUnloaded(cx: number, cz: number): void {
    this.entities.onChunkUnloaded(cx, cz)
  }

  /** One fixed simulation step. */
  tick(dt: number, input: TickInput): void {
    const p = this.player
    const uiOpen = this.openContainer !== null
    if (!this.dead) {
      const move = uiOpen ? EMPTY_INPUT : input
      const fall = updatePlayerMovement(p, move, this.world, dt, this.events)
      if (fall > 0) this.damagePlayer(fall, 'fall')
      if (uiOpen) this.interaction.cancel()
      else this.interaction.update(input, dt)
      const r = p.stats.tick(dt)
      if (r.starvationDamage > 0) this.afterDamage(r.starvationDamage, 'starvation')
      if (p.pos.y < -30) this.damagePlayer(1000, 'void')
    }
    p.hurtCooldown = Math.max(0, p.hurtCooldown - dt)

    if (this.rules.dayNightCycle) this.time += dt
    this.entities.update(dt, this.world, this.rng)
    if (this.rules.animalSpawning) this.entities.topUp(dt, this.world, p.pos, Math.max(2, this.activeRadius - 1), this.rng)
    this.pickups.update(dt, this.world, {
      pos: p.pos,
      canCollect: !this.dead,
      give: (stack) => p.inventory.add(stack),
    })
  }

  damagePlayer(amount: number, cause: DamageCause): void {
    if (this.dead || (this.player.debugMode && cause !== 'void')) return
    if (this.player.hurtCooldown > 0 && cause !== 'void') return
    const dealt = this.player.stats.damage(amount)
    this.player.hurtCooldown = PLAYER.hurtCooldown
    this.afterDamage(dealt, cause)
  }

  private afterDamage(dealt: number, cause: DamageCause): void {
    if (dealt > 0) this.events.emit('player:damaged', { amount: dealt, cause })
    if (this.player.stats.isDead && !this.dead) this.die(cause)
  }

  private die(cause: DamageCause): void {
    this.dead = true
    this.deathCause = cause
    this.interaction.cancel()
    this.closeContainer()
    if (!this.rules.keepInventory) {
      const inv = this.player.inventory
      for (let i = 0; i < inv.size; i++) {
        const s = inv.get(i)
        if (s) this.pickups.spawn(s, { ...this.player.pos, y: this.player.pos.y + 1 }, undefined, this.world, 2)
      }
      inv.clear()
    }
    this.events.emit('player:died', { cause })
  }

  respawn(): void {
    const p = this.player
    p.teleport(p.spawnPoint)
    // Make sure the spawn column is still free (the player may have built there).
    this.loadAround(1)
    for (let i = 0; i < 64 && (this.world.isSolid(Math.floor(p.pos.x), Math.floor(p.pos.y), Math.floor(p.pos.z)) || this.world.isSolid(Math.floor(p.pos.x), Math.floor(p.pos.y + 1), Math.floor(p.pos.z))); i++) {
      p.body.pos.y += 1
    }
    p.stats.reset(SURVIVAL.maxHunger)
    this.dead = false
    this.deathCause = null
    this.events.emit('player:respawned', {})
  }

  // ---------------------------------------------------------------- UI API

  requestOpenCraftingTable(): void {
    this.openContainer = 'crafting_table'
    this.interaction.cancel()
    this.onOpenCraftingTable?.()
  }

  openInventory(): void {
    this.openContainer = 'inventory'
    this.interaction.cancel()
  }

  activeGrid(): CraftingGrid {
    return this.openContainer === 'crafting_table' ? this.tableGrid : this.player.craftGrid
  }

  /** Returns cursor and crafting grid contents to the inventory (dropping overflow). */
  closeContainer(): void {
    const leftovers: ItemStack[] = [...this.player.craftGrid.drain(), ...this.tableGrid.drain()]
    if (this.cursor) leftovers.push(this.cursor)
    this.cursor = null
    for (const s of leftovers) {
      const rest = this.player.inventory.add(s)
      if (rest) this.throwStack(rest)
    }
    this.openContainer = null
  }

  /** Drops a stack in front of the player. */
  throwStack(stack: ItemStack): void {
    const eye = this.player.eyePosition()
    const dir = this.player.lookDirection()
    this.pickups.spawn(stack, { x: eye.x + dir.x * 0.4, y: eye.y - 0.3, z: eye.z + dir.z * 0.4 }, { x: dir.x * 5, y: dir.y * 5 + 2, z: dir.z * 5 }, this.world, 1.5)
  }

  /** Q: drop one item from the selected hotbar slot. */
  dropSelected(): void {
    const taken = this.player.inventory.takeFrom(this.player.hotbar.selected, 1)
    if (taken) this.throwStack(taken)
  }

  /** Mouse click on a slot of an inventory-like container (inventory or crafting grid). */
  clickSlot(inv: Inventory, index: number, button: 'left' | 'right', shift: boolean): void {
    if (shift) {
      if (inv === this.player.inventory) inv.quickMove(index)
      else {
        // From a crafting grid back into the player inventory.
        const s = inv.get(index)
        if (s) {
          const rest = this.player.inventory.add(s)
          inv.set(index, rest)
        }
      }
      this.events.emit('inventory:click', {})
      return
    }
    const fn = button === 'left' ? leftClick : rightClick
    const r = fn(inv.get(index), this.cursor)
    inv.set(index, r.slot)
    this.cursor = r.cursor
    this.events.emit('inventory:click', {})
  }

  /**
   * Clicking the crafting output: consumes ingredients once and puts the
   * result on the cursor; with shift, crafts as many as fit straight into
   * the inventory.
   */
  takeCraftResult(grid: CraftingGrid, shift: boolean): void {
    if (shift) {
      let crafted = 0
      for (let i = 0; i < 64; i++) {
        const out = grid.result()
        if (!out || this.player.inventory.spaceFor(out) < out.count) break
        const made = grid.craft()!
        this.player.inventory.add(made)
        crafted += made.count
        this.events.emit('craft:crafted', { itemId: made.itemId, count: made.count })
      }
      if (crafted) this.events.emit('inventory:click', {})
      return
    }
    const preview = grid.result()
    if (!preview || !cursorAccepts(this.cursor, preview)) return
    const made = grid.craft()!
    if (this.cursor && canMerge(this.cursor, made)) this.cursor = { ...this.cursor, count: this.cursor.count + made.count }
    else this.cursor = cloneStack(made)
    this.events.emit('craft:crafted', { itemId: made.itemId, count: made.count })
    this.events.emit('inventory:click', {})
  }

  /** Current mining progress snapshot for the renderer. */
  get miningProgress(): number {
    return this.interaction.mining?.progress ?? 0
  }
}
