import type { AudioManager } from './AudioManager'
import { Biquad } from './SoundSynth'
import type { Vec3 } from '../core/math'

/**
 * Background ambience: a looping synthesized wind bed whose volume
 * wanders randomly (so the loop never sounds obviously repeated), bird
 * calls by day, crickets at night, and occasional generative music.
 */
export class AmbientAudio {
  private windGain: GainNode | null = null
  private windSrc: AudioBufferSourceNode | null = null
  private birdTimer = 4
  private cricketTimer = 3
  private musicTimer = 45
  private windTarget = 0.5
  private windTimer = 0

  constructor(private audio: AudioManager) {}

  start(): void {
    const ctx = this.audio.ctx
    if (!ctx || this.windSrc) return
    // 12 s of brown-ish noise, low-passed, with slow gusts, cross-faded at the loop point.
    const len = ctx.sampleRate * 12
    const data = new Float32Array(len)
    const lp = new Biquad(ctx.sampleRate)
    let brown = 0
    for (let i = 0; i < len; i++) {
      if (i % 128 === 0) lp.set('lowpass', 380 + 260 * Math.sin((i / len) * Math.PI * 2 * 3), 0.6)
      brown = brown * 0.985 + (Math.random() * 2 - 1) * 0.06
      data[i] = lp.process(brown) * (0.6 + 0.4 * Math.sin((i / len) * Math.PI * 2 * 2))
    }
    const fade = ctx.sampleRate
    for (let i = 0; i < fade; i++) {
      const t = i / fade
      data[i] = data[i] * t + data[len - fade + i] * (1 - t)
    }
    let peak = 0
    for (const v of data) peak = Math.max(peak, Math.abs(v))
    for (let i = 0; i < len; i++) data[i] /= peak || 1
    const buf = ctx.createBuffer(1, len - fade, ctx.sampleRate)
    buf.copyToChannel(data.subarray(0, len - fade) as Float32Array<ArrayBuffer>, 0)
    this.windSrc = ctx.createBufferSource()
    this.windSrc.buffer = buf
    this.windSrc.loop = true
    this.windGain = ctx.createGain()
    this.windGain.gain.value = 0
    this.windSrc.connect(this.windGain)
    this.windGain.connect(this.audio.bus('ambient')!)
    this.windSrc.start()
  }

  stop(): void {
    try {
      this.windSrc?.stop()
    } catch {
      /* already stopped */
    }
    this.windSrc = null
    this.windGain = null
  }

  update(dt: number, opts: { daylight: number; player: Vec3; altitude: number; underwater: boolean; active: boolean }): void {
    const ctx = this.audio.ctx
    if (!ctx || !this.windGain) return
    this.windTimer -= dt
    if (this.windTimer <= 0) {
      this.windTimer = 3 + Math.random() * 6
      this.windTarget = 0.25 + Math.random() * 0.5
    }
    const altitudeBoost = Math.min(0.4, Math.max(0, (opts.altitude - 40) / 60))
    const level = opts.active ? (this.windTarget + altitudeBoost) * (opts.underwater ? 0.2 : 0.35) : 0.08
    this.windGain.gain.setTargetAtTime(level, ctx.currentTime, 1.2)
    if (!opts.active) return

    const around = (): Vec3 => {
      const a = Math.random() * Math.PI * 2, r = 8 + Math.random() * 14
      return { x: opts.player.x + Math.cos(a) * r, y: opts.player.y + 4 + Math.random() * 6, z: opts.player.z + Math.sin(a) * r }
    }
    this.birdTimer -= dt
    if (this.birdTimer <= 0) {
      this.birdTimer = 5 + Math.random() * 12
      if (opts.daylight > 0.5 && !opts.underwater) this.audio.play('bird', { at: around() })
    }
    this.cricketTimer -= dt
    if (this.cricketTimer <= 0) {
      this.cricketTimer = 1.5 + Math.random() * 4
      if (opts.daylight < 0.3 && !opts.underwater) this.audio.play('cricket', { at: around(), volume: 0.7 })
    }
    this.musicTimer -= dt
    if (this.musicTimer <= 0) {
      this.musicTimer = 180 + Math.random() * 240
      this.playPhrase()
    }
  }

  /** A short generative pentatonic phrase (original, procedurally composed). */
  playPhrase(): void {
    const ctx = this.audio.ctx
    const bus = this.audio.bus('music')
    if (!ctx || !bus || ctx.state !== 'running') return
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19]
    const root = 196 * Math.pow(2, Math.floor(Math.random() * 3) / 12)
    let t = ctx.currentTime + 0.1
    let degree = Math.floor(Math.random() * 4)
    const notes = 10 + Math.floor(Math.random() * 8)
    for (let i = 0; i < notes; i++) {
      degree = Math.max(0, Math.min(scale.length - 1, degree + Math.floor(Math.random() * 5) - 2))
      const f = root * Math.pow(2, scale[degree] / 12)
      for (const [mult, amp] of [[1, 0.16], [2, 0.04], [0.5, 0.05]] as const) {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.type = 'sine'
        o.frequency.value = f * mult * (1 + (Math.random() - 0.5) * 0.004)
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(amp, t + 0.02)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4)
        o.connect(g)
        g.connect(bus)
        o.start(t)
        o.stop(t + 2.5)
      }
      t += [0.45, 0.6, 0.9, 1.2][Math.floor(Math.random() * 4)]
    }
  }
}
