# VeloIQ™ Framework

**[veloiq.dev](https://veloiq.dev)**

VeloIQ™ is an open-core full-stack framework for building data-driven admin
and ERP applications.  You define your database models in Python SQLModel; the framework
generates the REST API, the SQLAdmin back-office, and the React CRUD frontend
automatically.

Built on **FastAPI** and **SQLModel** on the backend, and **React**, **Refine**,
and **Ant Design** on the frontend — battle-tested, well-documented libraries
trusted by thousands of production teams worldwide.

VeloIQ™ is a **pro-code framework**, not a no-code tool.  The generated code
is yours: every FastAPI endpoint, every React component, every SQLModel field is
plain Python and TypeScript that you can read, extend, and override.  The
framework handles the repetitive scaffolding so you spend your time on the logic
that makes your application unique — not on boilerplate.

```python
# VeloIQ™ — this is your entire backend entry point.
from veloiq_framework import create_veloiq_app
app = create_veloiq_app()
```

```python
# VeloIQ™ — two related modules: full CRUD and a React UI for both, including the relation.
from typing import List, Optional
from sqlmodel import Field
from veloiq_framework import TimestampedModel, jm_relationship

class TeamMember(TimestampedModel, table=True):
    __tablename__ = "team_member"
    name: str
    email: str
    role: str = "member"
    projects: List["Project"] = jm_relationship(back_populates="owner")

class Project(TimestampedModel, table=True):
    __tablename__ = "project"
    name: str
    status: str = "active"
    owner_id: Optional[int] = Field(default=None, foreign_key="team_member.id")
    owner: Optional["TeamMember"] = jm_relationship(back_populates="projects")
```

---

## See it in action

![Building an app with VeloIQ Studio — scaffolding models, fields, and relations, then running the generated app](website/showcase-assets/demo-gif/build-an-app.gif)

*Scaffold modules, models, fields, and a relation through VeloIQ Studio, then run the generated app — full CRUD, auth, RBAC, and analysis charts, with zero React written. See the resulting UI in the [showcase](https://veloiq.dev/showcase.html).*

> Want to see this running on your machine in 5 minutes? Jump to the [Five-minute demo](#five-minute-demo) below.

---

## What's New in v0.9.3

- **Navigate to related** — select rows on any list page, pick a relation from
  the dropdown, and jump to the related model's filtered list. Supports forward
  and reverse relations, recursive multi-hop navigation, and browser-native
  right-click "open in new tab". The first relation is auto-selected for
  immediate navigation.
- **Append related list** — stack filtered related-model lists directly below
  the current list page instead of navigating away. Each appended list is a
  fully-functional DynamicList with its own search, sort, filter, multi-select,
  and bulk actions — and can itself append further lists, enabling a multi-level
  drill-down workflow without leaving the page.
- **Right-click context menu** — right-click any row on a list page to open a
  context menu with the same bulk actions available in the multi-select toolbar
  (change field value, export CSV, navigate/append related, clone, pin/unpin,
  delete), plus **Open show page**, **Open in new tab**, and **Open in new
  window**. The context menu adapts its contrast automatically to light and dark
  themes.
- **Backend `__in` operator** — `?field__in=1,2,3` IN-clause filtering on any
  column in list endpoints.

## What's New in v0.9.1

- **Fix** — Search input text is now visible in the top bar in both light and dark
  modes when `plain_color_base_hex` is configured. CSS wildcard selectors exclude
  form inputs via `:not()`, and `GlobalSearch` applies `token.colorText` directly.
- **Fix** — SQLAdmin list/detail pages no longer crash for models with `sa_column`
  aliasing (e.g. `jm_eid` / `eid`). The `get_object_identifier` patch now covers
  all six SQLAdmin modules that import the function by name.
- **Fix** — SQLAdmin auto-sort no longer crashes on columns defined as
  `column_property`; sort is restricted to real table columns.
- **Fix** — Admin SPA fallback route uses `router.default` instead of `mount`,
  preventing blank pages in certain deployments.
- **Improvement** — Visual polish: inverted menu header/sidebar colors, default
  theme color switched to teal (`#1e708a`), single field borders, larger page titles.
- **Docs** — `import-schema` tutorial expanded with TUI/Studio alternatives for every step.

See [CHANGELOG.md](CHANGELOG.md) for the full release notes.

## What's New in v0.9.0

- **Convention-based page overrides for all page types** — drop a `custom_show.tsx`,
  `custom_edit.tsx`, `custom_create.tsx`, or `custom_list.tsx` into a model's page directory,
  run `veloiq generate`, and the custom component replaces the default page at runtime.
  Extensions can now declare `edit_overrides`, `create_overrides`, and `list_overrides`.
- **Literal type → dropdowns** — `Literal["a", "b"]` annotations on model fields are
  auto-detected and rendered as enumerated dropdown selects in generated forms.
- **Bulk-read API** — `POST /api/_meta/bulk-read` returns fully-serialized records by ID array.
- **Configurable model titles** — declare `titleFields` on any model to control how records
  are labeled throughout the UI (breadcrumbs, relation chips, list rows).
- **`veloiq import-schema`** — import an existing database schema into VeloIQ modules with
  foreign keys, types, and defaults preserved.
- **Security** — removed `VELOIQ_AUTH_DISABLED` escape hatch; authentication and RBAC are
  always enforced. New apps must run `veloiq migrate` to seed the admin user.
- **Crosstab chart renderer** — backend-rendered crosstab charts with Plotly 3D/bubble fixes.
- **Studio** — model-name dropdowns, searchable combo-boxes, IQVigilant hardening nudges.
- **Fixes** — list search uses `contains` for partial-text matching; `DynamicResource` guards
  against non-array dataSource; solo page sections span full grid width; CLI `veloiq run` works
  from repo root; i18n locale override honored in `main.tsx`.

See [CHANGELOG.md](CHANGELOG.md) for the full release notes.

## What's New in v0.8.5

- **New** — Dev-mode auto-migration: when `VELOIQ_DEV=1`, the framework detects missing columns
  on startup and applies `ALTER TABLE … ADD COLUMN` automatically — no manual migration step
  needed while iterating on your schema
- **Fix** — User/Role/Tenant CRUD routes are now correctly mounted under `/api`, matching the
  frontend's dataProvider (new apps previously showed empty User/Role/Tenant lists)
- **Fix** — `veloiq new` now correctly runs `veloiq generate` and `veloiq build` automatically,
  so a freshly scaffolded app works immediately with just `veloiq run`
- **Fix** — `DynamicResource` list, show, and crosstab pages no longer crash with
  `TypeError: e.map is not a function` when `tableProps.dataSource` resolves to a non-array
  truthy value

## What's New in v0.8.3

- **Fix** — menu/journey rendering no longer crashes when `useMenu()` or an unlicensed
  extension's `/api/journeys` endpoint returns a non-array shape (e.g. a 403)

## What's New in v0.8.0

- **`veloiq add-model`** — add a new SQLModel class to any module interactively; no manual file editing required
- **`veloiq add-field`** — add a field to an existing model and auto-run `alembic autogenerate` + `upgrade` in one step
- **`veloiq add-relation`** — wire up FK or many-to-many relations between models; auto-disambiguates `foreign_keys=` when multiple paths exist
- **`veloiq scaffold-page`** — generate a custom React override for any list or show page, pre-wired and patched into `App.tsx`
- **`veloiq check`** — health-check your project for missing dashboard config, unindexed search models, and undocumented models
- **Richer TUI** — model detail shows the path to `models.py`, field defaults, docstrings, options, relations, and custom page overrides; `[a]` opens `add-field` inline
- **Schema generator** — field options emitted as `{label, value}[]` typed objects; model docstrings and field descriptions flow into TypeScript
- **Alembic scaffold** — `naming_convention` and `render_as_batch=True` added to `env.py` for deterministic constraint names and SQLite `ALTER TABLE` support
- **UI** — relation tables show related entity labels; config relations resolve by `resourcePath` when `relationName` is absent
- **Expanded DB support** — any SQLAlchemy dialect string accepted in `veloiq new` and `veloiq configure-db`

See [CHANGELOG.md](CHANGELOG.md) for the full release notes.

---

## What the framework provides

**Backend** — FastAPI · SQLModel · SQLAdmin · Alembic
- FastAPI application factory with CORS, JWT auth middleware, and RBAC built in
- Automatic CRUD router generation (`create_crud_router`) — list, get, create, update, delete
- Module auto-loader — drop a `models.py` in `app/modules/<name>/` and it's live
- SQLAdmin back-office at `/admin/` with zero configuration
- Alembic migrations pre-wired and managed by `veloiq db upgrade`
- Runs on **Linux**, **macOS**, and **Windows** (native or WSL)
- Supports **PostgreSQL**, **MySQL**, **MariaDB**, **SQL Server**, **Oracle**, **Snowflake**, **DuckDB**, **ClickHouse**, **BigQuery**, **DB2**, **Informix**, **SQLite**, and any other SQLAlchemy-compatible database

**Access control**
- Three-layer RBAC: global role permissions → per-model exceptions → per-field exceptions
- ReBAC (row-level access): filter which rows a user can see based on ownership, tenant, or any relationship
- Built-in User / Role / Tenant management with a React UI

**Frontend** — React · Refine · Ant Design
- `@juicemantics/veloiq-ui` React component library — schema-driven CRUD pages with no boilerplate
- Powered by **Refine** for data fetching and state management, and **Ant Design** for the component system
- **Side panels** — left-click any list row to open a detail panel beside the list; drag the divider to resize; minimize, maximize, or pop out to a full page
- **Right-click context menu** — right-click any list row to access bulk actions (change field value, export CSV, navigate/append related, clone, pin/unpin, delete) plus Open show page, Open in new tab, and Open in new window — with theme-aware contrast
- **Stacked related lists** — use "Append related list" to open filtered related-model list pages directly below the current one; each appended list is fully functional and can itself append further lists, enabling multi-level drill-down without leaving the page
- **Miller columns tree view** — hierarchical parent/child data renders as an interactive multi-column browser, auto-detected from self-referential model relationships
- **Relations explorer** — an interactive graph on any record's Show page that visualises all connected records; click any node to navigate directly to it
- **Analysis charts** — distribution and summary charts appear automatically on relation tables with more than one row; toggle per view, preference saved
- **Column configuration** — show, hide, and reorder columns in any list or relation table; preferences saved per user
- **Bulk actions** — select multiple rows for bulk edit, bulk delete, or CSV export
- Inline sorting, filtering, and global search — all configurable, no code required
- Light and dark mode, keyboard shortcuts, and responsive layout out of the box

**CLI**
- `veloiq new <app>` — scaffold a new project in seconds
- `veloiq add-module <name>` — add a module to an existing project
- `veloiq add-model` — add a SQLModel class to any module interactively
- `veloiq add-field` — add a field to a model and auto-migrate the database
- `veloiq add-relation` — wire up FK or many-to-many relations between models
- `veloiq scaffold-page` — generate a custom React page override for any resource
- `veloiq check` — health-check your project configuration
- `veloiq generate` — regenerate `api.py` and TypeScript schemas from your models; also syncs installed extension schemas
- `veloiq build` — build the frontend for production; the backend serves the compiled React app at `/` — no Vite dev server needed
- `veloiq run` — start the server (dev: backend only; production: API + UI on one port)
- `veloiq db upgrade` — apply Alembic migrations
- `veloiq new-extension <name>` — scaffold a new extension package (backend modules + frontend schemas + license module + licensing CLI)
- `veloiq add-licensing` — add optional license enforcement to a host app's own modules

---

## Extension packages

VeloIQ has a **modular extension architecture** — pip-installable packages that add modules, UI schemas, and license-gated features to any host app without modifying the host app's code.

Extension packages declare themselves via a `veloiq.extensions` Python entry point.  When the app starts, `create_veloiq_app()` discovers all installed extensions automatically, loads their backend modules alongside the host app's own modules, and mounts their static JS bundles at `/ext/{name}/`.  Running `veloiq generate` copies the extension's frontend schema files into the host app and updates `allModels.gen.ts` and `navigation.config.json`.

Each extension manages its own licensing through a bundled license module.  The extension developer holds a private RSA key used to sign JWT license tokens; the matching public key ships inside the package.  The host app's License Management page (a pre-built React bundle from the extension) handles key registration, expiry, and grace-period enforcement.  Extension licensing is completely independent — multiple extensions installed in the same app each enforce their own licenses separately.

The **host app itself is always MIT** — the framework never enforces licensing on the app developer's own modules unless `veloiq add-licensing` is explicitly run.

See [docs/open-core.md](docs/open-core.md) for the Pro/Enterprise extension packages (IQVigilant, VantageIQ) and [docs/module-authoring.md](docs/module-authoring.md) for the extension authoring reference.

---

## Five-minute demo

**From zero to a running full-stack app with auth, RBAC, and a React CRUD UI in under 5 minutes.**

See the framework in action without writing any code:

```bash
git clone https://github.com/cesarlugos1s/veloiq.git
cd veloiq
bash samples/task-manager/quickstart.sh
```

The script sets up the environment, starts both servers, and opens
`http://localhost:5173` in your browser — a working task-manager app with
authentication, RBAC, and a full CRUD UI.

See [docs/quickstart.md](docs/quickstart.md) for what to explore once it is running.

---

## Documentation

| Document | Purpose |
|---|---|
| [docs/quickstart.md](docs/quickstart.md) | Run the sample app in five minutes and explore RBAC, ReBAC, Miller columns, and the analysis UI |
| [docs/getting-started.md](docs/getting-started.md) | Install the CLI, scaffold your first project, and understand the key concepts |
| [docs/tutorial-task-manager.md](docs/tutorial-task-manager.md) | Step-by-step tutorial building a full task manager — seven independent sections you can do in any order |
| [docs/tutorial-import-schema.md](docs/tutorial-import-schema.md) | Import an existing database into VeloIQ models — no models to write by hand |
| [docs/module-authoring.md](docs/module-authoring.md) | Full reference for models, relations, custom endpoints, RBAC, ReBAC, admin views, frontend schema customisation, and extension package authoring |
| [docs/configuration-reference.md](docs/configuration-reference.md) | Every `VeloIQConfig` field and environment variable |
| [docs/open-core.md](docs/open-core.md) | Free MIT tier vs Pro/Enterprise — extension packages (IQVigilant, VantageIQ), licensing architecture, and the full feature set |
| [CHANGELOG.md](CHANGELOG.md) | Release notes and version history |

**Recommended reading order for new developers:**

1. Run `quickstart.sh` and browse the demo app
2. Read `getting-started.md` to understand the project structure
3. Work through Section 1 of the tutorial to build your own app
4. Come back to `module-authoring.md` as a reference when you need details

---

## Repository layout

```
backend/
  veloiq_framework/         # Framework Python package (pip-installable as veloiq-framework)
    auth/                   # Built-in auth: User, Role, Tenant, JWT, RBAC
    cli/                    # veloiq CLI commands
    scaffold/               # Templates used by `veloiq new`
  pyproject.toml
  setup.py

packages/
  ui/                       # @juicemantics/veloiq-ui — React component library
    src/                    # TypeScript source
    dist/                   # Built output (committed; consumers install from this)

docs/                       # Framework documentation

samples/
  task-manager/             # Complete reference application
    backend/                # FastAPI backend
    frontend/               # React frontend
    quickstart.sh           # One-command setup and launch
    start.sh                # Re-launch after first run
```

---

## License

The framework core is released under the **MIT License**.
Copyright (c) 2026 JuiceMantics.
See [docs/open-core.md](docs/open-core.md) for the full open-core model.
