#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$SCRIPT_DIR/../tests/velo_venv"

source "$VENV/bin/activate"
cd "$SCRIPT_DIR/backend"

# Needed by the e2e tests (test_full_cli_lifecycle.py) to open a real browser.
# No-op if already installed.
playwright install chromium >/dev/null

python -m pytest tests/ -v -m "not slow" "$@"
