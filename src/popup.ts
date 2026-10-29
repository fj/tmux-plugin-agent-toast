#!/usr/bin/env node
import { renderFrame } from './frame.ts'
import { describe } from './harnesses/index.ts'
import { keyReader, parseKeys } from './input.ts'
import { parsePopupArgs } from './launch.ts'
import { cachedDescribe, describeAll, rowsAt, type Described } from './rows.ts'
import { readSettings } from './settings.ts'
import { isExpired, pressToast, startToast, toastRemainingMs, type Timing } from './toast.ts'
import { focusArgs, listWindows, tmux } from './windows.ts'

const FRAME_MS = 40
const REFRESH_MS = 1000
const ESCAPE_WAIT_MS = 50
const ARROW_HOLD_MS = 3000
const TITLE = 'agents'
const HIDE_CURSOR = '\x1b[?25l'
const SHOW_CURSOR = '\x1b[?25h'
const HOME = '\x1b[H'

const { client, newIds: settledIds } = parsePopupArgs(process.argv.slice(2))
const newIds = new Set(settledIds)
const describeWindow = cachedDescribe(describe)
let toast = startToast(Date.now())
const settings = await readSettings(tmux)
const timing: Timing = { totalMs: settings.totalMs, holdMs: ARROW_HOLD_MS, wave: settings.wave }
let described: Described[] = []

async function refresh(): Promise<void> {
  const windows = await listWindows(tmux).catch(() => described.map(({ window }) => window))
  described = await describeAll(windows, newIds, describeWindow)
}

function draw(): void {
  const nowMs = Date.now()

  if (isExpired(toast, timing, nowMs)) close()
  const lines = renderFrame({
    width: process.stdout.columns,
    height: process.stdout.rows,
    nowMs,
    title: TITLE,
    rows: rowsAt(described, newIds, toast.keys.selectedId, nowMs),
    remainingMs: toastRemainingMs(toast, timing, nowMs),
    totalMs: settings.totalMs,
    typed: toast.keys.typed,
    pulseAgeMs: toast.mistypedAtMs === undefined ? undefined : nowMs - toast.mistypedAtMs,
  })

  process.stdout.write(HOME + lines.join('\r\n'))
}

function close(): never {
  process.stdout.write(SHOW_CURSOR)
  process.exit(0)
}

async function press(data: string): Promise<void> {
  const pressed = pressToast(toast, parseKeys(data), described.map(({ window }) => window.id), timing, Date.now())

  toast = pressed.toast
  if (pressed.effect?.kind === 'close') close()
  if (pressed.effect?.kind === 'focus') {
    await tmux(focusArgs(client, pressed.effect.windowId)).catch(() => undefined)
    close()
  }
  draw()
}

process.stdout.write(HIDE_CURSOR)
process.stdin.setRawMode(true)
process.stdin.setEncoding('utf8')
process.stdin.on('data', keyReader(data => void press(data), ESCAPE_WAIT_MS))

await refresh()
setInterval(refresh, REFRESH_MS)
setInterval(draw, FRAME_MS)
draw()
