import type { DropDefinition } from '../world/BlockTypes'

/** Surface painting recipe for one model part (see render/AnimalModels.ts). */
export interface SkinDefinition {
  pattern: 'speckle' | 'patches' | 'pig_face' | 'cow_face' | 'snout' | 'hoof_leg' | 'horn'
  colors: string[]
}

/**
 * Model part in model pixels (1 block = 16 px). `pos` is the part centre
 * relative to the entity's feet centre; +Z is the animal's front.
 */
export interface ModelPart {
  name: string
  size: [number, number, number]
  pos: [number, number, number]
  skin: SkinDefinition
  /** Legs swing while walking; +1 / -1 gives opposite phase. */
  swing?: 1 | -1
  /** Parts attached to the head turn with it. */
  head?: boolean
}

export interface AnimalDefinition {
  kind: string
  name: string
  maxHealth: number
  width: number
  height: number
  walkSpeed: number
  fleeSpeed: number
  drops: DropDefinition[]
  sounds: { idle: string; hurt: string; death: string }
  model: ModelPart[]
}

const PIG_PINK = ['#e9a1a1', '#dc8f92', '#f1b3b0', '#d48287']
const COW_BROWN = ['#5a3b27', '#4a3020', '#65442e']
const COW_WHITE = ['#eae4da', '#d9d2c6', '#f4f0e8']

export const ANIMAL_DEFS: Record<string, AnimalDefinition> = {
  pig: {
    kind: 'pig',
    name: 'Pig',
    maxHealth: 10,
    width: 0.85,
    height: 0.9,
    walkSpeed: 1.1,
    fleeSpeed: 3.4,
    drops: [{ itemId: 'raw_pork', min: 1, max: 3 }],
    sounds: { idle: 'pig_idle', hurt: 'pig_hurt', death: 'pig_hurt' },
    model: [
      { name: 'body', size: [10, 8, 15], pos: [0, 9, 0], skin: { pattern: 'speckle', colors: PIG_PINK } },
      { name: 'head', size: [8, 8, 8], pos: [0, 11, 10.5], head: true, skin: { pattern: 'pig_face', colors: PIG_PINK } },
      { name: 'snout', size: [4, 3, 1], pos: [0, 9.5, 15], head: true, skin: { pattern: 'snout', colors: ['#c9737c', '#8a4550'] } },
      { name: 'leg_fl', size: [4, 5, 4], pos: [-3, 2.5, 5], swing: 1, skin: { pattern: 'hoof_leg', colors: [...PIG_PINK, '#7a4a48'] } },
      { name: 'leg_fr', size: [4, 5, 4], pos: [3, 2.5, 5], swing: -1, skin: { pattern: 'hoof_leg', colors: [...PIG_PINK, '#7a4a48'] } },
      { name: 'leg_bl', size: [4, 5, 4], pos: [-3, 2.5, -5], swing: -1, skin: { pattern: 'hoof_leg', colors: [...PIG_PINK, '#7a4a48'] } },
      { name: 'leg_br', size: [4, 5, 4], pos: [3, 2.5, -5], swing: 1, skin: { pattern: 'hoof_leg', colors: [...PIG_PINK, '#7a4a48'] } },
    ],
  },
  cow: {
    kind: 'cow',
    name: 'Cow',
    maxHealth: 12,
    width: 0.9,
    height: 1.4,
    walkSpeed: 1.0,
    fleeSpeed: 3.2,
    drops: [
      { itemId: 'raw_beef', min: 1, max: 3 },
      { itemId: 'leather', min: 0, max: 2 },
    ],
    sounds: { idle: 'cow_idle', hurt: 'cow_hurt', death: 'cow_hurt' },
    model: [
      { name: 'body', size: [12, 10, 18], pos: [0, 17, 0], skin: { pattern: 'patches', colors: [...COW_BROWN, ...COW_WHITE] } },
      { name: 'head', size: [8, 8, 6], pos: [0, 21, 12], head: true, skin: { pattern: 'cow_face', colors: [...COW_BROWN, ...COW_WHITE] } },
      { name: 'muzzle', size: [6, 3, 1], pos: [0, 18.5, 15.5], head: true, skin: { pattern: 'snout', colors: ['#d8b7a3', '#6d4a3a'] } },
      { name: 'horn_l', size: [1, 3, 1], pos: [-4.5, 26, 12], head: true, skin: { pattern: 'horn', colors: ['#e8dfc8', '#bcae8c'] } },
      { name: 'horn_r', size: [1, 3, 1], pos: [4.5, 26, 12], head: true, skin: { pattern: 'horn', colors: ['#e8dfc8', '#bcae8c'] } },
      { name: 'leg_fl', size: [4, 12, 4], pos: [-4, 6, 6], swing: 1, skin: { pattern: 'hoof_leg', colors: [...COW_WHITE, '#2e241c'] } },
      { name: 'leg_fr', size: [4, 12, 4], pos: [4, 6, 6], swing: -1, skin: { pattern: 'hoof_leg', colors: [...COW_BROWN, '#2e241c'] } },
      { name: 'leg_bl', size: [4, 12, 4], pos: [-4, 6, -6], swing: -1, skin: { pattern: 'hoof_leg', colors: [...COW_BROWN, '#2e241c'] } },
      { name: 'leg_br', size: [4, 12, 4], pos: [4, 6, -6], swing: 1, skin: { pattern: 'hoof_leg', colors: [...COW_WHITE, '#2e241c'] } },
    ],
  },
}
