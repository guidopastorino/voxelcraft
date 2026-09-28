import { SeededRandom } from '../world/SeededRandom'
import { ATLAS_COLS, ATLAS_ROWS, ATLAS_TILES, TILE_PX, type AtlasTile } from '../world/atlasLayout'
import { PixelBuffer, ctx2d, hex, makeCanvas, pick, shadeRGBA, valueNoise, type RGBA } from './PixelCanvas'

/**
 * Original procedural pixel-art for every terrain tile. Each tile is
 * painted from a fixed seed so the look is stable between sessions.
 */
const S = TILE_PX

const GRASS = ['#3f7a2b', '#4a8a30', '#579b37', '#63a93f', '#71b646'].map((c) => hex(c))
const DIRT = ['#6b4a2f', '#7a5536', '#86603d', '#93704a', '#5e4029'].map((c) => hex(c))
const STONE = ['#6d6f73', '#7b7d81', '#86888c', '#93959a', '#5f6165'].map((c) => hex(c))
const SAND = ['#d6c48c', '#dfcd96', '#e7d7a2', '#cdb97f', '#efe0b0'].map((c) => hex(c))
const BARK = ['#4b3521', '#5a4029', '#664a30', '#3d2b1a'].map((c) => hex(c))
const RINGS = ['#b08b58', '#9c7847', '#c29c67', '#8a6a3e'].map((c) => hex(c))
const LEAF = ['#2f6b25', '#377a2b', '#3f8830', '#285d20', '#4a9536'].map((c) => hex(c))
const PLANK = ['#a47b48', '#b0864f', '#9a7143', '#bb925a', '#8a643a'].map((c) => hex(c))
const WATER = ['#2f5fb8', '#3569c4', '#3b72cf', '#4a82da', '#2a56a8'].map((c) => hex(c))
const DEEP = ['#1d1d22', '#2a2a30', '#35353c', '#141418'].map((c) => hex(c))

type Painter = (px: PixelBuffer, rng: SeededRandom) => void

function speckle(px: PixelBuffer, rng: SeededRandom, palette: RGBA[], blotch: number): void {
  const n = valueNoise(rng, S, blotch)
  px.fill((x, y) => pick(palette, Math.min(0.999, n(x, y) * 0.6 + rng.next() * 0.4)))
}

const grassTop: Painter = (px, rng) => {
  speckle(px, rng, GRASS, 4)
  for (let i = 0; i < 10; i++) px.set(rng.int(0, 15), rng.int(0, 15), shadeRGBA(GRASS[4], 1.1))
}

const dirt: Painter = (px, rng) => {
  speckle(px, rng, DIRT.slice(0, 4), 3)
  for (let i = 0; i < 7; i++) px.set(rng.int(0, 15), rng.int(0, 15), DIRT[4])
  for (let i = 0; i < 3; i++) {
    const x = rng.int(0, 14), y = rng.int(0, 14)
    px.set(x, y, hex('#8d8a84'))
    px.set(x + 1, y, hex('#77746f'))
  }
}

const grassSide: Painter = (px, rng) => {
  dirt(px, rng)
  for (let x = 0; x < S; x++) {
    const depth = 3 + (rng.next() < 0.45 ? 1 : 0) + (rng.next() < 0.2 ? 1 : 0)
    for (let y = 0; y < depth; y++) px.set(x, y, pick(GRASS, rng.next() * (y === depth - 1 ? 0.5 : 1)))
  }
}

const stone: Painter = (px, rng) => {
  const n = valueNoise(rng, S, 5)
  const m = valueNoise(rng, S, 2)
  px.fill((x, y) => pick(STONE.slice(0, 4), Math.min(0.999, n(x, y) * 0.55 + m(x, y) * 0.3 + rng.next() * 0.15)))
  // A few dark fissures.
  for (let k = 0; k < 3; k++) {
    let x = rng.int(0, 15), y = rng.int(0, 15)
    for (let i = 0; i < rng.int(2, 4); i++) {
      px.set(x, y, STONE[4])
      x += rng.pick([-1, 0, 1])
      y += 1
    }
  }
}

const sand: Painter = (px, rng) => {
  speckle(px, rng, SAND.slice(0, 3), 4)
  for (let i = 0; i < 14; i++) px.set(rng.int(0, 15), rng.int(0, 15), rng.next() < 0.5 ? SAND[3] : SAND[4])
}

