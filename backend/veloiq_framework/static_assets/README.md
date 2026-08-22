# Core framework assets

Static files served unconditionally at `/veloiq-assets/<filename>` in every host
app, regardless of which extensions are enabled (see `_mount_studio`-style mount in
`factory.py`, near the `/ext/{name}/` extension static loop). Unlike `/ext/{name}/`,
this mount does not depend on any extension being installed or enabled — it's for
assets that framework-level, extension-independent UI components need.

Vendored third-party assets:
- `plotly.min.js` — Plotly.js runtime (from the `plotly.js-dist-min` npm package),
  vendored so chart rendering (`packages/ui`'s `InlinePlotlyHtml`/`ExecutableHtml`,
  and `utils/views_utils.py`'s Plotly HTML generators) never depends on internet
  access to cdn.plot.ly. To update: `npm pack plotly.js-dist-min`, extract, and
  replace this file with the new `plotly.min.js`.
