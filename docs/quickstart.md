# Quick Start — See It Running in 5 Minutes

**From zero to a running full-stack app with auth, RBAC, and a React CRUD UI in under 5 minutes.**

No tutorial to follow, no database to set up.  Run one script and the full
task-manager demo app is live in your browser.

> If this saves you time, please [⭐ star the repo](https://github.com/cesarlugos1s/VeloIQ) — it helps other developers find VeloIQ.

---

## Get the repo

Navigate to the directory where you want the project to live, then clone:

```bash
cd ~/projects          # or wherever you keep your code
git clone https://github.com/cesarlugos1s/VeloIQ.git
cd VeloIQ
```

---

## Prerequisites

| Tool | Minimum version | Check |
|---|---|---|
| Python | 3.10 | `python3 --version` |
| Node.js | 18 | `node --version` |
| npm | ships with Node | `npm --version` |

No PostgreSQL needed — the demo uses a bundled SQLite file with sample data
already in it.

---

## One command

The script is self-locating — you can run it from anywhere:

```bash
# From inside the sample directory (simplest):
cd samples/task-manager
bash quickstart.sh

# Or from the repo root, using the relative path:
bash samples/task-manager/quickstart.sh

# Or with an absolute path from anywhere on your machine:
bash /path/to/fastapi_sqladmin_prototype/samples/task-manager/quickstart.sh
```

**Windows (PowerShell):**
```powershell
# From inside the sample directory:
cd samples\task-manager
powershell -ExecutionPolicy Bypass -File quickstart.ps1

# Or from the repo root:
powershell -ExecutionPolicy Bypass -File samples\task-manager\quickstart.ps1
```

The script will:

1. Verify Python and Node.js versions
2. Create a virtual environment at `samples/task-manager/backend/.venv`
3. Install `veloiq-framework` (editable, from this repo)
4. Copy `.env.example → .env` pointing at the bundled `taskmanager.db`
5. Build `@juicemantics/veloiq-ui` from `packages/ui/` (one-time, ~15 s)
6. Run `npm install` in the frontend (one-time, ~30 s)
7. Start the FastAPI backend on port 8000
8. Start the Vite dev server on port 5173
9. Open `http://localhost:5173` in your default browser

Subsequent runs detect what is already set up and skip those steps, so
re-launching is fast.

---

## What you will see

| URL | What |
|---|---|
| `http://localhost:5173` | React CRUD frontend |
| `http://localhost:8000/docs` | Interactive REST API docs (Swagger UI) |
| `http://localhost:8000/admin/` | SQLAdmin back-office |

The app lands on a pre-configured **Dashboard** with three tabs:

- **Models Grid** — embedded lists for Projects, Tasks, Team, and Access Control, each in its own cell. Hover a cell to reveal controls (configure, open full page, maximize, minimize). Cells default to showing only the Analyse charts; click **View list** to expand the table.
- **Recent Activity** — records modified in the last 30 days, grouped by model with relative timestamps. The lookback period is adjustable.
- **Pinned Records** — records you've bookmarked from anywhere in the app. Pin from a record's Show page (📌 button in the header) or in bulk from any list's bulk-action toolbar.

The app also comes pre-loaded with:

- **3 team members** (Alice, Bob, Carol)
- **3 projects** (Website Relaunch, API v2, Brand Refresh)
- **13 tasks** across those projects, linked to team members as assignees
  — including a two-level parent/sub-task hierarchy to demonstrate the
  **Miller columns** tree view

---

## Exploring the sample data

### Miller columns tree view

1. Open the **Tasks** list and click any root-level task (e.g. *"Launch website"*).
2. The row opens in a side panel.  Scroll down to the **Subtasks** section — it
   renders as a **Miller columns** browser: each column shows the children of
   the selected item.
3. Click a sub-task to drill into the next level.  A new column slides in;
   breadcrumbs at the top of each column let you navigate back up.

### Analysis charts

1. Open **Projects → Show** for *Website Relaunch*.
2. In the **Tasks** relation table, click the **📊 Analyse** icon in the toolbar.
3. Distribution charts appear for status, priority, and the numeric fields
   (planned work hours, actual work hours).

### Dark mode

Toggle **☀ / 🌙** in the top-right corner of the application header.

### Named query — Projects with Tasks and Members

The sample app ships with a cross-model named query that joins Projects, Tasks,
and Team Members into a single denormalised view.  You can find it in two places:

- **Sidebar** — open the **Projects** group in the left navigation menu.
  "Projects with Tasks and Members" appears as its own entry below the
  individual Project and Task items.  Click it to open the full list view,
  where each row represents one Project × Task pair.
- **Project Show page** — open any project's detail page
  (e.g. click a project name, then the eye/show icon).  A
  **"Projects with Tasks and Members"** tab appears alongside the regular
  **Tasks** relation tab, already filtered to that project's rows.

### Relations explorer

On any **Show** page, click **⬡ Explore** to open a visual graph of all
records connected to that entity.

---

## Stopping and restarting

Press **Ctrl+C** in the terminal — both servers shut down cleanly.

To start again without re-running setup:

```bash
bash samples/task-manager/start.sh
```

---

## Switching to PostgreSQL

The demo defaults to SQLite for zero-friction startup.  To use your own
PostgreSQL instance:

1. Edit `samples/task-manager/backend/.env`:
   ```
   DATABASE_URL=postgresql://user:password@localhost/task_manager
   ```
2. Update `samples/task-manager/backend/requirements.txt`:
   ```
   veloiq-framework[postgres]
   ```
3. Re-install dependencies and run migrations:
   ```bash
   source samples/task-manager/backend/.venv/bin/activate
   pip install -r samples/task-manager/backend/requirements.txt
   cd samples/task-manager/backend
   veloiq db upgrade
   ```
4. Re-seed (optional):
   ```bash
   python3 seed_sqlite.py      # works with any DATABASE_URL
   ```
5. `bash samples/task-manager/start.sh`

---

## Windows

A native PowerShell script is provided alongside the Bash one.  Open
**PowerShell** (Windows Terminal, Start menu, or Win+R → `powershell`) and run:

```powershell
powershell -ExecutionPolicy Bypass -File samples\task-manager\quickstart.ps1
```

The PowerShell script does exactly the same steps as `quickstart.sh`.  The only
visible difference is that the backend and frontend servers each open in their
own console window (instead of multiplexing output in one terminal), so you can
watch their logs independently.

To restart after the first run:

```powershell
powershell -ExecutionPolicy Bypass -File samples\task-manager\start.ps1
```

**WSL / Git Bash users on Windows** can use the Bash scripts instead:

```bash
bash samples/task-manager/quickstart.sh
```

> **Note — `ExecutionPolicy`:** the `-ExecutionPolicy Bypass` flag is a
> per-invocation override that lets you run an unsigned local script without
> permanently changing your system policy.  Nothing is modified permanently.

---

## Access control

The sample app ships with three roles already configured: **Admin**, **Manager**,
and **Viewer**.  Log in with different users to see how the UI adapts:

| User | Credentials | Role | Can do |
|---|---|---|---|
| System Admin | `admin` / `admin` | Admin | Everything |
| Alice Chen | `alice` / `alice123` | Manager | Create, edit — no delete |
| Bob Martin | `bob` / `bob123` | Manager | Create, edit — no delete |
| Carol Davies | `carol` / `carol123` | Viewer | Read-only |

### RBAC — three layers of control

The framework ships with a three-layer role-based access control system that
goes from coarse to fine:

**Layer 1 — Role permissions (global, admin-UI editable)**
Each role carries a set of HTTP methods it may use.  The defaults are set in
`backend/app/main.py` via `VeloIQConfig(roles=[...])` and are editable at
runtime through **Access Control → Roles**.

**Layer 2 — Model-level exceptions (`@model_access`)**
Restrict which Refine actions a specific role may perform on one model,
independently of its global permissions.  Useful when a role should have
read-only access to a particular resource but full write access everywhere else.

```python
from veloiq_framework import model_access, TimestampedModel

@model_access(Viewer=["list", "show"])
class Invoice(TimestampedModel, table=True):
    ...
```

**Layer 3 — Field-level exceptions (`veloiq_field`)**
Control which roles can read or write a specific field.

```python
from veloiq_framework import veloiq_field, TimestampedModel

class Employee(TimestampedModel, table=True):
    name: str
    salary: float = veloiq_field(default=0.0, read_roles=["Admin"], write_roles=["Admin"])
```

### ReBAC — row-level access control

For row-level filtering (e.g. "a user can only see tasks they created"),
apply `@rebac` to any model:

```python
from veloiq_framework import rebac, rebac_subquery, TimestampedModel

@rebac(owner_field="created_by")   # shorthand: user sees only their own rows
class Task(TimestampedModel, table=True):
    created_by: int = Field(foreign_key="veloiq_user.id")

# Relationship traversal: documents inherit access from their folder
@rebac(filter=lambda user, cls, session:
           cls.folder_id.in_(rebac_subquery(Folder, user, session)))
class Document(TimestampedModel, table=True):
    folder_id: int
```

For a step-by-step walkthrough of all three RBAC layers and ReBAC,
see the [full tutorial](./tutorial-task-manager.md#step-12--access-control).

---

## What's inside the sample app

The sample app is a small but complete project used throughout the
[development tutorial](./tutorial-task-manager.md).

```
samples/task-manager/
├── backend/
│   ├── app/
│   │   ├── main.py            # one line: create_veloiq_app()
│   │   └── modules/
│   │       ├── team/          # TeamMember model, API, admin view
│   │       ├── projects/      # Project model, API, admin view
│   │       └── tasks/         # Task model, auto API, custom_api.py, admin view
│   ├── taskmanager.db         # pre-filled SQLite database
│   ├── seed_sqlite.py         # script that generated taskmanager.db
│   └── .env.example
└── frontend/
    └── src/
        ├── App.tsx             # Refine app — three resources wired up
        └── pages/
            ├── team/           # teamSchema.gen.ts (auto-generated)
            ├── projects/       # projectsSchema.gen.ts
            └── tasks/          # tasksSchema.gen.ts (includes tree-view relation)
```

To understand how any of this was built step by step, follow the
[full tutorial](./tutorial-task-manager.md).
