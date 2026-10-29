import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { after, test } from 'node:test'

import { markOf, renderFrame } from '../src/frame.ts'
import { launchPopups, lockPath, parseClients, popupArgv, POPUP } from '../src/launch.ts'
import { FIELD_SEPARATOR, type AgentWindow } from '../src/windows.ts'

const CONF = join(import.meta.dirname, '..', 'agent-toast.conf')
const SOCKET = `tmux-toast-test-${process.pid}`
const HOOK_WAIT_MS = 3000
const POLL_MS = 50

const agent = (session: string, i: number): AgentWindow => ({ id: `@${i}`, target: `${session}:${i}`, name: 'w', state: 'done', harness: '', session: '', seen: 'done', title: '' })
const agents = (count: number, session = 's') => Array.from({ length: count }, (_, i) => agent(session, i))
const tmux = (...args: string[]) => execFileSync('tmux', ['-L', SOCKET, ...args], { encoding: 'utf8' }).trim()
const hasTmux = (() => {
  try {
    execFileSync('tmux', ['-V'])
    return true
  } catch {
    return false
  }
})()

test('clients are parsed with their size', () => {
  assert.deepEqual(parseClients(['/dev/pts/2', '208', '57\n'].join(FIELD_SEPARATOR)), [{ name: '/dev/pts/2', width: 208, height: 57 }])
})

test('each client gets its own lock file', () => {
  assert.notEqual(lockPath('/dev/pts/2', '/run'), lockPath('/dev/pts/3', '/run'))
  assert.match(lockPath('/dev/pts/2', '/run'), /^\/run\/agent-toast-\d+-_dev_pts_2\.lock$/)
})

test('the popup is borderless, pinned top-right, and sized to its rows', () => {
  const argv = popupArgv({ name: '/dev/pts/2', width: 200, height: 50 }, agents(3), ['@4'], '/run/x.lock')

  assert.deepEqual(argv.slice(0, 3), ['flock', '-n', '/run/x.lock'])
  assert.deepEqual(argv.slice(3, argv.indexOf('-E')), ['tmux', 'display-popup', '-c', '/dev/pts/2', '-B', '-x', 'R', '-y', '0', '-w', '72', '-h', '7'])
  assert.deepEqual(argv.slice(argv.indexOf('-E') + 1), [process.execPath, POPUP, '@4'])
})

test('long targets widen the popup so summaries keep at least 50 cells', () => {
  const widthFor = (windows: readonly AgentWindow[], clientWidth = 200) => {
    const argv = popupArgv({ name: 'c', width: clientWidth, height: 50 }, windows, [], '/run/x.lock')
    return Number(argv[argv.indexOf('-w') + 1])
  }
  const target = 'a-very-long-session-name:0 @0'
  const row = { mark: markOf('done', 0), target, label: 'tmux', summary: 'x'.repeat(80), isNew: false, isSelected: false }
  const width = widthFor(agents(1, 'a-very-long-session-name'))
  const [, line] = renderFrame({ width, height: 7, nowMs: 0, title: 'agents', rows: [row], remainingMs: 1, totalMs: 1, typed: '', pulseAgeMs: undefined })

  assert.equal(widthFor(agents(1)), 72)
  assert.equal(line?.match(/x+…/)?.[0].length, 50)
  assert.equal(widthFor(agents(1, 'a-very-long-session-name'), 80), 80)
})

test('a small client limits the popup size', () => {
  const argv = popupArgv({ name: 'c', width: 30, height: 6 }, agents(40), [], '/run/x.lock')

  assert.equal(argv[argv.indexOf('-w') + 1], '30')
  assert.equal(argv[argv.indexOf('-h') + 1], '5')
})

test('every attached client gets a popup under its own lock', async () => {
  const started: (readonly string[])[] = []
  const clients = [['/dev/pts/2', '100', '40'], ['/dev/pts/3', '80', '30']].map(fields => fields.join(FIELD_SEPARATOR)).join('\n')

  await launchPopups(async () => clients, agents(2), ['@1'], argv => void started.push(argv))

  assert.deepEqual(started.map(argv => argv[argv.indexOf('-c') + 1]), ['/dev/pts/2', '/dev/pts/3'])
  assert.deepEqual(started.map(argv => argv[2]), [lockPath('/dev/pts/2'), lockPath('/dev/pts/3')])
})

test('no attached client means no popup', async () => {
  const started: unknown[] = []

  await launchPopups(async () => '', agents(2), ['@1'], argv => void started.push(argv))
  assert.deepEqual(started, [])
})

test('the conf hook records each state the agent sets', { skip: !hasTmux && 'tmux is not installed' }, async () => {
  after(() => tmux('kill-server'))
  tmux('-f', '/dev/null', 'new-session', '-d', '-s', 's')
  tmux('source-file', CONF)

  const seenBecomes = async (state: string) => {
    tmux('set-option', '-w', '-t', 's:0', '@agent_state', state)
    for (let waited = 0; waited < HOOK_WAIT_MS; waited += POLL_MS) {
      if (tmux('show-options', '-wqv', '-t', 's:0', '@agent_toast_seen') === state) return true
      await new Promise(resolve => setTimeout(resolve, POLL_MS))
    }
    return false
  }

  assert.ok(await seenBecomes('busy'))
  assert.ok(await seenBecomes('done'))
})
