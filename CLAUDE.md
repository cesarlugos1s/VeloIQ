# CLAUDE.md

This file provides guidance to Claude Code when working with the SafeMantIQ framework repository.

## Repository Layout

```
backend/
  safemantiq_framework/     # Framework Python package (pip-installable as safemantiq-framework)
    auth/                   # Built-in auth module (User, Role, Tenant + JWT + RBAC)
    scaffold/               # Templates used by `safem new <app>` to create new projects
      backend/              # Backend scaffold (main.py, requirements.txt, .env.example)
      frontend/             # Frontend scaffold (App.tsx, allModels.gen.ts, vite.config.ts)
  pyproject.toml            # Framework package metadata (name, version, dependencies)
  setup.py                  # Setuptools compatibility shim

packages/
  ui/                       # @safemantiq/ui — React component library
    src/                    # TypeScript source
    dist/                   # Built output (committed — consumers install from this)

docs/                       # Framework documentation

samples/
  task-manager/             # Complete reference application built with the framework
    backend/                # FastAPI backend using safemantiq-framework
    frontend/               # React frontend using @safemantiq/ui
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
pip install -e ../../..   # install safemantiq-framework from local source
python seed_sqlite.py     # seed the SQLite database
uvicorn app.main:app --reload
# API: http://localhost:8000 | Docs: http://localhost:8000/docs | Admin: http://localhost:8000/admin/

# Frontend
cd samples/task-manager/frontend
npm install
npm run dev      # Dev server at http://localhost:5173
```

### Install framework from local source (development)
```bash
pip install -e backend/
```

## Architecture

### Framework (`safemantiq_framework`)
- `create_safem_app(cfg)` — factory function that builds a FastAPI app with SQLAdmin, CORS, auth, and module auto-loading
- `SafemConfig` — dataclass-based config (reads env vars; override per-field for app-specific values)
- Module auto-loader: scans `app/modules/*/` for `models.py`, `api.py`, `custom_api.py`, `admin/admin_views.py`
- Built-in auth: `safemantiq_framework.auth` — User/Role/Tenant models, JWT login, RBAC middleware, DB seeding

### UI package (`@safemantiq/ui`)
- `DynamicList`, `DynamicShow`, `DynamicCreate`, `DynamicEdit` — schema-driven CRUD pages
- `generateResources(models, moduleName)` — builds Refine resource definitions from ModelDef arrays
- `authSystemModels` — static ModelDef definitions for User, Role, Tenant CRUD pages
- Auth providers: `authProvider`, `accessControlProvider`, `httpClient`

### Creating a new application
```bash
pip install safemantiq-framework
safem new my-app
cd my-app
# Follow the generated README.md
```

## Key Conventions
- Auth tables use `safem_` prefix (e.g., `safem_user`, `safem_role`) — avoids collision with app tables
- API responses include `eid` field (= `id`) for frontend compatibility
- `AUTH_SECRET` env var must be set for JWT signing; `SAFEM_AUTH_DISABLED=1` disables auth enforcement
- `DATABASE_URL` env var controls the database connection (defaults to SQLite for development)
