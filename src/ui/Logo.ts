import { makeCanvas, ctx2d } from '../assets/PixelCanvas'
import { getTileCanvas } from '../assets/TerrainTextures'

/** Original 5×7 bitmap glyphs for the title logo. */
const GLYPHS: Record<string, string[]> = {
  V: ['X...X', 'X...X', 'X...X', 'X...X', '.X.X.', '.X.X.', '..X..'],
  O: ['.XXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
  X: ['X...X', 'X...X', '.X.X.', '..X..', '.X.X.', 'X...X', 'X...X'],
  E: ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'XXXXX'],
  L: ['X....', 'X....', 'X....', 'X....', 'X....', 'X....', 'XXXXX'],
  C: ['.XXXX', 'X....', 'X....', 'X....', 'X....', 'X....', '.XXXX'],
  R: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X.X..', 'X..X.', 'X...X'],
  A: ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
  F: ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'X....'],
  T: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..'],
}

/**
 * Renders the VOXELCRAFT logo: every glyph pixel is a small bevelled
 * stone block; blocks with open sky above get a grass cap, and the
 * whole word gets a dark extruded shadow for depth.
 */
export function renderLogo(text = 'VOXELCRAFT'): HTMLCanvasElement {
  const CELL = 8, GAP = 1, DEPTH = 4
  const letters = [...text].map((ch) => GLYPHS[ch] ?? GLYPHS.O)
  const cols = letters.length * (5 + GAP) - GAP
  const w = cols * CELL + DEPTH + 2, hgt = 7 * CELL + DEPTH + 2
  const c = makeCanvas(w, hgt)
  const ctx = ctx2d(c)
  const stone = getTileCanvas('stone')
  const grass = getTileCanvas('grass_side')
  const on = (lx: number, row: number, col: number) => lx >= 0 && letters[lx]?.[row]?.[col] === 'X'

  const cells: [number, number, boolean][] = []
  letters.forEach((g, li) => {
    for (let row = 0; row < 7; row++)
      for (let col = 0; col < 5; col++) {
        if (g[row][col] !== 'X') continue
        const x = (li * (5 + GAP) + col) * CELL + 1
        const y = row * CELL + 1
        const grassy = row === 0 || !on(li, row - 1, col)
        cells.push([x, y, grassy])
      }
  })
  // Extrusion (back to front) for a chunky 3D look.
  for (let d = DEPTH; d >= 1; d--) {
    ctx.fillStyle = d === DEPTH ? '#0c1116' : '#1f262e'
    for (const [x, y] of cells) ctx.fillRect(x + d, y + d, CELL, CELL)
  }
  for (const [x, y, grassy] of cells) {
    const src = grassy ? grass : stone
    // Sample a CELL×CELL window of the 16px tile, varied per block.
    const sx = ((x * 7) % 8), sy = grassy ? 0 : ((y * 5) % 8)
    ctx.drawImage(src, sx, sy, CELL, CELL, x, y, CELL, CELL)
    ctx.fillStyle = 'rgba(255,255,255,0.28)'
    ctx.fillRect(x, y, CELL, 1)
    ctx.fillRect(x, y, 1, CELL)
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillRect(x, y + CELL - 1, CELL, 1)
    ctx.fillRect(x + CELL - 1, y, 1, CELL)
  }
  return c
}
