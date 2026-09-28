import { h } from './dom'

export type LoadingStage = string
export const WORLD_STAGES = ['Terrain', 'Meshing', 'Spawning entities', 'Ready']

/** "Generating world…" with approximate progress per stage. */
export class LoadingScreen {
  readonly root: HTMLElement
  private bar: HTMLElement
  private stageEls: HTMLElement[]
  private label: HTMLElement

  constructor(title = 'Generating world…', private stages: string[] = WORLD_STAGES) {
    this.bar = h('div')
    this.stageEls = stages.map((s) => h('span', {}, s))
    this.label = h('div', { class: 'subtitle' }, '')
    this.root = h(
      'div',
      { class: 'screen dark' },
      h('h2', { class: 'title' }, title),
      h('div', { class: 'progress' }, this.bar),
      h('div', { class: 'stages' }, ...this.stageEls),
      this.label,
    )
  }

  set(stage: LoadingStage, progress: number, detail = ''): void {
    const i = this.stages.indexOf(stage)
    this.stageEls.forEach((el, k) => {
      el.className = k < i ? 'done' : k === i ? 'active' : ''
    })
    const overall = (i + Math.max(0, Math.min(1, progress))) / this.stages.length
    this.bar.style.width = `${Math.round(overall * 100)}%`
    this.label.textContent = detail
  }
}
