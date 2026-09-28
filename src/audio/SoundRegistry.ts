import { Synth, concat, mix, silence, type Rng } from './SoundSynth'
import type { Material } from '../world/BlockTypes'

export type SoundCategory = 'effects' | 'animals' | 'ambient' | 'music'

export interface SoundDef {
  category: SoundCategory
  /** Number of pre-rendered variations (picked at random to avoid repetition). */
  variants: number
  volume: number
  /** Random playback-rate spread (±). */
  pitchVar: number
  make: (s: Synth, rng: Rng) => Float32Array
}

const step = (freq: number, len: number, grainCount: number, q = 1): SoundDef['make'] => (s, rng) =>
  mix([s.grains(rng, len, grainCount, freq, q), 1], [s.noise(rng, len * 0.8, { type: 'lowpass', freq: freq * 0.5 }), 0.5])

/**
 * Every sound effect in the game, defined as a synthesis recipe.
 * Keys are referenced by gameplay events and block materials.
 */
export const SOUNDS: Record<string, SoundDef> = {
  // Footsteps
  step_grass: { category: 'effects', variants: 4, volume: 0.35, pitchVar: 0.12, make: step(2600, 0.14, 7, 0.9) },
  step_soil: { category: 'effects', variants: 4, volume: 0.4, pitchVar: 0.1, make: step(900, 0.12, 5, 0.8) },
  step_rock: {
    category: 'effects', variants: 4, volume: 0.35, pitchVar: 0.1,
    make: (s, rng) => mix([s.noise(rng, 0.07, { type: 'highpass', freq: 1800 }, 0.001, 4), 1], [s.tone(0.06, 190, 150, 'tri', 0.001, 3), 0.6]),
  },
  step_sand: { category: 'effects', variants: 4, volume: 0.3, pitchVar: 0.12, make: step(4200, 0.16, 12, 0.7) },
  step_wood: {
    category: 'effects', variants: 4, volume: 0.4, pitchVar: 0.08,
    make: (s, rng) => mix([s.tone(0.09, 150, 120, 'sine', 0.001, 3), 1], [s.tone(0.05, 320, 260, 'tri', 0.001, 3), 0.4], [s.noise(rng, 0.05, { type: 'bandpass', freq: 700 }), 0.4]),
  },
  step_leaves: { category: 'effects', variants: 3, volume: 0.3, pitchVar: 0.15, make: step(3500, 0.18, 10, 1.4) },
  splash: {
    category: 'effects', variants: 3, volume: 0.35, pitchVar: 0.15,
    make: (s, rng) => mix([s.noise(rng, 0.35, { type: 'bandpass', freq: 1400, sweepTo: 500, q: 0.6 }, 0.01, 2), 1], [s.grains(rng, 0.3, 10, 2500), 0.4]),
  },

  // Block hits (while mining) and breaks
  hit_soft: { category: 'effects', variants: 4, volume: 0.35, pitchVar: 0.1, make: step(1400, 0.08, 4) },
  hit_rock: {
    category: 'effects', variants: 4, volume: 0.35, pitchVar: 0.08,
    make: (s, rng) => mix([s.noise(rng, 0.06, { type: 'bandpass', freq: 2600, q: 2 }, 0.001, 4), 1], [s.tone(0.05, 420, 380, 'tri', 0.001, 4), 0.3]),
  },
  hit_wood: {
    category: 'effects', variants: 4, volume: 0.4, pitchVar: 0.08,
    make: (s, rng) => mix([s.tone(0.08, 210, 170, 'sine', 0.001, 3), 1], [s.noise(rng, 0.05, { type: 'bandpass', freq: 900 }), 0.5]),
  },
  break_soft: { category: 'effects', variants: 3, volume: 0.5, pitchVar: 0.1, make: (s, rng) => mix([s.grains(rng, 0.28, 16, 1500), 1], [s.noise(rng, 0.2, { type: 'lowpass', freq: 600 }), 0.6]) },
  break_rock: {
    category: 'effects', variants: 3, volume: 0.5, pitchVar: 0.08,
    make: (s, rng) => mix([s.grains(rng, 0.3, 18, 2200, 1.6), 1], [s.noise(rng, 0.22, { type: 'lowpass', freq: 900, sweepTo: 300 }), 0.6]),
  },
  break_wood: {
    category: 'effects', variants: 3, volume: 0.5, pitchVar: 0.08,
    make: (s, rng) => mix([s.grains(rng, 0.3, 10, 800), 1], [s.tone(0.18, 180, 110, 'tri', 0.002, 2), 0.5]),
  },
  break_leaves: { category: 'effects', variants: 3, volume: 0.45, pitchVar: 0.12, make: (s, rng) => s.grains(rng, 0.3, 22, 3200, 1.2) },
  place: {
    category: 'effects', variants: 3, volume: 0.45, pitchVar: 0.12,
    make: (s, rng) => mix([s.noise(rng, 0.09, { type: 'lowpass', freq: 700 }, 0.001, 3), 1], [s.tone(0.08, 130, 95, 'sine', 0.001, 3), 0.8]),
  },

  // Items and UI
  pickup: { category: 'effects', variants: 1, volume: 0.3, pitchVar: 0.25, make: (s) => s.tone(0.08, 620, 1250, 'sine', 0.002, 1.5) },
  click: { category: 'effects', variants: 1, volume: 0.25, pitchVar: 0.05, make: (s) => s.tone(0.035, 1500, 1300, 'square', 0.001, 3) },
  craft: {
    category: 'effects', variants: 1, volume: 0.3, pitchVar: 0.02,
    make: (s) => concat(s.tone(0.07, 660, 660, 'tri', 0.002, 1.5), s.tone(0.12, 990, 990, 'tri', 0.002, 2)),
  },
  tool_break: {
    category: 'effects', variants: 1, volume: 0.5, pitchVar: 0.05,
    make: (s, rng) => mix([s.noise(rng, 0.2, { type: 'highpass', freq: 3000 }, 0.001, 3), 0.8], [s.tone(0.3, 2200, 1900, 'tri', 0.001, 3), 0.5], [s.grains(rng, 0.25, 8, 1200), 0.6]),
  },
  eat: { category: 'effects', variants: 3, volume: 0.4, pitchVar: 0.15, make: (s, rng) => s.grains(rng, 0.12, 6, 1800, 1.5) },
  ate: {
    category: 'effects', variants: 1, volume: 0.35, pitchVar: 0.03,
    make: (s) => concat(s.tone(0.06, 520, 540, 'sine', 0.003, 1), s.tone(0.1, 780, 800, 'sine', 0.003, 2)),
  },
  hurt: {
    category: 'effects', variants: 2, volume: 0.55, pitchVar: 0.08,
    make: (s, rng) => mix([s.tone(0.16, 240, 140, 'square', 0.002, 2), 0.5], [s.noise(rng, 0.14, { type: 'bandpass', freq: 800, q: 1.2 }), 0.7]),
  },
  swing: { category: 'effects', variants: 2, volume: 0.12, pitchVar: 0.15, make: (s, rng) => s.noise(rng, 0.12, { type: 'bandpass', freq: 900, sweepTo: 2200, q: 1.5 }, 0.03, 2) },
  land: { category: 'effects', variants: 2, volume: 0.35, pitchVar: 0.1, make: (s, rng) => s.noise(rng, 0.1, { type: 'lowpass', freq: 400 }, 0.001, 3) },

  // Animals
  pig_idle: {
    category: 'animals', variants: 3, volume: 0.55, pitchVar: 0.1,
    make: (s, rng) => {
      const grunt = (len: number, p: number) => s.voice(len, (t) => p * (1 + 0.25 * Math.sin(t * Math.PI)), (t) => 700 + 500 * Math.sin(t * Math.PI), 3, (t) => Math.sin(t * Math.PI) ** 0.6, rng, 0.25)
      return concat(grunt(0.16, 170 + rng() * 30), silence(s, 0.05), grunt(0.2, 150 + rng() * 30))
    },
  },
  pig_hurt: {
    category: 'animals', variants: 2, volume: 0.6, pitchVar: 0.08,
    make: (s, rng) => s.voice(0.3, (t) => 420 - 160 * t, (t) => 1400 - 400 * t, 2.5, (t) => Math.sin(Math.min(1, t * 4) * Math.PI / 2) * (1 - t), rng, 0.3),
  },
  cow_idle: {
    category: 'animals', variants: 2, volume: 0.55, pitchVar: 0.06,
    make: (s, rng) => s.voice(1.2, (t) => 115 - 25 * t + Math.sin(t * 40) * 2, (t) => 380 + 520 * Math.sin(Math.min(1, t * 1.6) * Math.PI), 2.2, (t) => Math.min(1, t * 6) * Math.pow(1 - t, 0.7), rng, 0.08),
  },
  cow_hurt: {
    category: 'animals', variants: 2, volume: 0.6, pitchVar: 0.06,
    make: (s, rng) => s.voice(0.45, (t) => 170 - 40 * t, (t) => 900 - 300 * t, 2, (t) => Math.min(1, t * 10) * (1 - t), rng, 0.15),
  },

  // Ambience
  bird: {
    category: 'ambient', variants: 4, volume: 0.22, pitchVar: 0.1,
    make: (s, rng) => {
      const notes: Float32Array[] = []
      const n = 2 + Math.floor(rng() * 4)
      for (let i = 0; i < n; i++) {
        const f = 2600 + rng() * 1800
        notes.push(s.tone(0.05 + rng() * 0.06, f, f * (0.8 + rng() * 0.5), 'sine', 0.004, 1.2), silence(s, 0.03 + rng() * 0.06))
      }
      return concat(...notes)
    },
  },
  cricket: {
    category: 'ambient', variants: 2, volume: 0.12, pitchVar: 0.05,
    make: (s) => {
      const parts: Float32Array[] = []
      for (let i = 0; i < 4; i++) parts.push(s.tone(0.035, 4600, 4500, 'sine', 0.002, 1), silence(s, 0.03))
      return concat(...parts)
    },
  },
}

const HIT_BY_MATERIAL: Record<Material, string> = {
  grass: 'hit_soft', soil: 'hit_soft', sand: 'hit_soft', leaves: 'hit_soft', rock: 'hit_rock', wood: 'hit_wood', water: 'splash', none: 'hit_soft',
}
const BREAK_BY_MATERIAL: Record<Material, string> = {
  grass: 'break_soft', soil: 'break_soft', sand: 'break_soft', leaves: 'break_leaves', rock: 'break_rock', wood: 'break_wood', water: 'splash', none: 'break_soft',
}
const STEP_BY_MATERIAL: Record<Material, string> = {
  grass: 'step_grass', soil: 'step_soil', sand: 'step_sand', leaves: 'step_leaves', rock: 'step_rock', wood: 'step_wood', water: 'splash', none: 'step_soil',
}

export const materialSound = {
  hit: (m: Material) => HIT_BY_MATERIAL[m],
  break: (m: Material) => BREAK_BY_MATERIAL[m],
  step: (m: Material) => STEP_BY_MATERIAL[m],
}
