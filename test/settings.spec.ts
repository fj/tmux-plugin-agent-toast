import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { after, test } from 'node:test'

import { DEFAULT_SETTINGS, parseSettings, readSettings } from '../src/settings.ts'
import { FIELD_SEPARATOR } from '../src/windows.ts'

const SOCKET = `tmux-toast-settings-test-${process.pid}`
const settingsText = (timeout: string, wave: string) => `${timeout}${FIELD_SEPARATOR}${wave}\n`
const hasTmux = (() => {
  try {
    execFileSync('tmux', ['-V'])
    return true
  } catch {
    return false
  }
})()

test('unset options give the defaults', () => {
  assert.deepEqual(parseSettings(settingsText('', '')), DEFAULT_SETTINGS)
})

test('the timeout is in seconds and must be positive', () => {
  assert.equal(parseSettings(settingsText('30', '')).totalMs, 30_000)
  assert.equal(parseSettings(settingsText('2.5', '')).totalMs, 2500)
  assert.equal(parseSettings(settingsText('0', '')).totalMs, DEFAULT_SETTINGS.totalMs)
  assert.equal(parseSettings(settingsText('-1', '')).totalMs, DEFAULT_SETTINGS.totalMs)
  assert.equal(parseSettings(settingsText('soon', '')).totalMs, DEFAULT_SETTINGS.totalMs)
})

test('the wave turns off with any tmux-style off value', () => {
  for (const off of ['off', 'OFF', 'no', 'false', '0']) assert.equal(parseSettings(settingsText('', off)).wave, false)
  for (const on of ['on', 'yes', 'true', '1']) assert.equal(parseSettings(settingsText('', on)).wave, true)
})

test('a failed tmux call gives the defaults', async () => {
  assert.deepEqual(await readSettings(async () => Promise.reject(new Error('no server'))), DEFAULT_SETTINGS)
})

test('the settings come from global tmux options', { skip: !hasTmux && 'tmux is not installed' }, async () => {
  const tmux = (...args: string[]) => execFileSync('tmux', ['-L', SOCKET, ...args], { encoding: 'utf8' })
  after(() => tmux('kill-server'))
  tmux('-f', '/dev/null', 'new-session', '-d', '-s', 's')
  tmux('set-option', '-g', '@agent_toast_timeout', '20')
  tmux('set-option', '-g', '@agent_toast_wave', 'off')

  assert.deepEqual(await readSettings(async args => tmux(...args)), { totalMs: 20_000, wave: false })
})
