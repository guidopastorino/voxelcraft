import { ItemRegistry } from './ItemRegistry'
import { assert } from '../core/assert'

/**
 * A stack of items in a slot. `damage` is only used by tools: the number of
 * uses consumed so far (durability left = tool.durability - damage).
 */
export interface ItemStack {
  itemId: string
  count: number
  damage?: number
}

export function makeStack(itemId: string, count = 1): ItemStack {
  assert(ItemRegistry.has(itemId), `unknown item ${itemId}`)
  assert(Number.isInteger(count) && count > 0, `invalid stack count ${count}`)
  assert(count <= ItemRegistry.get(itemId).maxStack, `stack of ${itemId} exceeds max (${count})`)
  const stack: ItemStack = { itemId, count }
  if (ItemRegistry.get(itemId).tool) stack.damage = 0
  return stack
}

export const maxStackOf = (itemId: string): number => ItemRegistry.get(itemId).maxStack

export function cloneStack(s: ItemStack): ItemStack {
  return s.damage === undefined ? { itemId: s.itemId, count: s.count } : { itemId: s.itemId, count: s.count, damage: s.damage }
}

/** Two stacks can merge when they hold the same stackable item. */
export function canMerge(a: ItemStack, b: ItemStack): boolean {
  return a.itemId === b.itemId && maxStackOf(a.itemId) > 1
}

export function durabilityLeft(s: ItemStack): number | undefined {
  const tool = ItemRegistry.get(s.itemId).tool
  if (!tool) return undefined
  return tool.durability - (s.damage ?? 0)
}

export function validateStack(s: ItemStack): void {
  assert(ItemRegistry.has(s.itemId), `unknown item ${s.itemId}`)
  assert(Number.isInteger(s.count) && s.count > 0, `invalid count ${s.count} for ${s.itemId}`)
  assert(s.count <= maxStackOf(s.itemId), `stack > max for ${s.itemId}`)
}
