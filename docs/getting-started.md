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

## Create your first project

```bash
veloiq new my-app
cd my-app
```

This scaffolds the full project structure, creates `backend/.env` from `.env.example`,
installs frontend and backend dependencies, and runs `veloiq generate`:

```
my-app/
├── backend/
│   ├── app/
│   │   ├── main.py          # one line: app = create_veloiq_app()
│   │   └── modules/         # your domain modules go here
│   ├── .env                 # pre-configured from .env.example
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

### Configure the database

By default the project uses SQLite — no configuration needed.  To use a different
engine, pass `--db-type` when creating the project:

```bash
veloiq new my-app --db-type postgresql --db-user myuser --db-password secret
```

`--db-type` accepts any SQLAlchemy dialect.  The commonly used engines are:

| `--db-type` | Default port | Driver |
|---|---|---|
| `sqlite` | — | built in |
| `postgresql` | 5432 | bundled (`psycopg2-binary`) |
| `mysql` | 3306 | `pip install pymysql` |
| `mariadb` | 3306 | `pip install pymysql` |
| `mssql` | 1433 | `pip install pyodbc` |
| `oracle` | 1521 | `pip install cx_Oracle` |
| `db2` | 50000 | `pip install ibm-db-sa` |
| `informix` | 9088 | `pip install IfxAlchemy` |

Only **SQLite** and **PostgreSQL** drivers ship with the framework; every other
engine needs its driver installed into the project's environment.  Any other
SQLAlchemy dialect string (e.g. `postgresql+asyncpg`, `cockroachdb`) is accepted
too, as long as the matching driver is installed.

Or edit `backend/.env` after creation:

```
DATABASE_URL=postgresql://user:pass@localhost/myapp
```

### Customise admin credentials

The default admin user is `admin` / `admin`.  To set custom credentials:

```bash
veloiq new my-app --admin-username admin --admin-password "MyS3cret!"
```

Or set `VELOIQ_ADMIN_USERNAME` and `VELOIQ_ADMIN_PASSWORD` in `backend/.env`.

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

The Command Center is a full-screen overlay for navigation, search, and
quick actions across your entire application.

- **Open:** press `Ctrl+G` (or `Cmd+G` on macOS), or click the bento-grid icon
  in the header (the icon immediately to the right of the layout toggle).
- **Filter modules & models:** start typing to narrow the module cards in real time.
- **Search records:** type any text to search actual data from your configured
  searchable models (the same backend search used by the header search bar).
  Results appear grouped by model and each result links to the record's show page.
- **Command navigation:** prefix your query with a verb to jump directly to a page:
  - `list <model>` — opens the model's list view
  - `create <model>` / `new <model>` / `add <model>` — opens the create form
  - `show <model>` / `edit <model>` — opens the model's list view

  Examples: `list horse`, `create task`, `new exercise log`.

The search input placeholder always shows two real model names from your
application so users can see the syntax at a glance.

The Command Center reflects the live set of Refine resources — adding a new
module to the backend automatically makes it appear here with no frontend changes.
Record search follows the same `config/search.json` configuration as the header
search bar (see [Global search](./tutorial-task-manager.md#section-3--global-search)).

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

## Project Explorer

Running `veloiq` with no arguments opens an interactive terminal UI that lets you inspect everything your project has configured — without reading any files manually.

```bash
veloiq
```

If you run `veloiq` outside a project directory, the explorer shows a form to
create a new app interactively — you can set the app name, database, admin
credentials, and ports without leaving the terminal.  Every field shows its
default as a dim hint (e.g. admin user `admin`, DB user `veloiq`), so you can
see exactly what you'll get before pressing **c** to create.  The **DB type**
field is a selector you cycle with **←/→** or **Space** through the supported
engines (`sqlite`, `postgresql`, `mysql`, `mariadb`, `mssql`, `oracle`, `db2`,
`informix`); press **Enter** on it to type any other SQLAlchemy dialect.  When
SQLite is selected the host/port/user/password fields dim out, since they aren't
used.

Once inside a project, the explorer has five screens navigated with arrow keys
and letter shortcuts:

| Screen | What you see |
|---|---|
| **Home** | App summary — database URL, auth status, module/model counts, dashboard and search totals |
| **Modules** | All modules with per-module dashboard and search coverage counts |
| **Module detail** | Every model in a module with its resource name, dashboard status, and search status at a glance |
| **Model detail** | Full field list (type, FK reference, required, role restrictions), relations, dashboard tab, search enrollment, `@model_access` permissions, and ReBAC status |
| **Search config** | Enrolled models, searchable fields, and models not yet enrolled |

From any screen you can trigger CLI commands directly — `add-dashboard`, `search add-model`, `search add-field`, `generate`, `add-module` — with a Y/N confirmation before anything runs.

If `veloiq generate` has not been run yet, the explorer still loads and shows module and model names, but field and relation details require the generated schemas.

## Upgrading an existing app

When a new framework version ships, `veloiq generate` **alone is not enough** to
upgrade an app that was scaffolded against an older version. `generate` only
rewrites auto-generated artifacts (`api.py`, `*.gen.ts`, `allModels.gen.ts`,
`extensions.gen.tsx`, and the upserted `navigation.config.json`). It does not
upgrade the installed packages, the host-owned `App.tsx`, or the project's
`veloiq.toml`. Follow these steps in order:

```bash
# 1. Upgrade the backend package (provides the veloiq CLI + code generator)
pip install -U veloiq-framework

# 2. Upgrade the frontend component library, then rebuild
cd frontend
npm install @juicemantics/veloiq-ui@latest
cd ..
```

3. **Ensure `veloiq.toml` exists at the project root.** Newer versions read
   enabled extensions and global view settings from this file. Apps created
   before it was introduced won't have one — extensions stay disabled and the
   `[views]` settings are ignored until it's present. Create it with:

   ```toml
   [extensions]
   enabled = []        # add extension names here, e.g. ["iqvigilant"]

   [views]
   # optional global UI view settings — see the Configuration Reference
   ```

   or manage it with `veloiq extend-package <name>` / `veloiq list-extensions`.

4. **Reconcile `App.tsx` if your app predates extension frontend delivery.**
   `App.tsx` is host-owned and is *never* regenerated. The current scaffold's
   `App.tsx` imports from `./extensions.gen` and wires up
   `extensionShowComponents`, `extensionRoutes`, and `extensionUserMenuItems`,
   plus `NavConfig`. If your `App.tsx` does not already import from
   `./extensions.gen`, hand-merge those additions from a freshly scaffolded app
   (`veloiq new _tmp` in a scratch directory) before continuing — otherwise the
   regenerated `extensions.gen.tsx` is written but nothing consumes it.

```bash
# 5. Regenerate api.py + frontend schemas + extension schemas
veloiq generate

# 6. Apply any new migrations (e.g. when enabling extensions or licensing)
veloiq db upgrade
```

If your app was scaffolded recently (its `App.tsx` already imports
`./extensions.gen`), step 4 is a no-op and the upgrade is just steps 1–3, 5, 6.

## Next steps

- [Tutorial: Build a Task Manager](./tutorial-task-manager.md) — step-by-step guide covering relations, custom endpoints, and the full dev loop in ~15 minutes
- [Module Authoring](./module-authoring.md) — add relations, custom endpoints, custom schemas
- [Configuration Reference](./configuration-reference.md) — all `VeloIQConfig` options
- [Open-Core Model](./open-core.md) — free vs Pro features
