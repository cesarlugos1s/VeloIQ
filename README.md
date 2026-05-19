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

## What the framework provides

**Backend** — FastAPI · SQLModel · SQLAdmin · Alembic
- FastAPI application factory with CORS, JWT auth middleware, and RBAC built in
- Automatic CRUD router generation (`create_crud_router`) — list, get, create, update, delete
- Module auto-loader — drop a `models.py` in `app/modules/<name>/` and it's live
- SQLAdmin back-office at `/admin/` with zero configuration
- Alembic migrations pre-wired and managed by `veloiq db upgrade`
- Runs on **Linux**, **macOS**, and **Windows** (native or WSL)
- Supports **PostgreSQL**, **MySQL**, **SQLite**, and any other SQLAlchemy-compatible database

**Access control**
- Three-layer RBAC: global role permissions → per-model exceptions → per-field exceptions
- ReBAC (row-level access): filter which rows a user can see based on ownership, tenant, or any relationship
- Built-in User / Role / Tenant management with a React UI

**Frontend** — React · Refine · Ant Design
- `@veloiq/ui` React component library — schema-driven CRUD pages with no boilerplate
- Powered by **Refine** for data fetching and state management, and **Ant Design** for the component system
- **Side panels** — click any list row to open a detail panel beside the list; drag the divider to resize; minimize, maximize, or pop out to a full page
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
- `veloiq generate` — regenerate `api.py` and TypeScript schemas from your models
- `veloiq run` — start the development server
- `veloiq db upgrade` — apply Alembic migrations

---

## Five-minute demo

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
| [docs/module-authoring.md](docs/module-authoring.md) | Full reference for models, relations, custom endpoints, RBAC, ReBAC, admin views, and frontend schema customisation |
| [docs/configuration-reference.md](docs/configuration-reference.md) | Every `VeloIQConfig` field and environment variable |
| [docs/open-core.md](docs/open-core.md) | Free MIT tier vs Pro/Enterprise — WYSIWYG page builder, User Journeys, VeloIQ AI engine, Advanced ReBAC, SSO, compliance audit logs, and Goal-Seeking Scenarios |

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
  ui/                       # @veloiq/ui — React component library
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
