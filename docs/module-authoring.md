# Module Authoring

A VeloIQ module is a Python package under `backend/app/modules/`.  The
framework discovers and registers modules automatically on startup — no
registration in `main.py` required.

## Module layout

```
modules/orders/
├── __init__.py
├── models.py           # SQLModel table classes — you write this
├── api.py              # AUTO-GENERATED CRUD — do not edit
├── custom_api.py       # custom endpoints — you write this
└── admin/
    └── admin_views.py  # SQLAdmin view — you write this
```

## models.py

Define your entities by inheriting from one of the framework base classes.

### FrameworkModel

Minimal base — standard auto-increment `id` primary key, no timestamps.

```python
from veloiq_framework import FrameworkModel

class Category(FrameworkModel, table=True):
    __tablename__ = "category"
    name: str
    slug: str
```

### TimestampedModel

Adds automatic `created_at` and `updated_at` columns.  The code generator
appends these two fields **after** all fields you declare, so they appear last
in every list, form, and detail view.

```python
from veloiq_framework import TimestampedModel

class Order(TimestampedModel, table=True):
    __tablename__ = "order"
    reference: str
    total: float
    status: str = "pending"
```

> **No timestamps needed?**  Use `FrameworkModel` instead — it provides only
> the `id` primary key and no extra columns, so the UI shows exactly the fields
> you declare and nothing more.

### StandardModel

For CubicWeb database compatibility: uses `eid` as the primary key
(mapped to the `cw_eid` column) and preserves `cw_` column conventions.

```python
from veloiq_framework import StandardModel
from sqlmodel import Field
from sqlalchemy import Column, String

class LegacyItem(StandardModel, table=True):
    __tablename__ = "legacy_item"
    cw_name: str = Field(sa_column=Column("cw_name", String))
```

## Relations

Use `jm_relationship()` to declare SQLModel relationships with optional
cardinality metadata that the frontend UI reads for validation hints.

```python
from typing import List, Optional
from sqlmodel import Field
from veloiq_framework import TimestampedModel, jm_relationship

class Customer(TimestampedModel, table=True):
    __tablename__ = "customer"
    name: str
    orders: List["Order"] = jm_relationship(back_populates="customer")

class Order(TimestampedModel, table=True):
    __tablename__ = "order"
    reference: str
    customer_id: Optional[int] = Field(default=None, foreign_key="customer.id")
    customer: Optional["Customer"] = jm_relationship(back_populates="orders")
```

## Access control

VeloIQ provides four layers of access control.  All are opt-in per model
and can be combined freely.

### Layer 1 — Configurable roles (global)

Roles and their HTTP-method permissions are defined in `main.py` and seeded to
the database on startup.  They are also editable at runtime through the admin UI.

```python
# main.py
from veloiq_framework import (
    create_veloiq_app, VeloIQConfig,
    RoleDef, ALL_METHODS, WRITE_METHODS, READ_METHODS,
)

app = create_veloiq_app(VeloIQConfig(
    roles=[
        RoleDef("Admin",   ALL_METHODS,   "Full access",               is_preset=True),
        RoleDef("Manager", WRITE_METHODS, "Create/edit, no delete",    is_preset=True),
        RoleDef("Viewer",  READ_METHODS,  "Read-only",                 is_preset=True),
        # Add as many custom roles as needed:
        RoleDef("Auditor", READ_METHODS,  "External auditor",          is_preset=True),
    ],
))
```

### Layer 2 — Model-level exceptions (`@model_access`)

Override which actions a role may perform on a specific model.  Roles not listed
in `@model_access` inherit their global permissions unchanged.

```python
from veloiq_framework import model_access, TimestampedModel

@model_access(Viewer=["list", "show"])   # Viewer is read-only on Invoice
class Invoice(TimestampedModel, table=True):
    __tablename__ = "invoice"
    amount: float
    status: str = "draft"
```

Exceptions are **restrictive only** — they can narrow access, never grant
beyond the role's global permissions.

### Layer 3 — Field-level exceptions (`veloiq_field`)

Control read and write access per field.

```python
from veloiq_framework import veloiq_field, TimestampedModel

class Employee(TimestampedModel, table=True):
    __tablename__ = "employee"
    name: str
    department: str
    # Only Admins can see or change salary
    salary: float = veloiq_field(
        default=0.0,
        read_roles=["Admin"],
        write_roles=["Admin"],
    )
    # Viewers can read notes, but only Managers and Admins can write them
    notes: str = veloiq_field(
        default="",
        write_roles=["Admin", "Manager"],
    )
```

