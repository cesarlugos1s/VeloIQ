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

### One-to-many

The "one" side holds `List["Other"]`; the "many" side carries the FK column.

```python
from typing import List, Optional
from sqlmodel import Field
from veloiq_framework import TimestampedModel, jm_relationship

class Customer(TimestampedModel, table=True):
    __tablename__ = "customer"
    name: str
    orders: List["Order"] = jm_relationship(back_populates="customer")
```

The frontend generates a relation tab on the Customer show/edit page that lists
all linked Orders.

### Many-to-one (FK side)

The "many" side declares the integer FK column plus an `Optional["One"]`
relationship pointing back to the parent.

```python
class Order(TimestampedModel, table=True):
    __tablename__ = "order"
    reference: str
    customer_id: Optional[int] = Field(default=None, foreign_key="customer.id")
    customer: Optional["Customer"] = jm_relationship(back_populates="orders")
```

The generator emits the FK column (`customer_id`) as a reference field in the
TypeScript schema, so the frontend renders it as a linked selector in forms and
a clickable link in show views.

### Many-to-many

Use a link table (a plain `FrameworkModel` with two FK columns) and pass
`link_model=` to `jm_relationship` on both sides.

```python
from veloiq_framework import FrameworkModel, TimestampedModel, jm_relationship
from sqlmodel import Field
from typing import List, Optional

class TaskTagLink(FrameworkModel, table=True):
    __tablename__ = "task_tag_link"
    task_id: Optional[int] = Field(default=None, foreign_key="task.id", primary_key=True)
    tag_id: Optional[int] = Field(default=None, foreign_key="tag.id", primary_key=True)

class Tag(FrameworkModel, table=True):
    __tablename__ = "tag"
    name: str
    tasks: List["Task"] = jm_relationship(back_populates="tags", link_model=TaskTagLink)

class Task(TimestampedModel, table=True):
    __tablename__ = "task"
    title: str
    tags: List["Tag"] = jm_relationship(back_populates="tasks", link_model=TaskTagLink)
```

The frontend renders each side as a relation tab.  Use
`showViewType: "read-and-edit-csv"` / `editViewType: "editable-csv"` on the
relation definition to display the linked records as an inline tag list rather
than a full table.

### Cardinality constraints

`jm_relationship()` accepts optional `min_items` and `max_items` arguments.
The UI reads these to show required/optional indicators and pagination hints.

