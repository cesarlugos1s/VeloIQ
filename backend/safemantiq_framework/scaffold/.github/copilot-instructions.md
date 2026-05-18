# GitHub Copilot instructions — {{app_title}}

This is a SafeMantIQ framework project. Follow these rules exactly.

## Always use the CLI

- Add a module: `safem add-module <name>` (optionally `--with-custom-api --with-admin`)
- After changing any model: `safem generate` then `safem db upgrade`
- Start backend: `safem run`

## Never edit generated files

- `backend/app/modules/*/api.py` — auto-generated CRUD, overwritten by `safem generate`
- `frontend/src/**/*.gen.ts` — auto-generated TypeScript schemas, overwritten by `safem generate`

## Models

- Extend `TimestampedModel` from `safemantiq_framework` (provides `id`, `created_at`, `updated_at`)
- Use snake_case table names matching the module name
- Never use the `safem_` table prefix — it is reserved for built-in auth tables

## Custom endpoints

Add them in `custom_api.py`, not in `api.py`. Import the auto-generated router:

```python
from .api import router
from .models import MyModel
```

## Environment variables

- `AUTH_SECRET` — required for JWT; set `SAFEM_AUTH_DISABLED=1` to skip auth in development
- `DATABASE_URL` — database connection string (defaults to SQLite)
- Copy `.env.example` to `.env` before running
