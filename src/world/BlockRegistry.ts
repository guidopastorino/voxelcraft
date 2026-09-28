import { BLOCKS } from '../config/blocks'
import type { BlockDefinition } from './BlockTypes'
import { assert } from '../core/assert'

/**
 * Lookup tables built once from config. Hot paths (meshing, physics) use the
 * flat typed arrays rather than walking definition objects.
 */
class BlockRegistryImpl {
  readonly defs: BlockDefinition[] = []
  private byKey = new Map<string, BlockDefinition>()
  /** 1 if the block collides. Indexed by block ID. */
  readonly solid: Uint8Array
  /** 1 if faces behind this block must still be drawn. */
  readonly transparent: Uint8Array
  readonly liquid: Uint8Array

  constructor(defs: BlockDefinition[]) {
    const max = defs.reduce((m, d) => Math.max(m, d.id), 0) + 1
    this.solid = new Uint8Array(max)
    this.transparent = new Uint8Array(max)
    this.liquid = new Uint8Array(max)
    for (const def of defs) {
      assert(!this.defs[def.id], `duplicate block id ${def.id}`)
      assert(!this.byKey.has(def.key), `duplicate block key ${def.key}`)
      this.defs[def.id] = def
      this.byKey.set(def.key, def)
      this.solid[def.id] = def.solid ? 1 : 0
      this.transparent[def.id] = def.transparent ? 1 : 0
      this.liquid[def.id] = def.liquid ? 1 : 0
    }
  }

  get(id: number): BlockDefinition {
    const def = this.defs[id]
    assert(def, `unknown block id ${id}`)
    return def
  }

  has(id: number): boolean {
    return Number.isInteger(id) && id >= 0 && this.defs[id] !== undefined
  }

  byName(key: string): BlockDefinition {
    const def = this.byKey.get(key)
    assert(def, `unknown block key ${key}`)
    return def
  }

  idOf(key: string): number {
    return this.byName(key).id
  }

  tryByName(key: string): BlockDefinition | undefined {
    return this.byKey.get(key)
  }
}

export const BlockRegistry = new BlockRegistryImpl(BLOCKS)

/** Frequently used IDs, resolved from config so they never drift. */
export const B = {
  AIR: BlockRegistry.idOf('air'),
  GRASS: BlockRegistry.idOf('grass'),
  DIRT: BlockRegistry.idOf('dirt'),
  STONE: BlockRegistry.idOf('stone'),
  SAND: BlockRegistry.idOf('sand'),
  LOG: BlockRegistry.idOf('log'),
  LEAVES: BlockRegistry.idOf('leaves'),
  PLANKS: BlockRegistry.idOf('planks'),
  WATER: BlockRegistry.idOf('water'),
  CRAFTING_TABLE: BlockRegistry.idOf('crafting_table'),
  BEDROCK: BlockRegistry.idOf('bedrock'),
} as const
