# Configuration Reference

All VeloIQ configuration is handled through `VeloIQConfig`.  Every field
reads from an environment variable if not set explicitly, so you can configure
the app entirely through a `.env` file.

## Quick example

```python
from veloiq_framework import create_veloiq_app, VeloIQConfig

app = create_veloiq_app(VeloIQConfig(
    title="Acme Admin",
    database_url="postgresql://user:pass@localhost/acme",
    cors_origins=["http://localhost:5173"],
    admin_title="Acme Back-Office",
))
```

Or rely entirely on environment variables in your `.env`:

```
DATABASE_URL=postgresql://user:pass@localhost/acme
CORS_ORIGINS=http://localhost:5173,https://app.acme.com
VELOIQ_MODULES_DIR=app/modules
AUTH_SECRET=your-secret-key
```

And keep `main.py` to one line:

```python
from veloiq_framework import create_veloiq_app
app = create_veloiq_app()
```

## VeloIQConfig fields

### Database

| Field | Env var | Default | Description |
|---|---|---|---|
| `database_url` | `DATABASE_URL` | — | SQLAlchemy database URL. Required. |
| `echo_sql` | `ECHO_SQL` | `False` | Log all SQL statements to stdout. |
| `create_tables_on_startup` | — | `True` | Call `SQLModel.metadata.create_all()` on startup. Set to `False` when using Alembic migrations. |

### Application

| Field | Env var | Default | Description |
|---|---|---|---|
| `title` | — | `"VeloIQ App"` | FastAPI app title, shown in `/docs`. |
| `modules_dir` | `VELOIQ_MODULES_DIR` | `"app/modules"` | Path to the modules directory, relative to the working directory. |
| `static_dir` | — | `None` | Directory to mount at `/static`. |
| `serve_frontend` | — | `None` | Path to the built frontend dist folder (e.g. `\"../frontend/dist\"`). When set, FastAPI serves the React app at `/` — no separate Vite dev server needed. See **Production mode** below. |
| `extensions` | `VELOIQ_EXTENSIONS` | `None` → resolves from `veloiq.toml` | Allowlist of extension (entry-point) names this app loads. See **Extensions** below. |

### Production mode

When `serve_frontend` points to a directory that contains a built frontend
(`index.html` + `assets/`), FastAPI serves the React app directly at `/` —
no separate Vite dev server needed.  The same process handles both the API at
`/api/` and the user interface at `/`.

**Build the frontend:**

```bash
cd frontend
npm run build          # or:  veloiq build
```

This produces `frontend/dist/`.  The scaffolded `main.py` already wires it up:

```python
from pathlib import Path
from veloiq_framework import create_veloiq_app, VeloIQConfig

_frontend_dist = Path(__file__).parent.parent.parent / \"frontend\" / \"dist\"

app = create_veloiq_app(VeloIQConfig(
    serve_frontend=_frontend_dist if _frontend_dist.exists() else None,
))
```

**Run in production:**

```bash
veloiq run              # single process — API + UI on http://localhost:8000
```

When the dist does **not** exist, `serve_frontend` is `None` and the app starts
in development mode — you need a separate Vite dev server (`npm run dev`) on
port 5173.

In production mode the auth middleware only protects `/api/`, `/auth/me`, and
`/auth/change-password` — all other paths (React routes) pass through to the
SPA handler, which serves `index.html` for any unmatched path.  This means
React Router can handle client-side redirects to `/login` without the backend
interfering.

### Extensions (explicit opt-in)

A VeloIQ extension (e.g. `iqvigilant`) declares a `veloiq.extensions` entry
point, which makes it discoverable to *every* app in the same virtualenv. To
keep each app's surface explicit, an app loads **only** the extensions it opts
into — it does not auto-load whatever is pip-installed.

The enabled list is resolved with this precedence:

1. `VeloIQConfig(extensions=[...])` passed in code (an explicit list, including `[]`, wins).
2. `VELOIQ_EXTENSIONS` env var (comma-separated).
3. `[extensions].enabled` in the project's `veloiq.toml` (at the app root).
4. Empty — **no extensions load** (strict default).

`veloiq.toml` lives at the project root (next to `backend/` and `frontend/`):

```toml
[extensions]
enabled = ["iqvigilant"]
```

Manage it with the CLI (which edits `veloiq.toml` for you):

```bash
veloiq extend-package iqvigilant   # enable
veloiq remove-package iqvigilant   # disable
veloiq list-extensions             # installed vs. enabled
```

The same allowlist gates both app startup and `veloiq generate`, so the running
backend and the generated frontend never disagree about which extensions are
active. After enabling or disabling, run `veloiq generate` and restart.

### Global view settings (`[views]`)

