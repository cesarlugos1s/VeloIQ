1,0# Getting Started with VeloIQ

VeloIQ is an open-core full-stack framework for building data-driven admin
and ERP applications.  You define your database models in Python; the framework
generates the REST API, the SQLAdmin back-office, and the React CRUD frontend
automatically.

## Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL (or any SQLAlchemy-compatible database)

## Install the CLI

```bash
pip install veloiq-framework
veloiq --version
```

> **Before PyPI release:** install directly from the source repository using
> pip's editable mode — the package stays in place and any source changes are
> reflected immediately:
>
> ```bash
> pip install -e /path/to/fastapi_sqladmin_prototype/backend
> veloiq --version
> ```

## Create your first project

```bash
veloiq new my-app
cd my-app
```

This scaffolds the full project structure:

```
my-app/
├── backend/
│   ├── app/
│   │   ├── main.py          # one line: app = create_veloiq_app()
│   │   └── modules/         # your domain modules go here
│   ├── .env.example
│   ├── requirements.txt
│   └── api_schema_gen.py    # code generator entry point
└── frontend/
    ├── src/
    │   ├── App.tsx           # clean ~50-line app shell
    │   └── allModels.gen.ts  # auto-generated, do not edit
    ├── package.json
    └── vite.config.ts
```

## Configure the database

```bash
cd backend
cp .env.example .env
# edit .env and set DATABASE_URL=postgresql://user:pass@localhost/myapp
```

## Add your first module

Create `backend/app/modules/products/models.py`:

```python
from typing import Optional
from veloiq_framework import TimestampedModel

class Product(TimestampedModel, table=True):
    __tablename__ = "product"

    name: str
    price: float
    in_stock: bool = True
    description: Optional[str] = None

# TimestampedModel automatically adds created_at and updated_at columns,
# which the UI displays last in all views.  If you don't want those columns,
# inherit from FrameworkModel instead — it provides only the id primary key.
```

## Generate API and schemas

```bash
cd backend
veloiq generate
```

This writes three files automatically:

- `backend/app/modules/products/api.py` — standard CRUD REST endpoints
- `frontend/src/pages/products/productsSchema.gen.ts` — TypeScript field definitions
- `frontend/src/navigation.config.json` — navigation icons and sort order (created on first run, updated with new entries on subsequent runs)

You never edit `api.py` or the `*.gen.ts` files.  Re-run `veloiq generate` whenever you change a model.  `navigation.config.json` is yours to edit — the generator only adds new entries and never overwrites existing ones.

## Start the backend

```bash
pip install -r requirements.txt
veloiq db upgrade          # creates tables
veloiq run                 # starts at http://localhost:8000
```

- API docs: http://localhost:8000/docs
- Admin panel: http://localhost:8000/admin/

## Start the frontend

```bash
cd ../frontend
npm install
npm run dev               # starts at http://localhost:5173
```


Open http://localhost:5173 — you have a working CRUD interface for your Product
model with zero additional code.

## Frontend layout and navigation

The generated frontend shell (`LayoutWrapper`) includes built-in navigation
controls that require no configuration to work out of the box.

### Layout modes

A toggle in the header switches between two layout modes:

| Mode | Description |
|---|---|
| **Sidebar** (default) | Collapsible left sidebar with icon + label per module |
| **Top bar** | Horizontal menu across the top of the page |

The selected mode is persisted to `localStorage` and survives page reloads.

### Command Center

The Command Center is a full-screen navigation overlay that lists every
registered module and model in your application.

- **Open:** press `Ctrl+G` (or `Cmd+G` on macOS), or click the bento-grid icon
  in the header (the icon immediately to the right of the layout toggle).
- **Search:** start typing to filter modules and models in real time.
- **Navigate:** click any model link to go directly to its list view.

The Command Center reflects the live set of Refine resources — adding a new
module to the backend automatically makes it appear here with no frontend changes.

### Navigation config

`frontend/src/navigation.config.json` controls the icon and display order
for every module and model in both the sidebar and the Command Center.  The file
is created automatically by `veloiq generate` with keyword-guessed icons; edit
it freely to override icons or reorder entries.

See [Navigation config](./module-authoring.md#navigation-config) in the Module
Authoring guide for the full schema reference.

## Access control

VeloIQ ships with a layered access control system that goes from coarse to
fine.  All layers are opt-in and can be combined freely.

**RBAC — three layers of role-based control**

| Layer | Mechanism | Scope |
|---|---|---|
| 1 — Global role permissions | `VeloIQConfig(roles=[RoleDef(...)])` in `main.py` | All resources |
| 2 — Model-level exceptions | `@model_access(Viewer=["list", "show"])` on a model class | One resource |
| 3 — Field-level exceptions | `veloiq_field(read_roles=[...], write_roles=[...])` on a field | One field |

```python
from veloiq_framework import model_access, veloiq_field, TimestampedModel

@model_access(Viewer=["list", "show"])   # Viewer cannot create/edit/delete
class Invoice(TimestampedModel, table=True):
    amount: float
    # Only Admin can see or change this field
    internal_notes: str = veloiq_field(default="", read_roles=["Admin"], write_roles=["Admin"])
```

**ReBAC — row-level access control**

Use `@rebac` when access depends on the data itself (ownership, tenant membership,
or any relationship):

```python
from veloiq_framework import rebac, rebac_subquery, TimestampedModel

@rebac(owner_field="created_by")          # user sees only their own rows
class Note(TimestampedModel, table=True):
    created_by: int = Field(foreign_key="veloiq_user.id")

@rebac(filter=lambda user, cls, session:  # inherit access from parent model
           cls.folder_id.in_(rebac_subquery(Folder, user, session)))
class Document(TimestampedModel, table=True):
    folder_id: int
```

For a full walkthrough see [Section 4 (RBAC)](./tutorial-task-manager.md#section-4--role-based-access-control-rbac) and [Section 5 (ReBAC)](./tutorial-task-manager.md#section-5--row-level-access-control-rebac) in the tutorial.

---

## Next steps

- [Tutorial: Build a Task Manager](./tutorial-task-manager.md) — step-by-step guide covering relations, custom endpoints, and the full dev loop in ~15 minutes
- [Module Authoring](./module-authoring.md) — add relations, custom endpoints, custom schemas
- [Configuration Reference](./configuration-reference.md) — all `VeloIQConfig` options
- [Open-Core Model](./open-core.md) — free vs Pro features
