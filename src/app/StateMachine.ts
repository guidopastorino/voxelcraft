export type GameState =
  | 'BOOT'
  | 'MAIN_MENU'
  | 'WORLD_SELECT'
  | 'WORLD_CREATE'
  | 'LOADING_WORLD'
  | 'PLAYING'
  | 'INVENTORY'
  | 'PAUSED'
  | 'DEAD'
  | 'SETTINGS'

/** Which transitions are legal. Keeps input and UI from mixing states. */
const ALLOWED: Record<GameState, GameState[]> = {
  BOOT: ['MAIN_MENU'],
  MAIN_MENU: ['WORLD_SELECT', 'SETTINGS'],
  WORLD_SELECT: ['MAIN_MENU', 'WORLD_CREATE', 'LOADING_WORLD'],
  WORLD_CREATE: ['WORLD_SELECT', 'LOADING_WORLD'],
  LOADING_WORLD: ['PLAYING', 'MAIN_MENU', 'DEAD'],
  PLAYING: ['PAUSED', 'INVENTORY', 'DEAD', 'MAIN_MENU'],
  INVENTORY: ['PLAYING', 'DEAD', 'PAUSED'],
  PAUSED: ['PLAYING', 'SETTINGS', 'MAIN_MENU'],
  DEAD: ['PLAYING', 'MAIN_MENU'],
  SETTINGS: ['MAIN_MENU', 'PAUSED'],
}

export class StateMachine {
  state: GameState = 'BOOT'
  private listeners = new Set<(to: GameState, from: GameState) => void>()

  onChange(fn: (to: GameState, from: GameState) => void): void {
    this.listeners.add(fn)
  }

  can(to: GameState): boolean {
    return ALLOWED[this.state].includes(to)
  }

  go(to: GameState): void {
    if (to === this.state) return
    if (!this.can(to)) throw new Error(`Illegal state transition ${this.state} → ${to}`)
    const from = this.state
    this.state = to
    for (const fn of this.listeners) fn(to, from)
  }

  /** True while the world simulation should advance. */
  get simulating(): boolean {
    return this.state === 'PLAYING' || this.state === 'INVENTORY' || this.state === 'DEAD'
  }
}
