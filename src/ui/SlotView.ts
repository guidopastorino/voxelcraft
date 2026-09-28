import { h } from './dom'
import type { Slot } from '../inventory/Inventory'
import { getItemIconURL } from '../assets/ItemIcons'
import { durabilityLeft } from '../items/ItemStack'
import { ItemRegistry } from '../items/ItemRegistry'

/** Renders a slot's contents: icon, count and durability bar. Cheap to call every change. */
export function renderSlot(el: HTMLElement, stack: Slot): void {
  const key = stack ? `${stack.itemId}:${stack.count}:${stack.damage ?? ''}` : ''
  if (el.dataset.key === key) return
  el.dataset.key = key
  for (const c of [...el.children]) if (!c.classList.contains('num')) c.remove()
  if (!stack) return
  el.append(h('img', { src: getItemIconURL(stack.itemId), alt: '', draggable: 'false' }))
  if (stack.count > 1) el.append(h('span', { class: 'count' }, String(stack.count)))
  const left = durabilityLeft(stack)
  const tool = ItemRegistry.get(stack.itemId).tool
  if (tool && left !== undefined && left < tool.durability) {
    const f = Math.max(0, left / tool.durability)
    const hue = Math.round(f * 120)
    el.append(h('div', { class: 'dura' }, h('div', { style: `width:${f * 100}%;background:hsl(${hue},85%,50%)` })))
  }
}
