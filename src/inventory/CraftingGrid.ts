import type { ItemStack } from '../items/ItemStack'
import { makeStack } from '../items/ItemStack'
import type { Slot } from './Inventory'
import { Inventory } from './Inventory'
import type { Recipe } from './Recipe'
import { defaultRecipes, type RecipeRegistry } from './RecipeRegistry'

/**
 * A square crafting grid (2×2 in the player inventory, 3×3 at a crafting
 * table). Extends Inventory so the UI can use the same slot actions.
 */
export class CraftingGrid extends Inventory {
  constructor(
    readonly side: 2 | 3,
    private recipes: RecipeRegistry = defaultRecipes,
  ) {
    super(side * side)
  }

  currentRecipe(): Recipe | null {
    return this.recipes.match(
      this.slots.map((s) => s?.itemId ?? null),
      this.side,
    )
  }

  /** Output preview, or null if the grid matches nothing. */
  result(): ItemStack | null {
    const r = this.currentRecipe()
    return r ? makeStack(r.output.itemId, r.output.count) : null
  }

  /** Consumes one of each ingredient and returns the output. Null if no recipe matches. */
  craft(): ItemStack | null {
    const out = this.result()
    if (!out) return null
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i]
      if (s) {
        s.count -= 1
        if (s.count === 0) this.slots[i] = null
      }
    }
    this.changed()
    return out
  }

  /** Removes everything from the grid (e.g. when the UI closes) and returns it. */
  drain(): ItemStack[] {
    const out = this.slots.filter((s): s is ItemStack => s !== null)
    this.slots.fill(null as Slot)
    this.changed()
    return out
  }
}
