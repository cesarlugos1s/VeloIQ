# GitHub Copilot instructions — {{app_title}}

This is a VeloIQ™ framework project. Follow these rules exactly.

## Always use the CLI

- Add a module: `veloiq add-module <name>` (optionally `--with-custom-api --with-admin`)
- After changing any model: `veloiq generate` then `veloiq db upgrade`
- Start backend: `veloiq run`

## Never edit generated files

- `backend/app/modules/*/api.py` — auto-generated CRUD, overwritten by `veloiq generate`
- `frontend/src/**/*.gen.ts` — auto-generated TypeScript schemas, overwritten by `veloiq generate`

## Models

- Extend `TimestampedModel` from `veloiq_framework` (provides `id`, `created_at`, `updated_at`)
- Use snake_case table names matching the module name
- Never use the `safem_` table prefix — it is reserved for built-in auth tables

## Custom endpoints

Add them in `custom_api.py`, not in `api.py`. Import the auto-generated router:

```python
from .api import router
from .models import MyModel
```

## Environment variables

- `AUTH_SECRET` — required for JWT; set `VELOIQ_AUTH_DISABLED=1` to skip auth in development
- `DATABASE_URL` — database connection string (defaults to SQLite)
- Copy `.env.example` to `.env` before running
