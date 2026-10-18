// Same palette and speed as the shimmer in mod-jxf-fancy-details.
const HUE_DEGREES = 360
const DEGREES_PER_SECOND = 240
const DEGREES_PER_CELL = 18
const SATURATION = 0.85
const LIGHTNESS = 0.65
const MS_PER_SECOND = 1000
const CHANNEL_MAX = 255

export type Rgb = readonly [number, number, number]

function hslToRgb(hue: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + hue / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const channel = (n: number) => Math.round((l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))) * CHANNEL_MAX)

  return [channel(0), channel(8), channel(4)]
}

export function rainbow(nowMs: number, index: number): Rgb {
  const hue = (nowMs / MS_PER_SECOND) * DEGREES_PER_SECOND - index * DEGREES_PER_CELL

  return hslToRgb(((hue % HUE_DEGREES) + HUE_DEGREES) % HUE_DEGREES, SATURATION, LIGHTNESS)
}
