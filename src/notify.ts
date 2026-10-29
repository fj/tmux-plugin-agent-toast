import { launchPopups } from './launch.ts'
import { justSettled, markSeenArgs } from './transitions.ts'
import { listWindows, type AgentWindow, type Tmux } from './windows.ts'

export type Launch = (run: Tmux, windows: readonly AgentWindow[], newIds: readonly string[]) => Promise<void>

export async function notifySettled(run: Tmux, launch: Launch = launchPopups): Promise<void> {
  const windows = await listWindows(run)
  const settled = justSettled(windows)
  const markSeen = markSeenArgs(windows)

  if (markSeen.length > 0) await run(markSeen)
  if (settled.length > 0) await launch(run, windows, settled.map(({ id }) => id))
}
