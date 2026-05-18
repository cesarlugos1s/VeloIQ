# Module Authoring

A SafeMantIQ module is a Python package under `backend/app/modules/`.  The
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
from safemantiq_framework import FrameworkModel

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
from safemantiq_framework import TimestampedModel

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
from safemantiq_framework import StandardModel
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
from safemantiq_framework import TimestampedModel, jm_relationship

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

## api.py — the generated CRUD layer

After running `safem generate`, each module has an `api.py` that looks like:

```python
# AUTO-GENERATED — do not edit. Run `safem generate` to update.
from safemantiq_framework.crud import create_crud_router
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

**Do not edit `api.py`.**  It is overwritten by `safem generate`.

## custom_api.py — custom endpoints

For business-specific endpoints, create `custom_api.py` in the same module
directory.  Import `router` from the generated `api.py` and add routes to it:

```python
from fastapi import Depends, HTTPException
from sqlmodel import Session, select

from safemantiq_framework import get_session
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
by `safem generate` and must not be edited directly.

To override or extend the generated schema, create a
`{module}Schema.manual.ts` in the same directory and merge it in
`{module}Schema.ts`.  See the `@safemantiq/ui` documentation for the
`ModelDef` and `FieldDef` type reference.