const woodSide: Painter = (px, rng) => {
  const cols: number[] = []
  for (let x = 0; x < S; x++) cols.push(rng.next())
  px.fill((x, y) => {
    const groove = (x % 4 === 0 && rng.next() < 0.85) || rng.next() < 0.04
    if (groove) return BARK[3]
    return pick(BARK.slice(0, 3), Math.min(0.999, cols[x] * 0.7 + rng.next() * 0.3 + (y % 5 === 0 ? 0.1 : 0)))
  })
}

const woodTop: Painter = (px, rng) => {
  px.fill((x, y) => {
    const edge = x === 0 || y === 0 || x === S - 1 || y === S - 1
    if (edge) return pick(BARK, rng.next())
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5))
    const ring = Math.floor(d + rng.next() * 0.6) % 2
    return ring ? RINGS[1] : pick([RINGS[0], RINGS[2]], rng.next())
  })
  px.set(7, 7, RINGS[3])
  px.set(8, 8, RINGS[3])
}

const leaves: Painter = (px, rng) => {
  const n = valueNoise(rng, S, 3)
  px.fill((x, y) => {
    if (rng.next() < 0.16) return [0, 0, 0, 0]
    return pick(LEAF, Math.min(0.999, n(x, y) * 0.5 + rng.next() * 0.5))
  })
}

function planksInto(px: PixelBuffer, rng: SeededRandom): void {
  const offsets = [3, 11, 6, 13]
  px.fill((x, y) => {
    const board = Math.floor(y / 4)
    if (y % 4 === 3) return PLANK[4]
    if (x === offsets[board] && y % 4 !== 3) return shadeRGBA(PLANK[4], 1.05)
    const grain = (x * 7 + board * 13) % 5 === 0 && rng.next() < 0.6
    return grain ? PLANK[2] : pick(PLANK.slice(0, 4), rng.next() * 0.9)
  })
  for (let b = 0; b < 4; b++) {
    px.set(offsets[b] - 1 < 0 ? 1 : offsets[b] - 1, b * 4 + 1, PLANK[4])
  }
}

const planks: Painter = (px, rng) => planksInto(px, rng)

const water: Painter = (px, rng) => {
  const n = valueNoise(rng, S, 4)
  px.fill((x, y) => {
    const wave = Math.sin((x + y * 0.5) * 0.9) * 0.15
    return pick(WATER.slice(0, 4), Math.min(0.999, Math.max(0, n(x, y) * 0.7 + wave + rng.next() * 0.2)))
  })
  for (let i = 0; i < 5; i++) {
    const x = rng.int(0, 12), y = rng.int(0, 15)
    for (let k = 0; k < 3; k++) px.set(x + k, y, hex('#6b9be6'))
  }
}

const tableTop: Painter = (px, rng) => {
  planksInto(px, rng)
  const frame = hex('#5a3f22')
  const inner = hex('#c49a61')
  for (let i = 0; i < S; i++) {
    px.set(i, 0, frame)
    px.set(i, S - 1, frame)
    px.set(0, i, frame)
    px.set(S - 1, i, frame)
  }
  // 3×3 work grid carved into the top.
  for (let gy = 0; gy < 3; gy++) {
    for (let gx = 0; gx < 3; gx++) {
      const x0 = 2 + gx * 4, y0 = 2 + gy * 4
      for (let y = y0; y < y0 + 4; y++) for (let x = x0; x < x0 + 4; x++) px.set(x, y, inner)
      for (let k = 0; k < 4; k++) {
        px.set(x0 + k, y0 + 3, frame)
        px.set(x0 + 3, y0 + k, frame)
      }
    }
  }
}

const tableSide: Painter = (px, rng) => {
  planksInto(px, rng)
  const dark = hex('#4a321b')
  const metal = hex('#a9adb3')
  const metalDark = hex('#6f7378')
  for (let x = 0; x < S; x++) {
    px.set(x, 0, dark)
    px.set(x, 1, hex('#6b4b2a'))
  }
  // A hanging hammer…
  for (let y = 4; y < 13; y++) px.set(4, y, hex('#7a5433'))
  for (let x = 2; x <= 6; x++) {
    px.set(x, 3, metal)
    px.set(x, 4, metalDark)
  }
  // …and a small saw.
  for (let x = 9; x <= 13; x++) for (let y = 5; y <= 7; y++) px.set(x, y, metal)
  for (let x = 9; x <= 13; x += 2) px.set(x, 8, metalDark)
  px.set(8, 5, hex('#7a5433'))
  px.set(8, 6, hex('#7a5433'))
  px.set(7, 5, hex('#7a5433'))
}

