import { h } from './dom'
import { renderSlot } from './SlotView'
import { CraftingUI } from './CraftingUI'
import type { GameSession } from '../app/GameSession'
import type { Slot } from '../inventory/Inventory'
import { HOTBAR_SIZE, INVENTORY_SIZE } from '../inventory/Inventory'
import { ItemRegistry } from '../items/ItemRegistry'
import { durabilityLeft } from '../items/ItemStack'
import { getItemIconURL } from '../assets/ItemIcons'

/**
 * Inventory screen (E) with the personal 2×2 grid, or the crafting table
 * screen with a 3×3 grid. Mouse: left = pick/place/merge/swap,
 * right = split/place one, shift = quick move; clicking outside drops the
 * held stack.
 */
export class InventoryUI {
  readonly root: HTMLElement
  private slotEls: HTMLElement[] = []
  private crafting: CraftingUI
  private cursorEl: HTMLElement
  private tooltip: HTMLElement
  private hoverGet: (() => Slot) | null = null
  private mouse = { x: 0, y: 0 }

  constructor(private s: GameSession, mode: 'inventory' | 'crafting_table') {
    const grid = mode === 'crafting_table' ? s.tableGrid : s.player.craftGrid
    this.crafting = new CraftingUI(grid, {
      onSlot: (i, b, shift) => s.clickSlot(grid, i, b, shift),
      onOutput: (shift) => s.takeCraftResult(grid, shift),
      onHover: (el, get) => this.hover(el, get),
    })
    const main = h('div', { class: 'grid', style: 'grid-template-columns: repeat(9, auto)' })
    const bar = h('div', { class: 'grid', style: 'grid-template-columns: repeat(9, auto)' })
    // Main inventory (slots 9..35) then hotbar (0..8), like a chest of drawers above your belt.
    for (let i = 0; i < INVENTORY_SIZE; i++) this.slotEls.push(h('div', { class: 'slot' }))
    for (let i = HOTBAR_SIZE; i < INVENTORY_SIZE; i++) main.append(this.bindSlot(i))
    for (let i = 0; i < HOTBAR_SIZE; i++) bar.append(this.bindSlot(i))

    this.cursorEl = h('div', { class: 'cursor-item' })
    this.tooltip = h('div', { class: 'tooltip' })
    this.tooltip.style.display = 'none'
    const panel = h(
      'div',
      { class: 'inv' },
      h('h3', {}, mode === 'crafting_table' ? 'Crafting Table' : 'Crafting'),
      this.crafting.root,
      h('h3', {}, 'Inventory'),
      main,
      bar,
      h('div', { class: 'inv-hint' }, 'Left: take/place · Right: split/place one · Shift: quick move · E/Esc: close'),
    )
    panel.addEventListener('mousedown', (e) => e.stopPropagation())
    this.root = h('div', { class: 'screen dim' }, panel, this.cursorEl, this.tooltip)
    this.root.addEventListener('contextmenu', (e) => e.preventDefault())
    // Clicking outside the panel throws the held stack into the world.
    this.root.addEventListener('mousedown', (e) => {
      if (!this.s.cursor) return
      e.preventDefault()
      if (e.button === 2) {
        const one = { ...this.s.cursor, count: 1 }
        this.s.cursor = this.s.cursor.count > 1 ? { ...this.s.cursor, count: this.s.cursor.count - 1 } : null
        this.s.throwStack(one)
      } else {
        this.s.throwStack(this.s.cursor)
        this.s.cursor = null
      }
    })
    this.root.addEventListener('mouseover', (e) => {
      this.mouse = { x: e.clientX, y: e.clientY }
      this.placeFloating()
    })
    this.root.addEventListener('mousemove', (e) => {
      this.mouse = { x: e.clientX, y: e.clientY }
      this.placeFloating()
    })
  }

  private bindSlot(i: number): HTMLElement {
    const el = this.slotEls[i]
    el.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.s.clickSlot(this.s.player.inventory, i, e.button === 2 ? 'right' : 'left', e.shiftKey)
    })
    this.hover(el, () => this.s.player.inventory.get(i))
    return el
  }

  private hover(el: HTMLElement, get: () => Slot): void {
    el.addEventListener('mouseenter', () => (this.hoverGet = get))
    el.addEventListener('mouseleave', () => {
      if (this.hoverGet === get) this.hoverGet = null
    })
  }

  private placeFloating(): void {
    this.cursorEl.style.left = `${this.mouse.x}px`
    this.cursorEl.style.top = `${this.mouse.y}px`
    this.tooltip.style.left = `${this.mouse.x + 14}px`
    this.tooltip.style.top = `${this.mouse.y - 24}px`
  }

  /** Called every frame while open. */
  refresh(): void {
    const inv = this.s.player.inventory
    for (let i = 0; i < INVENTORY_SIZE; i++) renderSlot(this.slotEls[i], inv.get(i))
    this.crafting.refresh()
    const c = this.s.cursor
    const key = c ? `${c.itemId}:${c.count}` : ''
    if (this.cursorEl.dataset.key !== key) {
      this.cursorEl.dataset.key = key
      this.cursorEl.innerHTML = ''
      if (c) {
        this.cursorEl.append(h('img', { src: getItemIconURL(c.itemId), alt: '' }))
        if (c.count > 1) this.cursorEl.append(h('span', { class: 'count' }, String(c.count)))
      }
    }
    const hovered = !c && this.hoverGet ? this.hoverGet() : null
    if (hovered) {
      const def = ItemRegistry.get(hovered.itemId)
      const left = durabilityLeft(hovered)
      const tkey = `${hovered.itemId}:${left}`
      if (this.tooltip.dataset.key !== tkey) {
        this.tooltip.dataset.key = tkey
        this.tooltip.innerHTML = ''
        this.tooltip.append(h('div', {}, def.name))
        if (def.tool && left !== undefined) this.tooltip.append(h('div', { class: 'sub' }, `Durability ${left} / ${def.tool.durability}`))
        if (def.food) this.tooltip.append(h('div', { class: 'sub' }, `Restores ${def.food.hunger / 2} food`))
      }
      this.tooltip.style.display = 'block'
    } else {
      this.tooltip.style.display = 'none'
    }
  }
}
