import { moveSelection } from './selection.ts'

export const ACKNOWLEDGEMENT = 'ok'

export type Key =
  | { kind: 'text'; char: string }
  | { kind: 'erase' }
  | { kind: 'move'; step: number }
  | { kind: 'other' }

const ERASE_KEYS = new Set(['\x7f', '\b'])
const ARROW_STEPS = new Map([
  ['\x1b[A', -1],
  ['\x1b[D', -1],
  ['\x1bOA', -1],
  ['\x1bOD', -1],
  ['\x1b[B', 1],
  ['\x1b[C', 1],
  ['\x1bOB', 1],
  ['\x1bOC', 1],
])
const ESCAPE_SEQUENCE = /\x1b(?:\[[0-?]*[ -/]*[@-~]|O[@-~])?/y
const INCOMPLETE_ESCAPE = /\x1b(?:\[[0-?]*[ -/]*|O)?$/
const PRINTABLE = /^\P{C}$/u

function keyOf(sequence: string): Key {
  const step = ARROW_STEPS.get(sequence)

  if (step !== undefined) return { kind: 'move', step }
  if (ERASE_KEYS.has(sequence)) return { kind: 'erase' }
  if (PRINTABLE.test(sequence)) return { kind: 'text', char: sequence }
  return { kind: 'other' }
}

export function parseKeys(data: string): Key[] {
  const keys: Key[] = []

  for (let i = 0; i < data.length; ) {
    ESCAPE_SEQUENCE.lastIndex = i
    const sequence = ESCAPE_SEQUENCE.exec(data)?.[0] ?? String.fromCodePoint(data.codePointAt(i) ?? 0)
    keys.push(keyOf(sequence))
    i += sequence.length
  }

  return keys
}

export function typedAfter(typed: string, keys: readonly Key[]): string {
  let next = typed

  for (const key of keys) {
    if (key.kind === 'erase') next = [...next].slice(0, -1).join('')
    else if (key.kind === 'text') next = [...next, key.char].slice(-ACKNOWLEDGEMENT.length).join('')
  }

  return next
}

export function isAcknowledged(typed: string): boolean {
  return typed.toLowerCase() === ACKNOWLEDGEMENT
}

function isOnTrack(typed: string): boolean {
  const lower = typed.toLowerCase()

  return [...lower].some((_, i) => ACKNOWLEDGEMENT.startsWith(lower.slice(i)))
}

export function isMistyped(keys: readonly Key[], typed: string): boolean {
  const typing = keys.filter(key => key.kind === 'text' || key.kind === 'other')

  return typing.length > 0 && (typing.some(key => key.kind === 'other') || !isOnTrack(typed))
}

export type KeyState = { typed: string; selectedId: string | undefined }
export type KeyAction = 'close' | 'pulse' | undefined

export function pressKeys(state: KeyState, keys: readonly Key[], ids: readonly string[]): { state: KeyState; action: KeyAction } {
  const typed = typedAfter(state.typed, keys)
  const current = state.selectedId !== undefined && ids.includes(state.selectedId) ? state.selectedId : undefined
  const selectedId = keys.reduce((id, key) => (key.kind === 'move' ? moveSelection(ids, id, key.step) : id), current)
  const next = { typed, selectedId }

  if (isAcknowledged(typed)) return { state: next, action: 'close' }
  return { state: next, action: isMistyped(keys, typed) ? 'pulse' : undefined }
}

export function splitPending(data: string): { complete: string; pending: string } {
  const pending = INCOMPLETE_ESCAPE.exec(data)?.[0] ?? ''

  return { complete: data.slice(0, data.length - pending.length), pending }
}

export function keyReader(press: (data: string) => void, waitMs: number): (data: string) => void {
  let pending = ''
  let timer: ReturnType<typeof setTimeout> | undefined

  const flush = () => {
    const data = pending
    pending = ''
    press(data)
  }

  return data => {
    const split = splitPending(pending + data)

    clearTimeout(timer)
    pending = split.pending
    press(split.complete)
    if (pending !== '') timer = setTimeout(flush, waitMs)
  }
}
