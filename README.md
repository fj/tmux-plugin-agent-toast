# tmux-plugin-agent-toast

A tmux plugin that shows a toast when a coding agent finishes work.

When an agent window goes from busy to waiting or done, a popup opens in the top-right corner of each attached client. It has an animated rainbow border and lists every agent window with its state, harness and a summary. Type `ok` to close it, or wait 10 seconds. Use the arrow keys to select an agent window, and press Enter to go to it. The timer stops while you use the arrow keys and resumes 3 seconds after the last one. If you press a key that is not part of `ok` and is not an arrow, a red wave pulses across the popup from the cursor.

## Install

With [TPM](https://github.com/tmux-plugins/tpm):

```tmux
set -g @plugin 'fj/tmux-plugin-agent-toast'
```

Or without TPM:

```tmux
source-file /path/to/tmux-plugin-agent-toast/agent-toast.conf
```

You need tmux 3.3 or newer, Node 22.18 or newer, and `flock` on `PATH`.

## Options

Set these global options in your tmux config:

| Option | Default | Value |
|---|---|---|
| `@agent_toast_timeout` | `10` | Seconds before the popup closes. |
| `@agent_toast_wave` | `on` | `off` stops the wave when you press a wrong key. |

```tmux
set -g @agent_toast_timeout 20
set -g @agent_toast_wave off
```

## Feed it

The plugin does not watch agents itself. Something must set these window options on the window of each agent:

| Option | Value |
|---|---|
| `@agent_state` | `busy`, `waiting` or `done`. Unset when no agent runs. |
| `@agent_harness` | The harness name, for example `claude` or `pi`. |
| `@agent_session` | A session reference that the harness strategy understands. |

[mod-jxf-tmux-spinner](https://github.com/fj/agent-plugins/tree/main/mod-jxf-tmux-spinner) sets them for Claude Code and pi.

## Summaries

A harness strategy in `src/harnesses/` reads the session that `@agent_session` names:

| Harness | `@agent_session` | Summary |
|---|---|---|
| `claude` | The session id. | The custom title, the AI title, the summary, or the last prompt of the transcript. |
| `pi` | The session file. | The session name, or the first prompt. |
| Other | Not used. | The pane title. |

When a harness gives no summary, the toast uses the pane title without its leading status glyphs, then the window name.

To add a harness, add a `Harness` to `HARNESSES` in `src/harnesses/index.ts`.

## Test

```sh
node --test 'test/**/*.spec.ts'
```

## Limits

- The popup takes the keyboard until it closes.
- The toast misses a busy state shorter than the time Node takes to start.
