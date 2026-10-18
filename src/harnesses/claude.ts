import { access, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { jsonLines, stringField, type Entry, type Harness } from './harness.ts'

const SESSION_ID = /^[\w-]+$/
const TITLES = [
  { type: 'custom-title', field: 'customTitle' },
  { type: 'ai-title', field: 'aiTitle' },
  { type: 'summary', field: 'summary' },
  { type: 'last-prompt', field: 'lastPrompt' },
]

export function claudeSummary(entries: readonly Entry[]): string | undefined {
  for (const { type, field } of TITLES) {
    const title = stringField(entries.findLast(entry => entry.type === type && stringField(entry, field)), field)
    if (title !== undefined) return title
  }

  return undefined
}

async function transcriptOf(configDir: string, sessionId: string): Promise<string | undefined> {
  const projects = join(configDir, 'projects')

  for (const project of await readdir(projects)) {
    const path = join(projects, project, `${sessionId}.jsonl`)
    if (await access(path).then(() => true, () => false)) return path
  }

  return undefined
}

export function claudeHarness(configDir: string): Harness {
  return {
    name: 'claude',
    label: 'Claude',
    summarize: async sessionId => {
      if (!SESSION_ID.test(sessionId)) return undefined

      const path = await transcriptOf(configDir, sessionId)
      return path === undefined ? undefined : claudeSummary(jsonLines(await readFile(path, 'utf8')))
    },
  }
}
