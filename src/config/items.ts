import type { ItemDefinition, ToolDefinition } from '../items/ToolDefinition'
import type { ToolType, ToolTierName, Material } from '../world/BlockTypes'
import { BLOCKS } from './blocks'

/** Speed multiplier a correct tool of each tier applies to its materials. */
const TIER_SPEED: Record<ToolTierName, number> = { wood: 4, stone: 6 }
const TIER_DURABILITY: Record<ToolTierName, number> = { wood: 60, stone: 132 }

const TOOL_MATERIALS: Record<ToolType, Material[]> = {
  pickaxe: ['rock'],
  axe: ['wood', 'leaves'],
  shovel: ['soil', 'grass', 'sand'],
  sword: [],
}

const BASE_DAMAGE: Record<ToolType, number> = { sword: 4, axe: 3, pickaxe: 2, shovel: 2 }
const COOLDOWN: Record<ToolType, number> = { sword: 0.6, axe: 0.9, pickaxe: 0.75, shovel: 0.75 }

function makeTool(toolType: ToolType, tier: ToolTierName): ToolDefinition {
  const speed = TIER_SPEED[tier]
  const miningSpeed: ToolDefinition['miningSpeed'] = {}
  for (const m of TOOL_MATERIALS[toolType]) miningSpeed[m] = speed
  if (toolType === 'sword') miningSpeed.leaves = 1.6
  return {
    id: `${tier}_${toolType}`,
    toolType,
    tier,
    damage: BASE_DAMAGE[toolType] + (tier === 'stone' ? 1 : 0),
    attackCooldown: COOLDOWN[toolType],
    miningSpeed,
    durability: TIER_DURABILITY[tier],
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const blockItems: ItemDefinition[] = BLOCKS.filter((b) => b.solid && Number.isFinite(b.hardness)).map((b) => ({
  id: b.key,
  name: b.name,
  kind: 'block' as const,
  maxStack: 64,
  blockId: b.id,
}))

const toolItems: ItemDefinition[] = (['wood', 'stone'] as ToolTierName[]).flatMap((tier) =>
  (['sword', 'pickaxe', 'axe', 'shovel'] as ToolType[]).map((type) => {
    const tool = makeTool(type, tier)
    return {
      id: tool.id,
      name: `${tier === 'wood' ? 'Wooden' : 'Stone'} ${cap(type)}`,
      kind: 'tool' as const,
      maxStack: 1,
      tool,
    }
  }),
)

export const ITEMS: ItemDefinition[] = [
  ...blockItems,
  { id: 'stick', name: 'Stick', kind: 'material', maxStack: 64 },
  { id: 'leather', name: 'Leather', kind: 'material', maxStack: 64 },
  { id: 'raw_pork', name: 'Raw Pork', kind: 'food', maxStack: 64, food: { hunger: 3, eatTime: 1.2 } },
  { id: 'raw_beef', name: 'Raw Beef', kind: 'food', maxStack: 64, food: { hunger: 3, eatTime: 1.2 } },
  ...toolItems,
]
