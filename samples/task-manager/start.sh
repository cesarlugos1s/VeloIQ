#!/usr/bin/env bash
# start.sh — restart both servers after quickstart.sh has already run once.
#
#   bash samples/task-manager/start.sh
#
# Run quickstart.sh first if you haven't yet.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/.venv"

if [ ! -d "$VENV_DIR" ]; then
  echo "Setup not complete. Run quickstart.sh first." >&2
  exit 1
fi

echo "Starting SafeMantIQ Task Manager…"
echo ""

set -a
# shellcheck disable=SC1090
source "$BACKEND_DIR/.env"
set +a

cd "$BACKEND_DIR"
"$VENV_DIR/bin/uvicorn" app.main:app --reload --port 8000 --log-level warning &
BACKEND_PID=$!

cd "$FRONTEND_DIR"
npm run dev -- --port 5173 &
FRONTEND_PID=$!

sleep 2
echo "  Frontend  →  http://localhost:5173"
echo "  API docs  →  http://localhost:8000/docs"
echo "  Admin     →  http://localhost:8000/admin/"
echo ""
echo "Ctrl+C to stop."
echo ""

_cleanup() {
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap _cleanup INT TERM

wait "$BACKEND_PID" "$FRONTEND_PID"
