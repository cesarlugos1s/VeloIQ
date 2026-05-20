#!/bin/bash
set -e

echo "Deploying website to GitHub Pages..."

# Copy website files to temp
rm -rf /tmp/veloiq-website-deploy
cp -r website /tmp/veloiq-website-deploy

# Switch to gh-pages, always return to main on exit
git checkout gh-pages
trap "git checkout main" EXIT

# Sync with remote before making changes
git pull origin gh-pages --no-rebase --quiet

# Copy only website files (never the whole working tree)
cp /tmp/veloiq-website-deploy/index.html .
cp /tmp/veloiq-website-deploy/pricing.html .
cp /tmp/veloiq-website-deploy/contact.html .
cp /tmp/veloiq-website-deploy/styles.css .
find /tmp/veloiq-website-deploy -maxdepth 1 \
  \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.webp" -o -name "*.svg" \) \
  -exec cp {} . \;

# Stage only website files
git add index.html pricing.html contact.html styles.css
git add *.png *.jpg *.jpeg *.gif *.webp *.svg 2>/dev/null || true

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
