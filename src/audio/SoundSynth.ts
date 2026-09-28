/**
 * Tiny offline synthesiser: every sound in the game is generated from
 * noise and oscillators at startup — no recorded or third-party audio.
 * All functions return mono Float32Array samples.
 */
export type Rng = () => number

export class Biquad {
  private b0 = 1; private b1 = 0; private b2 = 0; private a1 = 0; private a2 = 0
  private x1 = 0; private x2 = 0; private y1 = 0; private y2 = 0

  constructor(private sr: number) {}

  set(type: 'lowpass' | 'highpass' | 'bandpass', freq: number, q = 0.707): this {
    const w = (2 * Math.PI * Math.min(freq, this.sr * 0.45)) / this.sr
    const cos = Math.cos(w), alpha = Math.sin(w) / (2 * q)
    let b0: number, b1: number, b2: number
    if (type === 'lowpass') { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2 }
    else if (type === 'highpass') { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2 }
    else { b0 = alpha; b1 = 0; b2 = -alpha }
    const a0 = 1 + alpha
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0
    this.a1 = (-2 * cos) / a0; this.a2 = (1 - alpha) / a0
    return this
  }

  process(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y
    return y
  }
}

export class Synth {
  constructor(readonly sr: number) {}

  buf(seconds: number): Float32Array {
    return new Float32Array(Math.max(1, Math.floor(seconds * this.sr)))
  }

  /** Filtered noise with an attack/decay envelope. */
  noise(rng: Rng, seconds: number, filter: { type: 'lowpass' | 'highpass' | 'bandpass'; freq: number; q?: number; sweepTo?: number }, attack = 0.004, decayPow = 3): Float32Array {
    const out = this.buf(seconds)
    const f = new Biquad(this.sr)
    for (let i = 0; i < out.length; i++) {
      const t = i / out.length
      if (i % 64 === 0) f.set(filter.type, filter.sweepTo ? filter.freq + (filter.sweepTo - filter.freq) * t : filter.freq, filter.q ?? 0.8)
      const env = Math.min(1, i / (attack * this.sr)) * Math.pow(1 - t, decayPow)
      out[i] = f.process(rng() * 2 - 1) * env
    }
    return normalize(out, 0.9)
  }

  /** Crunchy texture: a cluster of short filtered noise grains. */
  grains(rng: Rng, seconds: number, count: number, freq: number, q = 1.2): Float32Array {
    const out = this.buf(seconds)
    for (let g = 0; g < count; g++) {
      const start = Math.floor(rng() * out.length * 0.7)
      const grain = this.noise(rng, 0.015 + rng() * 0.03, { type: 'bandpass', freq: freq * (0.7 + rng() * 0.6), q }, 0.001, 2)
      const amp = 0.4 + rng() * 0.6
      for (let i = 0; i < grain.length && start + i < out.length; i++) out[start + i] += grain[i] * amp
    }
    return normalize(out, 0.9)
  }

  /** Oscillator with pitch contour; shape: sine/square/saw/tri. */
  tone(seconds: number, f0: number, f1: number, shape: 'sine' | 'square' | 'saw' | 'tri', attack = 0.005, decayPow = 2, vibrato = 0): Float32Array {
    const out = this.buf(seconds)
    let phase = 0
    for (let i = 0; i < out.length; i++) {
      const t = i / out.length
      const f = f0 * Math.pow(f1 / f0, t) * (1 + Math.sin(i / this.sr * 2 * Math.PI * 5.5) * vibrato)
      phase += f / this.sr
      const p = phase % 1
      const v = shape === 'sine' ? Math.sin(p * 2 * Math.PI) : shape === 'square' ? (p < 0.5 ? 1 : -1) : shape === 'saw' ? p * 2 - 1 : 1 - 4 * Math.abs(p - 0.5)
      out[i] = v * Math.min(1, i / (attack * this.sr)) * Math.pow(1 - t, decayPow)
    }
    return out
  }

  /** Voice-like tone through a moving band-pass "formant" (animal calls). */
  voice(seconds: number, pitch: (t: number) => number, formant: (t: number) => number, q: number, env: (t: number) => number, rng: Rng, breath = 0.1): Float32Array {
    const out = this.buf(seconds)
    const f = new Biquad(this.sr)
    const f2 = new Biquad(this.sr)
    let phase = 0
    for (let i = 0; i < out.length; i++) {
      const t = i / out.length
      if (i % 32 === 0) {
        f.set('bandpass', formant(t), q)
        f2.set('bandpass', formant(t) * 2.4, q * 1.3)
      }
      phase += pitch(t) / this.sr
      const src = (phase % 1) * 2 - 1 + (rng() * 2 - 1) * breath
      out[i] = (f.process(src) * 1.0 + f2.process(src) * 0.35) * env(t)
    }
    return normalize(out, 0.9)
  }
}

export function mix(...parts: [Float32Array, number][]): Float32Array {
  const len = Math.max(...parts.map(([p]) => p.length))
  const out = new Float32Array(len)
  for (const [p, g] of parts) for (let i = 0; i < p.length; i++) out[i] += p[i] * g
  return normalize(out, 0.9)
}

export function concat(...parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

export function silence(synth: Synth, seconds: number): Float32Array {
  return synth.buf(seconds)
}

export function normalize(a: Float32Array, peak: number): Float32Array {
  let m = 0
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]))
  if (m > 0) {
    const k = peak / m
    for (let i = 0; i < a.length; i++) a[i] *= k
  }
  return a
}
