# Tutorial: Build a Task Manager in 15 Minutes

You will build a working task-management application from scratch: a PostgreSQL
database, a REST API, a SQLAdmin back-office, and a React CRUD frontend — with
almost no code to write yourself.

The finished app lives in `samples/task-manager/` if you want to compare at any
point.

## What you will build

Three modules, four models:

- **Team** — team members with a name, email, and role
- **Projects** — projects with a status and an owner (a team member)
- **Tasks** — tasks with a priority, a due date, a project, and an assignee;
  plus a self-referential parent/sub-task relationship that renders as an
  interactive **Miller columns** tree view in the UI

By the end you will have:

- A REST API at `http://localhost:8000` with auto-generated CRUD for all three
  entities plus a custom `POST /task/{id}/complete` endpoint
- Interactive API docs at `http://localhost:8000/docs`
- A SQLAdmin back-office at `http://localhost:8000/admin/`
- A React CRUD frontend at `http://localhost:5173` — including a tree browser
  for navigating task hierarchies with Miller columns

---

## Prerequisites

- Python 3.10+
- Node.js 18+
- A running PostgreSQL instance

---

## Step 1 — Create the project (1 min)

```bash
pip install safemantiq-framework
safem new task-manager
cd task-manager
```

> **Before PyPI release:** clone the repo, create a virtual environment, then
> install an editable copy of the framework:
>
> ```bash
> git clone https://github.com/cesarlugos1s/SafeMantIQ.git
> cd SafeMantIQ
> python3 -m venv .venv
> source .venv/bin/activate          # Windows: .venv\Scripts\activate
> pip install -e backend/
> safem new task-manager
> cd task-manager
> ```
>
> Everything else in this tutorial is identical.

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

`backend/app/main.py` is already complete:

```python
from safemantiq_framework import create_safem_app
app = create_safem_app()
```

---

## Step 2 — Configure the database (1 min)

```bash
cd backend
cp .env.example .env
```

### Option A — SQLite (fastest start, no server required)

The sample app ships with a pre-filled `taskmanager.db` file.  `.env.example`
already points to it:

```
DATABASE_URL=sqlite:///./taskmanager.db
```

Skip `safem db upgrade` in Step 9 — the tables and sample data are already
there.  If you want a clean slate, delete `taskmanager.db` and run:

```bash
safem db upgrade          # recreates the tables
python seed_sqlite.py     # optional: re-seed with sample data
```

### Option B — PostgreSQL

Edit `.env` and set your database URL:

```
DATABASE_URL=postgresql://user:pass@localhost/task_manager
```

Also update `requirements.txt` to pull in the PostgreSQL driver:

```
safemantiq-framework[postgres]
```

---

## Step 3 — Scaffold the three modules (30 sec)

Instead of creating directories by hand, use the CLI:

```bash
# still inside task-manager/ (the project root)
safem add-module team
safem add-module projects
safem add-module tasks --with-custom-api
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
    ├── models.py          ← fill this in
    └── custom_api.py      ← your custom endpoints go here
```

> **Tip:** add `--with-admin` to any module to also generate an
> `admin/admin_views.py` stub for the SQLAdmin back-office.

---

## Step 4 — Write the Team module (1 min)

Replace `backend/app/modules/team/models.py` with:

```python
from typing import List
from safemantiq_framework import TimestampedModel, jm_relationship


class TeamMember(TimestampedModel, table=True):
    __tablename__ = "team_member"

    name: str
    email: str
    role: str = "member"

    owned_projects: List["Project"] = jm_relationship(back_populates="owner")
    assigned_tasks: List["Task"] = jm_relationship(back_populates="assignee")
```

> **About `TimestampedModel`:** inheriting from it adds `created_at` and
> `updated_at` columns automatically.  The generator always places them *last*
> in every list, form, and detail view, after the fields you declare.
> If your model doesn't need audit timestamps, inherit from `FrameworkModel`
> instead — it provides only the `id` primary key and the UI will show exactly
> the fields you define, nothing more.

