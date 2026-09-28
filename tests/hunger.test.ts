import { describe, expect, it } from 'vitest'
import { PlayerStats } from '../src/player/PlayerStats'
import { SURVIVAL } from '../src/config/defaults'

describe('hunger & health', () => {
  it('exhaustion lowers hunger at the threshold', () => {
    const s = new PlayerStats()
    s.addExhaustion(SURVIVAL.exhaustionThreshold * 0.99)
    expect(s.hunger).toBe(20)
    s.addExhaustion(SURVIVAL.exhaustionThreshold * 0.02)
    expect(s.hunger).toBe(19)
  })

  it('sprinting is disabled at low hunger', () => {
    const s = new PlayerStats()
    s.hunger = 7
    expect(s.canSprint).toBe(true)
    s.hunger = 6
    expect(s.canSprint).toBe(false)
  })

  it('starvation damages periodically', () => {
    const s = new PlayerStats()
    s.hunger = 0
    let dmg = 0
    for (let i = 0; i < 60 * 9; i++) dmg += s.tick(1 / 60).starvationDamage
    expect(dmg).toBe(2)
    expect(s.health).toBe(18)
  })

  it('regenerates when well fed', () => {
    const s = new PlayerStats()
    s.health = 10
    for (let i = 0; i < 60 * 9; i++) s.tick(1 / 60)
    expect(s.health).toBe(12)
  })

  it('eating restores hunger and is blocked when full', () => {
    const s = new PlayerStats()
    expect(s.canEat).toBe(false)
    s.hunger = 15
    s.eat(3)
    expect(s.hunger).toBe(18)
    s.eat(10)
    expect(s.hunger).toBe(20)
  })

  it('damage never goes below zero', () => {
    const s = new PlayerStats()
    s.damage(50)
    expect(s.health).toBe(0)
    expect(s.isDead).toBe(true)
  })
})
