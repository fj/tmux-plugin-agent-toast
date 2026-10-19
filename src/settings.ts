import { FIELD_SEPARATOR, type Tmux } from './windows.ts'

export type Settings = { totalMs: number; wave: boolean }

export const DEFAULT_SETTINGS: Settings = { totalMs: 10_000, wave: true }

const MS_PER_SECOND = 1000
const OFF_VALUES = new Set(['off', 'no', 'false', '0'])
const SETTINGS_FORMAT = ['#{@agent_toast_timeout}', '#{@agent_toast_wave}'].join(FIELD_SEPARATOR)

function parseTotalMs(seconds: string): number {
  const value = Number(seconds)

  return seconds.trim() !== '' && Number.isFinite(value) && value > 0 ? value * MS_PER_SECOND : DEFAULT_SETTINGS.totalMs
}

function parseWave(flag: string): boolean {
  const value = flag.trim().toLowerCase()

  return value === '' ? DEFAULT_SETTINGS.wave : !OFF_VALUES.has(value)
}

export function parseSettings(text: string): Settings {
  const [timeout = '', wave = ''] = text.trim().split(FIELD_SEPARATOR)

  return { totalMs: parseTotalMs(timeout), wave: parseWave(wave) }
}

export async function readSettings(run: Tmux): Promise<Settings> {
  return run(['display-message', '-p', SETTINGS_FORMAT]).then(parseSettings, () => DEFAULT_SETTINGS)
}