---

## Step 5 — Write the Projects module (1 min)

Replace `backend/app/modules/projects/models.py` with:

```python
from typing import List, Optional
from sqlmodel import Field
from safemantiq_framework import TimestampedModel, jm_relationship


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

## Step 6 — Write the Tasks module (3 min)

Replace `backend/app/modules/tasks/models.py` with:

```python
import datetime
from typing import List, Optional
from sqlmodel import Field
from safemantiq_framework import TimestampedModel, jm_relationship


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

The `parent_task_id` FK and the `subtasks` / `parent_task` relationships give every
task an optional parent.  The code generator detects the self-referential
one-to-many and automatically sets `showViewType: "tree-details"` in the
TypeScript schema — which tells the React UI to render the sub-tasks relation
as a **Miller columns** tree browser instead of a flat table.

Now fill in `backend/app/modules/tasks/custom_api.py`:

```python
from fastapi import Depends, HTTPException
from sqlmodel import Session

from safemantiq_framework import get_session
from .api import router        # import the auto-generated router
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

---

## Step 7 — Generate the API and frontend schemas (1 min)

```bash
# still in backend/
python api_schema_gen.py
```

This writes, for each module:

- `backend/app/modules/{module}/api.py` — standard CRUD endpoints
- `frontend/src/pages/{module}/{module}Schema.gen.ts` — TypeScript field definitions

You will see output like:

```
Generated: modules/team/api.py
Generated: modules/projects/api.py
Generated: modules/tasks/api.py
Generated: frontend/src/pages/team/teamSchema.gen.ts
Generated: frontend/src/pages/projects/projectsSchema.gen.ts
Generated: frontend/src/pages/tasks/tasksSchema.gen.ts
```

Open `frontend/src/pages/tasks/tasksSchema.gen.ts` and notice the auto-generated
relation for sub-tasks:

```ts
{ resource: "task", targetKey: "parent_task_id", label: "Subtasks",
  isRecursive: true, otherKey: "id", otherResource: "task",
  resourcePath: "task", showViewType: "tree-details" }
```

No extra configuration needed — the framework detected the self-referential
relationship and wired up the tree view for you.

---

## Step 8 — Configure global search (1 min)

The search bar in the application header can find both pages and data records.
Pages are found automatically from the navigation menu.  Data search requires
you to tell the framework which models to search and which fields to match
against:

```bash
# still inside task-manager/ (the project root)
safem search add-model TeamMember --fields name,email
safem search add-model Project    --fields name,description
safem search add-model Task       --fields title,description
```

This creates `config/search.json`:

```json
{
  "models": ["TeamMember", "Project", "Task"],
  "fields": ["name", "email", "description", "title"]
}
```

At runtime the backend serves this file from `GET /config/search`.  The
frontend reads it once on startup and uses it to know which API endpoints to
query when the user types in the search bar.

**How the field matching works:** the field list is shared across all
models.  For each model, only fields whose key exactly matches one of the
listed names (or ends with `_<name>`, for example `task_title` matches
`title`) are searched.  Models that have none of the listed fields are
skipped automatically.

To review or change the configuration later:

```bash
safem search list           # show current config
safem search add-field role # add another field
safem search remove-model Project  # remove a model
```

---

## Step 9 — Start the backend (1 min)

```bash
pip install -r requirements.txt
safem db upgrade        # creates tables  (skip if using the pre-filled SQLite file)
safem run               # http://localhost:8000
```

> **SQLite shortcut:** if you are using the bundled `taskmanager.db`, the
> tables and sample data are already present — omit `safem db upgrade` and
> jump straight to `safem run`.

Open `http://localhost:8000/docs`.  You have a fully documented REST API for
all three entities plus the `POST /task/{id}/complete` endpoint you wrote — with
no router registration code anywhere in `main.py`.

