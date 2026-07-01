#!/bin/zsh
set -euo pipefail

TMP_DIR="${TMPDIR:-/tmp}"
PID_FILE="$TMP_DIR/personal-ai-os.pid"
PORT_FILE="$TMP_DIR/personal-ai-os.port"

if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "${PID:-}" ] && kill -0 "$PID" >/dev/null 2>&1; then
    kill "$PID"
    sleep 1
    if kill -0 "$PID" >/dev/null 2>&1; then
      kill -9 "$PID" || true
    fi
    echo "已关闭 Personal AI OS (PID: $PID)"
  else
    echo "未找到正在运行的 Personal AI OS 进程。"
  fi
  rm -f "$PID_FILE"
else
  echo "未找到 PID 文件，可能尚未启动。"
fi

if [ -f "$PORT_FILE" ]; then
  PORT="$(cat "$PORT_FILE" 2>/dev/null || true)"
  if [ -n "${PORT:-}" ]; then
    echo "最近使用端口：$PORT"
  fi
  rm -f "$PORT_FILE"
fi
