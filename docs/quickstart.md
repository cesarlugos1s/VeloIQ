# Quick Start — See It Running in 5 Minutes

No tutorial to follow, no database to set up.  Run one script and the full
task-manager demo app is live in your browser.

---

## Get the repo

```bash
git clone https://github.com/cesarlugos1s/SafeMantIQ.git
cd SafeMantIQ
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
3. Install `safemantiq-framework` (editable, from this repo)
4. Copy `.env.example → .env` pointing at the bundled `taskmanager.db`
5. Build `@safemantiq/ui` from `packages/ui/` (one-time, ~15 s)
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

The app comes pre-loaded with:

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
   safemantiq-framework[postgres]
   ```
3. Re-install dependencies and run migrations:
   ```bash
   source samples/task-manager/backend/.venv/bin/activate
   pip install -r samples/task-manager/backend/requirements.txt
   cd samples/task-manager/backend
   safem db upgrade
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

## What's inside the sample app

The sample app is a small but complete project used throughout the
[development tutorial](./tutorial-task-manager.md).

```
samples/task-manager/
├── backend/
│   ├── app/
│   │   ├── main.py            # one line: create_safem_app()
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
