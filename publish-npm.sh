#!/bin/bash
# Publish @juicemantics/veloiq-ui to npm.
# Both the npm package (packages/ui/package.json) and the Python package (pyproject.toml)
# must be on the same version. This must be run — and land on the registry — BEFORE
# publish-pypi.sh, since the scaffold templates shipped in the Python package assume
# whatever APIs this npm version exports.
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

if npm view "@juicemantics/veloiq-ui@$NPM_VERSION" version >/dev/null 2>&1; then
  echo ""
  echo "ERROR: @juicemantics/veloiq-ui@$NPM_VERSION is already published."
  exit 1
fi

echo ""
echo "Building @juicemantics/veloiq-ui $NPM_VERSION..."
echo ""

npm run build --workspace=packages/ui

echo ""
echo "Publishing @juicemantics/veloiq-ui $NPM_VERSION to npm..."
echo ""

npm publish --workspace=packages/ui

echo ""
echo "Done. @juicemantics/veloiq-ui $NPM_VERSION is live on npm."
echo "You can now run ./publish-pypi.sh to publish the matching veloiq-framework release."
