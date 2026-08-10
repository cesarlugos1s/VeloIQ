#!/bin/bash
set -e

echo "Deploying website to GitHub Pages..."

# Copy website files to temp
rm -rf /tmp/veloiq-website-deploy
cp -r website /tmp/veloiq-website-deploy
# Strip raw PNG frames — never deploy to gh-pages
rm -rf /tmp/veloiq-website-deploy/showcase-assets/demo-gif/frames

# Advanced Development is a separate repo, deployed as peer pages on this same
# domain (veloiq.dev/advanced-development.html) — pull its website/ content in
# and rename index/showcase to their published names to avoid colliding with
# this repo's own index.html/showcase.html.
AD_WEBSITE="../Advanced_development_extension/website"
if [ -d "$AD_WEBSITE" ]; then
  cp "$AD_WEBSITE/index.html" /tmp/veloiq-website-deploy/advanced-development.html
  cp "$AD_WEBSITE/showcase.html" /tmp/veloiq-website-deploy/advanced-development-showcase.html
  cp "$AD_WEBSITE/llms.txt" /tmp/veloiq-website-deploy/advanced-development-llms.txt
  rm -rf /tmp/veloiq-website-deploy/advanced-development-assets
  cp -r "$AD_WEBSITE/showcase-assets" /tmp/veloiq-website-deploy/advanced-development-assets
  # This repo's own showcase-assets/ dir already exists at gh-pages root, so
  # the AD assets are published under a distinctly-named sibling dir. Only the
  # SELF-referential links (AD's own showcase/index CTAs) get renamed here —
  # the shared nav's logo/#features/Showcase links intentionally keep pointing
  # at this repo's own index.html/showcase.html (same pattern as
  # enterprise-extensions.html's nav), so they must NOT be touched.
  sed -i \
    -e 's#showcase-assets/#advanced-development-assets/#g' \
    -e 's#href="showcase\.html" class="btn-primary"#href="advanced-development-showcase.html" class="btn-primary"#' \
    -e 's|href="showcase\.html#integrations"|href="advanced-development-showcase.html#integrations"|' \
    /tmp/veloiq-website-deploy/advanced-development.html
  sed -i \
    -e 's#showcase-assets/#advanced-development-assets/#g' \
    -e 's#href="index\.html" class="btn-primary">See All Features#href="advanced-development.html" class="btn-primary">See All Features#' \
    /tmp/veloiq-website-deploy/advanced-development-showcase.html
else
  echo "WARNING: $AD_WEBSITE not found — deploying without Advanced Development pages."
fi

# Switch to gh-pages, always return to main on exit
git checkout gh-pages
trap "git checkout -f main" EXIT

# Sync with remote before making changes
git pull origin gh-pages --no-rebase --quiet

# Copy only website files (never the whole working tree)
cp /tmp/veloiq-website-deploy/index.html .
cp /tmp/veloiq-website-deploy/showcase.html .
cp /tmp/veloiq-website-deploy/pricing.html .
cp /tmp/veloiq-website-deploy/contact.html .
cp /tmp/veloiq-website-deploy/thank-you.html .
cp /tmp/veloiq-website-deploy/solutions.html .
cp /tmp/veloiq-website-deploy/enterprise-extensions.html .
cp /tmp/veloiq-website-deploy/enterprise-extensions-showcase.html .
cp /tmp/veloiq-website-deploy/styles.css .
cp /tmp/veloiq-website-deploy/analytics.js .
find /tmp/veloiq-website-deploy -maxdepth 1 \
  \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.webp" -o -name "*.svg" \) \
  -exec cp {} . \;
# Showcase image assets (organized subdirectory)
rm -rf showcase-assets
cp -r /tmp/veloiq-website-deploy/showcase-assets .
# Enterprise Extensions showcase videos/posters (organized subdirectory)
rm -rf enterprise-extensions-assets
cp -r /tmp/veloiq-website-deploy/enterprise-extensions-assets .
# VeloIQ suite infographic(s) (organized subdirectory)
rm -rf VeloIQ-suite-assets
cp -r /tmp/veloiq-website-deploy/VeloIQ-suite-assets .
# Advanced Development pages (pulled from the sibling repo above, if present)
if [ -d "$AD_WEBSITE" ]; then
  cp /tmp/veloiq-website-deploy/advanced-development.html .
  cp /tmp/veloiq-website-deploy/advanced-development-showcase.html .
  cp /tmp/veloiq-website-deploy/advanced-development-llms.txt .
  rm -rf advanced-development-assets
  cp -r /tmp/veloiq-website-deploy/advanced-development-assets .
fi

# Stage only website files
git add index.html showcase.html pricing.html contact.html thank-you.html solutions.html enterprise-extensions.html enterprise-extensions-showcase.html styles.css analytics.js showcase-assets enterprise-extensions-assets "VeloIQ-suite-assets"
if [ -d "$AD_WEBSITE" ]; then
  git add advanced-development.html advanced-development-showcase.html advanced-development-llms.txt advanced-development-assets
fi
find . -maxdepth 1 \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.gif" -o -name "*.webp" -o -name "*.svg" \) -exec git add {} \;

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
