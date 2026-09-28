import { button, h } from './dom'
import type { DamageCause } from '../core/EventBus'

const MESSAGES: Record<DamageCause, string> = {
  fall: 'You hit the ground too hard',
  starvation: 'You starved',
  void: 'You fell out of the world',
  debug: 'You were struck down',
}

export function createDeathScreen(cause: DamageCause | null, keepInventory: boolean, a: { respawn(): void; mainMenu(): void }): HTMLElement {
  return h(
    'div',
    { class: 'screen death' },
    h('h2', { class: 'title' }, 'You Died'),
    h('div', { class: 'subtitle' }, cause ? MESSAGES[cause] : ''),
    h('div', { class: 'subtitle' }, keepInventory ? 'Your items are safe.' : 'Your items were dropped where you fell.'),
    h('div', { class: 'menu-col' }, button('Respawn', a.respawn), button('Main Menu', a.mainMenu)),
  )
}
