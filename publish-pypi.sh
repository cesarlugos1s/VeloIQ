#!/bin/bash
# Publish veloiq-framework to PyPI.
# Both the Python package (pyproject.toml) and the npm package (packages/ui/package.json)
# must be on the same version before publishing.
set -e

PYPROJECT="backend/pyproject.toml"
NPM_PKG="packages/ui/package.json"

PY_VERSION=$(grep '^version' "$PYPROJECT" | sed 's/version = "\(.*\)"/\1/')
NPM_VERSION=$(python3 -c "import json; print(json.load(open('$NPM_PKG'))['version'])")

echo "veloiq-framework  : $PY_VERSION"
echo "@juicemantics/veloiq-ui : $NPM_VERSION"

if [ "$PY_VERSION" != "$NPM_VERSION" ]; then
  echo ""
  echo "ERROR: version mismatch — update both to the same version before publishing."
  exit 1
fi

echo ""
echo "Publishing veloiq-framework $PY_VERSION to PyPI..."
echo ""

# Clean previous build artefacts
rm -rf backend/dist backend/build backend/*.egg-info

# Build sdist + wheel
cd backend
python3 -m build
echo ""

# Upload
python3 -m twine upload dist/*
echo ""
echo "Done. veloiq-framework $PY_VERSION is live on PyPI."