Open `http://localhost:8000/admin/` to explore the SQLAdmin back-office.

---

## Step 10 — Start the frontend (2 min)

In a second terminal:

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173
```

> **Before npm registry release:** build and install `@safemantiq/ui` from the
> cloned repo first — same idea as the Python editable install:
>
> ```bash
> # Build the UI package once (relative to SafeMantIQ/task-manager/frontend/)
> cd ../../packages/ui
> npm install && npm run build
>
> # Back to your project frontend
> cd ../../task-manager/frontend
> npm install ../../packages/ui
> npm install
> npm run dev
> ```

Open `http://localhost:5173`.  You will be redirected to `/login`.

---

## Step 11 — Log in to your app

Every SafeMantIQ application ships with **authentication enabled by default**.
The first time the backend starts it seeds a default admin user and the three
built-in roles.

### Pre-seeded credentials (task-manager sample)

| Username | Password   | Role    | Access                          |
|----------|------------|---------|---------------------------------|
| `admin`  | `admin`    | Admin   | Full CRUD — all resources       |
| `alice`  | `alice123` | Manager | Create and edit — no delete     |
| `bob`    | `bob123`   | Manager | Create and edit — no delete     |
| `carol`  | `carol123` | Viewer  | Read-only                       |

Log in with `admin` / `admin`.  After a successful login you are redirected to
the first resource list and will see the sidebar with:

- **Tasks**, **Projects**, **Team** — your application modules
- **Access Control** group — **Users**, **Roles**, **Tenants** — built-in auth management

### Role permissions

| Role    | GET | POST | PUT / PATCH | DELETE |
|---------|-----|------|-------------|--------|
| Admin   | ✓   | ✓    | ✓           | ✓      |
| Manager | ✓   | ✓    | ✓           | ✗      |
| Viewer  | ✓   | ✗    | ✗           | ✗      |

When a Viewer logs in, Create / Edit / Delete buttons are hidden in the UI and
the backend returns `403` for any mutating requests.

### Add more users

```bash
# POST /auth/register (Admin token required in Authorization header)
curl -X POST http://localhost:8000/auth/register \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"username":"diana","password":"diana123","email":"diana@example.com","role_names":["Manager"]}'
```

Or manage users directly in the **Users** page inside the app.

### Change your password

```bash
curl -X PUT http://localhost:8000/auth/change-password \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"current_password":"admin","new_password":"my-new-password"}'
```

### Disable auth during development

Add `SAFEM_AUTH_DISABLED=1` to your `.env` file.  The backend will accept any
request without validating tokens.  **Never use this in production.**

### Before going to production

