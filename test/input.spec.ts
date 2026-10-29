import assert from 'node:assert/strict'
import { mock, test } from 'node:test'

import { keyReader, parseKeys, pressKeys, splitPending, type KeyState } from '../src/input.ts'

const ids = ['@1', '@2']
const start: KeyState = { typed: '', selectedId: undefined }
const press = (data: string, state = start) => pressKeys(state, parseKeys(data), ids)

test('every arrow moves the selection one way', () => {
  for (const data of ['\x1b[A', '\x1b[D', '\x1bOA', '\x1bOD']) assert.deepEqual(parseKeys(data), [{ kind: 'move', step: -1 }], JSON.stringify(data))
  for (const data of ['\x1b[B', '\x1b[C', '\x1bOB', '\x1bOC']) assert.deepEqual(parseKeys(data), [{ kind: 'move', step: 1 }], JSON.stringify(data))
})

test('carriage return and line feed are both enter', () => {
  assert.deepEqual(parseKeys('\r\n'), [{ kind: 'enter' }, { kind: 'enter' }])
})

test('a sequence with parameters and an astral character are one key each', () => {
  assert.deepEqual(parseKeys('\x1b[1;5A'), [{ kind: 'other' }])
  assert.deepEqual(parseKeys('😀'), [{ kind: 'text', char: '😀' }])
})

test('arrows select rows without a pulse', () => {
  assert.deepEqual(press('\x1b[B\x1b[B'), { state: { typed: '', selectedId: '@2' }, action: undefined })
})

test('enter focuses the selected row, after moves in the same batch', () => {
  assert.deepEqual(press('\x1b[B\r'), { state: { typed: '', selectedId: '@1' }, action: 'focus' })
  assert.deepEqual(press('\x1b[B\r', { typed: '', selectedId: '@1' }), { state: { typed: '', selectedId: '@2' }, action: 'focus' })
})

test('enter with no selection does nothing', () => {
  assert.deepEqual(press('\r'), { state: start, action: undefined })
})

test('typing ok closes, even with a selection', () => {
  assert.equal(press('k', { typed: 'o', selectedId: '@1' }).action, 'close')
})

test('a stray key pulses and keeps the selection', () => {
  assert.deepEqual(press('x', { typed: '', selectedId: '@1' }), { state: { typed: 'x', selectedId: '@1' }, action: 'pulse' })
})

test('a selection whose window closed is dropped', () => {
  assert.deepEqual(press('', { typed: '', selectedId: '@9' }), { state: start, action: undefined })
})

test('an escape sequence cut at the end waits for the rest', () => {
  for (const pending of ['\x1b', '\x1b[', '\x1b[1;', '\x1bO']) {
    assert.deepEqual(splitPending(`ok${pending}`), { complete: 'ok', pending }, JSON.stringify(pending))
  }
  assert.deepEqual(splitPending('\x1b[Ax'), { complete: '\x1b[Ax', pending: '' })
  assert.deepEqual(splitPending('\x1b[1;5A'), { complete: '\x1b[1;5A', pending: '' })
})

test('the two halves of a split arrow join into one move', () => {
  const { complete, pending } = splitPending('\x1b')

  assert.deepEqual(parseKeys(complete), [])
  assert.deepEqual(parseKeys(splitPending(`${pending}[B`).complete), [{ kind: 'move', step: 1 }])
})

test('the key reader joins a split arrow and flushes a lone Esc after the wait', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const pressed: string[] = []
    const read = keyReader(data => void pressed.push(data), 50)

    read('o\x1b')
    read('[B')
    assert.deepEqual(pressed, ['o', '\x1b[B'])

    read('\x1b')
    mock.timers.tick(49)
    assert.deepEqual(pressed.slice(2), [''])
    mock.timers.tick(1)
    assert.deepEqual(pressed.slice(2), ['', '\x1b'])
  } finally {
    mock.timers.reset()
  }
})

test('enter on a selection whose window closed does nothing', () => {
  assert.deepEqual(press('\r', { typed: '', selectedId: '@9' }), { state: start, action: undefined })
})
