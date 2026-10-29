import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { CHROME_LINES, frameWidth, type Columns } from './frame.ts'
import { windowColumns } from './rows.ts'
import { FIELD_SEPARATOR, type AgentWindow, type Tmux } from './windows.ts'

export type Client = { name: string; width: number; height: number }

export const POPUP = join(import.meta.dirname, 'popup.ts')

const MIN_WIDTH = 72
const MIN_SUMMARY_CELLS = 50
const MAX_ROWS = 10
const STATUS_LINE_ROWS = 1
const CLIENT_FORMAT = ['#{client_name}', '#{client_width}', '#{client_height}'].join(FIELD_SEPARATOR)

export function parseClients(text: string): Client[] {
  return text
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const [name = '', width = '0', height = '0'] = line.split(FIELD_SEPARATOR)
      return { name, width: Number(width), height: Number(height) }
    })
}

export function lockPath(client: string, dir = tmpdir()): string {
  return join(dir, `agent-toast-${process.getuid?.() ?? 0}-${client.replace(/\W/g, '_')}.lock`)
}

function popupWidth(columns: Columns): number {
  return Math.max(MIN_WIDTH, frameWidth(columns, MIN_SUMMARY_CELLS))
}

export function popupArgv(client: Client, windows: readonly AgentWindow[], newIds: readonly string[], lock: string): string[] {
  const width = Math.min(popupWidth(windowColumns(windows)), client.width)
  const height = Math.min(Math.min(Math.max(windows.length, 1), MAX_ROWS) + CHROME_LINES, client.height - STATUS_LINE_ROWS)

  return [
    'flock', '-n', lock,
    'tmux', 'display-popup', '-c', client.name, '-B', '-x', 'R', '-y', '0', '-w', `${width}`, '-h', `${height}`, '-E',
    process.execPath, POPUP, ...newIds,
  ]
}

export type Spawn = (argv: readonly string[]) => void

const spawnDetached: Spawn = ([file = '', ...args]) => spawn(file, args, { detached: true, stdio: 'ignore' }).unref()

export async function launchPopups(run: Tmux, windows: readonly AgentWindow[], newIds: readonly string[], start: Spawn = spawnDetached): Promise<void> {
  for (const client of parseClients(await run(['list-clients', '-F', CLIENT_FORMAT]))) {
    start(popupArgv(client, windows, newIds, lockPath(client.name)))
  }
}