The same `veloiq.toml` can carry a `[views]` table that tunes how the frontend
renders list / show / edit pages across the whole app. The backend serves it at
`GET /config/views`; the UI applies it in `DynamicResource`. Every key is
optional — anything you omit falls back to the framework's built-in default, so
a project with no `[views]` table behaves exactly as before.

```toml
[views]
modules_color_schema = "plain-color"   # or "color-coded"
models_color_schema  = "plain-color"
plain_color_base_hex = "#c2410c"        # base hue for plain-color; blank = grayscale
general_actions_button_position = "top-right"   # or "left" / "right"
relations_max_rows_to_load = 1000
```

| Key | Default | Description |
|---|---|---|
| `modules_color_schema` | `"plain-color"` | `"color-coded"` gives each module its own color; `"plain-color"` uses one light/dark-aware color. |
| `models_color_schema` | `"plain-color"` | Same options, applied per model. |
| `plain_color_base_hex` | `""` (grayscale) | Base hex color used when a schema is `"plain-color"`. |
| `show_view_type` | framework default | Default view type for show forms (`table`, `editable-table`, `list`, `editable-list`, `csv`, `primary`, `gallery`, `calendar`, `totals-details`). |
| `edit_view_type` | framework default | Default view type for edit forms (same options). |
| `list_view_type` | framework default | Default view type for list pages. |
| `file_list_view_type` | framework default | Default view type for file / attachment lists. |
| `gallery_image_width` | `180` | Width (px) of images in gallery views. |
| `gallery_image_height` | `140` | Height (px) of images in gallery views. |
| `relations_max_rows_to_load` | `1000` | Max rows loaded in a relation table, to cap latency on large relations. |
| `max_distinct_column_filter_values_to_ranges` | `20` | Above this many distinct numeric values, a column filter offers ranges instead of individual values. |
| `general_actions_button_position` | `"top-right"` | Where general action buttons sit on list / show / edit pages: `"top-right"`, `"left"`, `"right"`. |
| `add_tabs_for_non_configured_relations` | `true` | When `true`, forward relations not configured in `views_preferences.json` each get their own tab in show / edit forms. |

The scaffolded `veloiq.toml` ships these keys as commented examples with the
same guidance, so you can uncomment and edit the ones you want to change. Apps
that enable an extension (e.g. `iqvigilant`) get the same settings on the
extension's pages automatically — they render through the host's `DynamicResource`.

### CORS

| Field | Env var | Default | Description |
|---|---|---|---|
| `cors_origins` | `CORS_ORIGINS` | `["*"]` | Comma-separated list of allowed origins. |

### Auth

| Field | Env var | Default | Description |
|---|---|---|---|
| `auth_enabled` | `AUTH_ENABLED` | `True` | Enable JWT Bearer token middleware. |
| `auth_secret` | `AUTH_SECRET` | `"change-me"` | Secret key for JWT signing. Change in production. |
| `auth_algorithm` | `AUTH_ALGORITHM` | `"HS256"` | JWT algorithm. |
| `auth_token_expire_minutes` | `AUTH_TOKEN_EXPIRE_MINUTES` | `60` | Token validity in minutes. |

### Admin panel

| Field | Env var | Default | Description |
|---|---|---|---|
| `admin_title` | — | Same as `title` | Title shown in the SQLAdmin back-office. |
| `admin_logo_url` | — | `None` | URL of the logo image in the admin panel. |
| `admin_templates_dir` | — | `None` | Custom Jinja2 templates directory for SQLAdmin. |

## Page layout configuration

VeloIQ stores all layout configuration in a single file: `views_preferences.json` in the backend root.

### Dashboard layout

The dashboard tab/cell grid is stored under the `user:all.__dashboard__` key:

```json
{
  "user:all": {
    "__dashboard__": {
      "tabs": [
        {
          "id": "...",
          "module": "projects",
          "name": "Projects",
          "cells": [
            {
              "id": "...",
              "model": "project",
              "source_type": "model",
              "row": 0,
              "col": 0,
              "view_type": null,
              "html_style": "",
              "min_width": null,
              "max_width": null,
              "min_height": null,
              "max_height": null
            }
          ]
        }
      ]
    }
  }
}
```

`source_type` is one of `"model"`, `"named_query"`, `"field"`, `"relation"`, or `"custom"`.

Use `veloiq add-dashboard` to add or remove models from the dashboard without editing the JSON manually.

### Show and edit page section layout

When a model has view configuration rows (defined via the `GET /views/configurations/{model}` endpoint), the show and edit pages render fields and relations as a configurable grid of named sections. Users can reposition sections by dragging or using the arrow buttons in each section header.

