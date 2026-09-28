import type { Vec3 } from '../core/math'

export interface RayHit {
  /** Hit block coordinates. */
  x: number
  y: number
  z: number
  /** Normal of the face that was entered (points back toward the ray origin). */
  nx: number
  ny: number
  nz: number
  distance: number
  blockId: number
}

/**
 * Voxel traversal (Amanatides & Woo DDA). Visits every cell the ray passes
 * through in order, so it never skips thin corners the way fixed-step
 * marching can.
 */
export function raycastVoxels(
  getBlock: (x: number, y: number, z: number) => number,
  origin: Vec3,
  dir: Vec3,
  maxDist: number,
  hits: (blockId: number) => boolean,
): RayHit | null {
  const len = Math.hypot(dir.x, dir.y, dir.z)
  if (len === 0) return null
  const dx = dir.x / len, dy = dir.y / len, dz = dir.z / len

  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z)
  const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1
  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity
  const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity
  const frac = (v: number, s: number) => (s > 0 ? Math.floor(v) + 1 - v : v - Math.floor(v))
  let tMaxX = dx !== 0 ? frac(origin.x, stepX) * tDeltaX : Infinity
  let tMaxY = dy !== 0 ? frac(origin.y, stepY) * tDeltaY : Infinity
  let tMaxZ = dz !== 0 ? frac(origin.z, stepZ) * tDeltaZ : Infinity

  let nx = 0, ny = 0, nz = 0
  let t = 0
  // The origin cell counts too (e.g. camera inside a leaf block).
  for (let i = 0; i < 256 && t <= maxDist; i++) {
    const id = getBlock(x, y, z)
    if (hits(id)) return { x, y, z, nx, ny, nz, distance: t, blockId: id }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX
      t = tMaxX
      tMaxX += tDeltaX
      nx = -stepX; ny = 0; nz = 0
    } else if (tMaxY < tMaxZ) {
      y += stepY
      t = tMaxY
      tMaxY += tDeltaY
      nx = 0; ny = -stepY; nz = 0
    } else {
      z += stepZ
      t = tMaxZ
      tMaxZ += tDeltaZ
      nx = 0; ny = 0; nz = -stepZ
    }
  }
  return null
}

/** Slab test: distance along a normalized ray to an AABB, or null if missed / beyond maxDist. */
export function rayAabb(
  origin: Vec3,
  dir: Vec3,
  min: Vec3,
  max: Vec3,
  maxDist: number,
): number | null {
  let tmin = 0
  let tmax = maxDist
  for (const a of ['x', 'y', 'z'] as const) {
    const d = dir[a]
    if (Math.abs(d) < 1e-9) {
      if (origin[a] < min[a] || origin[a] > max[a]) return null
      continue
    }
    let t1 = (min[a] - origin[a]) / d
    let t2 = (max[a] - origin[a]) / d
    if (t1 > t2) [t1, t2] = [t2, t1]
    tmin = Math.max(tmin, t1)
    tmax = Math.min(tmax, t2)
    if (tmin > tmax) return null
  }
  return tmin
}
