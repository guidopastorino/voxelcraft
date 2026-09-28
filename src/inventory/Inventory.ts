import type { ItemStack } from '../items/ItemStack'
import { canMerge, cloneStack, maxStackOf, validateStack } from '../items/ItemStack'
import { assert } from '../core/assert'

export const HOTBAR_SIZE = 9
export const MAIN_SIZE = 27
export const INVENTORY_SIZE = HOTBAR_SIZE + MAIN_SIZE

export type Slot = ItemStack | null

/**
 * Player inventory: 36 slots. Indices 0..8 are the hotbar, 9..35 the main
 * inventory. All mutations go through methods so `onChange` fires and
 * invariants (no zero/negative counts, no over-max stacks) hold.
 */
export class Inventory {
  readonly slots: Slot[]
  private listeners = new Set<() => void>()

  constructor(size = INVENTORY_SIZE) {
    this.slots = new Array<Slot>(size).fill(null)
  }

  get size(): number {
    return this.slots.length
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  protected changed(): void {
    for (const fn of this.listeners) fn()
  }

  get(i: number): Slot {
    return this.slots[i]
  }

  set(i: number, stack: Slot): void {
    assert(i >= 0 && i < this.slots.length, `slot ${i} out of range`)
    if (stack) validateStack(stack)
    this.slots[i] = stack
    this.changed()
  }

  /** Slot fill order: hotbar first, then main inventory. */
  private *order(): Iterable<number> {
    for (let i = 0; i < this.slots.length; i++) yield i
  }

  /** How many items of `stack` could be inserted right now. */
  spaceFor(stack: ItemStack): number {
    const max = maxStackOf(stack.itemId)
    let space = 0
    for (const i of this.order()) {
      const s = this.slots[i]
      if (!s) space += max
      else if (canMerge(s, stack)) space += max - s.count
      if (space >= stack.count) return stack.count
    }
    return space
  }

  /**
   * Adds as much of `stack` as fits. Returns the remainder (or null when
   * everything was inserted). The input stack is not mutated.
   */
  add(stack: ItemStack): ItemStack | null {
    validateStack(stack)
    let remaining = stack.count
    const max = maxStackOf(stack.itemId)
    // 1) merge into existing stacks
    if (max > 1) {
      for (const i of this.order()) {
        const s = this.slots[i]
        if (s && canMerge(s, stack) && s.count < max) {
          const moved = Math.min(max - s.count, remaining)
          s.count += moved
          remaining -= moved
          if (remaining === 0) break
        }
      }
    }
    // 2) fill empty slots
    if (remaining > 0) {
      for (const i of this.order()) {
        if (!this.slots[i]) {
          const moved = Math.min(max, remaining)
          const placed = cloneStack(stack)
          placed.count = moved
          this.slots[i] = placed
          remaining -= moved
          if (remaining === 0) break
        }
      }
    }
    if (remaining !== stack.count) this.changed()
    if (remaining === 0) return null
    const rest = cloneStack(stack)
    rest.count = remaining
    return rest
  }

  /** Removes up to `n` items from slot `i`. Returns the removed stack. */
  takeFrom(i: number, n: number): ItemStack | null {
    const s = this.slots[i]
    if (!s || n <= 0) return null
    const taken = Math.min(n, s.count)
    const out = cloneStack(s)
    out.count = taken
    s.count -= taken
    if (s.count === 0) this.slots[i] = null
    this.changed()
    return out
  }

  count(itemId: string): number {
    let n = 0
    for (const s of this.slots) if (s && s.itemId === itemId) n += s.count
    return n
  }

  /** Removes `n` items of a type from anywhere. Returns false (and changes nothing) if not enough. */
  removeItem(itemId: string, n: number): boolean {
    if (this.count(itemId) < n) return false
    let left = n
    for (let i = this.slots.length - 1; i >= 0 && left > 0; i--) {
      const s = this.slots[i]
      if (s && s.itemId === itemId) {
        const t = Math.min(left, s.count)
        s.count -= t
        left -= t
        if (s.count === 0) this.slots[i] = null
      }
    }
    this.changed()
    return true
  }

  /**
   * Shift-click: moves the stack in slot `i` between hotbar and main
   * inventory (merging first). Returns true if anything moved.
   */
  quickMove(i: number): boolean {
    const s = this.slots[i]
    if (!s) return false
    const [from, to] = i < HOTBAR_SIZE ? [HOTBAR_SIZE, this.slots.length] : [0, HOTBAR_SIZE]
    const moved = this.insertInto(s, from, to)
    if (s.count === 0) this.slots[i] = null
    if (moved) this.changed()
    return moved
  }

  /** Inserts `stack` into slots [from, to), mutating stack.count. Returns true if anything moved. */
  insertInto(stack: ItemStack, from: number, to: number): boolean {
    const start = stack.count
    const max = maxStackOf(stack.itemId)
    if (max > 1) {
      for (let j = from; j < to && stack.count > 0; j++) {
        const t = this.slots[j]
        if (t && canMerge(t, stack) && t.count < max) {
          const m = Math.min(max - t.count, stack.count)
          t.count += m
          stack.count -= m
        }
      }
    }
    for (let j = from; j < to && stack.count > 0; j++) {
      if (!this.slots[j]) {
        const placed = cloneStack(stack)
        placed.count = Math.min(max, stack.count)
        this.slots[j] = placed
        stack.count -= placed.count
      }
    }
    return stack.count !== start
  }

  /** Mutate a stack in place (e.g. tool damage) and notify listeners. */
  touch(): void {
    this.changed()
  }

  clear(): void {
    this.slots.fill(null)
    this.changed()
  }

  isEmpty(): boolean {
    return this.slots.every((s) => s === null)
  }
}
