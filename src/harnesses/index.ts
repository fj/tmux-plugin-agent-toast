import { homedir } from 'node:os'
import { join } from 'node:path'

import type { AgentWindow } from '../windows.ts'
import { claudeHarness } from './claude.ts'
import type { Harness } from './harness.ts'
import { piHarness } from './pi.ts'

export type { Harness } from './harness.ts'

export type Description = { label: string; summary: string }

const FALLBACK_LABEL = 'tmux'

export const HARNESSES: readonly Harness[] = [
  claudeHarness(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude')),
  piHarness(),
]

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export async function describe(window: AgentWindow, harnesses: readonly Harness[] = HARNESSES): Promise<Description> {
  const harness = harnesses.find(({ name }) => name === window.harness)
  const summary = harness === undefined ? undefined : await harness.summarize(window.session).catch(() => undefined)

  return {
    label: harness?.label ?? (window.harness || FALLBACK_LABEL),
    summary: oneLine(summary ?? window.name),
  }
}
