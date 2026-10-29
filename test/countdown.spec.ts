import assert from 'node:assert/strict'
import { test } from 'node:test'

import { hold, remainingMs, startCountdown } from '../src/countdown.ts'

const TOTAL_MS = 10_000
const HOLD_MS = 3000

test('the countdown runs from the start', () => {
  const countdown = startCountdown(1000)

  assert.equal(remainingMs(countdown, TOTAL_MS, 1000), TOTAL_MS)
  assert.equal(remainingMs(countdown, TOTAL_MS, 5000), 6000)
  assert.equal(remainingMs(countdown, TOTAL_MS, 99_000), 0)
})

test('a hold stops the countdown, which resumes when the hold ends', () => {
  const held = hold(startCountdown(0), 2000, HOLD_MS)

  assert.equal(remainingMs(held, TOTAL_MS, 2000), 8000)
  assert.equal(remainingMs(held, TOTAL_MS, 4999), 8000)
  assert.equal(remainingMs(held, TOTAL_MS, 6000), 7000)
})

test('another hold during a hold extends it from the latest press', () => {
  const held = hold(hold(startCountdown(0), 2000, HOLD_MS), 4000, HOLD_MS)

  assert.equal(remainingMs(held, TOTAL_MS, 6999), 8000)
  assert.equal(remainingMs(held, TOTAL_MS, 8000), 7000)
})

test('a hold after an earlier one only stops the countdown again', () => {
  const held = hold(hold(startCountdown(0), 1000, HOLD_MS), 6000, HOLD_MS)

  assert.equal(remainingMs(held, TOTAL_MS, 6000), 7000)
  assert.equal(remainingMs(held, TOTAL_MS, 10_000), 6000)
})
