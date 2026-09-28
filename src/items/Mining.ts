import type { BlockDefinition } from '../world/BlockTypes'
import { TOOL_TIER_LEVEL } from '../world/BlockTypes'
import type { ToolDefinition } from './ToolDefinition'

/** Swords are combat tools: they break most blocks slower than a bare hand. */
export const SWORD_PENALTY = 0.65

/** Effective speed multiplier for a (possibly absent) tool against a block. */
export function miningSpeed(block: BlockDefinition, tool: ToolDefinition | undefined): number {
  if (!tool) return 1
  const speed = tool.miningSpeed[block.material]
  if (speed !== undefined) return speed
  return tool.toolType === 'sword' ? SWORD_PENALTY : 1
}

/** Seconds needed to break `block` with `tool`. Infinity for unbreakable blocks. */
export function breakTime(block: BlockDefinition, tool: ToolDefinition | undefined): number {
  if (!Number.isFinite(block.hardness)) return Infinity
  if (block.hardness <= 0) return 0
  return block.hardness / miningSpeed(block, tool)
}

/** Whether breaking `block` with `tool` yields drops (tool type + tier check). */
export function canHarvest(block: BlockDefinition, tool: ToolDefinition | undefined): boolean {
  const minTier = block.minToolTier ?? 0
  if (minTier <= 0) return true
  if (!tool || tool.toolType !== block.preferredTool) return false
  return TOOL_TIER_LEVEL[tool.tier] >= minTier
}

/** A tool loses durability when used on a block it is meant for, or any block with non-zero hardness. */
export function toolWearOnBreak(block: BlockDefinition, tool: ToolDefinition | undefined): number {
  if (!tool || block.hardness <= 0) return 0
  return tool.toolType === 'sword' ? 2 : 1
}

export function toolWearOnAttack(tool: ToolDefinition | undefined): number {
  if (!tool) return 0
  return tool.toolType === 'sword' ? 1 : 2
}
