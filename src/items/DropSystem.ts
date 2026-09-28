import type { BlockDefinition, DropDefinition } from '../world/BlockTypes'
import type { ToolDefinition } from './ToolDefinition'
import type { ItemStack } from './ItemStack'
import { canHarvest } from './Mining'

/** Returns a float in [0, 1). Injected so drop rolls are testable/deterministic. */
export type Rng = () => number

export function rollDrops(drops: DropDefinition[] | undefined, rng: Rng): ItemStack[] {
  const out: ItemStack[] = []
  if (!drops) return out
  for (const d of drops) {
    if (d.chance !== undefined && rng() >= d.chance) continue
    const count = d.min + Math.floor(rng() * (d.max - d.min + 1))
    if (count > 0) out.push({ itemId: d.itemId, count })
  }
  return out
}

/** Items produced when a block is broken with the given tool. */
export function blockDrops(block: BlockDefinition, tool: ToolDefinition | undefined, rng: Rng): ItemStack[] {
  if (!canHarvest(block, tool)) return []
  return rollDrops(block.drops, rng)
}
