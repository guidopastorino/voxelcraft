import { button, clear, h, playUiSound } from './dom'
import { ACTION_LABELS, DEFAULT_KEYBINDINGS, type ActionName, type Settings } from '../config/defaults'
import { keyLabel } from '../input/InputManager'

type Tab = 'Audio' | 'Controls' | 'Video' | 'Gameplay'

/** Returns the actions whose binding collides with another action. */
export function findConflicts(bindings: Record<ActionName, string>): Set<ActionName> {
  const byKey = new Map<string, ActionName[]>()
  for (const [a, k] of Object.entries(bindings) as [ActionName, string][]) byKey.set(k, [...(byKey.get(k) ?? []), a])
  const out = new Set<ActionName>()
  for (const list of byKey.values()) if (list.length > 1) list.forEach((a) => out.add(a))
  return out
}

/**
 * Settings screen with Audio / Controls / Video / Gameplay tabs. Every
 * change is applied live through `onChange` and persisted by the caller.
 */
export function createSettings(settings: Settings, onChange: (s: Settings) => void, onDone: () => void, initialTab: Tab = 'Audio'): HTMLElement {
  let tab: Tab = initialTab
  const body = h('div', { class: 'settings-body' })
  const tabs = h('div', { class: 'tabs' })
  let capture: ((e: KeyboardEvent | MouseEvent) => void) | null = null

  const stopCapture = () => {
    if (!capture) return
    window.removeEventListener('keydown', capture as EventListener, true)
    window.removeEventListener('mousedown', capture as EventListener, true)
    capture = null
  }

  const slider = (label: string, value: number, min: number, max: number, step: number, fmt: (v: number) => string, set: (v: number) => void) => {
    const val = h('span', { class: 'val' }, fmt(value))
    const input = h('input', { type: 'range', min, max, step, value }) as HTMLInputElement
    input.addEventListener('input', () => {
      const v = Number(input.value)
      val.textContent = fmt(v)
      set(v)
      onChange(settings)
    })
    return h('div', { class: 'slider' }, h('span', {}, label), val, input)
  }
  const pct = (v: number) => `${Math.round(v * 100)}%`
  const toggle = (label: string, get: () => boolean, set: (v: boolean) => void) => {
    const b = button(get() ? 'ON' : 'OFF', () => {
      set(!get())
      b.textContent = get() ? 'ON' : 'OFF'
      onChange(settings)
    }, { cls: 'small' })
    return h('div', { class: 'toggle-row' }, h('span', {}, label), b)
  }
  const cycle = <T extends string>(label: string, options: T[], get: () => T, set: (v: T) => void) => {
    const b = button(get(), () => {
      set(options[(options.indexOf(get()) + 1) % options.length])
      b.textContent = get()
      onChange(settings)
    }, { cls: 'small' })
    return h('div', { class: 'toggle-row' }, h('span', {}, label), b)
  }

  const render = () => {
    stopCapture()
    clear(tabs)
    for (const t of ['Audio', 'Controls', 'Video', 'Gameplay'] as Tab[]) {
      tabs.append(button(t, () => {
        tab = t
        render()
      }, { cls: `small ${t === tab ? 'selected' : ''}` }))
    }
    clear(body)
    const a = settings.audio
    if (tab === 'Audio') {
      body.append(
        slider('Master Volume', a.master, 0, 1, 0.01, pct, (v) => (a.master = v)),
        slider('Music', a.music, 0, 1, 0.01, pct, (v) => (a.music = v)),
        slider('Ambient', a.ambient, 0, 1, 0.01, pct, (v) => (a.ambient = v)),
        slider('Effects', a.effects, 0, 1, 0.01, pct, (v) => (a.effects = v)),
        slider('Animals', a.animals, 0, 1, 0.01, pct, (v) => (a.animals = v)),
      )
    } else if (tab === 'Controls') {
      const c = settings.controls
      body.append(
        slider('Mouse Sensitivity', c.sensitivity, 0.05, 2, 0.05, (v) => `${Math.round(v * 100)}%`, (v) => (c.sensitivity = v)),
        toggle('Invert Mouse Y', () => c.invertY, (v) => (c.invertY = v)),
      )
      const conflicts = findConflicts(c.bindings)
      const grid = h('div', { class: 'binds' })
      for (const action of Object.keys(ACTION_LABELS) as ActionName[]) {
        const b = button(keyLabel(c.bindings[action]), () => {
          stopCapture()
          b.textContent = '> press a key <'
          capture = (e: KeyboardEvent | MouseEvent) => {
            e.preventDefault()
            e.stopPropagation()
            if (e instanceof KeyboardEvent && e.code === 'Escape') {
              render()
              return
            }
            // Ignore the click that started the capture.
            if (e instanceof MouseEvent && e.target === b) return
            c.bindings[action] = e instanceof KeyboardEvent ? e.code : `Mouse${e.button}`
            playUiSound()
            onChange(settings)
            render()
          }
          setTimeout(() => {
            window.addEventListener('keydown', capture as EventListener, true)
            window.addEventListener('mousedown', capture as EventListener, true)
          }, 0)
        }, { cls: `small ${conflicts.has(action) ? 'conflict' : ''}` })
        grid.append(h('span', {}, ACTION_LABELS[action]), b)
      }
      body.append(
        grid,
        conflicts.size ? h('div', { class: 'hint', style: 'color: var(--danger)' }, 'Some keys are bound to more than one action (highlighted).') : h('div', { class: 'hint' }, 'Click a binding, then press a key or mouse button. Esc cancels.'),
        button('Reset Controls', () => {
          c.bindings = { ...DEFAULT_KEYBINDINGS }
          onChange(settings)
          render()
        }, { cls: 'small' }),
      )
    } else if (tab === 'Video') {
      const v = settings.video
      body.append(
        slider('Render Distance', v.renderDistance, 2, 10, 1, (x) => `${x} chunks`, (x) => (v.renderDistance = x)),
        slider('Field of View', v.fov, 60, 100, 1, (x) => `${x}°`, (x) => (v.fov = x)),
        cycle('Particles', ['low', 'medium', 'high'], () => v.particles, (x) => (v.particles = x)),
        toggle('Clouds', () => v.clouds, (x) => (v.clouds = x)),
        h('div', { class: 'hint' }, 'VSync is controlled by the browser.'),
      )
    } else {
      const g = settings.gameplay
      body.append(
        toggle('View Bobbing', () => g.viewBobbing, (x) => (g.viewBobbing = x)),
        slider('Crosshair Size', g.crosshairSize, 0.5, 2, 0.1, (x) => `${Math.round(x * 100)}%`, (x) => (g.crosshairSize = x)),
        slider('UI Scale', g.uiScale, 0, 4, 1, (x) => (x === 0 ? 'Auto' : `${x}×`), (x) => (g.uiScale = x)),
      )
    }
  }
  render()

  return h(
    'div',
    { class: 'screen dim' },
    h('div', { class: 'panel' }, h('h2', { class: 'title' }, 'Settings'), tabs, body, h('div', { class: 'col', style: 'margin-top: calc(var(--u) * 6)' }, button('Done', () => {
      stopCapture()
      onDone()
    }))),
  )
}
