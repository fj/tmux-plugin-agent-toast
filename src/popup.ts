#!/usr/bin/env node
import { renderFrame } from './frame.ts'
import { describe } from './harnesses/index.ts'
import { isAcknowledged, typedAfter } from './input.ts'
import { cachedDescribe, describeAll, rowsAt, type Described } from './rows.ts'
import { readSettings } from './settings.ts'
import { listWindows, tmux } from './windows.ts'

const FRAME_MS = 100
const REFRESH_MS = 1000
const TITLE = 'agents'
const HIDE_CURSOR = '\x1b[?25l'
const SHOW_CURSOR = '\x1b[?25h'
const HOME = '\x1b[H'

const newIds = new Set(process.argv.slice(2))
const describeWindow = cachedDescribe(describe)
const startMs = Date.now()
const settings = await readSettings(tmux)
let described: Described[] = []
let typed = ''

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
    rows: rowsAt(described, newIds, nowMs),
    remainingMs: Math.max(0, settings.totalMs - (nowMs - startMs)),
    totalMs: settings.totalMs,
    typed,
  })

  process.stdout.write(HOME + lines.join('\r\n'))
}

function close(): never {
  process.stdout.write(SHOW_CURSOR)
  process.exit(0)
}

process.stdout.write(HIDE_CURSOR)
process.stdin.setRawMode(true)
process.stdin.setEncoding('utf8')
process.stdin.on('data', (keys: string) => {
  typed = typedAfter(typed, keys)
  if (isAcknowledged(typed)) close()
})

await refresh()
setInterval(refresh, REFRESH_MS)
setInterval(draw, FRAME_MS)
setTimeout(close, settings.totalMs)
draw()
