#!/bin/bash
set -e

echo "Deploying website to GitHub Pages..."

# Copy website files to temp
rm -rf /tmp/veloiq-website-deploy
cp -r website /tmp/veloiq-website-deploy

# Switch to gh-pages, always return to main on exit
git checkout gh-pages
trap "git checkout main" EXIT

# Copy updated files
cp /tmp/veloiq-website-deploy/* .

# Sync with remote before making changes
git pull origin gh-pages --no-rebase --quiet

# Stage files
git add index.html pricing.html contact.html styles.css

# Commit only if there are changes
if git diff --cached --quiet; then
  echo "No changes to deploy."
else
  git commit -m "Update website $(date '+%Y-%m-%d %H:%M')"
  git push origin gh-pages
  echo "Done. Site will update at veloiq.dev in ~30 seconds."
fi

# Cleanup
rm -rf /tmp/veloiq-website-deploy
