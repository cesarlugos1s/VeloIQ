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

## Relationships

Use `jm_relationship` from `veloiq_framework`. Never use `relationship()` from SQLAlchemy or `Relationship` from SQLModel.

```python
from typing import TYPE_CHECKING, List, Optional
from sqlmodel import Field
from veloiq_framework import TimestampedModel, jm_relationship

if TYPE_CHECKING:
    from app.modules.other.models import OtherModel
    from app.modules.items.models import Item

class MyModel(TimestampedModel, table=True):
    __tablename__ = "my_model"

    other_id: Optional[int] = Field(default=None, foreign_key="other.id")
    other: Optional["OtherModel"] = jm_relationship(back_populates="my_models")

    items: List["Item"] = jm_relationship(back_populates="my_model")

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

- FK column (`other_id`) and relationship attribute (`other`) are always separate fields
- Cross-module imports must be inside `if TYPE_CHECKING` to avoid circular imports
- Self-referential or multi-FK relationships need `sa_relationship_kwargs={"foreign_keys": [...]}` on both sides
- **Never add `from __future__ import annotations`** — it breaks SQLModel relationship resolution

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
