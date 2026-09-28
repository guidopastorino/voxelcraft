import type { Vec3 } from '../core/math'
import { rayAabb } from '../world/Raycast'
import type { Entity } from '../entities/Entity'

export interface EntityHit<T extends Entity> {
  entity: T
  distance: number
}

/** Nearest living entity hit by a ray within `range`, using slightly inflated AABBs for forgiving aim. */
export function raycastEntities<T extends Entity>(
  origin: Vec3,
  dir: Vec3,
  entities: Iterable<T>,
  range: number,
  inflate = 0.1,
): EntityHit<T> | null {
  let best: EntityHit<T> | null = null
  for (const e of entities) {
    if (!e.alive || e.removed) continue
    const min = e.aabbMin(), max = e.aabbMax()
    min.x -= inflate; min.y -= inflate; min.z -= inflate
    max.x += inflate; max.y += inflate; max.z += inflate
    const d = rayAabb(origin, dir, min, max, range)
    if (d !== null && (!best || d < best.distance)) best = { entity: e, distance: d }
  }
  return best
}
