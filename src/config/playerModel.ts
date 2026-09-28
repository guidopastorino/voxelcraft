import type { ModelPart } from './animals'

const SKIN = ['#d9a27a', '#cf9670', '#e2ad86']
const SHIRT = ['#2f7d7a', '#2a716e', '#358884']
const PANTS = ['#4a3b2e', '#3f3226', '#54432f']
const HAIR = ['#3b2618', '#4a3020', '#2f1d12']

/** Original third-person explorer model (teal jacket, brown trousers). */
export const PLAYER_MODEL: ModelPart[] = [
  { name: 'torso', size: [8, 12, 4], pos: [0, 18, 0], skin: { pattern: 'speckle', colors: SHIRT } },
  { name: 'head', size: [8, 8, 8], pos: [0, 28, 0], head: true, skin: { pattern: 'pig_face', colors: SKIN } },
  { name: 'hair', size: [8.4, 2.5, 8.4], pos: [0, 31, -0.2], head: true, skin: { pattern: 'speckle', colors: HAIR } },
  { name: 'hair_back', size: [8.4, 6, 1], pos: [0, 28.5, -4.2], head: true, skin: { pattern: 'speckle', colors: HAIR } },
  { name: 'arm_l', size: [4, 12, 4], pos: [-6, 18, 0], swing: -1, skin: { pattern: 'hoof_leg', colors: [...SHIRT, '#d9a27a'] } },
  { name: 'arm_r', size: [4, 12, 4], pos: [6, 18, 0], swing: 1, skin: { pattern: 'hoof_leg', colors: [...SHIRT, '#d9a27a'] } },
  { name: 'leg_l', size: [4, 12, 4], pos: [-2, 6, 0], swing: 1, skin: { pattern: 'hoof_leg', colors: [...PANTS, '#2a211a'] } },
  { name: 'leg_r', size: [4, 12, 4], pos: [2, 6, 0], swing: -1, skin: { pattern: 'hoof_leg', colors: [...PANTS, '#2a211a'] } },
]
