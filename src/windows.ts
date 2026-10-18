import { execFile } from 'node:child_process'

export const SEEN_OPTION = '@agent_toast_seen'

export type AgentWindow = {
  id: string
  target: string
  name: string
  state: string
  harness: string
  session: string
  seen: string
}

export type Tmux = (args: readonly string[]) => Promise<string>

const FIELD_SEPARATOR = '\x1f'
const FIELDS: Record<keyof AgentWindow, string> = {
  id: '#{window_id}',
  target: '#{session_name}:#{window_index}',
  name: '#{window_name}',
  state: '#{@agent_state}',
  harness: '#{@agent_harness}',
  session: '#{@agent_session}',
  seen: `#{${SEEN_OPTION}}`,
}
const KEYS = Object.keys(FIELDS) as (keyof AgentWindow)[]

export const WINDOW_FORMAT = Object.values(FIELDS).join(FIELD_SEPARATOR)

export const tmux: Tmux = args =>
  new Promise((resolve, reject) =>
    execFile('tmux', args, { encoding: 'utf8' }, (error, stdout) => (error ? reject(error) : resolve(stdout))),
  )

function isAgent(window: AgentWindow): boolean {
  return window.harness !== '' || window.state !== '' || window.seen !== ''
}

export function parseWindows(text: string): AgentWindow[] {
  const byId = new Map<string, AgentWindow>()

  for (const line of text.split('\n').filter(Boolean)) {
    const values = line.split(FIELD_SEPARATOR)
    const window = Object.fromEntries(KEYS.map((key, i) => [key, values[i] ?? ''])) as AgentWindow

    if (!byId.has(window.id)) byId.set(window.id, window)
  }

  return [...byId.values()].filter(isAgent)
}

export async function listWindows(run: Tmux): Promise<AgentWindow[]> {
  return parseWindows(await run(['list-windows', '-a', '-F', WINDOW_FORMAT]))
}
