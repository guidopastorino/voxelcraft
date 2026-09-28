import { shaped, shapeless, type Recipe } from '../inventory/Recipe'

const toolSet = (material: string, tier: string): Recipe[] => {
  const k = { M: material, S: 'stick' }
  return [
    shaped(`${tier}_pickaxe`, ['MMM', ' S ', ' S '], k, `${tier}_pickaxe`),
    shaped(`${tier}_axe`, ['MM', 'MS', ' S'], k, `${tier}_axe`),
    shaped(`${tier}_shovel`, ['M', 'S', 'S'], k, `${tier}_shovel`),
    shaped(`${tier}_sword`, ['M', 'M', 'S'], k, `${tier}_sword`),
  ]
}

export const RECIPES: Recipe[] = [
  shapeless('planks', ['log'], 'planks', 4),
  shaped('sticks', ['P', 'P'], { P: 'planks' }, 'stick', 4),
  shaped('crafting_table', ['PP', 'PP'], { P: 'planks' }, 'crafting_table'),
  ...toolSet('planks', 'wood'),
  ...toolSet('stone', 'stone'),
]
