# CLAUDE.md

This file provides guidance to Claude Code when working with the VeloIQ™ framework repository.

## Repository Layout

```
backend/
  veloiq_framework/         # Framework Python package (pip-installable as veloiq-framework)
    auth/                   # Built-in auth module (User, Role, Tenant + JWT + RBAC)
    extension.py            # VeloIQExtension base class — subclass in extension packages
    extensions.py           # discover_extensions() — scans veloiq.extensions entry points
    scaffold/               # Templates used by `veloiq new <app>` to create new projects
      backend/              # Backend scaffold (main.py, requirements.txt, .env.example)
      frontend/             # Frontend scaffold (App.tsx, allModels.gen.ts, vite.config.ts)
    cli/
      new_extension.py      # veloiq new-extension — scaffold a new extension package
      add_licensing.py      # veloiq add-licensing — scaffold license module into host app
  pyproject.toml            # Framework package metadata (name, version, dependencies)
  setup.py                  # Setuptools compatibility shim

packages/
  ui/                       # @juicemantics/veloiq-ui — React component library
    src/                    # TypeScript source
    dist/                   # Built output (committed — consumers install from this)

docs/                       # Framework documentation

samples/
  task-manager/             # Complete reference application built with the framework
    backend/                # FastAPI backend using veloiq-framework
    frontend/               # React frontend using @juicemantics/veloiq-ui
```

## Commands

### Framework UI package
```bash
cd packages/ui
npm install
npm run build    # Rebuild dist/ after source changes
npm run dev      # Watch mode
```

### Sample task-manager app
```bash
# Backend
cd samples/task-manager/backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip install -e ../../..   # install veloiq-framework from local source
python seed_sqlite.py     # seed the SQLite database
uvicorn app.main:app --reload
# API: http://localhost:8000 | Docs: http://localhost:8000/docs | Admin: http://localhost:8000/admin/

# Frontend
cd samples/task-manager/frontend
npm install
npm run dev      # Dev server at http://localhost:5173
```

### Project explorer (interactive TUI)
```bash
veloiq          # run with no arguments from inside a project directory
```
Opens a curses TUI showing all modules, models, fields, relations, dashboard
configuration, and search configuration. Supports launching CLI commands
(`add-dashboard`, `search add-model`, `generate`, `add-module`, etc.) with
Y/N confirmation. Implemented in `backend/veloiq_framework/cli/explorer.py`.

### Install framework from local source (development)
```bash
pip install -e backend/
```

## Architecture

### Framework (`veloiq_framework`)
- `create_veloiq_app(cfg)` — factory function that builds a FastAPI app with SQLAdmin, CORS, auth, module auto-loading, and extension discovery
- `VeloIQConfig` — dataclass-based config (reads env vars; override per-field for app-specific values)
- Module auto-loader: scans `app/modules/*/` for `models.py`, `api.py`, `custom_api.py`, `admin/admin_views.py`
- Built-in auth: `veloiq_framework.auth` — User/Role/Tenant models, JWT login, RBAC middleware, DB seeding
- Extension system: `veloiq_framework.extension.VeloIQExtension` + `veloiq_framework.extensions.discover_extensions()` — discovers installed extension packages via the `veloiq.extensions` Python entry point group at app startup

### UI package (`@juicemantics/veloiq-ui`)
- `DynamicList`, `DynamicShow`, `DynamicCreate`, `DynamicEdit` — schema-driven CRUD pages
- `generateResources(models, moduleName)` — builds Refine resource definitions from ModelDef arrays
- `authSystemModels` — static ModelDef definitions for User, Role, Tenant CRUD pages
- Auth providers: `authProvider`, `accessControlProvider`, `httpClient`

### Creating a new application
```bash
pip install veloiq-framework
veloiq new my-app
cd my-app
# Follow the generated README.md
```

## Extension package architecture

Extension packages are pip-installable Python packages that add modules, schemas, and licensing to any host app without modifying the host app's code.

### Key files
- `backend/veloiq_framework/extension.py` — `VeloIQExtension` base class (subclass this in your extension)
- `backend/veloiq_framework/extensions.py` — `discover_extensions()` scans the `veloiq.extensions` entry point group
- `backend/veloiq_framework/cli/new_extension.py` — `veloiq new-extension <name>` scaffolds a new extension package
- `backend/veloiq_framework/cli/add_licensing.py` — `veloiq add-licensing` scaffolds a license module into a host app

### Extension manifest contract
An extension declares itself via `pyproject.toml`:
```toml
[project.entry-points."veloiq.extensions"]
myext = "myext.manifest:ExtensionManifest"
```
And subclasses `VeloIQExtension`:
```python
from veloiq_framework import VeloIQExtension

class ExtensionManifest(VeloIQExtension):
    name = "myext"
    modules_package = "myext.modules"      # loaded like host app modules
    static_dir = "static"                   # served at /ext/myext/
    frontend_pages_dir = "frontend/pages"   # copied by veloiq generate
```

### How extension modules are loaded
`create_veloiq_app()` calls `discover_extensions()`, mounts each extension's `static_dir` at `/ext/{name}/`, then passes the extension list to `load_modules()`. `load_modules()` runs the same 3-pass load (models → APIs → admin views) for each extension's `modules_package` via `pkgutil.iter_modules`.

### How extension schemas reach the frontend
`veloiq generate` calls `_sync_extension_schemas()` which copies each installed extension's `frontend/pages/` schema files into the host app's `frontend/src/pages/`, then updates `allModels.gen.ts` and `navigation.config.json`.

### Licensing in extension packages
Each extension package includes its own license module (`modules/license/`) with full JWT enforcement, grace-period logic, and a React management page (`static/license-manager.umd.js`). The license module uses RS256 JWTs where the extension developer holds the private key and the public key is bundled as package data. The host app has no license code unless `veloiq add-licensing` is run explicitly.

## Key Conventions
- Auth tables use `veloiq_` prefix (e.g., `veloiq_user`, `veloiq_role`) — avoids collision with app tables
- License tables in the `add-licensing` scaffold also use `veloiq_` prefix (`veloiq_installation_config`, `veloiq_license_key`)
- API responses include `eid` field (= `id`) for frontend compatibility
- `AUTH_SECRET` env var must be set for JWT signing; `VELOIQ_AUTH_DISABLED=1` disables auth enforcement
- `DATABASE_URL` env var controls the database connection (defaults to SQLite for development)
