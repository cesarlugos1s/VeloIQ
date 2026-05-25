#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$SCRIPT_DIR/../tests/velo_venv"

source "$VENV/bin/activate"
cd "$SCRIPT_DIR/backend"

python -m pytest tests/ -v -m "not slow" "$@"
