import { COMMAND_SEPARATOR, SEEN_OPTION, type AgentWindow } from './windows.ts'

const BUSY = 'busy'
const SETTLED_STATES = new Set(['waiting', 'done'])

export function justSettled(windows: readonly AgentWindow[]): AgentWindow[] {
  return windows.filter(window => window.seen === BUSY && SETTLED_STATES.has(window.state))
}

export function markSeenArgs(windows: readonly AgentWindow[]): string[] {
  return windows
    .filter(window => window.seen !== window.state)
    .flatMap(({ id, state }) =>
      state === ''
        ? [COMMAND_SEPARATOR, 'set-option', '-wu', '-t', id, SEEN_OPTION]
        : [COMMAND_SEPARATOR, 'set-option', '-w', '-t', id, SEEN_OPTION, state],
    )
    .slice(1)
}
