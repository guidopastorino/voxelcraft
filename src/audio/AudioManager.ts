import { SOUNDS, type SoundCategory } from './SoundRegistry'
import { Synth } from './SoundSynth'
import { SeededRandom } from '../world/SeededRandom'
import type { Vec3 } from '../core/math'

export interface Volumes {
  master: number
  music: number
  ambient: number
  effects: number
  animals: number
}

/**
 * Web Audio mixer: master → category buses (music, ambient, effects,
 * animals). Sounds are synthesised once into AudioBuffers; world sounds
 * use 3D panners (volume by distance), UI sounds play flat.
 */
export class AudioManager {
  readonly ctx: AudioContext | null
  private master: GainNode | null = null
  private buses = new Map<SoundCategory, GainNode>()
  private buffers = new Map<string, AudioBuffer[]>()
  private cooldowns = new Map<string, number>()
  private rng = new SeededRandom(99)

  constructor() {
    let ctx: AudioContext | null
    try {
      ctx = new AudioContext()
    } catch {
      ctx = null
    }
    this.ctx = ctx
    if (!ctx) return
    this.master = ctx.createGain()
    this.master.connect(ctx.destination)
    for (const c of ['music', 'ambient', 'effects', 'animals'] as SoundCategory[]) {
      const g = ctx.createGain()
      g.connect(this.master)
      this.buses.set(c, g)
    }
  }

  /** Browsers start audio suspended until a user gesture. */
  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
  }

  bus(c: SoundCategory): GainNode | null {
    return this.buses.get(c) ?? null
  }

  setVolumes(v: Volumes): void {
    if (!this.ctx || !this.master) return
    const t = this.ctx.currentTime
    this.master.gain.setTargetAtTime(v.master, t, 0.02)
    for (const c of ['music', 'ambient', 'effects', 'animals'] as SoundCategory[]) this.buses.get(c)!.gain.setTargetAtTime(v[c], t, 0.02)
  }

  /** Renders all sound variations up front (called during boot). */
  preload(): void {
    if (!this.ctx) return
    const synth = new Synth(this.ctx.sampleRate)
    for (const [key, def] of Object.entries(SOUNDS)) {
      const list: AudioBuffer[] = []
      for (let v = 0; v < def.variants; v++) {
        const rng = new SeededRandom(key.length * 1000 + v * 77 + key.charCodeAt(0))
        const data = def.make(synth, () => rng.next())
        const buf = this.ctx.createBuffer(1, data.length, this.ctx.sampleRate)
        buf.copyToChannel(data as Float32Array<ArrayBuffer>, 0)
        list.push(buf)
      }
      this.buffers.set(key, list)
    }
  }

  setListener(pos: Vec3, forward: Vec3): void {
    const ctx = this.ctx
    if (!ctx) return
    const l = ctx.listener
    const t = ctx.currentTime
    if (l.positionX) {
      l.positionX.setTargetAtTime(pos.x, t, 0.02)
      l.positionY.setTargetAtTime(pos.y, t, 0.02)
      l.positionZ.setTargetAtTime(pos.z, t, 0.02)
      l.forwardX.setTargetAtTime(forward.x, t, 0.02)
      l.forwardY.setTargetAtTime(forward.y, t, 0.02)
      l.forwardZ.setTargetAtTime(forward.z, t, 0.02)
      l.upX.value = 0
      l.upY.value = 1
      l.upZ.value = 0
    } else {
      l.setPosition(pos.x, pos.y, pos.z)
      l.setOrientation(forward.x, forward.y, forward.z, 0, 1, 0)
    }
  }

  /**
   * Plays a sound. With `at`, it is positioned in 3D. `cooldown` (s)
   * suppresses spam of the same key (footsteps, hits, idle calls).
   */
  play(key: string, opts: { at?: Vec3; volume?: number; pitch?: number; cooldown?: number } = {}): void {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running') return
    const def = SOUNDS[key]
    const list = this.buffers.get(key)
    if (!def || !list) return
    if (opts.cooldown) {
      const last = this.cooldowns.get(key) ?? -Infinity
      if (ctx.currentTime - last < opts.cooldown) return
      this.cooldowns.set(key, ctx.currentTime)
    }
    const src = ctx.createBufferSource()
    src.buffer = list[Math.floor(this.rng.next() * list.length)]
    src.playbackRate.value = (opts.pitch ?? 1) * (1 + (this.rng.next() * 2 - 1) * def.pitchVar)
    const gain = ctx.createGain()
    gain.gain.value = def.volume * (opts.volume ?? 1)
    src.connect(gain)
    let out: AudioNode = gain
    if (opts.at) {
      const p = ctx.createPanner()
      p.panningModel = 'HRTF'
      p.distanceModel = 'inverse'
      p.refDistance = 2
      p.maxDistance = 40
      p.rolloffFactor = 1.4
      p.positionX.value = opts.at.x
      p.positionY.value = opts.at.y
      p.positionZ.value = opts.at.z
      gain.connect(p)
      out = p
    }
    out.connect(this.buses.get(def.category)!)
    src.start()
  }
}
