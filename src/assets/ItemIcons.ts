import { ItemRegistry } from '../items/ItemRegistry'
import { BlockRegistry } from '../world/BlockRegistry'
import type { AtlasTile } from '../world/atlasLayout'
import { getTileCanvas } from './TerrainTextures'
import { PixelBuffer, ctx2d, hex, makeCanvas, shadeRGBA, type RGBA } from './PixelCanvas'
import { SeededRandom } from '../world/SeededRandom'

/**
 * Original item icons. Flat items (tools, food, materials) are described
 * as shapes in a rotated coordinate frame, rasterised to a 16×16 mask and
 * then auto-shaded (bevel) and auto-outlined — so every icon shares one
 * consistent pixel-art style. Block items are rendered as isometric cubes
 * from their terrain tiles.
 */

type Palette = RGBA[] // [light, mid, dark]
type Shape = (along: number, perp: number, x: number, y: number) => string | null

const WOOD: Palette = ['#c89a5c', '#a57a45', '#7d5a31'].map((c) => hex(c))
const HANDLE: Palette = ['#9a6c3c', '#7c532c', '#5a3a1e'].map((c) => hex(c))
const STONE: Palette = ['#a4a6aa', '#86888c', '#606266'].map((c) => hex(c))
const PORK: Palette = ['#f2a6a6', '#e0878b', '#bf6570'].map((c) => hex(c))
const FAT: Palette = ['#fbe6dc', '#f1cfc4', '#dcb1a6'].map((c) => hex(c))
const BEEF: Palette = ['#c8463f', '#a8342f', '#7f2522'].map((c) => hex(c))
const MARBLE: Palette = ['#f3d7d0', '#e5bdb4', '#cf9f96'].map((c) => hex(c))
const LEATHER: Palette = ['#a7693c', '#8a542e', '#6a3e20'].map((c) => hex(c))

const SQ2 = Math.SQRT1_2

/** Rasterise a shape expressed in (along, perp) coords rotated 45° around an anchor. */
function raster(shape: Shape, ax: number, ay: number): (string | null)[][] {
  const g: (string | null)[][] = []
  for (let y = 0; y < 16; y++) {
    g.push([])
    for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - ax, dy = y + 0.5 - ay
      // along: toward top-right; perp: toward top-left.
      const along = (dx - dy) * SQ2
      const perp = (-dx - dy) * SQ2
      g[y].push(x === 0 || y === 0 || x === 15 || y === 15 ? null : shape(along, perp, x, y))
    }
  }
  return g
}

const handle = (len: number, start = -9) => (a: number, p: number) => (a >= start && a <= len && Math.abs(p) <= 0.8 ? 'h' : null)

function toolShape(type: string): { shape: Shape; ax: number; ay: number } {
  const ax = 8, ay = 8
  switch (type) {
    case 'pickaxe':
      return {
        ax, ay,
        shape: (a, p, x, y) => {
          // Crescent head centred on the handle top.
          const cx = 3, cy = 13
          const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
          const ang = Math.atan2(cy - (y + 0.5), x + 0.5 - cx)
          const mid = Math.PI / 4
          const span = Math.abs(ang - mid)
          const thick = 1.9 - span * 0.9
          if (span < 0.95 && r > 10.4 - thick && r < 10.6 + 0.2) return 'a'
          return handle(5.2)(a, p)
        },
      }
    case 'axe':
      return {
        ax, ay,
        shape: (a, p) => {
          if (a > 0.4 && a < 6.4 && p > 0.6 && p < 5.4 - Math.pow(a - 3.4, 2) * 0.28) return 'a'
          if (a > 2.4 && a < 4.6 && p <= 0.6 && p > -1.8) return 'a'
          return handle(6)(a, p)
        },
      }
    case 'shovel':
      return {
        ax, ay,
        shape: (a, p) => {
          if (a > 1.8 && a < 7.2 && Math.abs(p) < 2.1 - Math.max(0, a - 5.6) * 0.9) return 'a'
          return handle(2.2)(a, p)
        },
      }
    default: // sword
      return {
        ax: 6, ay: 10,
        shape: (a, p) => {
          if (a > 0.9 && a < 11.3 && Math.abs(p) < 1.25 - Math.max(0, a - 9.8) * 0.8) return 'a'
          if (a > -0.2 && a <= 0.9 && Math.abs(p) < 3.3) return 'h'
          if (a > -4.4 && a <= -0.2 && Math.abs(p) < 0.8) return 'h'
          if (a > -5.4 && a <= -4.4 && Math.abs(p) < 1.3) return 'h'
          return null
        },
      }
  }
}

/** Bevel shading + dark outline from a material mask. */
function paintMask(mask: (string | null)[][], palettes: Record<string, Palette>, seed: number): PixelBuffer {
  const px = new PixelBuffer(16, 16)
  const rng = new SeededRandom(seed)
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < 16 && y < 16 && mask[y][x] !== null
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const m = mask[y][x]
      if (!m) continue
      const pal = palettes[m]
      let c = pal[1]
      if (!filled(x - 1, y) || !filled(x, y - 1)) c = pal[0]
      else if (!filled(x + 1, y) || !filled(x, y + 1)) c = pal[2]
      else if (rng.next() < 0.18) c = rng.next() < 0.5 ? pal[0] : pal[2]
      px.set(x, y, c)
    }
  }
  // Outline: empty pixels touching the shape get a darkened neighbour colour.
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (filled(x, y)) continue
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (filled(x + dx, y + dy)) {
          px.set(x, y, shadeRGBA(palettes[mask[y + dy][x + dx]!][2], 0.45))
          break
        }
      }
    }
  }
  return px
}

