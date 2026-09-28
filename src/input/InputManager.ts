import type { ActionName } from '../config/defaults'

export type InputContext = 'gameplay' | 'ui'

/**
 * Keyboard/mouse state mapped to named actions through remappable
 * bindings. Gameplay only reads actions while in the 'gameplay' context
 * (pointer locked); in 'ui' the mouse drives the DOM instead.
 */
export class InputManager {
  bindings: Record<ActionName, string>
  context: InputContext = 'ui'
  private down = new Set<string>()
  private pressedEdges = new Set<string>()
  mouseDX = 0
  mouseDY = 0
  wheel = 0
  /** Last digit key pressed (1–9 → 0–8), consumed by the game. */
  hotbarKey: number | null = null
  /** Called for every keydown (used for key rebinding capture and global shortcuts). */
  onKey?: (code: string, e: KeyboardEvent) => boolean | void
  onPointerLockChange?: (locked: boolean) => void

  constructor(private canvas: HTMLCanvasElement, bindings: Record<ActionName, string>) {
    this.bindings = { ...bindings }
    window.addEventListener('keydown', this.keydown)
    window.addEventListener('keyup', this.keyup)
    window.addEventListener('blur', this.reset)
    canvas.addEventListener('mousedown', this.mousedown)
    window.addEventListener('mouseup', this.mouseup)
    window.addEventListener('mousemove', this.mousemove)
    window.addEventListener('wheel', this.onWheel, { passive: false })
    window.addEventListener('contextmenu', (e) => {
      if (this.context === 'gameplay') e.preventDefault()
    })
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvas
      if (!locked) this.reset()
      this.onPointerLockChange?.(locked)
    })
  }

  get pointerLocked(): boolean {
    return document.pointerLockElement === this.canvas
  }

  requestPointerLock(): void {
    if (this.pointerLocked) return
    try {
      const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined
      if (p && typeof p.catch === 'function') p.catch(() => {})
    } catch {
      /* not allowed right now — the user can click to capture */
    }
  }

  exitPointerLock(): void {
    if (this.pointerLocked) document.exitPointerLock()
  }

  private keydown = (e: KeyboardEvent) => {
    if (this.onKey?.(e.code, e) === true) {
      e.preventDefault()
      return
    }
    if (this.context === 'gameplay') {
      if (/^Digit[1-9]$/.test(e.code)) this.hotbarKey = Number(e.code.slice(5)) - 1
      // Keep browser shortcuts (Space scroll, F-keys, Tab) from firing mid-game.
      if (e.code === 'Space' || e.code === 'Tab' || e.code.startsWith('F') || e.code.startsWith('Arrow')) e.preventDefault()
    }
    if (!this.down.has(e.code)) this.pressedEdges.add(e.code)
    this.down.add(e.code)
  }

  private keyup = (e: KeyboardEvent) => {
    this.down.delete(e.code)
  }

  private mousedown = (e: MouseEvent) => {
    const code = `Mouse${e.button}`
    if (!this.down.has(code)) this.pressedEdges.add(code)
    this.down.add(code)
  }

  private mouseup = (e: MouseEvent) => {
    this.down.delete(`Mouse${e.button}`)
  }

  private mousemove = (e: MouseEvent) => {
    if (this.context !== 'gameplay' || !this.pointerLocked) return
    this.mouseDX += e.movementX
    this.mouseDY += e.movementY
  }

  private onWheel = (e: WheelEvent) => {
    if (this.context !== 'gameplay') return
    e.preventDefault()
    this.wheel += Math.sign(e.deltaY)
  }

  reset = () => {
    this.down.clear()
    this.pressedEdges.clear()
    this.mouseDX = this.mouseDY = this.wheel = 0
  }

  isDown(action: ActionName): boolean {
    return this.context === 'gameplay' && this.down.has(this.bindings[action])
  }

  /** True once per physical press (edge), consumed by `endFrame`. */
  wasPressed(action: ActionName): boolean {
    return this.context === 'gameplay' && this.pressedEdges.has(this.bindings[action])
  }

  /** Raw edge check regardless of context (for UI toggles like the inventory key). */
  pressedCode(code: string): boolean {
    return this.pressedEdges.has(code)
  }

  consumeMouse(): { dx: number; dy: number } {
    const r = { dx: this.mouseDX, dy: this.mouseDY }
    this.mouseDX = this.mouseDY = 0
    return r
  }

  consumeWheel(): number {
    const w = this.wheel
    this.wheel = 0
    return w
  }

  endFrame(): void {
    this.pressedEdges.clear()
    this.hotbarKey = null
  }
}

/** Human-readable label for a binding code. */
export function keyLabel(code: string): string {
  if (code === 'Mouse0') return 'LMB'
  if (code === 'Mouse1') return 'MMB'
  if (code === 'Mouse2') return 'RMB'
  if (code.startsWith('Mouse')) return `Mouse ${code.slice(5)}`
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  const names: Record<string, string> = {
    Space: 'Space', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl',
    AltLeft: 'L-Alt', AltRight: 'R-Alt', Tab: 'Tab', Enter: 'Enter', Backquote: '`',
  }
  return names[code] ?? code
}
