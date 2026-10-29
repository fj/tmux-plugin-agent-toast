import assert from 'node:assert/strict'
import { test } from 'node:test'

import { fit, textWidth } from '../src/cells.ts'
import { markOf, meterBar, perimeterIndex, renderFrame, type FrameInput } from '../src/frame.ts'
import { isAcknowledged, isMistyped, parseKeys, typedAfter } from '../src/input.ts'
import { rainbow } from '../src/rainbow.ts'
import { PULSE_MS, shade, waveAt } from '../src/wave.ts'

const ANSI = /\x1b\[[0-9;]*m/g
const plain = (line: string) => line.replace(ANSI, '')
const backgrounds = (line: string) => {
  const cells: (string | undefined)[] = []
  let current: string | undefined
  for (const [, code, char] of line.matchAll(/\x1b\[([0-9;]*)m|(.)/gsu)) {
    if (code?.startsWith('48;2;')) current = code.slice('48;2;'.length)
    else if (code === '49' || code === '0') current = undefined
    else if (char !== undefined) cells.push(...Array.from({ length: textWidth(char) }, () => current))
  }
  return cells
}
const row = (summary: string, isNew = false, isSelected = false) => ({ mark: markOf('done', 0), target: 's:1 @1', label: 'Pi', summary, isNew, isSelected })
const typing = (typed: string, data: string) => typedAfter(typed, parseKeys(data))
const frame = (overrides: Partial<FrameInput> = {}): FrameInput => ({
  width: 40,
  height: 7,
  nowMs: 0,
  title: 'agents',
  rows: [row('first'), row('second')],
  remainingMs: 5000,
  totalMs: 10_000,
  typed: '',
  pulseAgeMs: undefined,
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
  assert.equal(isAcknowledged(typing('', 'o')), false)
  assert.equal(isAcknowledged(typing('', 'ok')), true)
  assert.equal(isAcknowledged(typing('', 'OK')), true)
  assert.equal(isAcknowledged(typing('', 'xok')), true)
  assert.equal(isAcknowledged(typing('', 'o\rk')), true)
  assert.equal(isAcknowledged(typing('', 'ox\x7fk')), true)
  assert.equal(isAcknowledged(typing('', '\x03\x1b\r')), false)
})

test('only a key that strays from ok is a mistype', () => {
  const press = (typed: string, data: string) => isMistyped(parseKeys(data), typing(typed, data))

  assert.equal(press('', 'o'), false)
  assert.equal(press('', 'O'), false)
  assert.equal(press('o', 'o'), false)
  assert.equal(press('x', '\x7f'), false)
  assert.equal(press('', 'x'), true)
  assert.equal(press('', 'k'), true)
  assert.equal(press('o', 'x'), true)
  assert.equal(press('', '\x1b'), true)
  assert.equal(press('', '\x03'), true)
})

test('the wave rings out from its origin and fades', () => {
  const pulse = { x: 60, y: 5, ageMs: 0 }
  const nearestLit = (ageMs: number) =>
    Array.from({ length: pulse.x }, (_, d) => d).find(d => waveAt({ ...pulse, ageMs }, pulse.x - d, pulse.y) !== undefined)

  assert.equal(nearestLit(0), 0)
  assert.ok((nearestLit(PULSE_MS / 4) ?? 0) > 0)
  assert.ok((nearestLit(PULSE_MS / 2) ?? 0) > (nearestLit(PULSE_MS / 4) ?? 0))
  assert.equal(nearestLit(PULSE_MS), undefined)
})

test('shading keeps the text and colors each cell, wide or narrow', () => {
  const line = `a\x1b[1m日\x1b[0mb`
  const shaded = shade(line, x => (x === 1 ? [1, 2, 3] : undefined))

  assert.equal(plain(shaded), 'a日b')
  assert.deepEqual(backgrounds(shaded), [undefined, '1;2;3', '1;2;3', undefined])
})

test('a mistype pulses the popup from the prompt cursor', () => {
  const quiet = renderFrame(frame())
  const pulsed = renderFrame(frame({ pulseAgeMs: 0 }))
  const footer = backgrounds(pulsed[5] ?? '')
  const cursorX = plain(pulsed[5] ?? '').lastIndexOf('▏')

  assert.deepEqual(pulsed.map(plain), quiet.map(plain))
  assert.ok(quiet.every(line => !line.includes('48;2;')))
  assert.notEqual(footer[cursorX], undefined)
  assert.equal(backgrounds(pulsed[0] ?? '')[0], undefined)
  assert.ok(renderFrame(frame({ pulseAgeMs: PULSE_MS })).every(line => !line.includes('48;2;')))
})

test('escape sequences are one key, so arrows never type', () => {
  assert.deepEqual(parseKeys('\x1b[Ao\x1bOB\x1b'), [
    { kind: 'move', step: -1 },
    { kind: 'text', char: 'o' },
    { kind: 'move', step: 1 },
    { kind: 'other' },
  ])
  assert.equal(typing('o', '\x1b[A\x1b[Bk'), 'ok')
})

test('arrows are not mistypes', () => {
  for (const data of ['\x1b[A', '\x1b[B', '\x1b[C', '\x1b[D', '\x1bOA']) {
    assert.equal(isMistyped(parseKeys(data), typing('', data)), false, JSON.stringify(data))
  }
  assert.equal(isMistyped(parseKeys('\x1b[Ax'), typing('', '\x1b[Ax')), true)
})

test('the selected row has a background across its full width', () => {
  const [, selected, other] = renderFrame(frame({ rows: [row('first', false, true), row('second')] }))
  const cells = backgrounds(selected ?? '')

  assert.ok(cells.slice(2, -2).every(cell => cell !== undefined))
  assert.equal(cells[0], undefined)
  assert.ok(backgrounds(other ?? '').every(cell => cell === undefined))
})

test('rows scroll to keep the selected row in view', () => {
  const rows = ['a', 'b', 'c', 'd', 'e'].map(summary => row(summary, false, summary === 'd'))
  const lines = renderFrame(frame({ rows })).map(plain)

  assert.match(lines[1] ?? '', / c +│$/)
  assert.match(lines[2] ?? '', / d +│$/)
  assert.match(lines[3] ?? '', /^│ \+2 above, \+1 below +│$/)

  const last = renderFrame(frame({ rows: rows.map((r, i) => ({ ...r, isSelected: i === 4 })) })).map(plain)
  assert.match(last[3] ?? '', /^│ \+3 above +│$/)
})

test('shading keeps the line background outside the wave', () => {
  const line = `a\x1b[48;2;9;9;9mbc\x1b[0md`
  const shaded = shade(line, x => (x === 1 ? [1, 2, 3] : undefined))

  assert.deepEqual(backgrounds(shaded), [undefined, '1;2;3', '9;9;9', undefined])
})

test('a pulse keeps the selected row highlighted', () => {
  const [, selected] = renderFrame(frame({ rows: [row('first', false, true)], pulseAgeMs: PULSE_MS / 2 }))

  assert.ok(backgrounds(selected ?? '').slice(2, -2).every(cell => cell !== undefined))
})

test('every reset code ends the line background', () => {
  for (const reset of ['\x1b[0m', '\x1b[m', '\x1b[49m']) {
    const shaded = shade(`\x1b[48;2;9;9;9ma${reset}b`, () => undefined)
    assert.deepEqual(backgrounds(shaded), ['9;9;9', undefined], JSON.stringify(reset))
  }
})
