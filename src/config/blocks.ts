import type { BlockDefinition } from '../world/BlockTypes'

/**
 * Block definitions. IDs are stable: they are stored in chunk arrays and
 * save files, so never renumber existing entries — append new ones.
 *
 * `hardness` is the break time in seconds with bare hands; tools divide it
 * by their per-material speed (see items/Mining.ts).
 */
export const BLOCKS: BlockDefinition[] = [
  { id: 0, key: 'air', name: 'Air', material: 'none', solid: false, transparent: true, liquid: false, hardness: 0, textures: {} },
  {
    id: 1, key: 'grass', name: 'Grass', material: 'grass', solid: true, transparent: false, liquid: false,
    hardness: 0.8, preferredTool: 'shovel',
    drops: [{ itemId: 'dirt', min: 1, max: 1 }],
    textures: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' },
  },
  {
    id: 2, key: 'dirt', name: 'Dirt', material: 'soil', solid: true, transparent: false, liquid: false,
    hardness: 0.7, preferredTool: 'shovel',
    drops: [{ itemId: 'dirt', min: 1, max: 1 }],
    textures: { all: 'dirt' },
  },
  {
    id: 3, key: 'stone', name: 'Stone', material: 'rock', solid: true, transparent: false, liquid: false,
    hardness: 6.0, preferredTool: 'pickaxe', minToolTier: 1,
    drops: [{ itemId: 'stone', min: 1, max: 1 }],
    textures: { all: 'stone' },
  },
  {
    id: 4, key: 'sand', name: 'Sand', material: 'sand', solid: true, transparent: false, liquid: false,
    hardness: 0.6, preferredTool: 'shovel',
    drops: [{ itemId: 'sand', min: 1, max: 1 }],
    textures: { all: 'sand' },
  },
  {
    id: 5, key: 'log', name: 'Wood Log', material: 'wood', solid: true, transparent: false, liquid: false,
    hardness: 2.5, preferredTool: 'axe',
    drops: [{ itemId: 'log', min: 1, max: 1 }],
    textures: { top: 'wood_top', bottom: 'wood_top', side: 'wood_side' },
  },
  {
    id: 6, key: 'leaves', name: 'Leaves', material: 'leaves', solid: true, transparent: true, liquid: false,
    hardness: 0.4, preferredTool: 'axe',
    drops: [{ itemId: 'stick', min: 1, max: 1, chance: 0.08 }],
    textures: { all: 'leaves' },
  },
  {
    id: 7, key: 'planks', name: 'Planks', material: 'wood', solid: true, transparent: false, liquid: false,
    hardness: 2.0, preferredTool: 'axe',
    drops: [{ itemId: 'planks', min: 1, max: 1 }],
    textures: { all: 'planks' },
  },
  {
    id: 8, key: 'water', name: 'Water', material: 'water', solid: false, transparent: true, liquid: true,
    hardness: Infinity, textures: { all: 'water' },
  },
  {
    id: 9, key: 'crafting_table', name: 'Crafting Table', material: 'wood', solid: true, transparent: false, liquid: false,
    hardness: 2.5, preferredTool: 'axe', interaction: 'crafting_table',
    drops: [{ itemId: 'crafting_table', min: 1, max: 1 }],
    textures: { top: 'crafting_table_top', bottom: 'planks', side: 'crafting_table_side' },
  },
  {
    id: 10, key: 'bedrock', name: 'Deepstone', material: 'rock', solid: true, transparent: false, liquid: false,
    hardness: Infinity, textures: { all: 'bedrock' },
  },
]
