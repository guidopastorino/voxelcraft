import { describe, expect, it } from 'vitest'
import { StateMachine } from '../src/app/StateMachine'
import { findConflicts } from '../src/ui/SettingsUI'
import { DEFAULT_KEYBINDINGS } from '../src/config/defaults'
import { buildChunkMesh, buildPaddedBlocks, PADDED_VOLUME } from '../src/world/TerrainMesher'
import { buildFaceTileTable } from '../src/world/atlasLayout'
import { CHUNK_VOLUME } from '../src/world/constants'
import { blockIndex } from '../src/world/coords'
import { B } from '../src/world/BlockRegistry'
import { EntityManager } from '../src/entities/EntityManager'
import { Animal } from '../src/entities/Animal'
import { makeSession, tick } from './helpers'
import { restoreSession, serializeSession } from '../src/save/WorldSerializer'
import { damageAnimal } from '../src/combat/DamageSystem'

describe('state machine', () => {
  it('allows the normal game flow and rejects illegal jumps', () => {
    const fsm = new StateMachine()
    const seen: string[] = []
    fsm.onChange((to) => seen.push(to))
    for (const s of ['MAIN_MENU', 'WORLD_SELECT', 'WORLD_CREATE', 'LOADING_WORLD', 'PLAYING', 'INVENTORY', 'PLAYING', 'PAUSED', 'SETTINGS', 'PAUSED', 'PLAYING', 'DEAD', 'PLAYING'] as const) fsm.go(s)
    expect(seen.length).toBe(13)
    expect(() => fsm.go('WORLD_CREATE')).toThrow()
    expect(fsm.simulating).toBe(true)
    fsm.go('PAUSED')
    expect(fsm.simulating).toBe(false)
  })
})

describe('key binding conflicts', () => {
  it('flags actions sharing a key', () => {
    expect(findConflicts(DEFAULT_KEYBINDINGS).size).toBe(0)
    const c = findConflicts({ ...DEFAULT_KEYBINDINGS, forward: 'KeyS' })
    expect([...c].sort()).toEqual(['backward', 'forward'])
  })
})

describe('terrain mesher', () => {
  const tiles = buildFaceTileTable()
  const single = (id: number) => {
    const blocks = new Uint16Array(CHUNK_VOLUME)
    blocks[blockIndex(5, 40, 5)] = id
    return blocks
  }

  it('emits 6 faces for an isolated block', () => {
    const m = buildChunkMesh(buildPaddedBlocks(single(B.STONE), () => undefined), tiles)
    expect(m.opaque.indices.length / 6).toBe(6)
    expect(m.water.indices.length).toBe(0)
  })

  it('culls the shared face between two solid blocks', () => {
    const blocks = single(B.STONE)
    blocks[blockIndex(6, 40, 5)] = B.STONE
    const m = buildChunkMesh(buildPaddedBlocks(blocks, () => undefined), tiles)
    expect(m.opaque.indices.length / 6).toBe(10)
  })

  it('culls faces against neighbour chunks via the padded border', () => {
    const center = single(B.AIR)
    center[blockIndex(15, 40, 5)] = B.STONE
    const east = new Uint16Array(CHUNK_VOLUME)
    east[blockIndex(0, 40, 5)] = B.STONE
    const m = buildChunkMesh(buildPaddedBlocks(center, (dx, dz) => (dx === 1 && dz === 0 ? east : undefined)), tiles)
    expect(m.opaque.indices.length / 6).toBe(5)
  })

  it('puts water in its own mesh and hides water-water faces', () => {
    const blocks = single(B.WATER)
    blocks[blockIndex(6, 40, 5)] = B.WATER
    const m = buildChunkMesh(buildPaddedBlocks(blocks, () => undefined), tiles)
    expect(m.opaque.indices.length).toBe(0)
    expect(m.water.indices.length / 6).toBe(10)
  })

  it('padded array has the expected size', () => {
    expect(buildPaddedBlocks(new Uint16Array(CHUNK_VOLUME), () => undefined).length).toBe(PADDED_VOLUME)
  })
})

describe('animals', () => {
  it('flee and take knockback when hit, die at 0 HP', () => {
    const a = new Animal('pig', { x: 0, y: 40, z: 0 })
    const died1 = damageAnimal(a, 4, { x: -2, y: 40, z: 0 }, () => 0.5)
    expect(died1).toBe(false)
    expect(a.state).toBe('flee')
    expect(a.body.vel.x).toBeGreaterThan(0)
    a.hurtTimer = 0
    expect(damageAnimal(a, 20, { x: -2, y: 40, z: 0 }, () => 0.5)).toBe(true)
    expect(a.alive).toBe(false)
  })

  it('go dormant when their chunk unloads and come back when it reloads', () => {
    const em = new EntityManager(1)
    const a = new Animal('cow', { x: 5.5, y: 40, z: 5.5 })
    em.animals.push(a)
    em.onChunkUnloaded(0, 0)
    expect(em.animals.length).toBe(0)
    expect(em.serializeAll().length).toBe(1)
    const fake = { getBlock: () => 0, isSolid: () => false, isLiquid: () => false, surfaceY: () => 0, isLoadedAt: () => true }
    em.onChunkLoaded(0, 0, fake, null, false)
    expect(em.animals.length).toBe(1)
    expect(em.animals[0].kind).toBe('cow')
  })

  it('spawn on grass, walk around without leaving the world, and persist through saves', () => {
    const s = makeSession(2024)
    expect(s.entities.animals.length).toBeGreaterThan(0)
    const start = s.entities.animals.map((a) => ({ ...a.pos }))
    tick(s, 20)
    const moved = s.entities.animals.filter((a, i) => start[i] && Math.hypot(a.pos.x - start[i].x, a.pos.z - start[i].z) > 0.5)
    expect(moved.length).toBeGreaterThan(0)
    for (const a of s.entities.animals) expect(s.world.isSolid(Math.floor(a.pos.x), Math.floor(a.pos.y + 0.1), Math.floor(a.pos.z))).toBe(false)
    const r = restoreSession(JSON.parse(JSON.stringify(serializeSession(s))))
    r.loadAround(3)
    expect(r.entities.animals.length).toBe(s.entities.animals.length)
  })
})
