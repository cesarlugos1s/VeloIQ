#!/usr/bin/env bash
# backup.sh — mirror the repo to a sibling folder, ready to upload to Google Drive.
#
# Destination: ../VeloIQ_framework_backup/  (relative to this script)
#
# Excluded (not worth backing up — fully reproducible or better kept in git remote):
#   .git/             git internals (thousands of tiny files; use a git remote for history)
#   node_modules/     Python venvs (.venv/ venv/)
#   __pycache__/      *.pyc / *.pyo
#   *.egg-info/       .pytest_cache/
#
# Everything else is included: source, docs, website, packages/ui/dist, configs, etc.
#
# Usage:  bash backup.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE="$SCRIPT_DIR/"
DEST="$SCRIPT_DIR/../VeloIQ_framework_backup/"

echo "Source:      $SOURCE"
echo "Destination: $DEST"
echo ""

rsync -av --delete \
    --exclude='.git/' \
    --exclude='node_modules/' \
    --exclude='.venv/' \
    --exclude='venv/' \
    --exclude='__pycache__/' \
    --exclude='*.pyc' \
    --exclude='*.pyo' \
    --exclude='*.egg-info/' \
    --exclude='.pytest_cache/' \
    "$SOURCE" "$DEST"

echo ""
echo "Backup complete: $DEST"