User position overrides are saved automatically to `views_preferences.json` under the model's resource key:

```json
{
  "user:all": {
    "project": {
      "current_view_name": "default view",
      "views": {
        "default view": {
          "ShowLayoutGrid": {
            "cells": [
              { "id": "general", "row": 0, "col": 0, "min_width": null, "min_height": null }
            ]
          },
          "EditLayoutGrid": {
            "cells": [...]
          }
        }
      }
    }
  }
}
```

`ShowLayoutGrid` is the preference type for show pages; `EditLayoutGrid` is for edit pages.

### Configuration methods

Without the pro version (Vantage), layout can be configured by:

- **JSON editing** — directly edit `views_preferences.json` for dashboard layout, or implement the `GET /views/configurations/{model}` endpoint to return `ViewConfigRow` arrays for show/edit section layout.
- **Section controls** — on any show or edit page that has section layout configured, users can reposition sections using the arrow buttons in each section's header. Changes are saved automatically.
- **Cell config drawer** — accessible from the gear icon in each dashboard cell or section header; controls min/max width, height, and inline styles.

> **Permission required:** The section controls (move arrows, resize handles) and cell config drawer are only shown to users whose role includes the `CONFIGURE_LAYOUT` permission. The built-in `ALL_METHODS` and `WRITE_METHODS` constants include this permission; `READ_METHODS` does not. Roles built from `READ_METHODS` alone (e.g. Viewer) will see the layout without any configuration controls.

### Migrating from legacy layout files

Older projects generated before the unified layout system may have a separate `config/views_configuration.json` file for dashboard configuration. Run the migration command to consolidate it:

```bash
veloiq migrate
```

This reads the dashboard layout from `config/views_configuration.json`, merges it into `views_preferences.json`, and renames the old file to `config/views_configuration.json.bak`.

```bash
veloiq migrate --dry-run   # preview changes without modifying files
```

`veloiq generate` will remind you to run this command if an unmigrated file is detected.

## Database migrations with Alembic

For production use, disable table auto-creation and manage schema changes
with Alembic:

```python
app = create_veloiq_app(VeloIQConfig(
    create_tables_on_startup=False,
))
```

```bash
veloiq db migrate -m "add product table"   # create a new revision
veloiq db upgrade                           # apply pending migrations
veloiq db history                           # show revision history
veloiq db current                           # show current revision
```

## Internationalisation (i18n)

VeloIQ includes a PO-file-based translation system available in backend code via the `_()` helper.

| Field | Env var | Default | Description |
|---|---|---|---|
| `i18n_locales_dir` | `VELOIQ_I18N_LOCALES_DIR` | `config/internationalization/locales` | Path to the directory that contains per-locale subdirectories (resolved relative to the working directory at startup). |
| `i18n_default_locale` | `VELOIQ_I18N_DEFAULT_LOCALE` | `en` | Locale used when no `Accept-Language` header is present. |

The expected directory layout is:

```
config/
  internationalization/
    locales/
      en/
        LC_MESSAGES/
          messages.po
      es/
        LC_MESSAGES/
          messages.po
```

Import and call `_()` in any custom endpoint or repository:

```python
from veloiq_framework.utils.i18n_utils import _

def my_function():
    label = _("sales_price")          # looks up msgid in the active locale's catalog
    title = _("Total Amount", locale="es")  # explicit locale override
```

The active locale per request is set automatically from the `Accept-Language` header by the framework middleware. Catalog files are parsed on first use and cached; edits on disk are picked up automatically (the cache is keyed on file mtime).

> **Path resolution note:** `VELOIQ_I18N_LOCALES_DIR` is resolved relative to the process working directory when `create_veloiq_app()` is called. If you run `veloiq run` from the `backend/` subdirectory instead of the project root, set an absolute path or a `../`-relative path in your `.env` to point to the shared catalogs:
>
> ```bash
> VELOIQ_I18N_LOCALES_DIR=../config/internationalization/locales
> ```

## Environment variable reference

```bash
# Required
DATABASE_URL=postgresql://user:password@localhost/dbname

# Optional
VELOIQ_MODULES_DIR=app/modules
CORS_ORIGINS=http://localhost:5173,https://yourdomain.com
AUTH_ENABLED=true
AUTH_SECRET=your-secret-key-here
AUTH_ALGORITHM=HS256
AUTH_TOKEN_EXPIRE_MINUTES=60
ECHO_SQL=false
VELOIQ_EXTENSIONS=iqvigilant   # comma-separated; overrides veloiq.toml (usually unset)

# i18n
VELOIQ_I18N_LOCALES_DIR=../config/internationalization/locales
VELOIQ_I18N_DEFAULT_LOCALE=en
```