`veloiq_field` uses `pydantic.Field` under the hood and is fully compatible with
`TimestampedModel` and `FrameworkModel`.  After adding or changing `veloiq_field`
annotations, run `python api_schema_gen.py` — the generator emits `readRoles`
and `writeRoles` into the TypeScript schema so the frontend can hide or disable
restricted inputs automatically.

### ReBAC — Row-level access control (`@rebac`)

Filter which rows a user can see, edit, or delete based on the data itself.

```python
from veloiq_framework import rebac, rebac_subquery, TimestampedModel

# Shorthand: user sees only rows they own
@rebac(owner_field="created_by")
class Note(TimestampedModel, table=True):
    created_by: int = Field(foreign_key="veloiq_user.id")

# Tenant isolation: user sees rows whose tenant they belong to
@rebac(tenant_field="tenant_id")
class Contract(TimestampedModel, table=True):
    tenant_id: int = Field(foreign_key="veloiq_tenant.id")

# Relationship traversal: inherit access from a parent model
@rebac(filter=lambda user, cls, session:
           cls.folder_id.in_(rebac_subquery(Folder, user, session)))
class Document(TimestampedModel, table=True):
    folder_id: int
```

**`rebac_subquery(ModelClass, user, session)`** returns a subquery of accessible
primary keys from *ModelClass* — the target model must itself carry `@rebac`.
Circular dependencies raise a `ValueError` at runtime.

Key characteristics:
- `@rebac` applies to **all roles**, including Admin.  To exempt Admins, return
  `True` from the filter for admin users.
- Inaccessible rows return **404**, not 403, to avoid leaking which IDs exist.
- Multiple patterns (`filter`, `owner_field`, `tenant_field`) on one decorator
  are **OR-combined**: a row is visible if any pattern allows it.

---

## api.py — the generated CRUD layer

After running `veloiq generate`, each module has an `api.py` that looks like:

```python
# AUTO-GENERATED — do not edit. Run `veloiq generate` to update.
from veloiq_framework.crud import create_crud_router
from .models import Order

router = create_crud_router(Order)
```

`create_crud_router` generates these endpoints automatically:

| Method | Path | Action |
|---|---|---|
| GET | `/order` | Paginated list (`?_start=0&_end=25`) |
| GET | `/order/{id}` | Single record |
| POST | `/order` | Create |
| PUT | `/order/{id}` | Full update |
| DELETE | `/order/{id}` | Delete |

Response headers `x-total-count` and `content-range` are set on list responses
to support the Refine data provider pagination convention.

**Do not edit `api.py`.**  It is overwritten by `veloiq generate`.

## custom_api.py — custom endpoints

For business-specific endpoints, create `custom_api.py` in the same module
directory.  Import `router` from the generated `api.py` and add routes to it:

```python
from fastapi import Depends, HTTPException
from sqlmodel import Session, select

from veloiq_framework import get_session
from .api import router
from .models import Order


@router.post("/{order_id}/confirm")
def confirm_order(order_id: int, session: Session = Depends(get_session)):
    order = session.get(Order, order_id)
    if order is None:
        raise HTTPException(404, f"Order {order_id} not found")
    order.status = "confirmed"
    session.add(order)
    session.commit()
    session.refresh(order)
    return order.model_dump()


@router.get("/pending")
def list_pending(session: Session = Depends(get_session)):
    rows = session.exec(select(Order).where(Order.status == "pending")).all()
    return [r.model_dump() for r in rows]
```

The framework loader imports both `api.py` and `custom_api.py` automatically.

## admin/admin_views.py

SQLAdmin views for the back-office at `/admin/`.

```python
from sqladmin import ModelView
from app.modules.orders.models import Order

class OrderAdmin(ModelView, model=Order):
    column_list = [Order.id, Order.reference, Order.status, Order.total]
    column_searchable_list = [Order.reference]
    column_sortable_list = [Order.total, Order.created_at]
    icon = "fa-solid fa-receipt"
```

## Frontend schema customisation

The generated `{module}Schema.gen.ts` defines field labels, types, and
relations for the DynamicResource UI component.  The file is regenerated
by `veloiq generate` and must not be edited directly.

To override or extend the generated schema, create a
`{module}Schema.manual.ts` in the same directory and merge it in
`{module}Schema.ts`.  See the `@juicemantics/veloiq-ui` documentation for the
`ModelDef` and `FieldDef` type reference.