const bedrock: Painter = (px, rng) => {
  const n = valueNoise(rng, S, 3)
  px.fill((x, y) => pick(DEEP, Math.min(0.999, n(x, y) * 0.7 + rng.next() * 0.3)))
  for (let i = 0; i < 6; i++) px.set(rng.int(0, 15), rng.int(0, 15), hex('#4a3d5c'))
}

const PAINTERS: Record<AtlasTile, Painter> = {
  grass_top: grassTop,
  grass_side: grassSide,
  dirt,
  stone,
  sand,
  wood_side: woodSide,
  wood_top: woodTop,
  leaves,
  planks,
  water,
  crafting_table_top: tableTop,
  crafting_table_side: tableSide,
  bedrock,
}

/** Paints a single named tile (used by the atlas and by item icons). */
export function paintTile(name: AtlasTile): PixelBuffer {
  const px = new PixelBuffer(S, S)
  const seed = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)
  PAINTERS[name](px, new SeededRandom(seed))
  return px
}

let atlasCache: HTMLCanvasElement | null = null
const tileCache = new Map<string, HTMLCanvasElement>()

export function getTileCanvas(name: AtlasTile): HTMLCanvasElement {
  let c = tileCache.get(name)
  if (!c) {
    c = paintTile(name).toCanvas()
    tileCache.set(name, c)
  }
  return c
}

/** The terrain atlas: ATLAS_COLS × ATLAS_ROWS tiles of 16 px. */
export function buildTerrainAtlas(): HTMLCanvasElement {
  if (atlasCache) return atlasCache
  const c = makeCanvas(ATLAS_COLS * S, ATLAS_ROWS * S)
  const ctx = ctx2d(c)
  ATLAS_TILES.forEach((name, i) => {
    const col = i % ATLAS_COLS, row = Math.floor(i / ATLAS_COLS)
    ctx.drawImage(getTileCanvas(name), col * S, row * S)
  })
  atlasCache = c
  return c
}

/** Average colour of a tile — used for block-break particles. */
export function tileAverageColor(name: AtlasTile): [number, number, number] {
  const px = paintTile(name)
  let r = 0, g = 0, b = 0, n = 0
  for (let i = 0; i < px.data.length; i += 4) {
    if (px.data[i + 3] < 128) continue
    r += px.data[i]; g += px.data[i + 1]; b += px.data[i + 2]; n++
  }
  return [r / n / 255, g / n / 255, b / n / 255]
}

/**
 * Eight crack stages. Cracks are random walks from the centre; stage k
 * draws the first (k+1)/8 of the segments, so cracks grow over time.
 */
export function buildCrackTextures(): HTMLCanvasElement[] {
  const rng = new SeededRandom(0xc4ac)
  const segments: [number, number][] = []
  for (let arm = 0; arm < 7; arm++) {
    let x = 7 + rng.int(-1, 1), y = 7 + rng.int(-1, 1)
    const dx = rng.pick([-1, 1]), dy = rng.pick([-1, 1])
    for (let i = 0; i < 9; i++) {
      segments.push([x, y])
      if (rng.next() < 0.5) x += dx
      else y += dy
      if (rng.next() < 0.2) x -= dx
    }
  }
  // Interleave arms so every stage grows all arms a bit.
  const order = segments.map((s, i) => ({ s, k: (i % 9) * 10 + Math.floor(i / 9) })).sort((a, b) => a.k - b.k).map((o) => o.s)
  const out: HTMLCanvasElement[] = []
  for (let stage = 0; stage < 8; stage++) {
    const px = new PixelBuffer(S, S)
    const n = Math.ceil(((stage + 1) / 8) * order.length)
    for (let i = 0; i < n; i++) {
      const [x, y] = order[i]
      px.set(((x % S) + S) % S, ((y % S) + S) % S, [20, 16, 12, 200])
    }
    out.push(px.toCanvas())
  }
  return out
}
