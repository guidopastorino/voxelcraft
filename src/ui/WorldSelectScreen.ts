import { button, clear, h } from './dom'
import type { WorldMetadata } from '../save/types'

export interface WorldSelectActions {
  play(id: string): void
  create(): void
  remove(id: string): Promise<void>
  back(): void
}

const fmt = (t: number) => new Date(t).toLocaleString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** List of saved worlds with Play / Create / Delete (with confirmation) / Back. */
export function createWorldSelect(worlds: WorldMetadata[], actions: WorldSelectActions, lastId: string | null): HTMLElement {
  let selected: string | null = worlds.find((w) => w.id === lastId)?.id ?? worlds[0]?.id ?? null
  const list = h('div', { class: 'world-list' })
  const playBtn = button('Play Selected World', () => selected && actions.play(selected))
  let confirming = false
  const delBtn = button('Delete', () => {
    if (!selected) return
    if (!confirming) {
      confirming = true
      delBtn.textContent = 'Click again to delete'
      return
    }
    const id = selected
    delBtn.disabled = true
    void actions.remove(id).then(() => {
      worlds = worlds.filter((w) => w.id !== id)
      selected = worlds[0]?.id ?? null
      confirming = false
      delBtn.textContent = 'Delete'
      render()
    })
  }, { cls: 'danger' })

  const render = () => {
    clear(list)
    if (worlds.length === 0) list.append(h('div', { class: 'empty' }, 'No worlds yet — create one!'))
    for (const w of worlds) {
      const item = h(
        'div',
        { class: `world-item ${w.id === selected ? 'sel' : ''}` },
        h('div', {}, h('div', {}, w.name), h('div', { class: 'meta' }, `Seed ${w.seed}`)),
        h('div', { class: 'meta' }, fmt(w.updatedAt)),
      )
      item.addEventListener('click', () => {
        selected = w.id
        confirming = false
        delBtn.textContent = 'Delete'
        render()
      })
      item.addEventListener('dblclick', () => actions.play(w.id))
      list.append(item)
    }
    playBtn.disabled = !selected
    delBtn.disabled = !selected
  }
  render()

  return h(
    'div',
    { class: 'screen dim' },
    h(
      'div',
      { class: 'panel col' },
      h('h2', { class: 'title' }, 'Worlds'),
      list,
      h('div', { class: 'row' }, playBtn, button('Create New World', actions.create)),
      h('div', { class: 'row' }, delBtn, button('Back', actions.back)),
    ),
  )
}
