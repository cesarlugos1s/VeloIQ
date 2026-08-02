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

# The scaffold templates shipped in this Python package (backend/veloiq_framework/scaffold/)
# assume whatever APIs exist in @juicemantics/veloiq-ui@$NPM_VERSION. If that exact version
# hasn't actually been published to npm yet, new apps built from this pypi release will fail
# at `veloiq build` with "X is not exported by ...veloiq-ui/dist/index.mjs" — the version
# strings matching locally is not enough proof that npm has it. Verify the real registry state.
echo "Checking npm registry for @juicemantics/veloiq-ui@$NPM_VERSION..."
if ! npm view "@juicemantics/veloiq-ui@$NPM_VERSION" version >/dev/null 2>&1; then
  echo ""
  echo "ERROR: @juicemantics/veloiq-ui@$NPM_VERSION is not published to npm yet."
  echo "Run ./publish-npm.sh first, then re-run this script."
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
