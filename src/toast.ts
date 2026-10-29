import { hold, remainingMs, startCountdown, type Countdown } from './countdown.ts'
import { pressKeys, type Key, type KeyState } from './input.ts'

export type Toast = {
  keys: KeyState
  countdown: Countdown
  mistypedAtMs: number | undefined
  isFocusing: boolean
}

export type Effect = { kind: 'close' } | { kind: 'focus'; windowId: string } | undefined

export type Timing = { totalMs: number; holdMs: number; wave: boolean }

export function startToast(nowMs: number): Toast {
  return { keys: { typed: '', selectedId: undefined }, countdown: startCountdown(nowMs), mistypedAtMs: undefined, isFocusing: false }
}

export function toastRemainingMs(toast: Toast, timing: Timing, nowMs: number): number {
  return remainingMs(toast.countdown, timing.totalMs, nowMs)
}

export function isExpired(toast: Toast, timing: Timing, nowMs: number): boolean {
  return toastRemainingMs(toast, timing, nowMs) === 0
}

export function pressToast(toast: Toast, keys: readonly Key[], ids: readonly string[], timing: Timing, nowMs: number): { toast: Toast; effect: Effect } {
  if (toast.isFocusing) return { toast, effect: undefined }

  const { state, action } = pressKeys(toast.keys, keys, ids)
  const moved = keys.some(key => key.kind === 'move')
  const next: Toast = {
    keys: state,
    countdown: moved ? hold(toast.countdown, nowMs, timing.holdMs) : toast.countdown,
    mistypedAtMs: action === 'pulse' && timing.wave ? nowMs : toast.mistypedAtMs,
    isFocusing: action === 'focus',
  }

  if (action === 'close') return { toast: next, effect: { kind: 'close' } }
  if (action === 'focus' && state.selectedId !== undefined) return { toast: next, effect: { kind: 'focus', windowId: state.selectedId } }
  return { toast: next, effect: undefined }
}
