import { readFile } from 'node:fs/promises'

import { jsonLines, stringField, type Entry, type Harness } from './harness.ts'

type Block = { type?: string; text?: string }
type Message = { role?: string; content?: string | Block[] }

function textOf({ content = '' }: Message): string {
  return typeof content === 'string'
    ? content
    : content.flatMap(block => (block.type === 'text' && block.text ? [block.text] : [])).join(' ')
}

function firstPrompt(entries: readonly Entry[]): string | undefined {
  const message = entries.find(entry => entry.type === 'message' && (entry.message as Message | undefined)?.role === 'user')
  const text = message === undefined ? '' : textOf(message.message as Message)

  return text.trim() === '' ? undefined : text
}

export function piSummary(entries: readonly Entry[]): string | undefined {
  const named = entries.findLast(entry => entry.type === 'session_info' && stringField(entry, 'name'))

  return stringField(named, 'name') ?? firstPrompt(entries)
}

export function piHarness(): Harness {
  return {
    name: 'pi',
    label: 'Pi',
    summarize: async sessionFile => (sessionFile === '' ? undefined : piSummary(jsonLines(await readFile(sessionFile, 'utf8')))),
  }
}
