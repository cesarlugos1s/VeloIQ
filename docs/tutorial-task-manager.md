# Tutorial: Build a Task Manager

You will build a working task-management application from scratch: a REST API,
a SQLAdmin back-office, and a React CRUD frontend — with almost no code to write.

The finished app lives in `samples/task-manager/` if you want to compare at any point.

---

## What this tutorial covers

| Section | Goal | Time | Required? |
|---|---|---|---|
| [Section 1 — Core app](#section-1--create-and-run-your-first-app) | Have a working full-stack app in your browser | ~15 min | **Yes** |
| [Section 2 — Custom endpoints](#section-2--custom-endpoints) | Add business logic beyond standard CRUD | ~5 min | Optional |
| [Section 3 — Global search](#section-3--global-search) | Wire up the header search bar | ~5 min | Optional |
| [Section 4 — RBAC](#section-4--role-based-access-control-rbac) | Restrict what roles can do globally, per-model, and per-field | ~10 min | Optional |
| [Section 5 — ReBAC](#section-5--row-level-access-control-rebac) | Filter which rows each user can see | ~10 min | Optional |
| [Section 6 — Tree views](#section-6--tree-views-and-miller-columns) | Navigate task hierarchies with Miller columns | ~5 min | Optional |
| [Section 7 — Built-in UI features](#section-7--built-in-ui-features) | Explore the analysis charts, column config, dark mode | ~5 min | Optional |

**Complete Section 1 first.** All optional sections depend only on Section 1, not on each other, so you can read their goal and skip or do them in any order.

---

## What you will build

Three modules, four models:

- **Team** — team members with a name, email, and role
- **Projects** — projects with a status and an owner (a team member)
- **Tasks** — tasks with priority, due date, project, and assignee; plus a
  self-referential parent/sub-task relationship that renders as an interactive
  **Miller columns** tree view

By the end of Section 1 you will have:

- A REST API at `http://localhost:8000` with auto-generated CRUD for all three entities
- Interactive API docs at `http://localhost:8000/docs`
- A SQLAdmin back-office at `http://localhost:8000/admin/`
- A React CRUD frontend at `http://localhost:5173`

---

# Section 1 — Create and run your first app

**Goal:** Have a working full-stack CRUD app with authentication in your browser in about 15 minutes.

**Prerequisites:** Python 3.10+, Node.js 18+

---

## Step 1 — Create the project (1 min)

```bash
cd ~/projects          # or wherever you keep your code
git clone https://github.com/cesarlugos1s/VeloIQ.git
cd VeloIQ
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -e backend/
veloiq new task-manager
cd task-manager
```

You get this layout:

```
task-manager/
├── backend/
│   ├── app/
│   │   ├── main.py          # one line
│   │   └── modules/         # your modules go here
│   ├── .env.example
│   ├── requirements.txt
│   └── api_schema_gen.py
└── frontend/
    ├── src/
    │   ├── App.tsx
    │   └── allModels.gen.ts
    └── package.json
```

`backend/app/main.py` is already complete — one line that creates the whole app:

```python
from veloiq_framework import create_veloiq_app
app = create_veloiq_app()
```

---

## Step 2 — Configure the database (1 min)

```bash
cd backend
cp .env.example .env
```

### Option A — SQLite (fastest start, no server required)

`.env.example` already points to a local SQLite file — no changes needed:

```
DATABASE_URL=sqlite:///./app.db
```

SQLite creates `app.db` automatically on the first startup.

### Option B — PostgreSQL

Edit `.env` and set your database URL:

```
DATABASE_URL=postgresql://user:pass@localhost/task_manager
```

Also update `requirements.txt` to pull in the PostgreSQL driver:

```
veloiq-framework[postgres]
```

---

## Step 3 — Scaffold the three modules (30 sec)

```bash
cd ..                  # back to task-manager/
veloiq add-module team
veloiq add-module projects
veloiq add-module tasks
```

Each command creates the module skeleton under `backend/app/modules/`:

```
backend/app/modules/
├── team/
│   ├── __init__.py
│   └── models.py          ← fill this in
├── projects/
│   ├── __init__.py
│   └── models.py          ← fill this in
└── tasks/
    ├── __init__.py
    └── models.py          ← fill this in
```

> **Tip:** pass `--with-custom-api` or `--with-admin` to also generate a
> `custom_api.py` or `admin/admin_views.py` stub.

---

## Shortcut — use a vibe coding tool for Steps 4–6

Once the project skeleton exists you can hand the remaining model-writing to an
AI coding tool instead of typing models by hand.  Every project created with
`veloiq new` ships with context files that tell the tool the framework conventions:

| Tool | Context file loaded automatically |
|---|---|
| Claude Code | `CLAUDE.md` |
| Cursor | `.cursor/rules/veloiq.mdc` + `models.mdc` |
| Windsurf | `.windsurfrules` |
| GitHub Copilot | `.github/copilot-instructions.md` |
| OpenAI Codex CLI | `AGENTS.md` |
| Continue.dev | `.continue/config.json` |

Open the project root in your tool and paste this prompt to complete Steps 4–6
in a single interaction:

> Build the task-manager app using the VeloIQ framework.
>
> Create three modules:
>
> - **team** — `TeamMember` model: `name: str`, `email: str`, `role: str = "member"`.
>   Relationships: `owned_projects` → Project, `assigned_tasks` → Task.
> - **projects** — `Project` model: `name: str`, `description: Optional[str]`,
>   `status: str = "active"`, FK `owner_id → team_member.id`.
>   Relationships: `owner` → TeamMember, `tasks` → Task.
> - **tasks** — `Task` model: `title: str`, `description: Optional[str]`,
>   `status: str = "todo"`, `priority: str = "medium"`,
>   `due_date: Optional[datetime.date]`, `planned_work_hours: Optional[float]`,
>   `actual_work_hours: Optional[float]`, FK `project_id → project.id`,
>   FK `assignee_id → team_member.id`, self-referential FK
>   `parent_task_id → task.id` with `subtasks` and `parent_task` relationships.
>
> Use `jm_relationship` from `veloiq_framework` for all relationships (never
> `relationship()` from SQLAlchemy or `Relationship` from SQLModel). Guard
> cross-module imports with `if TYPE_CHECKING`. Do NOT add
> `from __future__ import annotations` to any models.py — it breaks SQLModel
> relationship resolution.
>
> After writing the models run `veloiq generate` then `veloiq db init` (if
> alembic.ini is missing) then `veloiq db upgrade`.

When the AI is done, skip ahead to **Step 7**.

---

## Step 4 — Write the Team module (1 min)

Replace `backend/app/modules/team/models.py` with:

```python
from typing import List
from veloiq_framework import TimestampedModel, jm_relationship


class TeamMember(TimestampedModel, table=True):
    __tablename__ = "team_member"

    name: str
    email: str
    role: str = "member"

    owned_projects: List["Project"] = jm_relationship(back_populates="owner")
    assigned_tasks: List["Task"] = jm_relationship(back_populates="assignee")
```

> **`TimestampedModel`** adds `created_at` and `updated_at` automatically,
> always placed last in every list, form, and detail view.  Use `FrameworkModel`
> instead if you do not need audit timestamps.

---

## Step 5 — Write the Projects module (1 min)

Replace `backend/app/modules/projects/models.py` with:

```python
from typing import List, Optional
from sqlmodel import Field
from veloiq_framework import TimestampedModel, jm_relationship


class Project(TimestampedModel, table=True):
    __tablename__ = "project"

    name: str
    description: Optional[str] = None
    status: str = "active"

    owner_id: Optional[int] = Field(default=None, foreign_key="team_member.id")
    owner: Optional["TeamMember"] = jm_relationship(back_populates="owned_projects")
    tasks: List["Task"] = jm_relationship(back_populates="project")
```

---

## Step 6 — Write the Tasks module (2 min)

Replace `backend/app/modules/tasks/models.py` with:

```python
import datetime
from typing import List, Optional
from sqlmodel import Field
from veloiq_framework import TimestampedModel, jm_relationship


class Task(TimestampedModel, table=True):
    __tablename__ = "task"

    title: str
    description: Optional[str] = None
    status: str = "todo"        # todo | in_progress | done
    priority: str = "medium"    # low | medium | high | critical
    due_date: Optional[datetime.date] = None
    planned_work_hours: Optional[float] = None
    actual_work_hours: Optional[float] = None

    project_id: Optional[int] = Field(default=None, foreign_key="project.id")
    project: Optional["Project"] = jm_relationship(back_populates="tasks")

    assignee_id: Optional[int] = Field(default=None, foreign_key="team_member.id")
    assignee: Optional["TeamMember"] = jm_relationship(back_populates="assigned_tasks")

    # Self-referential: a task can have sub-tasks
    parent_task_id: Optional[int] = Field(default=None, foreign_key="task.id")
    subtasks: List["Task"] = jm_relationship(
        back_populates="parent_task",
        sa_relationship_kwargs={"foreign_keys": "[Task.parent_task_id]"},
    )
    parent_task: Optional["Task"] = jm_relationship(
        back_populates="subtasks",
        sa_relationship_kwargs={
            "foreign_keys": "[Task.parent_task_id]",
            "remote_side": "[Task.id]",
        },
    )
```

The `parent_task_id` FK and the `subtasks` / `parent_task` relationships give
every task an optional parent.  The code generator detects the self-referential
relationship and automatically sets `showViewType: "tree-details"` in the
TypeScript schema — telling the React UI to render sub-tasks as a **Miller
columns** tree browser instead of a flat table.

---

## Step 7 — Generate API and frontend schemas (1 min)

```bash
veloiq generate
```

This writes two files per module:

- `backend/app/modules/{module}/api.py` — standard CRUD endpoints
- `frontend/src/pages/{module}/{module}Schema.gen.ts` — TypeScript field definitions

> **If the generator warns about empty fields or failed introspection**, your models
> have an issue. Common causes: using `Relationship` from sqlmodel instead of
> `jm_relationship`, or having `from __future__ import annotations` at the top of
> `models.py`. Fix the models and re-run `veloiq generate`.

---

## Step 8 — Start the backend (1 min)

```bash
pip install -r requirements.txt
veloiq run               # http://localhost:8000
```

The framework creates all database tables automatically on first start — no
migration step needed for a fresh project.

> **After changing your models:** run `veloiq db upgrade` to apply schema changes
> via Alembic without restarting the app.

Open `http://localhost:8000/docs` — you have a fully documented REST API for all
three entities.  Open `http://localhost:8000/admin/` for the SQLAdmin back-office.

---

## Step 9 — Start the frontend and log in (2 min)

In a second terminal:

```bash
cd ../../packages/ui && npm install && npm run build   # build UI library (one-time)
cd ../../task-manager/frontend
npm install
npm run dev     # http://localhost:5173
```

The first line builds `@veloiq/ui` from the local repo — needed once until
the package is published to npm.

Open `http://localhost:5173`.  You will be redirected to `/login`.

Every VeloIQ application ships with authentication enabled.  The first
startup seeds a default admin user:

| Username | Password | Role | Access |
|---|---|---|---|
| `admin` | `admin` | Admin | Full CRUD on all resources |

Log in with `admin` / `admin`.  You will see the sidebar with **Tasks**,
**Projects**, **Team**, and an **Access Control** group with **Users**, **Roles**,
and **Tenants**.

> **Before going to production:** replace `AUTH_SECRET` in `.env` with a long
> random string (`python -c "import secrets; print(secrets.token_hex(32))"`),
> change the default `admin` password, and remove `VELOIQ_AUTH_DISABLED`.

---

## You're done with Section 1

| You wrote | The framework generated |
|---|---|
| 3 × `models.py` | 3 × `api.py` (full CRUD REST endpoints) |
| nothing in `main.py` | TypeScript schemas, all routers, SQLAdmin views |
| a self-referential FK in Task | Miller columns tree view — automatically |

The optional sections below are independent of each other.  Read the goal of
each and do only the ones that interest you.

---

# Section 2 — Custom endpoints

**Goal:** Learn how to add business logic beyond standard CRUD — a task "mark as
complete" action callable from any API client with a single request.

**Depends on:** Section 1 · **Time:** ~5 min

---

The auto-generated CRUD endpoints cover list, get, create, update, and delete.
For anything more specific — status transitions, batch actions, domain operations
— add a `custom_api.py` in the module directory and import the generated router.

Create `backend/app/modules/tasks/custom_api.py`:

```python
from fastapi import Depends, HTTPException
from sqlmodel import Session

from veloiq_framework import get_session
from .api import router        # the auto-generated router
from .models import Task


@router.post("/{task_id}/complete")
def complete_task(task_id: int, session: Session = Depends(get_session)):
    task = session.get(Task, task_id)
    if task is None:
        raise HTTPException(404, f"Task {task_id} not found")
    task.status = "done"
    session.add(task)
    session.commit()
    session.refresh(task)
    return task.model_dump()
```

The framework loads `custom_api.py` automatically — no registration in `main.py`.
Restart the backend (or let uvicorn hot-reload) and the new endpoint appears in
`http://localhost:8000/docs` under the `task` section.

**Vibe coding prompt:**

> In `backend/app/modules/tasks/custom_api.py` add a
> `POST /task/{task_id}/reopen` endpoint that sets `status = "todo"` and clears
> `actual_work_hours`.

---

# Section 3 — Global search

**Goal:** Wire up the header search bar so users can find team members, projects,
and tasks by typing in the search box.

**Depends on:** Section 1 · **Time:** ~5 min

---

Pages are found automatically from the navigation menu.  Data search requires
you to tell the framework which models and fields to match:

```bash
# from task-manager/backend/
veloiq search add-model TeamMember --fields name,email
veloiq search add-model Project    --fields name,description
veloiq search add-model Task       --fields title,description
```

This creates `config/search.json`:

```json
{
  "models": ["TeamMember", "Project", "Task"],
  "fields": ["name", "email", "description", "title"]
}
```

The backend serves this from `GET /config/search`; the frontend reads it on
startup and queries those endpoints when a user types in the search bar.

**How field matching works:** for each model, only fields whose key exactly
matches one of the listed names (or ends with `_<name>`, e.g. `task_title`
matches `title`) are searched.

To review or change the config later:

```bash
veloiq search list               # show current config
veloiq search add-field role     # add another field
veloiq search remove-model Project
```

---

# Section 4 — Role-based access control: RBAC

**Goal:** Understand and apply the three RBAC layers — global role permissions,
per-model exceptions, and per-field exceptions — so different roles see and do
different things.

**Depends on:** Section 1 · **Time:** ~10 min

---

The framework ships with a three-layer RBAC system.  All layers are purely
restrictive — they can narrow access but never grant more than the role's global
permissions allow.

## Layer 1 — Configurable roles (global)

Roles are defined in `backend/app/main.py`, seeded to the database on startup,
and editable at runtime through **Access Control → Roles** in the sidebar.

```python
# backend/app/main.py
from veloiq_framework import (
    create_veloiq_app, VeloIQConfig,
    RoleDef, ALL_METHODS, WRITE_METHODS, READ_METHODS,
)

app = create_veloiq_app(VeloIQConfig(
    roles=[
        RoleDef("Admin",   ALL_METHODS,   "Full administrative access",        is_preset=True),
        RoleDef("Manager", WRITE_METHODS, "Create, edit and view — no delete", is_preset=True),
        RoleDef("Viewer",  READ_METHODS,  "Read-only access",                  is_preset=True),
        # Add custom roles as needed:
        RoleDef("Auditor", READ_METHODS,  "External auditor — read only",      is_preset=True),
    ],
))
```

The `Auditor` role is upserted to the database on the next startup and
immediately appears in **Access Control → Roles**.

To test different roles, create users via **Access Control → Users** and assign roles:

| Username | Role | Can do |
|---|---|---|
| `alice` | Manager | Create and edit — no delete |
| `carol` | Viewer | Read-only |

## Layer 2 — Model-level exceptions (`@model_access`)

Restrict which actions a role may perform on one specific model, without changing
that role's permissions on every other resource.

Open `backend/app/modules/tasks/models.py` and add:

```python
from veloiq_framework import TimestampedModel, jm_relationship, model_access

@model_access(Viewer=["list", "show"])
class Task(TimestampedModel, table=True):
    ...
```

A Viewer can list and view tasks but can never create, edit, or delete one —
even if their global permissions are expanded later.  Roles **not** listed in
`@model_access` are unaffected.

> **When to use:** protecting sensitive resources (invoices, HR records) from
> roles that have broader global write access.

## Layer 3 — Field-level exceptions (`veloiq_field`)

Control which roles can read or write individual fields:

```python
from veloiq_framework import TimestampedModel, jm_relationship, veloiq_field

class Task(TimestampedModel, table=True):
    __tablename__ = "task"

    title: str
    status: str = "todo"

    # Only managers and admins can set work-hour estimates
    planned_work_hours: Optional[float] = veloiq_field(
        default=None, write_roles=["Admin", "Manager"]
    )
    # Actual hours logged — Admin-only write, everyone can read
    actual_work_hours: Optional[float] = veloiq_field(
        default=None, write_roles=["Admin", "Manager"]
    )
```

- `write_roles` — roles that may set this field.  Others' payloads are silently filtered.
- `read_roles` — roles that may see this field.  Others receive the record without it.

After changing model annotations, regenerate the schema:

```bash
cd backend && python api_schema_gen.py
```

The generator emits `readRoles` / `writeRoles` into the TypeScript schema so the
frontend also hides or disables restricted inputs.

**Vibe coding prompts:**

> In `backend/app/modules/tasks/models.py` apply `@model_access` to `Task` so
> that the `Viewer` role can only `list` and `show` tasks.  Import `model_access`
> from `veloiq_framework`.  Run `veloiq generate`.

> In `backend/app/modules/tasks/models.py` change `planned_work_hours` and
> `actual_work_hours` to use `veloiq_field(default=None, write_roles=["Admin", "Manager"])`.
> Import `veloiq_field` from `veloiq_framework`.  Run `veloiq generate`.

---

# Section 5 — Row-level access control: ReBAC

**Goal:** Filter which rows each user can access based on data ownership or
relationship traversal — for example, a user only sees tasks assigned to them.

**Depends on:** Section 1 · **Time:** ~10 min

---

Use `@rebac` when access depends on the data itself rather than a role.

## Owner-based access

```python
from veloiq_framework import TimestampedModel, jm_relationship, rebac

@rebac(owner_field="assignee_id")
class Task(TimestampedModel, table=True):
    __tablename__ = "task"

    assignee_id: Optional[int] = Field(default=None, foreign_key="team_member.id")
    ...
```

With this decorator, every list/get/update/delete endpoint filters rows so a
user only sees tasks where `assignee_id` matches their user ID.

## Tenant isolation

```python
@rebac(tenant_field="tenant_id")
class Contract(TimestampedModel, table=True):
    tenant_id: int = Field(foreign_key="veloiq_tenant.id")
```

## Relationship traversal

Use `rebac_subquery` when access follows a chain — for example, tasks are
accessible when their project is accessible:

```python
from veloiq_framework import rebac, rebac_subquery

@rebac(owner_field="owner_id")
class Project(TimestampedModel, table=True):
    owner_id: Optional[int] = Field(default=None, foreign_key="team_member.id")

@rebac(filter=lambda user, cls, session:
           cls.project_id.in_(rebac_subquery(Project, user, session)))
class Task(TimestampedModel, table=True):
    ...
```

`rebac_subquery` builds the subquery for you and handles circular-dependency
detection automatically.

## Key points

- **No automatic Admin bypass** — `@rebac` applies to all roles including Admin.
  To exempt Admins, return `True` from your filter for admin users.
- **404 not 403** — accessing an existing but inaccessible row returns 404 to
  prevent leaking which record IDs exist.
- Multiple patterns (`filter`, `owner_field`, `tenant_field`) on one decorator
  are **OR-combined**: a row is visible if any pattern allows it.
- Omitting `@rebac` from a model means no row filtering — RBAC layers 1–3 still apply.

**Vibe coding prompt:**

> In `backend/app/modules/tasks/models.py` apply `@rebac(owner_field="assignee_id")`
> to `Task` so users only see tasks assigned to them.  Import `rebac` from
> `veloiq_framework`.  Note that `@rebac` applies to all roles including Admin —
> remind me if I need an Admin bypass.

---

# Section 6 — Tree views and Miller columns

**Goal:** Explore the built-in interactive tree browser for navigating hierarchical
data (parent → sub-tasks).

**Depends on:** Section 1 (the self-referential `parent_task_id` in the Task model) · **Time:** ~5 min

---

Because `Task` has a self-referential `parent_task_id` foreign key, the code
generator automatically configured the sub-tasks relation as
`showViewType: "tree-details"` in the TypeScript schema.  No extra code needed.

Create a few tasks and link them:

1. Create a top-level task: *"Launch website"*
2. Create sub-tasks: *"Write copy"*, *"Design mockups"*, *"Set up hosting"* —
   each with **Parent Task Id** pointing to *"Launch website"*
3. Create a sub-sub-task under *"Write copy"*: *"Draft landing page headline"*
4. Open the **Show** page for *"Launch website"*

The **Subtasks** panel renders as a **Miller columns** browser: each column shows
the children of the selected item.  Click any sub-task — a new column slides in
to the right.  The breadcrumb trail at the top of each column lets you navigate
back up the tree without leaving the page.

**Resize and navigate:**

- Drag the vertical handle between two columns to resize them.
- Each row has a **↗** (open in new tab) button — click it to open that task's
  Show page in a full browser tab.
- The Tasks list page uses the same row-click behaviour in a side-by-side layout:
  click a row and a detail panel slides in from the right.

---

# Section 7 — Built-in UI features

**Goal:** Discover the analysis charts, column customisation, dark mode, and the
relations explorer — all available out of the box, no code required.

**Depends on:** Section 1 · **Time:** ~5 min

---

**Analysis charts** — open the **Show** page for a project that has several
tasks.  The **Analyse** panel renders distribution charts for the relation's
columns (status, priority, numeric fields).  Click the bar-chart icon (📊) in
the table toolbar to toggle it; your preference is saved.

**Column configuration** — click the settings icon (⚙) in any list or relation
table toolbar to open the column configuration panel.  Tick or untick columns to
show or hide them, and drag to reorder.  Preferences are saved per user and per view.

**Sorting** — click any column header to sort ascending, again to sort descending,
a third time to clear the sort.

**Filtering** — hover over a column header to reveal the filter icon (▼).  String
columns support contains/starts-with; number and date columns support range
operators.  Multiple filters stack.

**Dark mode** — the toggle in the top-right corner of the header switches between
light and dark themes.  The preference is stored in the browser.

**Metadata** — the **ℹ** button in a list toolbar opens a modal with technical
details about the resource: field names, types, relation targets, and the API path.

**Relations explorer** — the **⬡** (explore) button on any Show page opens an
interactive graph visualising all the relations connected to that record.  Click
any node to navigate directly to that record.

**Bulk actions** — tick the checkboxes on one or more rows in any list.  A
bulk-action toolbar appears at the bottom with bulk edit, bulk delete, and CSV
export.

---

## Next steps

- Add a custom admin back-office view
  → [Module Authoring](./module-authoring.md#adminadmin_viewspy)
- Override a generated TypeScript schema to add custom field labels or renderers
  → [Module Authoring](./module-authoring.md#frontend-schema-customisation)
- Configure auth, CORS, or Alembic migrations
  → [Configuration Reference](./configuration-reference.md)
- See the full list of free and Pro features
  → [Open-Core Model](./open-core.md)
