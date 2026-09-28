import { HOTBAR_SIZE, type Inventory, type Slot } from './Inventory'

/** Selection state over the first 9 inventory slots. */
export class Hotbar {
  selected = 0

  constructor(private inventory: Inventory) {}

  select(i: number): void {
    this.selected = ((i % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE
  }

  /** Mouse wheel: positive delta moves right, wrapping around. */
  scroll(delta: number): void {
    this.select(this.selected + Math.sign(delta))
  }

  get stack(): Slot {
    return this.inventory.get(this.selected)
  }
}
