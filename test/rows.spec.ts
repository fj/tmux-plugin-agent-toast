import assert from 'node:assert/strict'
import { test } from 'node:test'

import { notifySettled } from '../src/notify.ts'
import { cachedDescribe, describeAll, rowsAt } from '../src/rows.ts'
import { FIELD_SEPARATOR, type AgentWindow } from '../src/windows.ts'

const window = (id: string, state = 'done', seen = state, session = 's'): AgentWindow => ({ id, target: `s:${id.slice(1)}`, name: `w${id}`, state, harness: 'pi', session, seen })
const byName = async ({ name }: AgentWindow) => ({ label: 'Pi', summary: name })
const listing = (windows: readonly AgentWindow[]) =>
  windows.map(w => [w.id, w.target, w.name, w.state, w.harness, w.session, w.seen].join(FIELD_SEPARATOR)).join('\n')

test('newly settled windows come first, and the rest keep their order', async () => {
  const described = await describeAll([window('@1'), window('@2'), window('@3')], new Set(['@3']), byName)

  assert.deepEqual(described.map(({ window }) => window.id), ['@3', '@1', '@2'])
})

test('rows carry the mark, target, description and whether the window is new', async () => {
  const described = await describeAll([window('@1', 'waiting'), window('@2', 'busy')], new Set(['@1']), byName)

  assert.deepEqual(
    rowsAt(described, new Set(['@1']), 0).map(({ mark, target, summary, isNew }) => [mark.glyph, target, summary, isNew]),
    [['?', 's:1 @1', 'w@1', true], ['◐', 's:2 @2', 'w@2', false]],
  )
})

test('a window is described once until its session changes', async () => {
  const calls: string[] = []
  const describe = cachedDescribe(async w => {
    calls.push(w.session)
    return byName(w)
  })

  await describe(window('@1', 'done', 'done', 'a'))
  await describe(window('@1', 'busy', 'busy', 'a'))
  await describe(window('@1', 'done', 'done', 'b'))
  assert.deepEqual(calls, ['a', 'b'])
})

test('a settled window marks what was seen and launches the toast', async () => {
  const runs: (readonly string[])[] = []
  const launches: (readonly string[])[] = []
  const windows = [window('@1', 'done', 'busy'), window('@2', 'busy', 'busy')]

  await notifySettled(
    async args => {
      runs.push(args)
      return args[0] === 'list-windows' ? listing(windows) : ''
    },
    async (_run, rowCount, newIds) => void launches.push([`${rowCount}`, ...newIds]),
  )

  assert.deepEqual(runs.at(-1), ['set-option', '-w', '-t', '@1', '@agent_toast_seen', 'done'])
  assert.deepEqual(launches, [['2', '@1']])
})

test('no settled window means no toast', async () => {
  const launches: unknown[] = []

  await notifySettled(async args => (args[0] === 'list-windows' ? listing([window('@1', 'busy', 'done')]) : ''), async () => void launches.push(1))

  assert.deepEqual(launches, [])
})
