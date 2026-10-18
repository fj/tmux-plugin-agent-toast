import { fit, textWidth } from './cells.ts'
import { rainbow, type Rgb } from './rainbow.ts'

export type Mark = { glyph: string; rgb: Rgb | undefined }

export type Row = { mark: Mark; target: string; label: string; summary: string; isNew: boolean }

export type FrameInput = {
  width: number
  height: number
  nowMs: number
  title: string
  rows: readonly Row[]
  remainingMs: number
  totalMs: number
  typed: string
}

const BUSY_FRAMES = ['◐', '◓', '◑', '◒']
const WAITING_RGB: Rgb = [0xf0, 0xc6, 0x74]
const DONE_RGB: Rgb = [0x9b, 0xe2, 0x7f]
const MUTED_RGB: Rgb = [0x8a, 0x8a, 0x8a]
const METER_RGB: Rgb = [0xf0, 0xc6, 0x74]
const MS_PER_SECOND = 1000
const PADDING = 1
const BORDER_CELLS = 2
const FOOTER_LINES = 2
const TITLE_OFFSET = 2
const METER_CELLS = 16
const PARTIAL_BLOCKS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']
const EIGHTHS = 8
const PROMPTS = ['type ok to dismiss: ', 'type ok: ']
const CURSOR = '▏'

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const fg = ([r, g, b]: Rgb) => `\x1b[38;2;${r};${g};${b}m`
const paint = (text: string, rgb: Rgb | undefined, bold = false) =>
  rgb === undefined && !bold ? text : `${bold ? BOLD : ''}${rgb === undefined ? '' : fg(rgb)}${text}${RESET}`

export const CHROME_LINES = BORDER_CELLS + FOOTER_LINES

export function markOf(state: string, nowMs: number): Mark {
  if (state === 'waiting') return { glyph: '?', rgb: WAITING_RGB }
  if (state === 'done') return { glyph: '✓', rgb: DONE_RGB }
  if (state === 'busy') return { glyph: BUSY_FRAMES[Math.floor(nowMs / MS_PER_SECOND) % BUSY_FRAMES.length] ?? '', rgb: undefined }
  return { glyph: ' ', rgb: undefined }
}

export function perimeterIndex(x: number, y: number, width: number, height: number): number {
  const right = width - 1
  const bottom = height - 1

  if (y === 0) return x
  if (x === right) return right + y
  if (y === bottom) return right + bottom + (right - x)
  return 2 * right + bottom + (bottom - y)
}

function borderLine(y: number, input: FrameInput): string {
  const { width, height, nowMs, title } = input
  const isTop = y === 0
  const isBottom = y === height - 1
  const titleText = ` ${title} `
  const isTitle = (x: number) => isTop && x >= TITLE_OFFSET && x < TITLE_OFFSET + titleText.length
  const cellAt = (x: number) => {
    if (isTitle(x)) return titleText[x - TITLE_OFFSET] ?? ''
    if (x === 0) return isBottom ? '╰' : '╭'
    if (x === width - 1) return isBottom ? '╯' : '╮'
    return '─'
  }

  return Array.from({ length: width }, (_, x) => paint(cellAt(x), rainbow(nowMs, perimeterIndex(x, y, width, height)), isTitle(x))).join('')
}

function side(x: number, y: number, input: FrameInput): string {
  return paint('│', rainbow(input.nowMs, perimeterIndex(x, y, input.width, input.height)))
}

function rowColumns(rows: readonly Row[]): { target: number; label: number } {
  return {
    target: Math.max(0, ...rows.map(row => textWidth(row.target))),
    label: Math.max(0, ...rows.map(row => textWidth(row.label))),
  }
}

function rowText(row: Row, columns: { target: number; label: number }, width: number): string {
  const head = `${fit(row.target, columns.target)} ${fit(row.label, columns.label)} `
  const summaryWidth = Math.max(0, width - 2 - textWidth(head))

  return `${paint(row.mark.glyph, row.mark.rgb, true)} ${paint(head, MUTED_RGB)}${paint(fit(row.summary, summaryWidth), undefined, row.isNew)}`
}

export function meterBar(fraction: number, cells: number): string {
  const eighths = Math.round(Math.max(0, Math.min(1, fraction)) * cells * EIGHTHS)
  const full = Math.floor(eighths / EIGHTHS)
  const partial = PARTIAL_BLOCKS[eighths % EIGHTHS] ?? ''

  return `▕${'█'.repeat(full)}${partial}${' '.repeat(cells - full - (partial === '' ? 0 : 1))}▏`
}

function footer(input: FrameInput, width: number): string {
  const seconds = `${Math.ceil(input.remainingMs / MS_PER_SECOND)}s`
  const meter = `${meterBar(input.remainingMs / input.totalMs, METER_CELLS)} ${seconds}`
  const prompts = PROMPTS.map(prompt => `${prompt}${input.typed}${CURSOR}`)
  const prompt = prompts.find(text => width - textWidth(meter) - textWidth(text) >= 1)

  return prompt === undefined
    ? fit(prompts.at(-1) ?? '', width)
    : `${paint(meter, METER_RGB)}${' '.repeat(width - textWidth(meter) - textWidth(prompt))}${prompt}`
}

function bodyLines(input: FrameInput, width: number): string[] {
  const capacity = Math.max(0, input.height - CHROME_LINES)
  const overflow = capacity > 0 && input.rows.length > capacity
  const shown = overflow ? input.rows.slice(0, capacity - 1) : input.rows.slice(0, capacity)
  const columns = rowColumns(input.rows)
  const lines = shown.map(row => rowText(row, columns, width))

  if (overflow) lines.push(paint(fit(`+${input.rows.length - shown.length} more`, width), MUTED_RGB))
  while (lines.length < capacity) lines.push(' '.repeat(width))

  return [...lines, ' '.repeat(width), footer(input, width)]
}

export function renderFrame(input: FrameInput): string[] {
  const inner = input.width - BORDER_CELLS - 2 * PADDING
  const pad = ' '.repeat(PADDING)
  const body = bodyLines(input, inner).map((line, i) => `${side(0, i + 1, input)}${pad}${line}${pad}${side(input.width - 1, i + 1, input)}`)

  return [borderLine(0, input), ...body, borderLine(input.height - 1, input)]
}
