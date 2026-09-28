export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Vec2 {
  x: number
  y: number
}

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z })

export const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v)

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const smoothstep = (t: number): number => t * t * (3 - 2 * t)

export const dist3 = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

export const DEG = Math.PI / 180

/** Forward direction for a yaw/pitch pair. Yaw 0 looks toward -Z (Three.js convention). */
export function directionFromAngles(yaw: number, pitch: number): Vec3 {
  const cp = Math.cos(pitch)
  return { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp }
}
