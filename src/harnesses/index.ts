import { homedir, hostname } from 'node:os'
import { join } from 'node:path'

import type { AgentWindow } from '../windows.ts'
import { claudeHarness } from './claude.ts'
import type { Harness } from './harness.ts'
import { piHarness } from './pi.ts'

export type { Harness } from './harness.ts'

export type Description = { label: string; summary: string }

const FALLBACK_LABEL = 'tmux'
const TITLE_DECORATION = /^[^\p{L}\p{N}]+/u

export const HARNESSES: readonly Harness[] = [
  claudeHarness(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude')),
  piHarness(),
]

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function paneTitle(title: string, host: string): string | undefined {
  const text = title.replace(TITLE_DECORATION, '')
  const isHost = title === host || title === host.split('.')[0]

  return isHost || text.trim() === '' ? undefined : text
}

function harnessOf(window: AgentWindow, harnesses: readonly Harness[]): Harness | undefined {
  return harnesses.find(({ name }) => name === window.harness)
}

function labelFor(window: AgentWindow, harness: Harness | undefined): string {
  return harness?.label ?? (window.harness || FALLBACK_LABEL)
}

export function labelOf(window: AgentWindow, harnesses: readonly Harness[] = HARNESSES): string {
  return labelFor(window, harnessOf(window, harnesses))
}

export async function describe(window: AgentWindow, harnesses: readonly Harness[] = HARNESSES, host = hostname()): Promise<Description> {
  const harness = harnessOf(window, harnesses)
  const summary = harness === undefined ? undefined : await harness.summarize(window.session).catch(() => undefined)

  return {
    label: labelFor(window, harness),
    summary: oneLine(summary ?? paneTitle(window.title, host) ?? window.name),
  }
}
