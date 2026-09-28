import type { WorldMetadata, WorldSave } from './types'

const DB_NAME = 'voxelcraft'
const DB_VERSION = 1
const META = 'worlds'
const SAVES = 'saves'

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

/**
 * IndexedDB persistence. Metadata and save bodies live in separate
 * stores so the world list loads without reading every save.
 */
export class SaveManager {
  private dbp: Promise<IDBDatabase> | null = null

  constructor(private factory: IDBFactory = indexedDB) {}

  private db(): Promise<IDBDatabase> {
    if (!this.dbp) {
      this.dbp = new Promise((resolve, reject) => {
        const open = this.factory.open(DB_NAME, DB_VERSION)
        open.onupgradeneeded = () => {
          const db = open.result
          if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'id' })
          if (!db.objectStoreNames.contains(SAVES)) db.createObjectStore(SAVES)
        }
        open.onsuccess = () => resolve(open.result)
        open.onerror = () => reject(open.error)
        open.onblocked = () => reject(new Error('database blocked by another tab'))
      })
    }
    return this.dbp
  }

  async listWorlds(): Promise<WorldMetadata[]> {
    const db = await this.db()
    const all = await req(db.transaction(META).objectStore(META).getAll() as IDBRequest<WorldMetadata[]>)
    return all.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async save(data: WorldSave): Promise<void> {
    const db = await this.db()
    const tx = db.transaction([META, SAVES], 'readwrite')
    tx.objectStore(META).put(data.metadata)
    tx.objectStore(SAVES).put(data, data.metadata.id)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error ?? new Error('save aborted'))
    })
  }

  async load(id: string): Promise<WorldSave | null> {
    const db = await this.db()
    const r = await req(db.transaction(SAVES).objectStore(SAVES).get(id) as IDBRequest<WorldSave | undefined>)
    return r ?? null
  }

  async delete(id: string): Promise<void> {
    const db = await this.db()
    const tx = db.transaction([META, SAVES], 'readwrite')
    tx.objectStore(META).delete(id)
    tx.objectStore(SAVES).delete(id)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }
}
