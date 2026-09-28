import { button, h } from './dom'

export interface PauseActions {
  resume(): void
  settings(): void
  save(): void
  mainMenu(): void
}

export function createPauseMenu(a: PauseActions): HTMLElement {
  return h(
    'div',
    { class: 'screen dim' },
    h('h2', { class: 'title' }, 'Game Paused'),
    h('div', { class: 'menu-col' }, button('Resume', a.resume), button('Settings', a.settings), button('Save', a.save), button('Save & Quit to Main Menu', a.mainMenu)),
  )
}
