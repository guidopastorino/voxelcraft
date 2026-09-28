import type { Recipe, ShapedRecipe } from './Recipe'
import { RECIPES } from '../config/recipes'
import { ItemRegistry } from '../items/ItemRegistry'
import { assert } from '../core/assert'

/** Grid contents as item ids (null = empty), row-major, `size`×`size`. */
export type GridItems = Array<string | null>

interface Bounds {
  minX: number
  minY: number
  w: number
  h: number
}

function bounds(grid: GridItems, size: number): Bounds | null {
  let minX = size, minY = size, maxX = -1, maxY = -1
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (grid[y * size + x] !== null) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { minX, minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

function matchShaped(r: ShapedRecipe, grid: GridItems, size: number, b: Bounds): boolean {
  if (r.width !== b.w || r.height !== b.h) return false
  const test = (mirror: boolean) => {
    for (let y = 0; y < r.height; y++) {
      for (let x = 0; x < r.width; x++) {
        const px = mirror ? r.width - 1 - x : x
        const want = r.pattern[y * r.width + px]
        const have = grid[(b.minY + y) * size + (b.minX + x)]
        if (want !== have) return false
      }
    }
    return true
  }
  return test(false) || test(true)
}

function matchShapeless(ingredients: string[], grid: GridItems): boolean {
  const have = grid.filter((g): g is string => g !== null).sort()
  if (have.length !== ingredients.length) return false
  const want = [...ingredients].sort()
  return have.every((h, i) => h === want[i])
}

export class RecipeRegistry {
  constructor(readonly recipes: Recipe[] = RECIPES) {
    for (const r of recipes) {
      assert(ItemRegistry.has(r.output.itemId), `recipe ${r.id}: unknown output ${r.output.itemId}`)
      const inputs = r.type === 'shaped' ? r.pattern : r.ingredients
      for (const i of inputs) if (i) assert(ItemRegistry.has(i), `recipe ${r.id}: unknown input ${i}`)
      if (r.type === 'shaped') assert(r.pattern.length === r.width * r.height, `recipe ${r.id}: bad pattern size`)
    }
  }

  /** Finds the recipe matching a square crafting grid of side `size`. */
  match(grid: GridItems, size: number): Recipe | null {
    const b = bounds(grid, size)
    if (!b) return null
    for (const r of this.recipes) {
      if (r.type === 'shaped' ? matchShaped(r, grid, size, b) : matchShapeless(r.ingredients, grid)) return r
    }
    return null
  }
}

export const defaultRecipes = new RecipeRegistry()
