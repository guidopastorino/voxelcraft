import { describe, expect, it } from 'vitest'
import { makeBody, stepBody, type CollisionWorld } from '../src/physics/VoxelPhysics'
import { raycastVoxels } from '../src/world/Raycast'

/** Flat floor at y < 10 plus optional extra solid cells. */
function flatWorld(extra: [number, number, number][] = []): CollisionWorld {
  const set = new Set(extra.map((c) => c.join(',')))
  return {
    isSolid: (x, y, z) => y < 10 || set.has(`${x},${y},${z}`),
    isLiquid: () => false,
  }
}

describe('voxel physics', () => {
  it('falls and lands on the floor', () => {
    const w = flatWorld()
    const b = makeBody({ x: 0.5, y: 20, z: 0.5 }, 0.6, 1.8)
    for (let i = 0; i < 200; i++) {
      b.vel.y -= 22 / 60
      stepBody(w, b, 1 / 60)
    }
    expect(b.pos.y).toBeCloseTo(10, 2)
    expect(b.onGround).toBe(true)
  })

  it('does not tunnel through the floor at terminal velocity', () => {
    const w = flatWorld()
    const b = makeBody({ x: 0.5, y: 12, z: 0.5 }, 0.6, 1.8)
    b.vel.y = -200
    stepBody(w, b, 1 / 60)
    expect(b.pos.y).toBeGreaterThanOrEqual(10)
  })

  it('is blocked by walls', () => {
    const w = flatWorld([[2, 10, 0], [2, 11, 0]])
    const b = makeBody({ x: 0.5, y: 10, z: 0.5 }, 0.6, 1.8)
    for (let i = 0; i < 60; i++) {
      b.vel.x = 5
      stepBody(w, b, 1 / 60)
    }
    expect(b.pos.x).toBeLessThan(2 - 0.3 + 1e-3)
    expect(b.hitWall).toBe(true)
  })
})

describe('voxel raycast', () => {
  const get = (x: number, y: number, z: number) => (x === 3 && y === 0 && z === 0 ? 1 : 0)

  it('hits the first solid block and reports the entered face', () => {
    const hit = raycastVoxels(get, { x: 0.5, y: 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, 5, (id) => id !== 0)
    expect(hit).toMatchObject({ x: 3, y: 0, z: 0, nx: -1, ny: 0, nz: 0 })
    expect(hit!.distance).toBeCloseTo(2.5)
  })

  it('respects max distance', () => {
    expect(raycastVoxels(get, { x: 0.5, y: 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, 2, (id) => id !== 0)).toBeNull()
  })

  it('works with negative directions', () => {
    const g = (x: number, y: number, z: number) => (x === -4 && y === 0 && z === -1 ? 1 : 0)
    const hit = raycastVoxels(g, { x: -0.5, y: 0.5, z: -0.5 }, { x: -1, y: 0, z: 0 }, 6, (id) => id !== 0)
    expect(hit).toMatchObject({ x: -4, nx: 1 })
  })
})

describe('voxel physics — overlap recovery', () => {
  it('does not snap a body that starts inside a wall to the top of it', () => {
    // Floor below y=10 and a 6-high wall at x=1 overlapping the body.
    const wall = new Set<string>()
    for (let y = 10; y < 16; y++) wall.add(`1,${y},0`)
    const w: CollisionWorld = { isSolid: (x, y, z) => y < 10 || wall.has(`${x},${y},${z}`), isLiquid: () => false }
    const b = makeBody({ x: 0.8, y: 10.5, z: 0.5 }, 0.6, 1.8)
    for (let i = 0; i < 60; i++) {
      b.vel.y -= 22 / 60
      stepBody(w, b, 1 / 60)
    }
    expect(b.pos.y).toBeCloseTo(10, 2)
    // …and can walk back out of the wall.
    for (let i = 0; i < 30; i++) {
      b.vel.x = -3
      stepBody(w, b, 1 / 60)
    }
    expect(b.pos.x).toBeLessThan(0.7)
  })

  it('stops when jumping into a ceiling', () => {
    const w: CollisionWorld = { isSolid: (_x, y) => y < 10 || y === 12, isLiquid: () => false }
    const b = makeBody({ x: 0.5, y: 10, z: 0.5 }, 0.6, 1.8)
    b.vel.y = 8
    stepBody(w, b, 1 / 60)
    for (let i = 0; i < 10; i++) stepBody(w, b, 1 / 60)
    expect(b.pos.y + b.height).toBeLessThanOrEqual(12)
  })
})
