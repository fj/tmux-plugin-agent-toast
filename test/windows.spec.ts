import assert from 'node:assert/strict'
import { test } from 'node:test'

import { justSettled, markSeenArgs } from '../src/transitions.ts'
import { FIELD_SEPARATOR, parseWindows, type AgentWindow } from '../src/windows.ts'

const line = (...fields: string[]) => fields.join(FIELD_SEPARATOR)
const agent = (id: string, state: string, seen: string): AgentWindow => ({ id, target: 's:1', name: 'w', state, harness: 'pi', session: '', seen, title: '' })

test('only windows with agent options are listed, once each', () => {
  const text = [
    line('@1', 's:1', 'fish', '', '', '', ''),
    line('@2', 's:2', 'pi', 'busy', 'pi', '/s.jsonl', 'busy', '✳ Fix it'),
    line('@2', 't:1', 'pi', 'busy', 'pi', '/s.jsonl', 'busy'),
    line('@3', 's:3', 'old', '', '', '', 'done'),
  ].join('\n')

  assert.deepEqual(
    parseWindows(text).map(({ id, target }) => `${id} ${target}`),
    ['@2 s:2', '@3 s:3'],
  )
  assert.equal(parseWindows(text)[0]?.title, '✳ Fix it')
})

test('a window settles when it goes from busy to waiting or done', () => {
  const windows = [agent('@1', 'done', 'busy'), agent('@2', 'waiting', 'busy'), agent('@3', 'busy', 'busy'), agent('@4', 'done', 'done'), agent('@5', '', 'busy')]

  assert.deepEqual(justSettled(windows).map(({ id }) => id), ['@1', '@2'])
})

test('the seen state follows the state in one tmux call', () => {
  assert.deepEqual(markSeenArgs([agent('@1', 'done', 'busy'), agent('@2', 'busy', 'busy'), agent('@3', '', 'done')]), [
    'set-option', '-w', '-t', '@1', '@agent_toast_seen', 'done', ';', 'set-option', '-wu', '-t', '@3', '@agent_toast_seen',
  ])
})

test('nothing to mark gives no tmux call', () => {
  assert.deepEqual(markSeenArgs([agent('@1', 'busy', 'busy')]), [])
})
