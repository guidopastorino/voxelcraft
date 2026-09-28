import type { Material, ToolTierName, ToolType } from '../world/BlockTypes'

export interface ToolDefinition {
  id: string
  toolType: ToolType
  tier: ToolTierName

  damage: number
  /** Seconds between full-strength attacks. */
  attackCooldown: number

  /** Break-speed multiplier per material. Materials not listed use 1 (or the sword penalty). */
  miningSpeed: Partial<Record<Material, number>>

  durability: number
}

export interface FoodDefinition {
  hunger: number
  /** Seconds the use button must be held. */
  eatTime: number
}

export type ItemKind = 'block' | 'tool' | 'food' | 'material'

export interface ItemDefinition {
  id: string
  name: string
  kind: ItemKind
  maxStack: number
  /** For block items: the block placed. */
  blockId?: number
  tool?: ToolDefinition
  food?: FoodDefinition
  /** Icon key in the procedural icon atlas (defaults to id). */
  icon?: string
}

/** Stats used when nothing (or a non-weapon item) is held. */
export const HAND = { damage: 1, attackCooldown: 0.35 } as const
