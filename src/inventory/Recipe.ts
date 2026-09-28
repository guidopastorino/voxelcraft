export interface RecipeOutput {
  itemId: string
  count: number
}

/**
 * Shaped recipe: `pattern` is row-major, width*height cells, each an item
 * id or null. Matching ignores position inside the grid and accepts the
 * horizontal mirror image.
 */
export interface ShapedRecipe {
  type: 'shaped'
  id: string
  width: number
  height: number
  pattern: Array<string | null>
  output: RecipeOutput
}

/** Shapeless recipe: the ingredient multiset must match exactly, anywhere in the grid. */
export interface ShapelessRecipe {
  type: 'shapeless'
  id: string
  ingredients: string[]
  output: RecipeOutput
}

export type Recipe = ShapedRecipe | ShapelessRecipe

/**
 * Helper to write shaped recipes legibly:
 *   shaped('wood_pickaxe', ['PPP', ' S ', ' S '], { P: 'planks', S: 'stick' }, 'wood_pickaxe')
 */
export function shaped(
  id: string,
  rows: string[],
  key: Record<string, string>,
  outputId: string,
  count = 1,
): ShapedRecipe {
  const height = rows.length
  const width = Math.max(...rows.map((r) => r.length))
  const pattern: Array<string | null> = []
  for (const row of rows) {
    for (let x = 0; x < width; x++) {
      const ch = row[x] ?? ' '
      if (ch === ' ') pattern.push(null)
      else {
        const item = key[ch]
        if (!item) throw new Error(`recipe ${id}: unknown key '${ch}'`)
        pattern.push(item)
      }
    }
  }
  return { type: 'shaped', id, width, height, pattern, output: { itemId: outputId, count } }
}

export function shapeless(id: string, ingredients: string[], outputId: string, count = 1): ShapelessRecipe {
  return { type: 'shapeless', id, ingredients, output: { itemId: outputId, count } }
}
