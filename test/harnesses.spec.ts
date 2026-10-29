import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { claudeHarness, claudeSummary } from '../src/harnesses/claude.ts'
import { jsonLines } from '../src/harnesses/harness.ts'
import { describe, type Harness } from '../src/harnesses/index.ts'
import { piHarness, piSummary } from '../src/harnesses/pi.ts'
import type { AgentWindow } from '../src/windows.ts'

const jsonl = (...entries: object[]) => entries.map(entry => JSON.stringify(entry)).join('\n')
const window = (harness: string, session = 'x'): AgentWindow => ({ id: '@1', target: 's:1', name: 'win', state: 'done', harness, session, seen: 'done', title: '' })

test('broken JSON lines are skipped', () => {
  assert.deepEqual(jsonLines('{"a":1}\nnot json\n\n3\n{"b":2}'), [{ a: 1 }, { b: 2 }])
})

test('a Claude title prefers a custom title, then the latest AI title, then the last prompt', () => {
  const prompt = { type: 'last-prompt', lastPrompt: 'fix it' }
  const ai = (aiTitle: string) => ({ type: 'ai-title', aiTitle })

  assert.equal(claudeSummary([prompt]), 'fix it')
  assert.equal(claudeSummary([ai('Old'), prompt, ai('New')]), 'New')
  assert.equal(claudeSummary([{ type: 'custom-title', customTitle: 'Mine' }, ai('New')]), 'Mine')
  assert.equal(claudeSummary([{ type: 'summary', summary: 'Recap' }, prompt]), 'Recap')
  assert.equal(claudeSummary([{ type: 'summary', summary: 'Recap' }, ai('New')]), 'New')
  assert.equal(claudeSummary([{ type: 'user' }]), undefined)
})

test('a Pi summary prefers the session name, then the first prompt', () => {
  const prompt = { type: 'message', message: { role: 'user', content: [{ type: 'text', text: 'fix it' }] } }

  assert.equal(piSummary([{ type: 'session' }, prompt]), 'fix it')
  assert.equal(piSummary([prompt, { type: 'session_info', name: 'Fixer' }]), 'Fixer')
  assert.equal(piSummary([{ type: 'session' }]), undefined)
})

test('the Claude harness finds a transcript by session id in any project', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'toast-claude-'))

  try {
    await mkdir(join(dir, 'projects', '-work'), { recursive: true })
    await writeFile(join(dir, 'projects', '-work', 'abc-1.jsonl'), jsonl({ type: 'ai-title', aiTitle: 'Build the toast' }))
    const harness = claudeHarness(dir)

    assert.equal(await harness.summarize('abc-1'), 'Build the toast')
    assert.equal(await harness.summarize('missing'), undefined)
    assert.equal(await harness.summarize('../x'), undefined)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('the Pi harness reads its session file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'toast-pi-'))

  try {
    const file = join(dir, 's.jsonl')
    await writeFile(file, jsonl({ type: 'session_info', name: 'Fixer' }))

    assert.equal(await piHarness().summarize(file), 'Fixer')
    assert.equal(await piHarness().summarize(''), undefined)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a window is described by the strategy for its harness', async () => {
  const echo: Harness = { name: 'echo', label: 'Echo', summarize: async session => `said\n  ${session}` }

  assert.deepEqual(await describe(window('echo', 'hi'), [echo]), { label: 'Echo', summary: 'said hi' })
})

test('without a summary the window name is used', async () => {
  const silent: Harness = { name: 'silent', label: 'Silent', summarize: async () => undefined }
  const broken: Harness = { name: 'broken', label: 'Broken', summarize: () => Promise.reject(new Error('no file')) }

  assert.deepEqual(await describe(window('silent'), [silent]), { label: 'Silent', summary: 'win' })
  assert.deepEqual(await describe(window('broken'), [broken]), { label: 'Broken', summary: 'win' })
})

test('an unknown harness keeps its name, and no harness reads as tmux', async () => {
  assert.deepEqual(await describe(window('opencode'), []), { label: 'opencode', summary: 'win' })
  assert.deepEqual(await describe(window(''), []), { label: 'tmux', summary: 'win' })
})

test('without a summary the pane title is used, minus its status glyphs', async () => {
  const titled = (title: string) => ({ ...window(''), title })

  assert.equal((await describe(titled('✳ Add Session Name'), [])).summary, 'Add Session Name')
  assert.equal((await describe(titled('⠐ Fix it'), [])).summary, 'Fix it')
  assert.equal((await describe(titled('π - Fix it - repo'), [])).summary, 'π - Fix it - repo')
  assert.equal((await describe(titled('✳ '), [])).summary, 'win')
})

test('a harness summary wins over the pane title', async () => {
  const echo: Harness = { name: 'echo', label: 'Echo', summarize: async () => 'from harness' }

  assert.equal((await describe({ ...window('echo'), title: '✳ from title' }, [echo])).summary, 'from harness')
})

test('a pane title that is only the host name is skipped', async () => {
  const titled = (title: string) => ({ ...window(''), title })

  assert.equal((await describe(titled('box.example.com'), [], 'box.example.com')).summary, 'win')
  assert.equal((await describe(titled('box'), [], 'box.example.com')).summary, 'win')
  assert.equal((await describe(titled('✳ Fix it'), [], 'box.example.com')).summary, 'Fix it')
})
