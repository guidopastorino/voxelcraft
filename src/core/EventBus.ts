/**
 * Minimal typed event bus. Decouples gameplay from audio/UI/persistence:
 * systems emit facts ("block:broken") and listeners react without the
 * emitter knowing who is listening.
 */
import type { Vec3 } from './math'

export interface GameEvents {
  'block:hit': { x: number; y: number; z: number; blockId: number }
  'block:broken': { x: number; y: number; z: number; blockId: number }
  'block:placed': { x: number; y: number; z: number; blockId: number }
  'item:picked': { itemId: string; count: number }
  'item:consumed': { itemId: string }
  'tool:broken': { itemId: string }
  'player:damaged': { amount: number; cause: DamageCause }
  'player:died': { cause: DamageCause }
  'player:respawned': Record<string, never>
  'player:footstep': { material: string; position: Vec3 }
  'player:jump': Record<string, never>
  'player:swing': Record<string, never>
  'player:ate': { itemId: string }
  'player:eating': Record<string, never>
  'animal:hurt': { kind: string; position: Vec3 }
  'animal:killed': { kind: string; position: Vec3 }
  'animal:idle': { kind: string; position: Vec3 }
  'inventory:changed': Record<string, never>
  'inventory:click': Record<string, never>
  'craft:crafted': { itemId: string; count: number }
  'world:saving': Record<string, never>
  'world:saved': Record<string, never>
  'world:saveFailed': { error: string }
}

export type DamageCause = 'fall' | 'starvation' | 'void' | 'debug'

type Handler<T> = (payload: T) => void

export class EventBus {
  private handlers = new Map<keyof GameEvents, Set<Handler<unknown>>>()

  on<K extends keyof GameEvents>(type: K, handler: Handler<GameEvents[K]>): () => void {
    let set = this.handlers.get(type)
    if (!set) {
      set = new Set()
      this.handlers.set(type, set)
    }
    set.add(handler as Handler<unknown>)
    return () => set!.delete(handler as Handler<unknown>)
  }

  emit<K extends keyof GameEvents>(type: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(type)
    if (!set) return
    for (const h of set) h(payload)
  }

  clear(): void {
    this.handlers.clear()
  }
}
