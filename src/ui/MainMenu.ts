import { button, h } from './dom'
import { renderLogo } from './Logo'

const TAGLINES = [
  'Punch trees, responsibly!',
  'Hand-painted pixels!',
  'Now with cows!',
  '100% procedural!',
  'Mind the cliffs!',
  'Seeds all the way down!',
  'Crafted, not copied!',
  'Pigs approve!',
]

export interface MainMenuActions {
  singleplayer(): void
  settings(): void
  quit(): void
}

/** Title screen over the orbiting 3D world. Logo letters are filled with the grass tile. */
export function createMainMenu(actions: MainMenuActions, version: string): HTMLElement {
  const logo = h('img', { class: 'logo', src: renderLogo().toDataURL(), alt: 'VoxelCraft' })
  const tagline = h('div', { class: 'tagline' }, TAGLINES[Math.floor(Math.random() * TAGLINES.length)])
  return h(
    'div',
    { class: 'screen' },
    h('div', { class: 'logo-wrap' }, logo, h('div', { class: 'logo-sub' }, 'SURVIVAL · SINGLEPLAYER'), tagline),
    h(
      'div',
      { class: 'menu-col' },
      button('Singleplayer', actions.singleplayer),
      button('Settings', actions.settings),
      button('Quit Game', actions.quit),
    ),
    h('div', { class: 'footer' }, h('span', {}, `VoxelCraft ${version}`), h('span', {}, 'Original assets · Not affiliated with any other game')),
  )
}
