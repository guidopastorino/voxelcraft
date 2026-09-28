import { button, h } from './dom'
import { parseSeed, randomSeed } from '../world/SeededRandom'
import { DEFAULT_GAME_RULES, type GameRules } from '../config/defaults'

export interface WorldCreateActions {
  create(name: string, seed: number, rules: GameRules): void
  cancel(): void
}

/** New world form: name, seed (blank = random), Random Seed button and game rules. */
export function createWorldCreate(actions: WorldCreateActions, existingNames: string[]): HTMLElement {
  let n = 1
  while (existingNames.includes(n === 1 ? 'New World' : `New World ${n}`)) n++
  const name = h('input', { class: 'vc-input', value: n === 1 ? 'New World' : `New World ${n}`, maxlength: 32 }) as HTMLInputElement
  const seed = h('input', { class: 'vc-input', placeholder: 'Leave blank for a random seed', maxlength: 40 }) as HTMLInputElement
  const rules: GameRules = { ...DEFAULT_GAME_RULES }
  const toggle = (key: keyof GameRules, label: string) => {
    const b = button(`${rules[key] ? 'ON' : 'OFF'}`, () => {
      rules[key] = !rules[key]
      b.textContent = rules[key] ? 'ON' : 'OFF'
    }, { cls: 'small' })
    return h('div', { class: 'toggle-row' }, h('span', {}, label), b)
  }
  const submit = () => actions.create(name.value.trim() || 'New World', parseSeed(seed.value), rules)
  for (const input of [name, seed]) input.addEventListener('keydown', (e) => {
    e.stopPropagation()
    if (e.key === 'Enter') submit()
  })
  setTimeout(() => name.focus(), 0)
  return h(
    'div',
    { class: 'screen dim' },
    h(
      'div',
      { class: 'panel col' },
      h('h2', { class: 'title' }, 'Create New World'),
      h('div', { class: 'field' }, h('label', {}, 'World Name'), name),
      h('div', { class: 'field' }, h('label', {}, 'Seed for the world generator'), h('div', { class: 'row' }, seed, button('Random Seed', () => (seed.value = String(randomSeed())), { cls: 'small' }))),
      toggle('keepInventory', 'Keep inventory on death'),
      toggle('dayNightCycle', 'Day/night cycle'),
      toggle('animalSpawning', 'Animal spawning'),
      h('div', { class: 'row' }, button('Create World', submit), button('Cancel', actions.cancel)),
    ),
  )
}
