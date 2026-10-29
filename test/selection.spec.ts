import assert from 'node:assert/strict'
import { test } from 'node:test'

import { moveSelection } from '../src/selection.ts'

const ids = ['@1', '@2', '@3']

test('first move selects the first row going down, the last going up', () => {
  assert.equal(moveSelection(ids, undefined, 1), '@1')
  assert.equal(moveSelection(ids, undefined, -1), '@3')
})

test('moves step through rows and wrap at both ends', () => {
  assert.equal(moveSelection(ids, '@1', 1), '@2')
  assert.equal(moveSelection(ids, '@3', 1), '@1')
  assert.equal(moveSelection(ids, '@1', -1), '@3')
})

test('a selection whose window is gone starts over', () => {
  assert.equal(moveSelection(ids, '@9', 1), '@1')
})

test('no rows means no selection', () => {
  assert.equal(moveSelection([], '@1', 1), undefined)
})
