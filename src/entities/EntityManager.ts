import { Animal } from './Animal'
import { updateAnimal, type AIWorld } from './AnimalAI'
import { ANIMAL_DEFS } from '../config/animals'
import { ANIMALS } from '../config/defaults'
import type { Vec3 } from '../core/math'
import { CHUNK_SIZE, SEA_LEVEL } from '../world/constants'
import { chunkKey, worldToChunk } from '../world/coords'
import { SeededRandom, hash3 } from '../world/SeededRandom'
import { B } from '../world/BlockRegistry'
import { overlapsSolid } from '../physics/VoxelPhysics'

export interface SerializedAnimal {
  kind: string
  x: number
  y: number
  z: number
  yaw: number
  health: number
}

export interface SpawnWorld extends AIWorld {
  surfaceY(x: number, z: number): number
  isLoadedAt(x: number, z: number): boolean
}

const DEATH_DURATION = 0.8

/**
 * Owns living animals. Animals in chunks that unload are frozen into a
 * per-chunk "dormant" list and thawed when the chunk returns, so they
 * persist across exploration and saves.
 */
export class EntityManager {
  animals: Animal[] = []
  readonly dormant = new Map<string, SerializedAnimal[]>()
  readonly spawnedChunks = new Set<string>()
  private topUpTimer = 0
  onAnimalDied?: (a: Animal) => void

  constructor(private seed: number) {}

  get count(): number {
    return this.animals.length
  }

  update(dt: number, world: SpawnWorld, rng: () => number): void {
    for (const a of this.animals) {
      if (!world.isLoadedAt(a.pos.x, a.pos.z)) continue
      updateAnimal(a, world, dt, rng)
      if (a.pos.y < -20) a.removed = true
      if (a.deathTimer >= DEATH_DURATION && !a.removed) {
        a.removed = true
        this.onAnimalDied?.(a)
      }
    }
    if (this.animals.some((a) => a.removed)) this.animals = this.animals.filter((a) => !a.removed)
  }

  /** Validates a spawn column: grass surface above sea level with room for the animal. */
  private trySpawnAt(world: SpawnWorld, kind: string, x: number, z: number, player: Vec3 | null): Animal | null {
    if (!world.isLoadedAt(x, z)) return null
    const y = world.surfaceY(x, z)
    if (y <= SEA_LEVEL || world.getBlock(x, y, z) !== B.GRASS) return null
    if (player && Math.hypot(x + 0.5 - player.x, z + 0.5 - player.z) < ANIMALS.minSpawnDistance) return null
    const a = new Animal(kind, { x: x + 0.5, y: y + 1, z: z + 0.5 })
    if (overlapsSolid(world, a.body)) return null
    return a
  }

  /**
   * First time a chunk is seen: deterministic 0–2 animals, capped by the
   * global population limit. Later visits rely on dormant state/top-ups.
   */
  onChunkLoaded(cx: number, cz: number, world: SpawnWorld, player: Vec3 | null, spawning: boolean): void {
    const key = chunkKey(cx, cz)
    const sleeping = this.dormant.get(key)
    if (sleeping) {
      this.dormant.delete(key)
      for (const s of sleeping) this.animals.push(deserializeAnimal(s))
    }
    if (this.spawnedChunks.has(key)) return
    this.spawnedChunks.add(key)
    if (!spawning) return
    const rng = new SeededRandom(hash3(this.seed, cx, cz, 404))
    const n = Math.floor(rng.next() * (ANIMALS.maxPerChunk + 1))
    const kind = rng.next() < 0.5 ? 'pig' : 'cow'
    for (let i = 0; i < n && this.animals.length < ANIMALS.maxAnimals; i++) {
      const x = cx * CHUNK_SIZE + rng.int(1, CHUNK_SIZE - 2)
      const z = cz * CHUNK_SIZE + rng.int(1, CHUNK_SIZE - 2)
      const a = this.trySpawnAt(world, kind, x, z, player)
      if (a) this.animals.push(a)
    }
  }

  onChunkUnloaded(cx: number, cz: number): void {
    const keep: Animal[] = []
    const frozen: SerializedAnimal[] = []
    for (const a of this.animals) {
      if (worldToChunk(a.pos.x) === cx && worldToChunk(a.pos.z) === cz && a.alive) frozen.push(serializeAnimal(a))
      else if (worldToChunk(a.pos.x) !== cx || worldToChunk(a.pos.z) !== cz) keep.push(a)
    }
    this.animals = keep
    if (frozen.length) {
      const key = chunkKey(cx, cz)
      this.dormant.set(key, [...(this.dormant.get(key) ?? []), ...frozen])
    }
  }

  /** Occasionally repopulates loaded areas when hunting has thinned the herds. */
  topUp(dt: number, world: SpawnWorld, player: Vec3, radiusChunks: number, rng: () => number): void {
    this.topUpTimer += dt
    if (this.topUpTimer < ANIMALS.respawnInterval) return
    this.topUpTimer = 0
    const target = Math.min(ANIMALS.maxAnimals, 6 + radiusChunks * 2)
    if (this.animals.length >= target) return
    const kinds = Object.keys(ANIMAL_DEFS)
    const kind = kinds[Math.floor(rng() * kinds.length)]
    const pcx = worldToChunk(player.x), pcz = worldToChunk(player.z)
    for (let attempt = 0; attempt < 8; attempt++) {
      const cx = pcx + Math.round((rng() * 2 - 1) * radiusChunks)
      const cz = pcz + Math.round((rng() * 2 - 1) * radiusChunks)
      const x = cx * CHUNK_SIZE + Math.floor(rng() * CHUNK_SIZE)
      const z = cz * CHUNK_SIZE + Math.floor(rng() * CHUNK_SIZE)
      const first = this.trySpawnAt(world, kind, x, z, player)
      if (!first) continue
      this.animals.push(first)
      // Animals come in small herds.
      for (let i = 0; i < 1 + Math.floor(rng() * 2); i++) {
        const b = this.trySpawnAt(world, kind, x + Math.floor(rng() * 5) - 2, z + Math.floor(rng() * 5) - 2, player)
        if (b) this.animals.push(b)
      }
      return
    }
  }

  serializeAll(): SerializedAnimal[] {
    const out = this.animals.filter((a) => a.alive).map(serializeAnimal)
    for (const list of this.dormant.values()) out.push(...list)
    return out
  }

  /** Restores saved animals; ones in unloaded chunks go dormant until their chunk loads. */
  restore(list: SerializedAnimal[], isLoaded: (x: number, z: number) => boolean): void {
    this.animals = []
    this.dormant.clear()
    for (const s of list) {
      if (!ANIMAL_DEFS[s.kind]) continue
      if (isLoaded(s.x, s.z)) this.animals.push(deserializeAnimal(s))
      else {
        const key = chunkKey(worldToChunk(s.x), worldToChunk(s.z))
        this.dormant.set(key, [...(this.dormant.get(key) ?? []), s])
      }
    }
  }
}

export function serializeAnimal(a: Animal): SerializedAnimal {
  return { kind: a.kind, x: a.pos.x, y: a.pos.y, z: a.pos.z, yaw: a.yaw, health: a.health }
}

export function deserializeAnimal(s: SerializedAnimal): Animal {
  const a = new Animal(s.kind, { x: s.x, y: s.y, z: s.z }, s.health)
  a.yaw = s.yaw
  a.heading = s.yaw
  return a
}
