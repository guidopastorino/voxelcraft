type Child = Node | string | null | undefined | false
type Attrs = Record<string, string | number | boolean | ((e: Event) => void) | undefined>

/** Tiny hyperscript helper for building UI without a framework. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener)
    else if (k === 'class') el.className = String(v)
    else if (k === 'style') el.setAttribute('style', String(v))
    else if (v === true) el.setAttribute(k, '')
    else el.setAttribute(k, String(v))
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c)
  return el
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild)
}

/** A styled menu button. `onClick` also plays the UI click (wired by the caller via `sound`). */
export function button(label: string, onClick: () => void, opts: { cls?: string; disabled?: boolean; title?: string } = {}): HTMLButtonElement {
  const b = h('button', { class: `vc-btn ${opts.cls ?? ''}`, title: opts.title, type: 'button' }, label)
  b.disabled = !!opts.disabled
  b.addEventListener('click', () => {
    uiSound?.()
    onClick()
  })
  return b
}

let uiSound: (() => void) | null = null
export function setUiSound(fn: () => void): void {
  uiSound = fn
}
export function playUiSound(): void {
  uiSound?.()
}
