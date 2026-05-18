# Task Manager — SafeMantIQ Sample App

A minimal but complete project management app built with the SafeMantIQ framework.
Three modules, three models, zero boilerplate.

## Quickest start — one command

Want to see it running immediately without reading a tutorial?

**Linux / macOS / WSL** — run from this directory:
```bash
bash quickstart.sh
```

**Windows (PowerShell)** — run from this directory:
```powershell
powershell -ExecutionPolicy Bypass -File quickstart.ps1
```

The scripts are self-locating and work from any directory — the paths above
assume you are already inside `samples/task-manager/`.  The script sets up the
virtual environment, installs dependencies, and starts both servers.  The app
opens at `http://localhost:5173` with sample data already loaded.
See [docs/quickstart.md](../../docs/quickstart.md) for full details.

After the first run, restart with:

```bash
bash samples/task-manager/start.sh        # Linux / macOS / WSL
```
```powershell
powershell -ExecutionPolicy Bypass -File samples\task-manager\start.ps1   # Windows
```

---

## What this demonstrates

| Concept | Where to look |
|---|---|
| One-line app entry point | `backend/app/main.py` |
| Module structure | `backend/app/modules/*/` |
| Auto-generated CRUD API | `backend/app/modules/*/api.py` |
| Custom endpoints extending generated API | `backend/app/modules/tasks/custom_api.py` |
| SQLAdmin views | `backend/app/modules/*/admin/admin_views.py` |
| Generated TypeScript schemas | `frontend/src/pages/*/` |
| Self-referential relation → Miller columns tree | `backend/app/modules/tasks/models.py` |
| Clean frontend App.tsx | `frontend/src/App.tsx` |

## Modules

- **Team** — `TeamMember` with name, email, and role
- **Projects** — `Project` with status and owner relation
- **Tasks** — `Task` with priority, due date, planned/actual hours,
  project and assignee relations, self-referential parent/sub-task hierarchy
  (renders as a **Miller columns** tree view); includes a custom `complete`
  endpoint in `custom_api.py`

## Manual setup (step by step)

If you prefer to run the steps yourself rather than using the quickstart script:

```bash
# ── Backend ───────────────────────────────────────────────────────────────────
cd backend
python3 -m venv .venv
source .venv/bin/activate

# Install framework from the local repo source
pip install -e ../../../backend            # safemantiq-framework
# (for PostgreSQL also: pip install psycopg2-binary)

cp .env.example .env      # defaults to the bundled SQLite taskmanager.db
safem run                 # starts at http://localhost:8000

# ── Frontend ──────────────────────────────────────────────────────────────────
# In a second terminal, build @safemantiq/ui from the local packages/ui first:
cd ../../../packages/ui && npm install && npm run build

cd samples/task-manager/frontend
npm install               # resolves @safemantiq/ui from packages/ui (file: ref)
npm run dev               # starts at http://localhost:5173
```

API docs: `http://localhost:8000/docs`  
Admin panel: `http://localhost:8000/admin/`

## Re-seeding the database

```bash
cd backend
python3 seed_sqlite.py    # drops and recreates all tables with sample data
```

## Module file roles

```
modules/tasks/
├── models.py        # SQLModel — source of truth, you write this
├── api.py           # AUTO-GENERATED CRUD — do not edit
├── custom_api.py    # Custom endpoints — import from api.py and extend
└── admin/
    └── admin_views.py   # SQLAdmin view — you write this
```

For the full step-by-step walkthrough of how this app was built, see
[docs/tutorial-task-manager.md](../../docs/tutorial-task-manager.md).
