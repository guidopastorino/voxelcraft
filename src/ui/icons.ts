import { makeCanvas, ctx2d } from '../assets/PixelCanvas'

/** Original HUD pixel icons (hearts and apples), drawn from ASCII masks. */
const HEART = [
  '.oo.oo.',
  'orroRRo',
  'orrrrRo',
  'orrrrro',
  '.orrro.',
  '..oro..',
  '...o...',
]
const APPLE = [
  '...gg..',
  '..og...',
  '.orroo.',
  'orwrrro',
  'orrrrro',
  'orrrrro',
  '.ooooo.',
]

function draw(mask: string[], colors: Record<string, string>, halfLeft = false): string {
  const c = makeCanvas(mask[0].length, mask.length)
  const ctx = ctx2d(c)
  mask.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const col = colors[ch]
      if (!col) return
      if (halfLeft && x > 3 && ch !== 'o') ctx.fillStyle = colors['_'] ?? col
      else ctx.fillStyle = col
      ctx.fillRect(x, y, 1, 1)
    }),
  )
  return c.toDataURL()
}

let cache: Record<string, string> | null = null

export function hudIcons(): Record<string, string> {
  if (cache) return cache
  const heart = { o: '#2a0d10', r: '#e0333d', R: '#ff9aa0' }
  const heartEmpty = { o: '#2a0d10', r: '#3b1a1d', R: '#4a2327' }
  const apple = { o: '#2b120b', r: '#d94a2b', w: '#ffc2a8', g: '#4fae3a' }
  const appleEmpty = { o: '#2b120b', r: '#3a2019', w: '#4a2a22', g: '#2d3d27' }
  cache = {
    heartFull: draw(HEART, heart),
    heartHalf: draw(HEART, { ...heart, _: '#3b1a1d' }, true),
    heartEmpty: draw(HEART, heartEmpty),
    foodFull: draw(APPLE, apple),
    foodHalf: draw(APPLE, { ...apple, _: '#3a2019' }, true),
    foodEmpty: draw(APPLE, appleEmpty),
  }
  return cache
}
