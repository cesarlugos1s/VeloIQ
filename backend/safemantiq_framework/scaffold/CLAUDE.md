# CLAUDE.md — {{app_title}}

This project was generated with the [SafeMantIQ framework](https://github.com/juicemantics/SafeMantIQ_framework).

## Project layout

```
backend/
  app/
    main.py               # App entry point — do not edit
    modules/              # Your feature modules live here
      <module>/
        models.py         # SQLModel table definition
        api.py            # Auto-generated CRUD endpoints — do not edit
        custom_api.py     # Custom endpoints (optional)
        admin/
          admin_views.py  # SQLAdmin views (optional)
  alembic/                # Database migrations
  .env                    # Local env vars (not committed)

frontend/
  src/
    allModels.gen.ts      # Auto-generated — do not edit
    pages/
      <module>/
        <module>Schema.gen.ts  # Auto-generated — do not edit
```

## Commands

```bash
# Add a new feature module
safem add-module <name>
safem add-module <name> --with-custom-api --with-admin

# After adding or changing any model
safem generate            # regenerates api.py + frontend TypeScript schemas
safem db upgrade          # applies Alembic migration

# Run the app
safem run                 # backend at http://localhost:{{backend_port}}
cd frontend && npm run dev  # frontend at http://localhost:5173
```

## How to add a feature

1. `safem add-module <name>` — creates the module skeleton
2. Edit `backend/app/modules/<name>/models.py` — define your SQLModel fields
3. `safem generate` — regenerates `api.py` and frontend schemas
4. `safem db upgrade` — creates the database table
5. Add custom endpoints in `custom_api.py` if needed (import `router` from `api.py`)

**Never edit `api.py` or `*.gen.ts` files** — they are overwritten by `safem generate`.

## Key conventions

- `TimestampedModel` — base class for all models; adds `id`, `created_at`, `updated_at`
- Table names use snake_case matching the module name (e.g., `inventory`)
- Auth tables use the `safem_` prefix — don't use it for app tables
- `eid` field in API responses equals `id` — used by the frontend for Refine compatibility
- `AUTH_SECRET` env var is required for JWT signing; set `SAFEM_AUTH_DISABLED=1` to skip auth in development
- `DATABASE_URL` env var controls the database (defaults to SQLite)

## Environment variables

See `.env.example` for all available variables. Copy it to `.env` before running:

```bash
cd backend && cp .env.example .env
```
