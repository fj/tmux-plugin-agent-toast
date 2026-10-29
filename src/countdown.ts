export type Countdown = { spentMs: number; atMs: number; holdUntilMs: number }

export function startCountdown(nowMs: number): Countdown {
  return { spentMs: 0, atMs: nowMs, holdUntilMs: nowMs }
}

function advance(countdown: Countdown, nowMs: number): Countdown {
  const runningFromMs = Math.max(countdown.atMs, countdown.holdUntilMs)

  return { ...countdown, spentMs: countdown.spentMs + Math.max(0, nowMs - runningFromMs), atMs: nowMs }
}

export function hold(countdown: Countdown, nowMs: number, holdMs: number): Countdown {
  return { ...advance(countdown, nowMs), holdUntilMs: nowMs + holdMs }
}

export function remainingMs(countdown: Countdown, totalMs: number, nowMs: number): number {
  return Math.max(0, totalMs - advance(countdown, nowMs).spentMs)
}