1. Replace `AUTH_SECRET` in `.env` with a long random string:
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```
2. Change the default `admin` password.
3. Remove or rename the `SAFEM_AUTH_DISABLED` variable.

---

## Step 13 — Try the Miller columns tree view

Create a few tasks and link them as sub-tasks by setting **Parent Task Id**:

1. Create a top-level task: *"Launch website"*
2. Create sub-tasks: *"Write copy"*, *"Design mockups"*, *"Set up hosting"* —
   each with **Parent Task Id** pointing to *"Launch website"*
3. Create a sub-sub-task under *"Write copy"*: *"Draft landing page headline"*
4. Open the **Show** page for *"Launch website"*

The **Subtasks** panel renders as a **Miller columns** browser: each column
shows the children of the currently selected item.  Click any sub-task to
navigate into it and a new column slides in to the right; the breadcrumb trail
at the top of each column lets you go back up the tree without leaving the page.

You can nest tasks arbitrarily deep — the tree browser handles any depth
automatically.

**Resize and navigate:**

- Drag the vertical handle between two columns to resize them.
- Each item row has a small **↗** (open in new tab) button on the right — click it
  to open that task's Show page in a full browser tab, leaving the tree view in
  place.
- **Right-click** any item row and choose *Open link in new tab* from the
  browser context menu to do the same thing without leaving the current page.

### Panels right

On the **Tasks list** page the same row-click behaviour is available in a
side-by-side layout.  When you click a row in the list, a detail panel slides in
from the right showing the full Show view for that task.

- Drag the divider between the list and the panel to resize them.
- Each panel header has **—** (minimize), **⤢** (maximize), and **✕** (close)
  buttons.
- The **↗** button in the panel header opens the same record as a standalone
  full-page view in a new browser tab.

---

## Step 14 — Customise relation tables: analyse, columns, sorting & filtering

Open the Show page for a project that has several tasks.  The **Tasks** table at
the bottom of the page is a fully interactive data table you can configure
without any code changes.

**Analyse:** the **Analyse** panel opens automatically when a relation table has
more than one row.  It renders distribution charts for the columns in that
relation (status, priority, etc.), giving a quick at-a-glance breakdown of the
related records.  Click the bar-chart icon (📊) in the table toolbar to toggle
it manually, and the next time your preference is saved.

**Columns:** click the columns/settings icon (⚙) in the toolbar to open the
**Column configuration** panel.  Tick or untick columns to show or hide them,
and drag them to reorder.  Your preferences are saved per user and per view.

**Sorting:** click any column header to sort ascending; click again to sort
descending; click a third time to clear the sort.

**Filtering:** hover over a column header to reveal the filter icon (▼).  Click
it to open an inline filter for that column.  String columns support
contains/starts-with; number and date columns support range operators.  Multiple
filters stack.

These features work on every relation table throughout the application — not
just for Tasks — so users can immediately start exploring data without any
developer effort.

---

## Step 15 — Discover the built-in UI features

The application shell includes several features worth pointing out to your end
users.

**Sidebar menu** — click the collapse arrow on the left edge of the sidebar to
fold it down to icon-only mode, freeing up horizontal space.  Click the same
control to expand it again.

**Light / dark mode** — the toggle in the top-right corner of the application
header switches between light and dark themes.  The preference is stored in the
browser.

**Metadata** — the **ℹ** (metadata) button in a list toolbar opens a modal that
shows technical details about the resource: field names, types, relation targets,
and the API path the view is reading from.  Useful during development and for
power users who want to understand the data model.

**Explore** — the **⬡** (explore) button on a Show page opens the
**Relations Explorer**: an interactive graph that visualises all the relations
connected to that record — which records it points to and which records point to
it.  Click any node to navigate directly to that record.

**Multi-row bulk actions** — in any list view, tick the checkboxes on the left of
one or more rows.  A bulk-action toolbar appears at the bottom of the table with
operations such as bulk edit, bulk delete, and export to CSV.  The available
actions depend on the resource, but export and delete are always present.

---

## What just happened

| You wrote | The framework generated |
|---|---|
| 3 × `models.py` | 3 × `api.py` (CRUD REST endpoints) |
| 1 × `custom_api.py` (7 lines) | 3 × TypeScript schemas |
| nothing in `main.py` | Auto-registered all routers and admin views |
| self-referential FK in Task | Miller columns tree view — automatically |

The total code you wrote is three model files and one seven-line custom
endpoint.  Everything else — routing, pagination, response headers, database
sessions, admin views, TypeScript types, the tree browser, the side-panel
layout, the analyse charts, column configuration, sorting, filtering, dark mode,
the relations explorer, and bulk actions — was generated or handled by the
framework.

---

## Next steps

- Add an `admin/admin_views.py` to customise how tasks appear in the back-office
  → [Module Authoring](./module-authoring.md#adminadmin_viewspy)
- Override a generated TypeScript schema to add a custom field label or relation
  renderer → [Module Authoring](./module-authoring.md#frontend-schema-customisation)
- Configure auth, CORS, or Alembic migrations
  → [Configuration Reference](./configuration-reference.md)
- See the full list of free and Pro features
  → [Open-Core Model](./open-core.md)
