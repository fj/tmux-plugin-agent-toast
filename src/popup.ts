#!/usr/bin/env node
import { renderFrame } from './frame.ts'
import { describe } from './harnesses/index.ts'
import { keyReader, parseKeys, pressKeys, type KeyState } from './input.ts'
import { parsePopupArgs } from './launch.ts'
import { cachedDescribe, describeAll, rowsAt, type Described } from './rows.ts'
import { readSettings } from './settings.ts'
import { focusArgs, listWindows, tmux } from './windows.ts'

const FRAME_MS = 40
const REFRESH_MS = 1000
const ESCAPE_WAIT_MS = 50
const TITLE = 'agents'
const HIDE_CURSOR = '\x1b[?25l'
const SHOW_CURSOR = '\x1b[?25h'
const HOME = '\x1b[H'

const { client, newIds: settledIds } = parsePopupArgs(process.argv.slice(2))
const newIds = new Set(settledIds)
const describeWindow = cachedDescribe(describe)
const startMs = Date.now()
const settings = await readSettings(tmux)
let described: Described[] = []
let keyState: KeyState = { typed: '', selectedId: undefined }
let mistypedAtMs: number | undefined
let focusing = false

async function refresh(): Promise<void> {
  const windows = await listWindows(tmux).catch(() => described.map(({ window }) => window))
  described = await describeAll(windows, newIds, describeWindow)
}

function draw(): void {
  const nowMs = Date.now()
  const lines = renderFrame({
    width: process.stdout.columns,
    height: process.stdout.rows,
    nowMs,
    title: TITLE,
    rows: rowsAt(described, newIds, keyState.selectedId, nowMs),
    remainingMs: Math.max(0, settings.totalMs - (nowMs - startMs)),
    totalMs: settings.totalMs,
    typed: keyState.typed,
    pulseAgeMs: mistypedAtMs === undefined ? undefined : nowMs - mistypedAtMs,
  })

  process.stdout.write(HOME + lines.join('\r\n'))
}

function close(): never {
  process.stdout.write(SHOW_CURSOR)
  process.exit(0)
}

async function press(data: string): Promise<void> {
  if (focusing) return

  const { state, action } = pressKeys(keyState, parseKeys(data), described.map(({ window }) => window.id))

  keyState = state
  if (action === 'close') close()
  if (action === 'focus' && state.selectedId !== undefined) {
    focusing = true
    await tmux(focusArgs(client, state.selectedId)).catch(() => undefined)
    close()
  }
  if (action === 'pulse' && settings.wave) mistypedAtMs = Date.now()
  draw()
}

process.stdout.write(HIDE_CURSOR)
process.stdin.setRawMode(true)
process.stdin.setEncoding('utf8')
process.stdin.on('data', keyReader(data => void press(data), ESCAPE_WAIT_MS))

await refresh()
setInterval(refresh, REFRESH_MS)
setInterval(draw, FRAME_MS)
setTimeout(close, settings.totalMs)
draw()