function meatMask(stripe: 'fat' | 'marble'): (string | null)[][] {
  return raster((a, p, x, y) => {
    const e = (a * a) / 36 + (p * p) / 12
    if (e > 1) return null
    if (stripe === 'fat' && p > 1.6) return 'f'
    if (stripe === 'marble' && Math.abs(p - Math.sin(a * 0.9) * 1.2) < 0.45 && (x + y) % 3 !== 0) return 'f'
    return 'm'
  }, 8, 8)
}

function flatIcon(itemId: string): PixelBuffer | null {
  const item = ItemRegistry.get(itemId)
  const seed = [...itemId].reduce((h, ch) => (h * 33 + ch.charCodeAt(0)) >>> 0, 5)
  if (item.tool) {
    const { shape, ax, ay } = toolShape(item.tool.toolType)
    const head = item.tool.tier === 'stone' ? STONE : WOOD
    return paintMask(raster(shape, ax, ay), { a: head, h: HANDLE }, seed)
  }
  switch (itemId) {
    case 'stick':
      return paintMask(raster(handle(7, -7), 8, 8), { h: HANDLE }, seed)
    case 'raw_pork':
      return paintMask(meatMask('fat'), { m: PORK, f: FAT }, seed)
    case 'raw_beef':
      return paintMask(meatMask('marble'), { m: BEEF, f: MARBLE }, seed)
    case 'leather':
      return paintMask(
        raster((_a, _p, x, y) => {
          const cx = x - 7.5, cy = y - 7.5
          const r = Math.max(Math.abs(cx) * 0.95, Math.abs(cy) * 1.1) + Math.sin(Math.atan2(cy, cx) * 5) * 0.8
          return r < 6 ? 'l' : null
        }, 8, 8),
        { l: LEATHER },
        seed,
      )
  }
  return null
}

function darkenTile(tile: HTMLCanvasElement, f: number): HTMLCanvasElement {
  const c = makeCanvas(tile.width, tile.height)
  const ctx = ctx2d(c)
  ctx.drawImage(tile, 0, 0)
  const img = ctx.getImageData(0, 0, c.width, c.height)
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] *= f
    img.data[i + 1] *= f
    img.data[i + 2] *= f
  }
  ctx.putImageData(img, 0, 0)
  return c
}

/** Isometric cube icon (64×64) built from a block's top and side tiles. */
function blockIcon(blockId: number): HTMLCanvasElement {
  const def = BlockRegistry.get(blockId)
  const t = def.textures
  const top = getTileCanvas((t.top ?? t.all) as AtlasTile)
  const side = getTileCanvas((t.side ?? t.all) as AtlasTile)
  const c = makeCanvas(64, 64)
  const ctx = ctx2d(c)
  const k = 2
  ctx.setTransform(0.875 * k, -0.4375 * k, 0.875 * k, 0.4375 * k, 2 * k, 8 * k)
  ctx.drawImage(top, 0, 0)
  ctx.setTransform(0.875 * k, 0.4375 * k, 0, 1 * k, 2 * k, 8 * k)
  ctx.drawImage(darkenTile(side, 0.78), 0, 0)
  ctx.setTransform(0.875 * k, -0.4375 * k, 0, 1 * k, 16 * k, 15 * k)
  ctx.drawImage(darkenTile(side, 0.6), 0, 0)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  return c
}

const iconCache = new Map<string, HTMLCanvasElement>()
const flatCache = new Map<string, PixelBuffer | null>()
const urlCache = new Map<string, string>()

/** 16×16 flat pixel icon (null for block items). Used for 3D extruded item models. */
export function getFlatIcon(itemId: string): PixelBuffer | null {
  if (!flatCache.has(itemId)) flatCache.set(itemId, flatIcon(itemId))
  return flatCache.get(itemId)!
}

export function getItemIcon(itemId: string): HTMLCanvasElement {
  let c = iconCache.get(itemId)
  if (c) return c
  const item = ItemRegistry.get(itemId)
  if (item.blockId !== undefined) c = blockIcon(item.blockId)
  else {
    const flat = getFlatIcon(itemId)
    c = makeCanvas(64, 64)
    if (flat) {
      const ctx = ctx2d(c)
      ctx.drawImage(flat.toCanvas(), 0, 0, 64, 64)
    }
  }
  iconCache.set(itemId, c)
  return c
}

export function getItemIconURL(itemId: string): string {
  let u = urlCache.get(itemId)
  if (!u) {
    u = getItemIcon(itemId).toDataURL()
    urlCache.set(itemId, u)
  }
  return u
}

/** Pre-builds every icon (called during the boot loading screen). */
export function preloadIcons(): void {
  for (const item of ItemRegistry.all()) getItemIconURL(item.id)
}
