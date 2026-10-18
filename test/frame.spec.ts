import assert from 'node:assert/strict'
import { test } from 'node:test'

import { fit, textWidth } from '../src/cells.ts'
import { markOf, meterBar, perimeterIndex, renderFrame, type FrameInput } from '../src/frame.ts'
import { isAcknowledged, typedAfter } from '../src/input.ts'
import { rainbow } from '../src/rainbow.ts'

const ANSI = /\x1b\[[0-9;]*m/g
const plain = (line: string) => line.replace(ANSI, '')
const row = (summary: string, isNew = false) => ({ mark: markOf('done', 0), target: 's:1 @1', label: 'Pi', summary, isNew })
const frame = (overrides: Partial<FrameInput> = {}): FrameInput => ({
  width: 40,
  height: 7,
  nowMs: 0,
  title: 'agents',
  rows: [row('first'), row('second')],
  remainingMs: 5000,
  totalMs: 10_000,
  typed: '',
  ...overrides,
})

test('text is padded or cut to its cell width', () => {
  assert.equal(fit('ab', 4), 'ab  ')
  assert.equal(fit('abcdef', 4), 'abc…')
  assert.equal(fit('日本語', 5), '日本…')
  assert.equal(textWidth('é日'), 3)
})

test('the perimeter is numbered clockwise from the top-left corner', () => {
  const [width, height] = [4, 3]
  const cells = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [2, 2], [1, 2], [0, 2], [0, 1]] as const

  assert.deepEqual(cells.map(([x, y]) => perimeterIndex(x, y, width, height)), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
})

test('every frame line fills the popup width', () => {
  const lines = renderFrame(frame()).map(plain)

  assert.equal(lines.length, 7)
  for (const line of lines) assert.equal(textWidth(line), 40)
  assert.match(lines[0] ?? '', /^╭─ agents ─+╮$/)
  assert.match(lines[6] ?? '', /^╰─+╯$/)
})

test('rows show their mark, target, label and summary', () => {
  const lines = renderFrame(frame()).map(plain)

  assert.equal(lines[1], `${'│ ✓ s:1 @1 Pi first'.padEnd(39)}│`)
  assert.match(lines[5] ?? '', /^│ ▕█{8} {8}▏ 5s +type ok: ▏ │$/)
})

test('a wide popup spells out the prompt and shows what was typed', () => {
  const lines = renderFrame(frame({ width: 60, typed: 'o' })).map(plain)

  assert.match(lines[5] ?? '', / 5s +type ok to dismiss: o▏ │$/)
})

test('rows beyond the space say how many more there are', () => {
  const lines = renderFrame(frame({ rows: ['a', 'b', 'c', 'd'].map(summary => row(summary)) })).map(plain)

  assert.match(lines[2] ?? '', / b +│$/)
  assert.match(lines[3] ?? '', /^│ \+2 more +│$/)
})

test('a popup with no room for rows keeps its height', () => {
  const lines = renderFrame(frame({ height: 4, rows: ['a', 'b', 'c'].map(summary => row(summary)) })).map(plain)

  assert.equal(lines.length, 4)
  assert.doesNotMatch(lines.join('\n'), /✓/)
})

test('a narrow popup keeps only the prompt in the footer', () => {
  const lines = renderFrame(frame({ width: 30 })).map(plain)

  assert.equal(lines[5], `${'│ type ok: ▏'.padEnd(29)}│`)
})

test('only a new row has a bold summary', () => {
  const [, fresh, old] = renderFrame(frame({ rows: [row('fresh', true), row('old')] }))

  assert.match(fresh ?? '', /\x1b\[1mfresh/)
  assert.doesNotMatch(old ?? '', /\x1b\[1mold/)
})

test('the border colors follow the rainbow around the edge and move with time', () => {
  const colorAt = (line: string) => line.match(/38;2;(\d+);(\d+);(\d+)m/)?.slice(1).map(Number)
  const [top] = renderFrame(frame({ nowMs: 0 }))
  const [later] = renderFrame(frame({ nowMs: 500 }))

  assert.deepEqual(colorAt(top ?? ''), [...rainbow(0, 0)])
  assert.deepEqual(colorAt(later ?? ''), [...rainbow(500, 0)])
  assert.notDeepEqual(rainbow(0, 0), rainbow(500, 0))
})

test('the meter drains in eighths', () => {
  assert.equal(meterBar(1, 4), '▕████▏')
  assert.equal(meterBar(0.5, 4), '▕██  ▏')
  assert.equal(meterBar(0.0625, 4), '▕▎   ▏')
  assert.equal(meterBar(0, 4), '▕    ▏')
})

test('marks match the tmux badge', () => {
  assert.equal(markOf('waiting', 0).glyph, '?')
  assert.equal(markOf('done', 0).glyph, '✓')
  assert.ok(['◐', '◓', '◑', '◒'].includes(markOf('busy', 0).glyph))
})

test('only typing ok acknowledges, in any case', () => {
  assert.equal(isAcknowledged(typedAfter('', 'o')), false)
  assert.equal(isAcknowledged(typedAfter('', 'ok')), true)
  assert.equal(isAcknowledged(typedAfter('', 'OK')), true)
  assert.equal(isAcknowledged(typedAfter('', 'xok')), true)
  assert.equal(isAcknowledged(typedAfter('', 'o\rk')), true)
  assert.equal(isAcknowledged(typedAfter('', 'ox\x7fk')), true)
  assert.equal(isAcknowledged(typedAfter('', '\x03\x1b\r')), false)
})
