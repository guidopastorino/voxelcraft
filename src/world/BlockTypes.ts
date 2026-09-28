/** Block-related types shared by config, world generation, meshing and gameplay. */

export type ToolType = 'pickaxe' | 'axe' | 'shovel' | 'sword'

/** Tool tiers: hand = 0, wood = 1, stone = 2. Blocks can require a minimum tier to drop. */
export type ToolTierName = 'wood' | 'stone'
export const TOOL_TIER_LEVEL: Record<ToolTierName | 'hand', number> = { hand: 0, wood: 1, stone: 2 }

/**
 * Material drives step/hit/break sounds and particles, so those never need
 * to be hardcoded per block.
 */
export type Material = 'grass' | 'soil' | 'rock' | 'sand' | 'wood' | 'leaves' | 'water' | 'none'

export interface DropDefinition {
  itemId: string
  min: number
  max: number
  /** Probability 0..1 that this drop happens at all (default 1). */
  chance?: number
}

export interface BlockTextures {
  top?: string
  bottom?: string
  side?: string
  all?: string
}

export interface BlockDefinition {
  id: number
  key: string
  name: string
  material: Material

  solid: boolean
  /** Neighbours of a transparent block keep their faces (leaves, water, air). */
  transparent: boolean
  liquid: boolean

  /** Seconds to break by hand. Infinity = unbreakable. */
  hardness: number

  preferredTool?: ToolType
  /** Minimum tool tier (of preferredTool) required for the block to drop anything. */
  minToolTier?: number

  drops?: DropDefinition[]

  textures: BlockTextures

  /** Block can be interacted with using RMB (e.g. opens a UI). */
  interaction?: 'crafting_table'
}

export const AIR = 0
