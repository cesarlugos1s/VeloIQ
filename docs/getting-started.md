# Getting Started with SafeMantIQ

SafeMantIQ is an open-core full-stack framework for building data-driven admin
and ERP applications.  You define your database models in Python; the framework
generates the REST API, the SQLAdmin back-office, and the React CRUD frontend
automatically.

## Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL (or any SQLAlchemy-compatible database)

## Install the CLI

```bash
pip install safemantiq-framework
safem --version
```

> **Before PyPI release:** install directly from the source repository using
> pip's editable mode — the package stays in place and any source changes are
> reflected immediately:
>
> ```bash
> pip install -e /path/to/fastapi_sqladmin_prototype/backend
> safem --version
> ```

## Create your first project

```bash
safem new my-app
cd my-app
```

This scaffolds the full project structure:

```
my-app/
├── backend/
│   ├── app/
│   │   ├── main.py          # one line: app = create_safem_app()
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
from safemantiq_framework import TimestampedModel

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
safem generate
```

This writes two files automatically:

- `backend/app/modules/products/api.py` — standard CRUD REST endpoints
- `frontend/src/pages/products/productsSchema.gen.ts` — TypeScript field definitions

You never edit these files.  Re-run `safem generate` whenever you change a model.

## Start the backend

```bash
pip install -r requirements.txt
safem db upgrade          # creates tables
safem run                 # starts at http://localhost:8000
```

- API docs: http://localhost:8000/docs
- Admin panel: http://localhost:8000/admin/

## Start the frontend

```bash
cd ../frontend
npm install
npm run dev               # starts at http://localhost:5173
```

> **Before npm registry release:** build and install `@safemantiq/ui` locally
> before `npm install`:
>
> ```bash
> cd /path/to/fastapi_sqladmin_prototype/packages/ui
> npm install && npm run build
> cd /path/to/your-project/frontend
> npm install /path/to/fastapi_sqladmin_prototype/packages/ui
> npm install
> ```

Open http://localhost:5173 — you have a working CRUD interface for your Product
model with zero additional code.

## Access control

SafeMantIQ ships with a layered access control system that goes from coarse to
fine.  All layers are opt-in and can be combined freely.

**RBAC — three layers of role-based control**

| Layer | Mechanism | Scope |
|---|---|---|
| 1 — Global role permissions | `SafemConfig(roles=[RoleDef(...)])` in `main.py` | All resources |
| 2 — Model-level exceptions | `@model_access(Viewer=["list", "show"])` on a model class | One resource |
| 3 — Field-level exceptions | `safem_field(read_roles=[...], write_roles=[...])` on a field | One field |

```python
from safemantiq_framework import model_access, safem_field, TimestampedModel

@model_access(Viewer=["list", "show"])   # Viewer cannot create/edit/delete
class Invoice(TimestampedModel, table=True):
    amount: float
    # Only Admin can see or change this field
    internal_notes: str = safem_field(default="", read_roles=["Admin"], write_roles=["Admin"])
```

**ReBAC — row-level access control**

Use `@rebac` when access depends on the data itself (ownership, tenant membership,
or any relationship):

```python
from safemantiq_framework import rebac, rebac_subquery, TimestampedModel

@rebac(owner_field="created_by")          # user sees only their own rows
class Note(TimestampedModel, table=True):
    created_by: int = Field(foreign_key="safem_user.id")

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
- [Configuration Reference](./configuration-reference.md) — all `SafemConfig` options
- [Open-Core Model](./open-core.md) — free vs Pro features
