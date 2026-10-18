#!/bin/sh
tmux source-file "$(cd "$(dirname "$0")" && pwd)/agent-toast.conf"
