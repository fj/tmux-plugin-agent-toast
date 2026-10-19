import type { Tmux } from './windows.ts'

export type Settings = { totalMs: number }

export const DEFAULT_SETTINGS: Settings = { totalMs: 10_000 }

const MS_PER_SECOND = 1000
const SETTINGS_FORMAT = '#{@agent_toast_timeout}'

function parseTotalMs(seconds: string): number {
  const value = Number(seconds)

  return seconds.trim() !== '' && Number.isFinite(value) && value > 0 ? value * MS_PER_SECOND : DEFAULT_SETTINGS.totalMs
}

export function parseSettings(text: string): Settings {
  return { totalMs: parseTotalMs(text.trim()) }
}

export async function readSettings(run: Tmux): Promise<Settings> {
  return run(['display-message', '-p', SETTINGS_FORMAT]).then(parseSettings, () => DEFAULT_SETTINGS)
}
