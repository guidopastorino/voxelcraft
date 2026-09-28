/** Gameplay tuning constants. Everything that "feels" can be adjusted here. */
export const PLAYER = {
  width: 0.6,
  height: 1.8,
  eyeHeight: 1.62,
  walkSpeed: 4.5,
  sprintSpeed: 6.2,
  /** Jump apex ≈ 1.2 blocks: clears one block, never two. */
  jumpHeight: 1.2,
  gravity: 22,
  terminalVelocity: 50,
  groundAccel: 18,
  airAccel: 4,
  waterSpeedFactor: 0.55,
  waterGravityFactor: 0.25,
  swimUpSpeed: 3.2,
  maxReach: 5,
  attackReach: 3,
  /** Blocks of fall before damage starts. */
  safeFall: 3,
  /** Invulnerability after taking damage (s). */
  hurtCooldown: 0.5,
} as const

export const SURVIVAL = {
  maxHealth: 20,
  maxHunger: 20,
  /** Accumulated exhaustion that costs one hunger point. */
  exhaustionThreshold: 1,
  exhaustion: {
    walkPerBlock: 0.01,
    sprintPerBlock: 0.03,
    swimPerBlock: 0.015,
    jump: 0.08,
    sprintJump: 0.16,
    attack: 0.05,
    mine: 0.015,
    perSecond: 0.004,
    regenPerHp: 0.3,
  },
  regenHunger: 18,
  regenInterval: 4,
  noSprintHunger: 6,
  starveInterval: 4,
  starveDamage: 1,
} as const

export const ITEM_ENTITY = {
  size: 0.25,
  pickupDelay: 0.3,
  pickupRadius: 1.5,
  /** Distance at which the item starts flying toward the player. */
  magnetRadius: 2.2,
  despawnSeconds: 300,
} as const

export const ANIMALS = {
  maxAnimals: 40,
  maxPerChunk: 2,
  minSpawnDistance: 10,
  /** Seconds between population top-up attempts. */
  respawnInterval: 20,
} as const

export const WORLD = {
  /** Full day/night cycle length in seconds. */
  dayLength: 20 * 60,
  autosaveSeconds: 30,
  saveVersion: 1,
} as const

export const PHYSICS_HZ = 60

export type ActionName =
  | 'forward'
  | 'backward'
  | 'left'
  | 'right'
  | 'jump'
  | 'sprint'
  | 'inventory'
  | 'attack'
  | 'use'
  | 'camera'
  | 'debug'
  | 'drop'

/**
 * Bindings are KeyboardEvent.code values, or 'Mouse0'/'Mouse2' for buttons.
 * Hotbar keys 1–9 and Esc are fixed.
 */
export const DEFAULT_KEYBINDINGS: Record<ActionName, string> = {
  forward: 'KeyW',
  backward: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  sprint: 'ShiftLeft',
  inventory: 'KeyE',
  attack: 'Mouse0',
  use: 'Mouse2',
  camera: 'F5',
  debug: 'F3',
  drop: 'KeyQ',
}

export const ACTION_LABELS: Record<ActionName, string> = {
  forward: 'Move Forward',
  backward: 'Move Backward',
  left: 'Move Left',
  right: 'Move Right',
  jump: 'Jump / Swim',
  sprint: 'Sprint',
  inventory: 'Inventory',
  attack: 'Attack / Mine',
  use: 'Use / Place',
  camera: 'Camera View',
  debug: 'Debug Overlay',
  drop: 'Drop Item',
}

export type ParticleLevel = 'low' | 'medium' | 'high'

export interface Settings {
  audio: { master: number; music: number; ambient: number; effects: number; animals: number }
  controls: { sensitivity: number; invertY: boolean; bindings: Record<ActionName, string> }
  video: { renderDistance: number; fov: number; particles: ParticleLevel; clouds: boolean }
  gameplay: { viewBobbing: boolean; crosshairSize: number; uiScale: number }
}

export const DEFAULT_SETTINGS: Settings = {
  audio: { master: 0.8, music: 0.5, ambient: 0.6, effects: 0.8, animals: 0.8 },
  controls: { sensitivity: 0.5, invertY: false, bindings: { ...DEFAULT_KEYBINDINGS } },
  video: { renderDistance: 5, fov: 75, particles: 'high', clouds: true },
  gameplay: { viewBobbing: true, crosshairSize: 1, uiScale: 0 },
}

export interface GameRules {
  keepInventory: boolean
  dayNightCycle: boolean
  animalSpawning: boolean
}

export const DEFAULT_GAME_RULES: GameRules = {
  keepInventory: true,
  dayNightCycle: true,
  animalSpawning: true,
}
