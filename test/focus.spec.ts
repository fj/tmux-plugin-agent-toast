import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { after, test } from 'node:test'

import { focusArgs } from '../src/windows.ts'

const SOCKET = `tmux-toast-focus-test-${process.pid}`
const ATTACH_WAIT_MS = 3000
const POLL_MS = 50

const tmux = (...args: string[]) => execFileSync('tmux', ['-L', SOCKET, ...args], { encoding: 'utf8' }).trim()
const has = (command: string) => {
  try {
    execFileSync('sh', ['-c', `command -v ${command}`])
    return true
  } catch {
    return false
  }
}

test('focus moves the client to the window in another session', { skip: !(has('tmux') && has('script')) && 'tmux or script is not installed' }, async () => {
  after(() => tmux('kill-server'))
  tmux('-f', '/dev/null', 'new-session', '-d', '-s', 'here')
  tmux('new-session', '-d', '-s', 'there')
  const target = tmux('new-window', '-d', '-P', '-F', '#{window_id}', '-t', 'there')
  spawn('script', ['-qc', `tmux -L ${SOCKET} attach -t here`, '/dev/null'], { stdio: 'ignore', env: { ...process.env, TERM: 'xterm-256color' } })

  let client = ''
  for (let waited = 0; client === '' && waited < ATTACH_WAIT_MS; waited += POLL_MS) {
    await new Promise(resolve => setTimeout(resolve, POLL_MS))
    client = tmux('list-clients', '-F', '#{client_name}')
  }

  assert.notEqual(client, '', 'no client attached')
  tmux(...focusArgs(client, target))
  assert.equal(tmux('display-message', '-p', '-c', client, '#{session_name} #{window_id}'), `there ${target}`)
})
