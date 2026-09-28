import { Entity } from './Entity'
import type { AnimalDefinition } from '../config/animals'
import { ANIMAL_DEFS } from '../config/animals'
import type { Vec3 } from '../core/math'
import { assert } from '../core/assert'

export type AnimalState = 'idle' | 'wander' | 'flee'

export class Animal extends Entity {
  readonly def: AnimalDefinition
  health: number
  state: AnimalState = 'idle'
  stateTimer = 0
  /** Desired heading while wandering/fleeing. */
  heading = 0
  /** Seconds of red hurt-flash left. */
  hurtTimer = 0
  /** Seconds since death (death animation), -1 while alive. */
  deathTimer = -1
  /** Accumulated walk distance, drives leg swing. */
  walkPhase = 0
  headPitch = 0
  idleSoundTimer: number

  constructor(kind: string, pos: Vec3, health?: number) {
    const def = ANIMAL_DEFS[kind]
    assert(def, `unknown animal kind ${kind}`)
    super(pos, def.width, def.height)
    this.def = def
    this.health = health ?? def.maxHealth
    this.idleSoundTimer = 5 + Math.random() * 15
    this.yaw = Math.random() * Math.PI * 2
    this.heading = this.yaw
  }

  get kind(): string {
    return this.def.kind
  }
}
