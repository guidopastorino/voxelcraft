import { PHYSICS_HZ } from '../config/defaults'

/**
 * requestAnimationFrame loop with a fixed simulation timestep. Rendering
 * runs every frame and receives the interpolation factor `alpha` between
 * the last two simulation states.
 */
export class GameLoop {
  readonly step = 1 / PHYSICS_HZ
  private acc = 0
  private last = 0
  private running = false
  fps = 0
  frameMs = 0
  private fpsFrames = 0
  private fpsTime = 0

  constructor(
    private tick: (dt: number, firstStepOfFrame: boolean) => void,
    private render: (frameDt: number, alpha: number) => void,
  ) {}

  start(): void {
    if (this.running) return
    this.running = true
    this.last = performance.now()
    requestAnimationFrame(this.frame)
  }

  /** Drop accumulated time (e.g. after loading or tab switch). */
  resetClock(): void {
    this.acc = 0
    this.last = performance.now()
  }

  private frame = (now: number) => {
    if (!this.running) return
    const frameDt = Math.min(0.25, (now - this.last) / 1000)
    this.last = now
    this.acc += frameDt
    let steps = 0
    while (this.acc >= this.step && steps < 5) {
      this.tick(this.step, steps === 0)
      this.acc -= this.step
      steps++
    }
    if (steps === 5) this.acc = 0 // too slow: drop time instead of spiralling
    const t0 = performance.now()
    this.render(frameDt, this.acc / this.step)
    this.frameMs = performance.now() - t0
    this.fpsFrames++
    this.fpsTime += frameDt
    if (this.fpsTime >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsTime)
      this.fpsFrames = 0
      this.fpsTime = 0
    }
    requestAnimationFrame(this.frame)
  }
}
