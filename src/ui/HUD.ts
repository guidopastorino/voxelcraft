import { h } from './dom'
import { hudIcons } from './icons'
import { renderSlot } from './SlotView'
import type { GameSession } from '../app/GameSession'
import { HOTBAR_SIZE } from '../inventory/Inventory'
import { ItemRegistry } from '../items/ItemRegistry'
import { SURVIVAL } from '../config/defaults'

/**
 * In-game overlay: crosshair, health & hunger bars, hotbar, selected item
 * name, save indicator, damage flash, underwater tint, F3 debug text and
 * the "click to resume" hint.
 */
export class HUD {
  readonly root: HTMLElement
  private hearts: HTMLImageElement[] = []
  private food: HTMLImageElement[] = []
  private heartBar: HTMLElement
  private foodBar: HTMLElement
  private slots: HTMLElement[] = []
  private itemName: HTMLElement
  private saveEl: HTMLElement
  private flashEl: HTMLElement
  private waterEl: HTMLElement
  private debugEl: HTMLElement
  private hintEl: HTMLElement
  private toastEl: HTMLElement
  private crosshair: HTMLElement
  private lastSelected = -1
  private lastItem = ''
  private nameTimer = 0
  private saveTimer = 0
  private toastTimer = 0
  private lastHealth: number = SURVIVAL.maxHealth

  constructor() {
    const icons = hudIcons()
    this.heartBar = h('div', { class: 'bar' })
    this.foodBar = h('div', { class: 'bar food' })
    for (let i = 0; i < 10; i++) {
      const hi = h('img', { src: icons.heartFull, alt: '' })
      const fi = h('img', { src: icons.foodFull, alt: '' })
      this.hearts.push(hi)
      this.food.push(fi)
      this.heartBar.append(hi)
      this.foodBar.append(fi)
    }
    const hotbar = h('div', { class: 'hotbar' })
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      const s = h('div', { class: 'slot' }, h('span', { class: 'num' }, String(i + 1)))
      this.slots.push(s)
      hotbar.append(s)
    }
    this.itemName = h('div', { class: 'item-name' })
    this.saveEl = h('div', { class: 'save-indicator' })
    this.flashEl = h('div', { class: 'flash' })
    this.waterEl = h('div', { class: 'water-tint' })
    this.debugEl = h('div', { class: 'debug' })
    this.hintEl = h('div', { class: 'click-hint' }, 'Click to resume')
    this.toastEl = h('div', { class: 'toast' })
    this.crosshair = h('div', { class: 'crosshair' })
    this.root = h(
      'div',
      { class: 'hud' },
      this.waterEl,
      this.flashEl,
      this.crosshair,
      h('div', { class: 'bottom-hud' }, this.itemName, h('div', { class: 'bars' }, this.heartBar, this.foodBar), hotbar),
      this.saveEl,
      this.debugEl,
      this.hintEl,
      this.toastEl,
    )
  }

  setCrosshairSize(scale: number): void {
    this.crosshair.style.setProperty('--ch', String(scale))
  }

  flashDamage(): void {
    this.flashEl.classList.add('on')
    requestAnimationFrame(() => requestAnimationFrame(() => this.flashEl.classList.remove('on')))
  }

  showSaving(state: 'saving' | 'saved' | 'failed'): void {
    this.saveEl.textContent = state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Save failed!'
    this.saveEl.classList.add('show')
    this.saveTimer = state === 'saving' ? 30 : 1.6
  }

  toast(text: string): void {
    this.toastEl.textContent = text
    this.toastEl.classList.add('on')
    this.toastTimer = 1.8
  }

  setUnderwater(on: boolean): void {
    this.waterEl.classList.toggle('on', on)
  }

  setClickHint(on: boolean): void {
    this.hintEl.classList.toggle('on', on)
  }

  setDebug(text: string | null): void {
    if (text === null) {
      this.debugEl.classList.remove('on')
      return
    }
    this.debugEl.classList.add('on')
    // One background span per line keeps the text readable over bright terrain.
    this.debugEl.innerHTML = ''
    for (const line of text.split('\n')) {
      this.debugEl.append(h('span', {}, line), '\n')
    }
  }

  update(s: GameSession, dt: number): void {
    const icons = hudIcons()
    const hp = s.player.stats.health, hunger = s.player.stats.hunger
    for (let i = 0; i < 10; i++) {
      const v = hp - i * 2
      const src = v >= 2 ? icons.heartFull : v === 1 ? icons.heartHalf : icons.heartEmpty
      if (this.hearts[i].src !== src) this.hearts[i].src = src
      const f = hunger - i * 2
      const fsrc = f >= 2 ? icons.foodFull : f === 1 ? icons.foodHalf : icons.foodEmpty
      if (this.food[i].src !== fsrc) this.food[i].src = fsrc
    }
    this.heartBar.classList.toggle('shake', hp <= 4 && hp > 0)
    this.foodBar.classList.toggle('shake', hunger <= 3)
    if (hp < this.lastHealth) this.flashDamage()
    this.lastHealth = hp

    const inv = s.player.inventory
    const sel = s.player.hotbar.selected
    for (let i = 0; i < HOTBAR_SIZE; i++) {
      renderSlot(this.slots[i], inv.get(i))
      this.slots[i].classList.toggle('sel', i === sel)
    }
    const stack = inv.get(sel)
    const itemKey = stack?.itemId ?? ''
    if (sel !== this.lastSelected || itemKey !== this.lastItem) {
      this.lastSelected = sel
      this.lastItem = itemKey
      this.itemName.textContent = stack ? ItemRegistry.get(stack.itemId).name : ''
      this.nameTimer = 2
    }
    this.nameTimer -= dt
    this.itemName.style.opacity = this.nameTimer > 0 ? '1' : '0'
    if (this.saveTimer > 0) {
      this.saveTimer -= dt
      if (this.saveTimer <= 0) this.saveEl.classList.remove('show')
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt
      if (this.toastTimer <= 0) this.toastEl.classList.remove('on')
    }
  }
}
