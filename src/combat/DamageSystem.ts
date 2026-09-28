import type { Animal } from '../entities/Animal'
import type { Vec3 } from '../core/math'
import { startFlee } from '../entities/AnimalAI'

export const KNOCKBACK_FORCE = 5.5
export const KNOCKBACK_LIFT = 4.5
const HURT_FLASH = 0.45

/**
 * Applies damage to an animal: health, hurt flash, knockback away from
 * the attacker and a switch to the flee state. Returns true if it died.
 */
export function damageAnimal(animal: Animal, amount: number, from: Vec3, rng: () => number): boolean {
  if (animal.deathTimer >= 0 || animal.hurtTimer > 0.3) return false
  animal.health -= amount
  animal.hurtTimer = HURT_FLASH
  const dx = animal.pos.x - from.x
  const dz = animal.pos.z - from.z
  const len = Math.hypot(dx, dz) || 1
  animal.body.vel.x = (dx / len) * KNOCKBACK_FORCE
  animal.body.vel.z = (dz / len) * KNOCKBACK_FORCE
  animal.body.vel.y = KNOCKBACK_LIFT
  if (animal.health <= 0) {
    animal.health = 0
    animal.deathTimer = 0
    animal.alive = false
    return true
  }
  startFlee(animal, from, rng)
  return false
}
