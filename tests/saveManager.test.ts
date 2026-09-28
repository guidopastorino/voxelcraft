import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { SaveManager } from '../src/save/SaveManager'
import { serializeSession, restoreSession } from '../src/save/WorldSerializer'
import { makeSession } from './helpers'
import { B } from '../src/world/BlockRegistry'

describe('IndexedDB save manager', () => {
  it('saves, lists, loads and deletes worlds', async () => {
    const sm = new SaveManager()
    const s = makeSession(321)
    const p = s.player.pos
    s.world.setBlock(Math.floor(p.x) + 3, Math.floor(p.y), Math.floor(p.z), B.CRAFTING_TABLE)
    const data = serializeSession(s)
    await sm.save(data)
    const list = await sm.listWorlds()
    expect(list.map((w) => w.id)).toContain(data.metadata.id)

    const loaded = await sm.load(data.metadata.id)
    expect(loaded).not.toBeNull()
    const r = restoreSession(loaded!)
    r.loadAround(1)
    expect(r.world.getBlock(Math.floor(p.x) + 3, Math.floor(p.y), Math.floor(p.z))).toBe(B.CRAFTING_TABLE)

    await sm.delete(data.metadata.id)
    expect((await sm.listWorlds()).map((w) => w.id)).not.toContain(data.metadata.id)
    expect(await sm.load(data.metadata.id)).toBeNull()
  })

  it('overwrites the same world on repeated saves', async () => {
    const sm = new SaveManager()
    const s = makeSession(654)
    await sm.save(serializeSession(s))
    s.player.stats.hunger = 5
    await sm.save(serializeSession(s))
    const worlds = (await sm.listWorlds()).filter((w) => w.id === s.metadata.id)
    expect(worlds.length).toBe(1)
    expect((await sm.load(s.metadata.id))!.player.hunger).toBe(5)
  })
})
