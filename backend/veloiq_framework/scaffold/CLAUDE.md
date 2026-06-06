# CLAUDE.md — {{app_title}}

This project was generated with the [VeloIQ™ framework](https://github.com/juicemantics/VeloIQ_framework).

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
veloiq add-module <name>              # includes custom_api.py by default
veloiq add-module <name> --with-admin # also create admin/admin_views.py stub

# After adding or changing any model, or after installing an extension package
veloiq generate            # regenerates api.py + frontend TypeScript schemas;
                           # also syncs schemas from any installed extension packages
veloiq db upgrade          # applies Alembic migration

# If alembic.ini is missing (project built without `veloiq new`)
veloiq db init             # copies Alembic scaffold into backend/; run once

# Run the app
veloiq run                 # backend at http://localhost:{{backend_port}}
cd frontend && npm run dev  # frontend at http://localhost:5173

# Extension packages (optional)
pip install <extension>    # e.g. pip install iqvigilant
veloiq generate            # sync the extension's schemas and nav config

# Add license enforcement to this app's own modules (optional)
veloiq add-licensing       # scaffolds app/modules/license/ + frontend/src/pages/license/
```

## How to add a feature

1. `veloiq add-module <name>` — creates the module skeleton
2. Edit `backend/app/modules/<name>/models.py` — define your SQLModel fields
3. `veloiq generate` — regenerates `api.py` and frontend schemas
4. `veloiq db upgrade` — creates the database table
5. Add custom endpoints in `custom_api.py` (import `router` from `api.py`) — file is already created
6. Edit `frontend/src/navigation.config.json` to set menu label, icon, and display order

**Never edit `api.py` or `*.gen.ts` files** — they are overwritten by `veloiq generate`.

## Key conventions

- `TimestampedModel` — base class for all models; adds `id`, `created_at`, `updated_at`
- Table names use snake_case matching the module name (e.g., `inventory`)
- Auth tables use the `safem_` prefix — don't use it for app tables
- `eid` field in API responses equals `id` — used by the frontend for Refine compatibility
- `AUTH_SECRET` env var is required for JWT signing; set `VELOIQ_AUTH_DISABLED=1` to skip auth in development
- `DATABASE_URL` env var controls the database (defaults to SQLite)

## Relationships

Always use `jm_relationship` from `veloiq_framework` — **never** `relationship()` from SQLAlchemy or `Relationship` from SQLModel directly.

```python
from typing import TYPE_CHECKING, List, Optional
from sqlmodel import Field
from veloiq_framework import TimestampedModel, jm_relationship

if TYPE_CHECKING:                                       # avoids circular imports
    from app.modules.other.models import OtherModel
    from app.modules.items.models import Item

class MyModel(TimestampedModel, table=True):
    __tablename__ = "my_model"

    # FK column — always a plain Optional[int] field
    other_id: Optional[int] = Field(default=None, foreign_key="other.id")

    # Many-to-one (nullable)
    other: Optional["OtherModel"] = jm_relationship(back_populates="my_models")

    # One-to-many
    items: List["Item"] = jm_relationship(back_populates="my_model")

    # Self-referential
    parent_id: Optional[int] = Field(default=None, foreign_key="my_model.id")
    children: List["MyModel"] = jm_relationship(
        back_populates="parent",
        sa_relationship_kwargs={"foreign_keys": "[MyModel.parent_id]"},
    )
    parent: Optional["MyModel"] = jm_relationship(
        back_populates="children",
        sa_relationship_kwargs={
            "foreign_keys": "[MyModel.parent_id]",
            "remote_side": "[MyModel.id]",
        },
    )
```

Rules:
- `jm_relationship` accepts `back_populates`, `link_model`, and `sa_relationship_kwargs` — nothing else
- The FK column (`other_id`) and the relationship attribute (`other`) are **separate** fields
- Cross-module model references must be inside `if TYPE_CHECKING` to avoid import cycles
- Self-referential and multi-FK relationships need `sa_relationship_kwargs={"foreign_keys": [...]}` on both sides
- **Never add `from __future__ import annotations` to models.py** — it makes all annotations lazy strings, which breaks SQLModel's relationship resolution

## Access control

The framework supports four layers of access control — all opt-in per model:

**Layer 1 — Configurable roles** (defined in `main.py` via `VeloIQConfig(roles=[...])`).
Roles map to HTTP methods.  They are seeded on startup and editable in the admin UI.

**Layer 2 — Model-level exceptions** (`@model_access`): restrict which actions a role
may perform on one specific model.

```python
from veloiq_framework import model_access, TimestampedModel

@model_access(Viewer=["list", "show"])
class Invoice(TimestampedModel, table=True):
    ...
```

**Layer 3 — Field-level exceptions** (`veloiq_field`): control which roles can read
or write a specific field.

```python
from veloiq_framework import veloiq_field, TimestampedModel

class Employee(TimestampedModel, table=True):
    salary: float = veloiq_field(default=0.0, read_roles=["Admin"], write_roles=["Admin"])
```

**ReBAC — Row-level access** (`@rebac`): filter which rows a user can access.

```python
from veloiq_framework import rebac, rebac_subquery, TimestampedModel

@rebac(owner_field="created_by")          # user sees only their own rows
class Note(TimestampedModel, table=True):
    created_by: int = Field(foreign_key="veloiq_user.id")

@rebac(filter=lambda user, cls, session:  # inherit access from parent
           cls.folder_id.in_(rebac_subquery(Folder, user, session)))
class Document(TimestampedModel, table=True):
    folder_id: int
```

After changing any model annotations run `veloiq generate` to update the API and
frontend schemas.

## Environment variables

See `.env.example` for all available variables. Copy it to `.env` before running:

```bash
cd backend && cp .env.example .env
```
