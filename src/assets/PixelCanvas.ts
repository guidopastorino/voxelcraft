import { SeededRandom } from '../world/SeededRandom'

/** Small helpers for painting pixel art on canvases. */

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

export function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = false
  return ctx
}

export type RGBA = [number, number, number, number]

export function hex(h: string, a = 255): RGBA {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a]
}

export function shadeRGBA(c: RGBA, f: number): RGBA {
  return [Math.min(255, c[0] * f) | 0, Math.min(255, c[1] * f) | 0, Math.min(255, c[2] * f) | 0, c[3]]
}

/** A width×height RGBA buffer with pixel helpers; blit onto a canvas at the end. */
export class PixelBuffer {
  readonly data: Uint8ClampedArray
  constructor(readonly w: number, readonly h: number) {
    this.data = new Uint8ClampedArray(w * h * 4)
  }
  set(x: number, y: number, c: RGBA): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const i = (y * this.w + x) * 4
    this.data[i] = c[0]
    this.data[i + 1] = c[1]
    this.data[i + 2] = c[2]
    this.data[i + 3] = c[3]
  }
  get(x: number, y: number): RGBA {
    const i = (y * this.w + x) * 4
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]]
  }
  alpha(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0
    return this.data[(y * this.w + x) * 4 + 3]
  }
  fill(fn: (x: number, y: number) => RGBA | null): void {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = fn(x, y)
        if (c) this.set(x, y, c)
      }
  }
  drawTo(ctx: CanvasRenderingContext2D, dx: number, dy: number): void {
    ctx.putImageData(new ImageData(this.data as unknown as Uint8ClampedArray<ArrayBuffer>, this.w, this.h), dx, dy)
  }
  toCanvas(): HTMLCanvasElement {
    const c = makeCanvas(this.w, this.h)
    this.drawTo(ctx2d(c), 0, 0)
    return c
  }
}

/** Tileable value noise on a small grid, for blotchy pixel textures. */
export function valueNoise(rng: SeededRandom, size: number, cell: number): (x: number, y: number) => number {
  const n = Math.ceil(size / cell)
  const grid: number[] = []
  for (let i = 0; i < n * n; i++) grid.push(rng.next())
  const at = (gx: number, gy: number) => grid[((gy % n) + n) % n * n + (((gx % n) + n) % n)]
  return (x, y) => {
    const fx = x / cell, fy = y / cell
    const x0 = Math.floor(fx), y0 = Math.floor(fy)
    const tx = fx - x0, ty = fy - y0
    const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1)
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty
  }
}

export const pick = <T>(arr: readonly T[], t: number): T => arr[Math.max(0, Math.min(arr.length - 1, Math.floor(t * arr.length)))]
