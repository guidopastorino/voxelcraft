import { GameSession, EMPTY_INPUT, type TickInput } from '../src/app/GameSession'
import type { WorldMetadata } from '../src/save/types'
import { SeededRandom } from '../src/world/SeededRandom'

export const DT = 1 / 60

export function meta(seed: number): WorldMetadata {
  return { id: `test-${seed}`, name: 'Test', seed, createdAt: 0, updatedAt: 0, version: 1 }
}

export function makeSession(seed = 12345, opts: ConstructorParameters<typeof GameSession>[1] = {}): GameSession {
  const rng = new SeededRandom(seed)
  const s = new GameSession(meta(seed), { rng: () => rng.next(), ...opts })
  s.loadAround(3)
  return s
}

export function tick(s: GameSession, seconds: number, input: Partial<TickInput> = {}): void {
  const n = Math.round(seconds / DT)
  for (let i = 0; i < n; i++) {
    s.tick(DT, { ...EMPTY_INPUT, ...input })
    // Edge-triggered inputs only fire on the first frame.
    input = { ...input, attackPressed: false, usePressed: false }
  }
}

/** Points the player's view at a world point. */
export function lookAt(s: GameSession, x: number, y: number, z: number): void {
  const eye = s.player.eyePosition()
  const dx = x - eye.x, dy = y - eye.y, dz = z - eye.z
  s.player.yaw = Math.atan2(-dx, -dz)
  s.player.pitch = Math.atan2(dy, Math.hypot(dx, dz))
}

/** Holds attack on a block until it disappears (or timeout). Returns seconds taken. */
export function mineBlock(s: GameSession, x: number, y: number, z: number, maxSeconds = 12): number {
  const start = s.world.getBlock(x, y, z)
  let t = 0
  let first = true
  while (t < maxSeconds && s.world.getBlock(x, y, z) === start) {
    lookAt(s, x + 0.5, y + 0.5, z + 0.5)
    s.tick(DT, { ...EMPTY_INPUT, attack: true, attackPressed: first })
    first = false
    t += DT
  }
  return t
}
