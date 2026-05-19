#!/usr/bin/env bash
# quickstart.sh — VeloIQ Task Manager: one-command setup and launch.
#
# Run from anywhere:
#   bash /path/to/samples/task-manager/quickstart.sh
#
# What it does:
#   1. Checks Python 3.10+ and Node 18+ are available
#   2. Creates a Python virtual environment in backend/.venv
#   3. Installs veloiq-framework (editable, from this repo)
#   4. Copies .env.example → .env  (SQLite pre-filled database, zero config)
#   5. Builds @veloiq/ui from the repo's packages/ui if the dist is stale
#   6. Installs frontend npm dependencies
#   7. Starts the FastAPI backend and Vite frontend dev server
#   8. Opens http://localhost:5173 in the default browser
#   9. Ctrl+C stops both servers cleanly

set -euo pipefail

# ── Terminal colours ──────────────────────────────────────────────────────────
if [ -t 1 ]; then
  GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BOLD='\033[1m'; NC='\033[0m'
else
  GREEN=''; YELLOW=''; RED=''; BOLD=''; NC=''
fi
ok()   { echo -e "${GREEN}✓${NC}  $*"; }
info() { echo -e "${YELLOW}→${NC}  $*"; }
err()  { echo -e "${RED}✗${NC}  $*" >&2; exit 1; }
banner() { echo -e "\n${BOLD}$*${NC}"; }

# ── Paths (resolved relative to this script, so it works from any cwd) ───────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
FRAMEWORK_SRC="$REPO_ROOT/backend"          # local veloiq-framework source
UI_PKG_DIR="$REPO_ROOT/packages/ui"         # local @veloiq/ui source
VENV_DIR="$BACKEND_DIR/.venv"

banner "VeloIQ — Task Manager Quick Start"
echo    "────────────────────────────────────────"

# ── 1. Prerequisites ──────────────────────────────────────────────────────────
banner "Checking prerequisites…"

# Python
if ! command -v python3 &>/dev/null; then
  err "Python 3.10+ is required but was not found.\n   Install from https://python.org"
fi
PY_VER=$(python3 -c "import sys; v=sys.version_info; print(f'{v.major}.{v.minor}')")
PY_MAJ=$(echo "$PY_VER" | cut -d. -f1)
PY_MIN=$(echo "$PY_VER" | cut -d. -f2)
if [ "$PY_MAJ" -lt 3 ] || { [ "$PY_MAJ" -eq 3 ] && [ "$PY_MIN" -lt 10 ]; }; then
  err "Python 3.10+ required — found $PY_VER. Please upgrade."
fi
ok "Python $PY_VER"

# Node
if ! command -v node &>/dev/null; then
  err "Node.js 18+ is required but was not found.\n   Install from https://nodejs.org"
fi
NODE_VER=$(node -e "process.stdout.write(process.version.slice(1))")
NODE_MAJ=$(echo "$NODE_VER" | cut -d. -f1)
if [ "$NODE_MAJ" -lt 18 ]; then
  err "Node.js 18+ required — found $NODE_VER. Please upgrade."
fi
ok "Node.js $NODE_VER"

if ! command -v npm &>/dev/null; then
  err "npm not found — it normally ships with Node.js."
fi
ok "npm $(npm --version)"

# ── 2. Python virtual environment ─────────────────────────────────────────────
banner "Setting up Python environment…"

if [ ! -d "$VENV_DIR" ]; then
  info "Creating virtual environment in backend/.venv …"
  python3 -m venv "$VENV_DIR"
  ok "Virtual environment created"
else
  ok "Virtual environment already exists"
fi

PY="$VENV_DIR/bin/python"
PIP="$VENV_DIR/bin/pip"

# Ensure pip is current (silent)
"$PIP" install -q --upgrade pip

# Install the framework from local source (editable)
if ! "$PY" -c "import veloiq_framework" 2>/dev/null; then
  info "Installing veloiq-framework…"
  "$PIP" install -q -e "$FRAMEWORK_SRC"
  ok "veloiq-framework installed"
else
  ok "veloiq-framework already installed"
fi

# ── 3. Backend environment file ───────────────────────────────────────────────
banner "Configuring backend…"

if [ ! -f "$BACKEND_DIR/.env" ]; then
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env"
  ok ".env created — using bundled SQLite database (no server needed)"
else
  ok ".env already exists"
fi

# ── 4. Build @veloiq/ui (only if the dist is missing) ────────────────────
banner "Preparing frontend UI library…"

if [ ! -f "$UI_PKG_DIR/dist/index.mjs" ]; then
  info "Building @veloiq/ui (one-time step)…"
  cd "$UI_PKG_DIR"
  npm install --silent
  npm run build --silent
  ok "@veloiq/ui built"
else
  ok "@veloiq/ui dist is current"
fi

# ── 5. Install frontend npm dependencies ─────────────────────────────────────
banner "Installing frontend dependencies…"

cd "$FRONTEND_DIR"
if [ ! -d "node_modules/@refinedev" ]; then
  info "Running npm install (this takes ~30 s the first time)…"
  npm install --silent
  ok "Frontend dependencies installed"
else
  ok "Frontend dependencies already installed"
fi

# ── 6. Launch both servers ────────────────────────────────────────────────────
banner "Starting servers…"

# Export variables from .env into the shell so uvicorn inherits them
set -a
# shellcheck disable=SC1090
source "$BACKEND_DIR/.env"
set +a

# Backend (FastAPI + uvicorn)
cd "$BACKEND_DIR"
"$VENV_DIR/bin/uvicorn" app.main:app --reload --port 8000 \
  --log-level warning &
BACKEND_PID=$!

# Frontend (Vite dev server)
cd "$FRONTEND_DIR"
npm run dev -- --port 5173 &
FRONTEND_PID=$!

# Give the servers a moment to bind
sleep 3

echo ""
echo "  ┌─────────────────────────────────────────────────────┐"
echo "  │                                                     │"
echo -e "  │  ${GREEN}Frontend${NC}  →  http://localhost:5173              │"
echo -e "  │  ${GREEN}API docs${NC}  →  http://localhost:8000/docs          │"
echo -e "  │  ${GREEN}Admin${NC}     →  http://localhost:8000/admin/         │"
echo "  │                                                     │"
echo "  │  Press Ctrl+C to stop both servers.                │"
echo "  └─────────────────────────────────────────────────────┘"
echo ""

# Open the browser (Linux/Mac/WSL)
_open_url() {
  if   command -v xdg-open &>/dev/null; then xdg-open "$1" &>/dev/null &
  elif command -v wslview   &>/dev/null; then wslview   "$1" &>/dev/null &
  elif command -v open      &>/dev/null; then open      "$1" &>/dev/null &
  fi
}
_open_url "http://localhost:5173"

# ── 7. Wait and clean up on Ctrl+C ───────────────────────────────────────────
_cleanup() {
  echo ""
  info "Stopping servers…"
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  ok "Done."
}
trap _cleanup INT TERM

wait "$BACKEND_PID" "$FRONTEND_PID"
