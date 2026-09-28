import type { Vec2, Vec3 } from '../core/math'
import type { GameRules } from '../config/defaults'
import type { SerializedAnimal } from '../entities/EntityManager'
import type { SerializedPickup } from '../items/PickupEntity'

export interface WorldMetadata {
  id: string
  name: string
  seed: number
  createdAt: number
  updatedAt: number
  version: number
}

export interface SerializedStack {
  itemId: string
  count: number
  damage?: number
}

/** Slot index → stack; only non-empty slots are stored. */
export type SerializedInventory = Array<{ slot: number; stack: SerializedStack }>

export interface SerializedChunkDiff {
  key: string
  /** Flattened [blockIndex, blockId, blockIndex, blockId, ...]. */
  changes: number[]
}

export type SerializedEntity = ({ type: 'animal' } & SerializedAnimal) | ({ type: 'item' } & SerializedPickup)

export interface WorldSave {
  metadata: WorldMetadata
  player: {
    position: Vec3
    rotation: Vec2
    health: number
    hunger: number
    exhaustion: number
    selectedHotbarSlot: number
    inventory: SerializedInventory
    spawnPoint: Vec3
  }
  modifiedChunks: SerializedChunkDiff[]
  entities: SerializedEntity[]
  spawnedChunks: string[]
  /** World clock in seconds. */
  time: number
  rules: GameRules
}
