/**
 * Deterministic randomness. Everything in world generation derives from the
 * world seed through these functions so the same seed always yields the
 * same world, independent of chunk load order.
 */

/** Mulberry32 PRNG: fast, 32-bit state, good enough for gameplay. */
export class SeededRandom {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  /** Float in [0, 1). */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1))
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }
}

/** Stateless integer hash of (seed, a, b, c) → uint32. Order-independent world features use this. */
export function hash3(seed: number, a: number, b: number, c = 0): number {
  let h = (seed ^ 0x9e3779b9) >>> 0
  h = Math.imul(h ^ (a | 0), 0x85ebca6b)
  h = (h ^ (h >>> 13)) >>> 0
  h = Math.imul(h ^ (b | 0), 0xc2b2ae35)
  h = (h ^ (h >>> 16)) >>> 0
  h = Math.imul(h ^ (c | 0), 0x27d4eb2f)
  h ^= h >>> 15
  h = Math.imul(h, 0x165667b1)
  h ^= h >>> 13
  return h >>> 0
}

/** hash3 mapped to [0, 1). */
export const hashFloat = (seed: number, a: number, b: number, c = 0): number => hash3(seed, a, b, c) / 4294967296

export function randomSeed(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return crypto.getRandomValues(new Uint32Array(1))[0]
  }
  return Math.floor(Math.random() * 4294967296) >>> 0
}

/** Converts a user-typed seed to a uint32: numeric strings are used as-is, text is hashed. */
export function parseSeed(input: string): number {
  const trimmed = input.trim()
  if (trimmed === '') return randomSeed()
  if (/^-?\d+$/.test(trimmed)) {
    const n = Number(trimmed)
    if (Number.isSafeInteger(n)) return n >>> 0
  }
  let h = 2166136261
  for (let i = 0; i < trimmed.length; i++) {
    h ^= trimmed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
