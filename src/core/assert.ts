/**
 * Development assertions. Stripped to no-ops in production builds so hot
 * paths pay nothing; in dev and tests they throw loudly on invalid state
 * (NaN positions, undefined block IDs, negative stack counts...).
 */
const ENABLED = typeof import.meta !== 'undefined' && (import.meta.env?.DEV ?? true)

export function assert(cond: unknown, message: string): asserts cond {
  if (ENABLED && !cond) throw new Error(`Assertion failed: ${message}`)
}

export function assertFinite(n: number, label: string): void {
  if (ENABLED && !Number.isFinite(n)) throw new Error(`Assertion failed: ${label} is not finite (${n})`)
}
