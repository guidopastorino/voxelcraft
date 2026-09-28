import { DEFAULT_SETTINGS, DEFAULT_KEYBINDINGS, type Settings } from '../config/defaults'
import { clamp } from '../core/math'

const KEY = 'voxelcraft.settings.v1'
const LAST_WORLD = 'voxelcraft.lastWorld'

/**
 * Settings and small UI prefs live in localStorage (the world itself goes
 * to IndexedDB). Every access is guarded: private windows or blocked
 * storage just fall back to defaults.
 */
export function loadSettings(): Settings {
  let raw: unknown
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? 'null')
  } catch {
    raw = null
  }
  const d = structuredClone(DEFAULT_SETTINGS)
  if (!raw || typeof raw !== 'object') return d
  const r = raw as Partial<Settings>
  const num = (v: unknown, def: number, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, min, max) : def)
  const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def)
  if (r.audio) for (const k of Object.keys(d.audio) as (keyof Settings['audio'])[]) d.audio[k] = num(r.audio[k], d.audio[k], 0, 1)
  if (r.controls) {
    d.controls.sensitivity = num(r.controls.sensitivity, d.controls.sensitivity, 0.05, 2)
    d.controls.invertY = bool(r.controls.invertY, false)
    if (r.controls.bindings) {
      for (const k of Object.keys(DEFAULT_KEYBINDINGS) as (keyof typeof DEFAULT_KEYBINDINGS)[]) {
        const b = r.controls.bindings[k]
        if (typeof b === 'string' && b.length > 0) d.controls.bindings[k] = b
      }
    }
  }
  if (r.video) {
    d.video.renderDistance = Math.round(num(r.video.renderDistance, d.video.renderDistance, 2, 10))
    d.video.fov = Math.round(num(r.video.fov, d.video.fov, 60, 100))
    if (r.video.particles === 'low' || r.video.particles === 'medium' || r.video.particles === 'high') d.video.particles = r.video.particles
    d.video.clouds = bool(r.video.clouds, true)
  }
  if (r.gameplay) {
    d.gameplay.viewBobbing = bool(r.gameplay.viewBobbing, true)
    d.gameplay.crosshairSize = num(r.gameplay.crosshairSize, 1, 0.5, 2)
    d.gameplay.uiScale = Math.round(num(r.gameplay.uiScale, 0, 0, 4))
  }
  return d
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* storage unavailable — settings apply for this session only */
  }
}

export function getLastWorld(): string | null {
  try {
    return localStorage.getItem(LAST_WORLD)
  } catch {
    return null
  }
}

export function setLastWorld(id: string): void {
  try {
    localStorage.setItem(LAST_WORLD, id)
  } catch {
    /* ignore */
  }
}
