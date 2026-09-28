import { h } from './dom'
import { renderSlot } from './SlotView'
import type { CraftingGrid } from '../inventory/CraftingGrid'

export interface CraftingHandlers {
  onSlot(index: number, button: 'left' | 'right', shift: boolean): void
  onOutput(shift: boolean): void
  onHover(el: HTMLElement, getStack: () => ReturnType<CraftingGrid['get']>): void
}

/** The crafting grid (2×2 or 3×3) with an arrow and the output slot. */
export class CraftingUI {
  readonly root: HTMLElement
  private cells: HTMLElement[] = []
  private output: HTMLElement

  constructor(private grid: CraftingGrid, handlers: CraftingHandlers) {
    const g = h('div', { class: 'grid', style: `grid-template-columns: repeat(${grid.side}, auto)` })
    for (let i = 0; i < grid.size; i++) {
      const cell = h('div', { class: 'slot' })
      cell.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        handlers.onSlot(i, e.button === 2 ? 'right' : 'left', e.shiftKey)
      })
      handlers.onHover(cell, () => this.grid.get(i))
      this.cells.push(cell)
      g.append(cell)
    }
    this.output = h('div', { class: 'slot output' })
    this.output.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      handlers.onOutput(e.shiftKey)
    })
    handlers.onHover(this.output, () => this.grid.result())
    this.root = h('div', { class: 'craft-area' }, g, h('div', { class: 'arrow' }, '➜'), this.output)
  }

  refresh(): void {
    for (let i = 0; i < this.cells.length; i++) renderSlot(this.cells[i], this.grid.get(i))
    renderSlot(this.output, this.grid.result())
  }
}