```python
# Exactly one-to-one: each order must have exactly one invoice
invoices: List["Invoice"] = jm_relationship(
    back_populates="order", min_items=1, max_items=1
)
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

The three built-in method sets map to the following capabilities:

| Constant | HTTP methods included | UI capabilities |
|---|---|---|
| `ALL_METHODS` | `GET POST PUT PATCH DELETE OPTIONS HEAD CONFIGURE_LAYOUT` | Full CRUD + page layout configuration |
| `WRITE_METHODS` | `GET POST PUT PATCH OPTIONS HEAD CONFIGURE_LAYOUT` | Create/edit/view + page layout configuration, no delete |
| `READ_METHODS` | `GET OPTIONS HEAD` | Read-only, no layout configuration controls |

`CONFIGURE_LAYOUT` is a non-HTTP permission token that gates the page layout configuration UI — the move arrows, resize handles, cell config drawer, and the "Configure page layout" toggle on show and edit pages. Roles built from `READ_METHODS` alone do not receive this permission and will see the layout without any configuration controls.

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

`veloiq generate` produces three files per module in
`frontend/src/pages/{module}/`:

| File | Managed by | Purpose |
|---|---|---|
| `{module}Schema.gen.ts` | Always overwritten | Raw schema derived from Python models; exports `{module}ModelsGen` |
| `{module}Schema.manual.ts` | Created once, **never overwritten** | Developer-editable overrides; exports `{module}ManualOverrides` |
| `{module}Schema.ts` | Always overwritten | Merges gen + manual; exports `{module}Models` — this is what the app consumes |

`allModels.gen.ts` imports from `{module}Schema` (the merged file), so manual
overrides are always included automatically.

### What you can override in `{module}Schema.manual.ts`

The manual file exports a `ModelOverride[]` array.  Each entry is matched to a
generated model by `name` and deep-merged:

- **Override a field property** — change any `FieldDef` key by providing the
  field's `key` plus the properties to change.  Common overrides:
  - `showViewType` / `editViewType` — control how the field is rendered in show
    and edit contexts.  See [View types](#view-types) for the full token list
    (currency, progress bar, rating, markdown, etc.).
  - `options` — array of `{ label, value }` objects; turns the field into a
    tag/select picker with labelled choices.
  - `valueColors` — map of value → Ant Design tag colour (e.g. `"green"`,
    `"blue"`, `"orange"`, `"volcano"`, `"gold"`, `"default"`); applied
    alongside `options` to colour-code each status/priority tag.
  - `label`, `required`, `readOnly`, `description` — display and validation tweaks.
- **Add a virtual field** — include a `key` that does not exist in the generated
  model; it is appended to the field list.
- **Override a relation** — match by `resource` (or `label` as a fallback) and
  spread new properties over the generated entry.
- **Add a new model** — add an entry whose `name` is not in the generated set;
  it is appended as a synthetic model with no backend CRUD.

```ts
// projectsSchema.manual.ts
export const projectsManualOverrides: ModelOverride[] = [
    {
        name: 'Project',
        fields: [
            // Render description as Markdown in show view, textarea in edit
            { key: 'description', showViewType: 'read-only-markdown', editViewType: 'editable-markdown' },
        ],
        relations: [
            // Rename the auto-generated relation label
            { resource: 'task', label: 'Open Tasks' },
        ],
    },
];
```

Overrides survive all future `veloiq generate` runs — the manual file is never
touched after its initial creation.

## Navigation config

`frontend/src/navigation.config.json` is the single source of truth for
navigation icons and sort order.  It drives both the collapsible sidebar and
the Command Center overlay.

### How it is generated

`veloiq generate` writes the file on first run and **upserts** new entries on
subsequent runs — it never overwrites or removes entries you have already
edited.  This means you can freely adjust icons and sort order and re-run the
generator safely.

### Schema

Each entry in the array describes one module or one model:

```json
{
  "key":      "module:tasks",
  "label":    "Tasks",
  "icon":     "CheckSquareOutlined",
  "sequence": 20,
  "type":     "module"
}
```

| Field | Type | Description |
|---|---|---|
| `key` | `string` | Refine resource key. Modules use the `module:<name>` prefix; models use the bare resource name (e.g. `"task"`). |
| `label` | `string` | Display name used in the sidebar and Command Center header. |
| `icon` | `string` | Ant Design icon component name (e.g. `"CheckSquareOutlined"`). See the [Ant Design icon set](https://ant.design/components/icon) for valid values. |
| `sequence` | `number` | Display order — lower numbers appear first.  Entries without a match sort to the end. |
| `type` | `"module" \| "model"` | `"module"` for a top-level group; `"model"` for a leaf resource. |

### Icon guessing

On first generation, `veloiq generate` picks icons automatically by matching
the resource name against a keyword table (e.g. `task` → `CheckSquareOutlined`,
`user` → `UserOutlined`).  Resources that match no keyword receive
`FolderOutlined` (modules) or `TableOutlined` (models).  Override any entry by
editing `icon` in the JSON file — the generator will not touch it again.

### Passing the config to the frontend

Load the file as a JSON import and pass it to `LayoutWrapper`:

```tsx
import type { NavConfig } from "@juicemantics/veloiq-ui";
import navConfigData from "./navigation.config.json";

<LayoutWrapper navConfig={navConfigData as NavConfig}>
  ...
