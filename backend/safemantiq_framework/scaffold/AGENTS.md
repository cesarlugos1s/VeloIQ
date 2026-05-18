# AGENTS.md — {{app_title}}

This project was generated with the SafeMantIQ framework. Use the `safem` CLI — do not manually create files that the CLI generates.

## Project layout

```
backend/
  app/
    main.py               # Entry point — do not edit
    modules/              # Feature modules
      <module>/
        models.py         # SQLModel table definition — edit this
        api.py            # Auto-generated CRUD — do not edit
        custom_api.py     # Custom endpoints (optional)
        admin/
          admin_views.py  # SQLAdmin views (optional)
  alembic/                # Migrations

frontend/
  src/
    allModels.gen.ts           # Auto-generated — do not edit
    pages/<module>/<module>Schema.gen.ts  # Auto-generated — do not edit
```

## CLI commands to use

```bash
safem add-module <name>                              # scaffold a new module
safem add-module <name> --with-custom-api --with-admin
safem generate       # regenerate api.py + frontend schemas after model changes
safem db upgrade     # apply Alembic migration after model changes
safem run            # start backend at http://localhost:{{backend_port}}
```

## Workflow for every new feature

1. Run `safem add-module <name>` — creates the module skeleton
2. Edit `backend/app/modules/<name>/models.py` — define SQLModel fields
3. Run `safem generate` — regenerates `api.py` and frontend TypeScript schemas
4. Run `safem db upgrade` — creates the database table
5. Add custom logic in `custom_api.py` (import `router` from `api.py`)

## Rules

- Never edit `api.py` or `*.gen.ts` — they are overwritten by `safem generate`
- Use `TimestampedModel` as the base class for all models
- Table names are snake_case matching the module name; never use the `safem_` prefix (reserved for auth tables)
- `eid` in API responses equals `id` — required by the frontend
- Required env vars: `AUTH_SECRET` (JWT signing), `DATABASE_URL`; set `SAFEM_AUTH_DISABLED=1` to skip auth in dev
