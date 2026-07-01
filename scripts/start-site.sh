#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"
TMP_DIR="${TMPDIR:-/tmp}"
PID_FILE="$TMP_DIR/personal-ai-os.pid"
PORT_FILE="$TMP_DIR/personal-ai-os.port"
LOG_FILE="$LOG_DIR/site-start.log"
DEFAULT_PORT=3000

mkdir -p "$LOG_DIR"
cd "$ROOT_DIR"

echo "Personal AI OS 正在启动..."

if [ ! -d "node_modules" ]; then
  echo "未检测到 node_modules，正在执行 npm install..."
  npm install
fi

if [ ! -f ".env.local" ]; then
  echo "未检测到 .env.local，已跳过自动创建，建议补充本地 DeepSeek 配置。"
fi

PORT="$DEFAULT_PORT"
while lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

if [ "$PORT" -ne "$DEFAULT_PORT" ]; then
  echo "端口 3000 被占用，已改用 $PORT 启动。"
else
  echo "端口 3000 可用。"
fi

printf '%s' "$PORT" > "$PORT_FILE"

if [ -f "$PID_FILE" ]; then
  OLD_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "${OLD_PID:-}" ] && kill -0 "$OLD_PID" >/dev/null 2>&1; then
    echo "检测到旧服务 PID=$OLD_PID，保持运行。"
  else
    rm -f "$PID_FILE"
  fi
fi

HOST=127.0.0.1 PORT="$PORT" npm start > "$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > "$PID_FILE"

READY=0
for _ in {1..30}; do
  if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -eq 1 ]; then
  URL="http://127.0.0.1:$PORT"
  echo "网站已启动：$URL"
  echo "DeepSeek Key 不会打印到终端。"
  open "$URL"
else
  echo "启动超时，请查看日志：$LOG_FILE"
  exit 1
fi
