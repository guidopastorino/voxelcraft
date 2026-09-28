import { GameSession } from '../app/GameSession'
import type { SerializedChunkDiff, SerializedEntity, SerializedInventory, WorldSave } from './types'
import type { ChunkDiffs } from '../world/World'
import type { Inventory } from '../inventory/Inventory'
import { ItemRegistry } from '../items/ItemRegistry'
import { BlockRegistry, B } from '../world/BlockRegistry'
import { CHUNK_VOLUME } from '../world/constants'
import { parseChunkKey } from '../world/coords'
import { DEFAULT_GAME_RULES, SURVIVAL, WORLD } from '../config/defaults'
import { clamp } from '../core/math'

/**
 * Converts a live session to a plain JSON-safe WorldSave and back.
 * Only the seed and player-made diffs are stored for terrain; everything
 * else is regenerated deterministically on load.
 */
export function serializeInventory(inv: Inventory): SerializedInventory {
  const out: SerializedInventory = []
  inv.slots.forEach((s, slot) => {
    if (s) out.push({ slot, stack: s.damage === undefined ? { itemId: s.itemId, count: s.count } : { ...s } })
  })
  return out
}

export function restoreInventory(inv: Inventory, data: SerializedInventory): void {
  inv.clear()
  for (const { slot, stack } of data) {
    // Skip anything invalid rather than crash on an old or tampered save.
    if (slot < 0 || slot >= inv.size || !ItemRegistry.has(stack.itemId)) continue
    const max = ItemRegistry.get(stack.itemId).maxStack
    const count = Math.floor(stack.count)
    if (!(count > 0)) continue
    inv.set(slot, stack.damage === undefined ? { itemId: stack.itemId, count: Math.min(count, max) } : { itemId: stack.itemId, count: 1, damage: stack.damage })
  }
}

export function serializeDiffs(diffs: ChunkDiffs): SerializedChunkDiff[] {
  const out: SerializedChunkDiff[] = []
  for (const [key, map] of diffs) {
    if (map.size === 0) continue
    const changes: number[] = []
    for (const [i, id] of map) changes.push(i, id)
    out.push({ key, changes })
  }
  return out
}

export function deserializeDiffs(list: SerializedChunkDiff[]): ChunkDiffs {
  const diffs: ChunkDiffs = new Map()
  for (const { key, changes } of list) {
    try {
      parseChunkKey(key)
    } catch {
      continue
    }
    const map = new Map<number, number>()
    for (let i = 0; i + 1 < changes.length; i += 2) {
      const idx = changes[i], id = changes[i + 1]
      if (!Number.isInteger(idx) || idx < 0 || idx >= CHUNK_VOLUME) continue
      map.set(idx, BlockRegistry.has(id) ? id : B.AIR)
    }
    diffs.set(key, map)
  }
  return diffs
}

export function serializeSession(s: GameSession): WorldSave {
  const p = s.player
  const entities: SerializedEntity[] = [
    ...s.entities.serializeAll().map((a) => ({ type: 'animal' as const, ...a })),
    ...s.pickups.serialize().map((i) => ({ type: 'item' as const, ...i })),
  ]
  // Items parked in the cursor/crafting grid belong to the player on reload.
  const inv = serializeInventory(p.inventory)
  return {
    metadata: { ...s.metadata, updatedAt: Date.now(), version: WORLD.saveVersion },
    player: {
      position: { ...p.pos },
      rotation: { x: p.yaw, y: p.pitch },
      health: p.stats.health,
      hunger: p.stats.hunger,
      exhaustion: p.stats.exhaustion,
      selectedHotbarSlot: p.hotbar.selected,
      inventory: inv,
      spawnPoint: { ...p.spawnPoint },
    },
    modifiedChunks: serializeDiffs(s.world.diffs),
    entities,
    spawnedChunks: [...s.entities.spawnedChunks],
    time: s.time,
    rules: { ...s.rules },
  }
}

const finite = (n: unknown, fallback: number) => (typeof n === 'number' && Number.isFinite(n) ? n : fallback)

/** seed → regenerate → apply chunk diffs → restore player and entities. */
export function restoreSession(save: WorldSave, rng?: () => number): GameSession {
  const sp = save.player
  const session = new GameSession(save.metadata, {
    diffs: deserializeDiffs(save.modifiedChunks ?? []),
    rules: { ...DEFAULT_GAME_RULES, ...save.rules },
    rng,
    spawn: sp.spawnPoint,
  })
  const p = session.player
  p.spawnPoint = { ...sp.spawnPoint }
  p.teleport({ x: finite(sp.position.x, sp.spawnPoint.x), y: finite(sp.position.y, sp.spawnPoint.y), z: finite(sp.position.z, sp.spawnPoint.z) })
  p.yaw = finite(sp.rotation.x, 0)
  p.pitch = finite(sp.rotation.y, 0)
  p.stats.health = clamp(finite(sp.health, SURVIVAL.maxHealth), 0, SURVIVAL.maxHealth)
  p.stats.hunger = clamp(finite(sp.hunger, SURVIVAL.maxHunger), 0, SURVIVAL.maxHunger)
  p.stats.exhaustion = Math.max(0, finite(sp.exhaustion, 0))
  if (p.stats.health <= 0) p.stats.health = 1
  p.hotbar.select(finite(sp.selectedHotbarSlot, 0))
  restoreInventory(p.inventory, sp.inventory ?? [])
  session.time = finite(save.time, session.time)
  for (const k of save.spawnedChunks ?? []) session.entities.spawnedChunks.add(k)
  const all = save.entities ?? []
  const animals = all.filter((e): e is Extract<SerializedEntity, { type: 'animal' }> => e.type === 'animal')
  const items = all.filter((e): e is Extract<SerializedEntity, { type: 'item' }> => e.type === 'item' && ItemRegistry.has(e.itemId))
  // Nothing is loaded yet, so every animal starts dormant and wakes with its chunk.
  session.entities.restore(animals, () => false)
  session.pickups.restore(items)
  return session
}
