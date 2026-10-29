import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseKeys } from '../src/input.ts'
import { isExpired, pressToast, startToast, toastRemainingMs, type Timing } from '../src/toast.ts'

const ids = ['@1', '@2']
const timing: Timing = { totalMs: 10_000, holdMs: 3000, wave: true }
const press = (toast: ReturnType<typeof startToast>, data: string, nowMs: number, at = timing) => pressToast(toast, parseKeys(data), ids, at, nowMs)

test('the toast expires when its time runs out', () => {
  const toast = startToast(0)

  assert.equal(isExpired(toast, timing, 9999), false)
  assert.equal(isExpired(toast, timing, 10_000), true)
})

test('only an arrow key holds the timer', () => {
  const moved = press(startToast(0), '\x1b[B', 2000).toast
  const typed = press(startToast(0), 'o', 2000).toast

  assert.equal(toastRemainingMs(moved, timing, 4000), 8000)
  assert.equal(toastRemainingMs(moved, timing, 6000), 7000)
  assert.equal(toastRemainingMs(typed, timing, 4000), 6000)
})

test('a mistype pulses only with the wave on', () => {
  assert.equal(press(startToast(0), 'x', 500).toast.mistypedAtMs, 500)
  assert.equal(press(startToast(0), 'x', 500, { ...timing, wave: false }).toast.mistypedAtMs, undefined)
})

test('typing ok closes the toast', () => {
  assert.deepEqual(press(startToast(0), 'ok', 0).effect, { kind: 'close' })
})

test('enter focuses the selected window once, ignoring keys after it', () => {
  const selected = press(startToast(0), '\x1b[B\x1b[B', 0).toast
  const focused = press(selected, '\r', 0)

  assert.deepEqual(focused.effect, { kind: 'focus', windowId: '@2' })
  assert.deepEqual(press(focused.toast, '\r', 0), { toast: focused.toast, effect: undefined })
  assert.deepEqual(press(focused.toast, 'ok', 0).effect, undefined)
})