</LayoutWrapper>
```

The scaffold (`veloiq new`) generates this wiring automatically.

## View types

`showViewType` and `editViewType` control how a field or relation is rendered
in show and edit contexts respectively.  They can be set directly on the
TypeScript schema definition or overridden at runtime via `vid` / `show_vid` /
`edit_vid` on a `ViewConfigRow` (fetched from `/views/configurations/{model}`).

### Scalar field view types

Set on `FieldDef.showViewType` / `FieldDef.editViewType`.  Tokens are
case-insensitive and tolerate spaces or underscores in place of hyphens.

| Token | Rendering |
|---|---|
| `read-only-field` | Force read-only using the field's default type renderer |
| `editable-field` | Force editable using the field's default type renderer |
| `read-only-password` | Masked ●●●●●● — no reveal |
| `editable-password` | Masked input with reveal toggle (`Input.Password`) |
| `read-only-textarea` | Multi-line read-only text area |
| `editable-textarea` | Multi-line `Input.TextArea` |
| `read-only-markdown` | Rendered Markdown (via `react-markdown`) |
| `editable-markdown` | `Input.TextArea` with a live preview toggle |
| `read-only-json` | Formatted JSON in a `<pre>` block |
| `editable-json` | `Input.TextArea` with JSON parse validation |
| `read-only-url` | Clickable `<a href>` link |
| `editable-url` | Plain text input |
| `read-only-email` | `<a href="mailto:">` link |
| `editable-email` | Text input with email validation |
| `read-only-currency` | Locale-formatted currency: `$ 1,234.56` (USD) |
| `editable-currency` | `InputNumber` with `$` prefix, 2 decimal precision |
| `read-only-percentage` | Value with `%` suffix: `87.5 %` |
| `editable-percentage` | `InputNumber` with `%` suffix |
| `read-only-progress` | Ant Design `Progress` bar, range 0–100 |
| `editable-progress` | `InputNumber` with `%` suffix, clamped 0–100 |
| `read-only-rating` | Ant Design `Rate` stars (read-only) |
| `editable-rating` | Ant Design `Rate` interactive |
| `read-only-duration` | Seconds formatted as `2h 15m 30s` |
| `editable-duration` | `InputNumber` (raw seconds) with `s` suffix |
| `read-only-phone` | `<a href="tel:">` clickable link |
| `editable-phone` | `<input type="tel">` |
| `read-only-color` | ■ colour swatch + hex string |
| `editable-color` | Native `<input type="color">` + hex text input |
| `read-only-code` | Monospace `<pre>` block (no parse/format — contrast with `json`) |
| `editable-code` | Monospace `Input.TextArea` |
| `read-only-image-url` | `<img>` thumbnail from a string field holding a single image URL (contrast: `gallery` is a relation view type over many linked image records) |
| `editable-image-url` | URL text input with inline image preview below |
| `read-only-qrcode` | QR code rendered from the field value (requires `qrcode.react`) |
| `read-only-relative` | Relative time: "3 days ago" / "in 2 hours" via dayjs — non-date fields fall back to the default renderer |
| `read-only-truncated-text` | Truncated text with full value on hover tooltip |

Example — store a field as plain text but render it as Markdown in the show
view while keeping a textarea in the edit form:

```ts
{ key: "notes", label: "Notes", type: "string",
  showViewType: "read-only-markdown", editViewType: "editable-textarea" }
```

### Relation view types

Set on `RelationDef.showViewType` / `RelationDef.editViewType` for to-many
relations, or on `FieldDef.showViewType` / `FieldDef.editViewType` for FK
(many-to-one) fields.  The same token vocabulary applies to both.

| Token | Rendering |
|---|---|
| `read-and-edit-list` | **Default for FK fields.** Clickable label link + pencil icon that swaps to an inline selector with confirm/cancel |
| `read-and-edit-csv` | Comma-separated clickable labels with × unlink per item and a + add control |
| `editable-csv` | Multi-select tag input (Ant Design `Select` in tags mode) |
| `csv` | Read-only comma-separated labels |
| `list` | Read-only bullet list |
| `editable-list` | Bullet list with add / remove controls |
| `table` | Read-only data table |
| `editable-table` | **Default for to-many in edit mode.** Table with inline editing |
| `gallery` | Image / card grid |
| `calendar` | Calendar view (requires a `date` or `datetime` field in the related model) |
| `primary` | Embedded show view of the related record |
| `totals-details` | **Default for to-many in show mode.** Summary totals + expandable details |
| `tree` | Hierarchical tree (recursive self-relations) |
| `tree-details` | Hierarchical Miller-columns tree with leaf details |

Example — render the `project_id` FK as a read-only link and `assignee_id` as
the default inline edit widget:

```ts
// tasksSchema.manual.ts
{ key: "project_id", label: "Project", type: "number",
  reference: "project", showViewType: "read-only-field" },
{ key: "assignee_id", label: "Assignee", type: "number",
  reference: "team_member" },  // defaults to read-and-edit-list
```

Example — render a to-many relation as a comma-separated list of links in the
show view and a multi-select tag input in the edit view:

```ts
{ resource: "tag", targetKey: "task_id", label: "Tags",
  showViewType: "read-and-edit-csv", editViewType: "editable-csv" }
```
