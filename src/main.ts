import '@fontsource/pixelify-sans/400.css'
import '@fontsource/pixelify-sans/700.css'
import './ui/styles.css'
import { Game } from './app/Game'

const canvas = document.getElementById('game') as HTMLCanvasElement
const ui = document.getElementById('ui') as HTMLElement

try {
  const game = new Game(canvas, ui)
  void game.boot()
} catch (err) {
  console.error(err)
  ui.innerHTML = `<div class="screen dark"><h2 class="title">VoxelCraft could not start</h2><div class="subtitle">${String(err instanceof Error ? err.message : err).replace(/</g, '&lt;')}</div><div class="subtitle">A browser with WebGL support is required.</div></div>`
}
