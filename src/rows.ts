import { markOf, rowColumns, type Columns, type Row } from './frame.ts'
import { HARNESSES, labelOf, type Description, type Harness } from './harnesses/index.ts'
import type { AgentWindow } from './windows.ts'

export type Described = { window: AgentWindow; description: Description }
export type Describe = (window: AgentWindow) => Promise<Description>

export function cachedDescribe(describe: Describe): Describe {
  const descriptions = new Map<string, Promise<Description>>()

  return window => {
    const key = `${window.id}\n${window.harness}\n${window.session}`
    if (!descriptions.has(key)) descriptions.set(key, describe(window))
    return descriptions.get(key)!
  }
}

export function describeAll(windows: readonly AgentWindow[], newIds: ReadonlySet<string>, describe: Describe): Promise<Described[]> {
  const newFirst = windows.toSorted((a, b) => Number(newIds.has(b.id)) - Number(newIds.has(a.id)))

  return Promise.all(newFirst.map(async window => ({ window, description: await describe(window) })))
}

function targetOf(window: AgentWindow): string {
  return `${window.target} ${window.id}`
}

export function windowColumns(windows: readonly AgentWindow[], harnesses: readonly Harness[] = HARNESSES): Columns {
  return rowColumns(windows.map(window => ({ target: targetOf(window), label: labelOf(window, harnesses) })))
}

export function rowsAt(described: readonly Described[], newIds: ReadonlySet<string>, nowMs: number): Row[] {
  return described.map(({ window, description }) => ({
    mark: markOf(window.state, nowMs),
    target: targetOf(window),
    ...description,
    isNew: newIds.has(window.id),
  }))
}
