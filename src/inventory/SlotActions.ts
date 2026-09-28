import type { ItemStack } from '../items/ItemStack'
import { canMerge, cloneStack, maxStackOf } from '../items/ItemStack'
import type { Slot } from './Inventory'

export interface SlotResult {
  slot: Slot
  cursor: Slot
}

/**
 * Left click on a slot while holding `cursor`:
 * - empty cursor → pick up the whole stack
 * - same item    → merge as much as fits
 * - otherwise    → swap
 */
export function leftClick(slot: Slot, cursor: Slot): SlotResult {
  if (!cursor) return { slot: null, cursor: slot }
  if (!slot) return { slot: cursor, cursor: null }
  if (canMerge(slot, cursor)) {
    const max = maxStackOf(slot.itemId)
    const moved = Math.min(max - slot.count, cursor.count)
    const newSlot = { ...slot, count: slot.count + moved }
    const left = cursor.count - moved
    return { slot: newSlot, cursor: left > 0 ? { ...cursor, count: left } : null }
  }
  return { slot: cursor, cursor: slot }
}

/**
 * Right click:
 * - empty cursor → pick up half the stack (rounded up)
 * - cursor held  → drop one item into the slot if compatible, else swap
 */
export function rightClick(slot: Slot, cursor: Slot): SlotResult {
  if (!cursor) {
    if (!slot) return { slot, cursor }
    const half = Math.ceil(slot.count / 2)
    const rest = slot.count - half
    return { slot: rest > 0 ? { ...slot, count: rest } : null, cursor: { ...slot, count: half } }
  }
  if (!slot) {
    const one = cloneStack(cursor)
    one.count = 1
    return { slot: one, cursor: cursor.count > 1 ? { ...cursor, count: cursor.count - 1 } : null }
  }
  if (canMerge(slot, cursor) && slot.count < maxStackOf(slot.itemId)) {
    return {
      slot: { ...slot, count: slot.count + 1 },
      cursor: cursor.count > 1 ? { ...cursor, count: cursor.count - 1 } : null,
    }
  }
  return leftClick(slot, cursor)
}

/** Can `output` be added onto the cursor stack (for taking crafting results)? */
export function cursorAccepts(cursor: Slot, output: ItemStack): boolean {
  if (!cursor) return true
  return canMerge(cursor, output) && cursor.count + output.count <= maxStackOf(output.itemId)
}
