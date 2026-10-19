import { cellWidth } from './cells.ts'
import type { Rgb } from './rainbow.ts'

export type Pulse = { x: number; y: number; ageMs: number }

export const PULSE_MS = 800
const CELLS_PER_SECOND = 90
const BAND_CELLS = 4
// A terminal cell is about twice as tall as it is wide.
const CELLS_PER_ROW = 2
const PULSE_RGB: Rgb = [0xe0, 0x6c, 0x75]
const MS_PER_SECOND = 1000
const SGR = /\x1b\[[0-9;]*m/y
const DEFAULT_BACKGROUND = '\x1b[49m'

const bg = ([r, g, b]: Rgb) => `\x1b[48;2;${r};${g};${b}m`

export function waveAt(pulse: Pulse, x: number, y: number): Rgb | undefined {
  const radius = (pulse.ageMs / MS_PER_SECOND) * CELLS_PER_SECOND
  const distance = Math.hypot(x - pulse.x, (y - pulse.y) * CELLS_PER_ROW)
  const strength = (1 - Math.abs(distance - radius) / BAND_CELLS) * (1 - pulse.ageMs / PULSE_MS)

  if (strength <= 0) return undefined
  const [r, g, b] = PULSE_RGB
  return [Math.round(r * strength), Math.round(g * strength), Math.round(b * strength)]
}

export function shade(line: string, backgroundAt: (x: number) => Rgb | undefined): string {
  let out = ''
  let x = 0
  let current: string | undefined

  for (let i = 0; i < line.length; ) {
    SGR.lastIndex = i
    const escape = SGR.exec(line)
    if (escape !== null) {
      out += escape[0]
      current = undefined
      i += escape[0].length
      continue
    }

    const char = String.fromCodePoint(line.codePointAt(i) ?? 0)
    const rgb = backgroundAt(x)
    const wanted = rgb === undefined ? DEFAULT_BACKGROUND : bg(rgb)
    if (wanted !== current) out += wanted
    current = wanted
    out += char
    x += cellWidth(char)
    i += char.length
  }

  return out + DEFAULT_BACKGROUND
}
