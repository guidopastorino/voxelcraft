import { SURVIVAL } from '../config/defaults'
import { clamp } from '../core/math'

export interface StatsTickResult {
  /** HP lost to starvation this tick. */
  starvationDamage: number
  healed: number
}

/**
 * Health, hunger and exhaustion. Pure logic (no rendering, no events):
 * actions add exhaustion; crossing the threshold costs hunger; hunger
 * gates regeneration, sprinting and starvation damage.
 */
export class PlayerStats {
  health: number = SURVIVAL.maxHealth
  hunger: number = SURVIVAL.maxHunger
  exhaustion = 0
  private regenTimer = 0
  private starveTimer = 0

  addExhaustion(amount: number): void {
    if (amount <= 0) return
    this.exhaustion += amount
    while (this.exhaustion >= SURVIVAL.exhaustionThreshold) {
      this.exhaustion -= SURVIVAL.exhaustionThreshold
      this.hunger = Math.max(0, this.hunger - 1)
    }
  }

  get canSprint(): boolean {
    return this.hunger > SURVIVAL.noSprintHunger
  }

  get canEat(): boolean {
    return this.hunger < SURVIVAL.maxHunger
  }

  get isDead(): boolean {
    return this.health <= 0
  }

  eat(value: number): void {
    this.hunger = clamp(this.hunger + value, 0, SURVIVAL.maxHunger)
  }

  damage(amount: number): number {
    const before = this.health
    this.health = clamp(this.health - amount, 0, SURVIVAL.maxHealth)
    return before - this.health
  }

  heal(amount: number): void {
    this.health = clamp(this.health + amount, 0, SURVIVAL.maxHealth)
  }

  /** Advances timers: passive exhaustion, regeneration and starvation. */
  tick(dt: number): StatsTickResult {
    const result: StatsTickResult = { starvationDamage: 0, healed: 0 }
    if (this.isDead) return result
    this.addExhaustion(SURVIVAL.exhaustion.perSecond * dt)

    if (this.hunger >= SURVIVAL.regenHunger && this.health < SURVIVAL.maxHealth) {
      this.regenTimer += dt
      if (this.regenTimer >= SURVIVAL.regenInterval) {
        this.regenTimer = 0
        this.heal(1)
        result.healed = 1
        this.addExhaustion(SURVIVAL.exhaustion.regenPerHp)
      }
    } else {
      this.regenTimer = 0
    }

    if (this.hunger <= 0) {
      this.starveTimer += dt
      if (this.starveTimer >= SURVIVAL.starveInterval) {
        this.starveTimer = 0
        result.starvationDamage = this.damage(SURVIVAL.starveDamage)
      }
    } else {
      this.starveTimer = 0
    }
    return result
  }

  reset(hunger: number = SURVIVAL.maxHunger): void {
    this.health = SURVIVAL.maxHealth
    this.hunger = hunger
    this.exhaustion = 0
    this.regenTimer = 0
    this.starveTimer = 0
  }
}
