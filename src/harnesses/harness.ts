export type Entry = Record<string, unknown>

export type Harness = {
  name: string
  label: string
  summarize: (session: string) => Promise<string | undefined>
}

export function jsonLines(text: string): Entry[] {
  return text.split('\n').flatMap(line => {
    try {
      const value: unknown = JSON.parse(line)
      return typeof value === 'object' && value !== null ? [value as Entry] : []
    } catch {
      return []
    }
  })
}

export function stringField(entry: Entry | undefined, field: string): string | undefined {
  const value = entry?.[field]
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}
