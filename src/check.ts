#!/usr/bin/env node
import { notifySettled } from './notify.ts'
import { tmux } from './windows.ts'

await notifySettled(tmux)
