import type { Vec3 } from '../core/math'
import { makeBody, type PhysicsBody } from '../physics/VoxelPhysics'

let nextId = 1

/** Base for anything simulated in the world besides the player. */
export abstract class Entity {
  readonly id = nextId++
  readonly body: PhysicsBody
  /** Facing angle around Y; 0 faces +Z. */
  yaw = 0
  alive = true
  /** Set when the entity should be removed from the world. */
  removed = false
  age = 0

  constructor(pos: Vec3, width: number, height: number) {
    this.body = makeBody(pos, width, height)
  }

  get pos(): Vec3 {
    return this.body.pos
  }

  aabbMin(): Vec3 {
    const b = this.body
    return { x: b.pos.x - b.halfWidth, y: b.pos.y, z: b.pos.z - b.halfWidth }
  }

  aabbMax(): Vec3 {
    const b = this.body
    return { x: b.pos.x + b.halfWidth, y: b.pos.y + b.height, z: b.pos.z + b.halfWidth }
  }
}
