#!/usr/bin/env bash
set -u

PORT="${1:-9627}"

if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
  echo "Error: PORT must be a number" >&2
  exit 1
fi

# Find PID listening on the port (try lsof first, then ss)
find_pid() {
  lsof -t -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null \
    || ss -ltnp 2>/dev/null | awk -v p=":$PORT" '$4 ~ p {if (match($0,/pid=([0-9]+)/,m)) {print m[1]; exit}}'
}

PID="$(find_pid)"
if [ -z "$PID" ]; then
  echo "No process is listening on port $PORT."
  exit 0
fi

echo "Attempting to gracefully stop PID $PID on port $PORT..."
kill "$PID" 2>/dev/null || true

# Wait briefly for graceful shutdown
for i in {1..10}; do
  sleep 0.2
  if ! kill -0 "$PID" 2>/dev/null; then
    break
  fi
done

# If still running, force kill
if kill -0 "$PID" 2>/dev/null; then
  echo "Process $PID did not exit gracefully. Sending SIGKILL..."
  kill -9 "$PID" 2>/dev/null || true
fi

# Verify
sleep 0.2
if PID_AFTER="$(find_pid)" && [ -z "$PID_AFTER" ]; then
  echo "Port $PORT is now free."
  exit 0
else
  echo "Warning: Port $PORT still appears to be in use (PID: $PID_AFTER)." >&2
  exit 2
fi
