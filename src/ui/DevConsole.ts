import { h } from './dom'
import type { GameSession } from '../app/GameSession'
import { ItemRegistry } from '../items/ItemRegistry'
import { makeStack } from '../items/ItemStack'
import { WORLD } from '../config/defaults'

/**
 * Development-only command console (opened with `/` while playing).
 * /gamemode debug|survival · /give <item> [count] · /tp x y z ·
 * /settime <0..1 | day | night> · /seed · /heal · /hunger <n> · /kill
 */
export class DevConsole {
  readonly root: HTMLElement
  private input: HTMLInputElement
  private log: HTMLElement
  open = false

  constructor(private getSession: () => GameSession | null, private onClose: () => void) {
    this.input = h('input', { class: 'vc-input', placeholder: '/give stone 64' }) as HTMLInputElement
    this.log = h('div', { class: 'log' })
    this.root = h('div', { class: 'console' }, this.log, this.input)
    this.root.style.display = 'none'
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (e.key === 'Enter') {
        this.print(this.run(this.input.value.trim()))
        this.input.value = ''
        this.close()
      } else if (e.key === 'Escape') {
        this.close()
      }
    })
  }

  show(prefix = '/'): void {
    this.open = true
    this.root.style.display = 'flex'
    this.input.value = prefix
    setTimeout(() => this.input.focus(), 0)
  }

  close(): void {
    this.open = false
    this.root.style.display = 'none'
    this.input.blur()
    this.onClose()
  }

  private print(msg: string): void {
    this.log.textContent = msg
    setTimeout(() => {
      if (this.log.textContent === msg) this.log.textContent = ''
    }, 5000)
  }

  run(line: string): string {
    const s = this.getSession()
    if (!s) return 'No world loaded'
    const [cmd, ...args] = line.replace(/^\//, '').split(/\s+/)
    const p = s.player
    switch (cmd) {
      case 'gamemode':
        p.debugMode = args[0] === 'debug'
        return `Game mode: ${p.debugMode ? 'debug (fly, instant break, no damage)' : 'survival'}`
      case 'give': {
        const id = args[0]
        if (!id || !ItemRegistry.has(id)) return `Unknown item. Try: ${ItemRegistry.all().map((i) => i.id).join(', ')}`
        let n = Math.max(1, Math.min(2304, Number(args[1] ?? 1) | 0))
        const max = ItemRegistry.get(id).maxStack
        while (n > 0) {
          const c = Math.min(n, max)
          const rest = p.inventory.add(makeStack(id, c))
          if (rest) {
            s.throwStack(rest)
            break
          }
          n -= c
        }
        return `Gave ${args[1] ?? 1} ${id}`
      }
      case 'tp': {
        const [x, y, z] = args.map(Number)
        if (![x, y, z].every(Number.isFinite)) return 'Usage: /tp x y z'
        p.teleport({ x, y, z })
        return `Teleported to ${x} ${y} ${z}`
      }
      case 'settime': {
        const v = args[0] === 'day' ? 0.02 : args[0] === 'noon' ? 0.25 : args[0] === 'night' ? 0.6 : Number(args[0])
        if (!Number.isFinite(v)) return 'Usage: /settime <0..1 | day | noon | night>'
        s.time = (Math.floor(s.time / WORLD.dayLength) + (v % 1)) * WORLD.dayLength
        return `Time set to ${v}`
      }
      case 'seed':
        return `Seed: ${s.metadata.seed}`
      case 'heal':
        p.stats.reset(p.stats.hunger)
        return 'Healed'
      case 'hunger': {
        const n = Number(args[0])
        if (!Number.isFinite(n)) return 'Usage: /hunger <0..20>'
        p.stats.hunger = Math.max(0, Math.min(20, n))
        return `Hunger set to ${p.stats.hunger}`
      }
      case 'kill':
        s.damagePlayer(1000, 'debug')
        return 'Ouch'
      default:
        return `Unknown command: ${cmd}`
    }
  }
}
