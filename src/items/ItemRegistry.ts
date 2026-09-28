import { ITEMS } from '../config/items'
import type { ItemDefinition } from './ToolDefinition'
import { assert } from '../core/assert'

class ItemRegistryImpl {
  private byId = new Map<string, ItemDefinition>()
  private byBlock = new Map<number, ItemDefinition>()

  constructor(items: ItemDefinition[]) {
    for (const item of items) {
      assert(!this.byId.has(item.id), `duplicate item id ${item.id}`)
      assert(item.maxStack >= 1, `item ${item.id} maxStack must be >= 1`)
      this.byId.set(item.id, item)
      if (item.blockId !== undefined) this.byBlock.set(item.blockId, item)
    }
  }

  get(id: string): ItemDefinition {
    const def = this.byId.get(id)
    assert(def, `unknown item id ${id}`)
    return def
  }

  has(id: string): boolean {
    return this.byId.has(id)
  }

  all(): ItemDefinition[] {
    return [...this.byId.values()]
  }

  forBlock(blockId: number): ItemDefinition | undefined {
    return this.byBlock.get(blockId)
  }
}

export const ItemRegistry = new ItemRegistryImpl(ITEMS)
