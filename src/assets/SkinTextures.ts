import type { ModelPart } from '../config/animals'
import { SeededRandom } from '../world/SeededRandom'
import { PixelBuffer, hex, pick, shadeRGBA, valueNoise, type RGBA } from './PixelCanvas'

/**
 * Paints per-face textures for box-model parts (animals, player). Face
 * order matches THREE.BoxGeometry: +X, -X, +Y, -Y, +Z (front), -Z.
 */
export function paintPartFaces(part: ModelPart, seedBase: number): HTMLCanvasElement[] {
  const [w, h, d] = part.size.map((v) => Math.max(1, Math.round(v)))
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]]
  const seed = [...part.name].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, seedBase)
  const colors = part.skin.colors.map((c) => hex(c))
  return dims.map(([fw, fh], face) => {
    const px = new PixelBuffer(fw, fh)
    const rng = new SeededRandom(seed + face * 7919)
    paintFace(px, part.skin.pattern, colors, face, rng)
    return px.toCanvas()
  })
}

function speckle(px: PixelBuffer, colors: RGBA[], rng: SeededRandom): void {
  px.fill(() => pick(colors, rng.next()))
}

function patches(px: PixelBuffer, colors: RGBA[], rng: SeededRandom): void {
  // First half of palette = dark coat, second half = white patches.
  const half = Math.floor(colors.length / 2)
  const dark = colors.slice(0, half), light = colors.slice(half)
  const n = valueNoise(rng, Math.max(px.w, px.h), 4)
  px.fill((x, y) => (n(x, y) > 0.58 ? pick(light, rng.next()) : pick(dark, rng.next())))
}

function eyes(px: PixelBuffer, y: number): void {
  const white = hex('#f4f4f4'), pupil = hex('#1b1b1b')
  const lx = 1, rx = px.w - 3
  px.set(lx, y, white)
  px.set(lx + 1, y, pupil)
  px.set(rx, y, pupil)
  px.set(rx + 1, y, white)
}

function paintFace(px: PixelBuffer, pattern: ModelPart['skin']['pattern'], colors: RGBA[], face: number, rng: SeededRandom): void {
  const front = face === 4
  switch (pattern) {
    case 'speckle':
      speckle(px, colors, rng)
      break
    case 'patches':
      patches(px, colors, rng)
      break
    case 'pig_face':
      speckle(px, colors, rng)
      if (front) eyes(px, Math.floor(px.h * 0.4))
      break
    case 'cow_face':
      patches(px, colors, rng)
      if (front) {
        // Keep the face readable: light blaze down the middle.
        const light = colors[colors.length - 1]
        for (let y = 0; y < px.h; y++) for (let x = Math.floor(px.w / 2) - 1; x <= Math.floor(px.w / 2); x++) px.set(x, y, light)
        eyes(px, Math.floor(px.h * 0.35))
      }
      break
    case 'snout':
      px.fill(() => shadeRGBA(colors[0], 0.92 + rng.next() * 0.12))
      if (front) {
        px.set(Math.max(0, Math.floor(px.w / 2) - 2), Math.floor(px.h / 2), colors[1])
        px.set(Math.min(px.w - 1, Math.floor(px.w / 2) + 1), Math.floor(px.h / 2), colors[1])
      }
      break
    case 'hoof_leg': {
      const hoof = colors[colors.length - 1]
      const coat = colors.slice(0, -1)
      if (face === 3) px.fill(() => hoof)
      else if (face === 2) px.fill(() => pick(coat, rng.next()))
      else px.fill((_x, y) => (y >= px.h - 2 ? hoof : pick(coat, rng.next())))
      break
    }
    case 'horn':
      px.fill((_x, y) => (y === 0 ? colors[0] : colors[1]))
      break
  }
}
