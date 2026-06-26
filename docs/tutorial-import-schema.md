# Tutorial: Import an Existing Database

You have a database.  You want a FastAPI backend and a React CRUD frontend on top of
it — today, without rewriting your schema.  This tutorial walks you through
`veloiq import-schema`: the command that reads your existing tables, foreign keys,
and many-to-many relationships, and scaffolds idiomatic VeloIQ models automatically.

The finished app — a full admin UI over the Chinook sample database — is yours in
**under 10 minutes**.  No Python models to write by hand.

> If this tutorial saves you time, please [⭐ star the repo](https://github.com/cesarlugos1s/VeloIQ) —
> it helps other developers find VeloIQ.

---

## What this tutorial covers

| Section | Goal | Time |
|---|---|---|
| [Section 1 — Download the sample database](#section-1--download-the-sample-database) | Get a realistic SQLite file with 11 tables, FKs, and M2M junctions | ~1 min |
| [Section 2 — Run import-schema](#section-2--run-importschema) | Reflect the schema into VeloIQ module stubs | ~3 min |
| [Section 3 — What was generated](#section-3--what-was-generated) | Tour the generated models, relationships, and TypeScript schemas | ~2 min |
| [Section 4 — Verify in the browser](#section-4--verify-in-the-browser) | Start the app and navigate the imported tables | ~2 min |
| [Section 5 — Making adjustments](#section-5--making-adjustments) | Add model titles, tweak labels, and add a custom page | ~5 min |

---

## Section 1 — Download the sample database

We'll use the **[Chinook](https://github.com/lerocha/chinook-database)** database — a
digital media store with 11 tables: artists, albums, tracks, customers, invoices,
employees, and more.  It is freely available, well-known, and includes foreign keys
and many-to-many junction tables, which makes it a realistic import target.

```bash
# Download Chinook as a SQLite file into the project directory
curl -L -o backend/chinook.db \
  https://github.com/lerocha/chinook-database/raw/master/ChinookDatabase/DataSources/Chinook_Sqlite.sqlite
```

> You can use any SQLite, PostgreSQL, MySQL, MSSQL, or Oracle database.  Chinook
> is just a convenient example that requires no server setup.

---

## Section 2 — Run import-schema

Create a fresh VeloIQ project (or use an existing one), then run the import command:

```bash
veloiq new music-store
cd music-store

# Point to the SQLite file and import everything into a module called "chinook"
veloiq import-schema --url sqlite:///backend/chinook.db --module chinook --tables all
```

### What happens during import

The command runs through four phases — you'll see output like:

```
🔌 Connecting to sqlite:///backend/chinook.db … connected
📋 11 tables discovered

📦 Phase 1/4 — Model skeletons
  ✅ chinook/Artist
  ✅ chinook/Album
  ✅ chinook/Track
  … (8 more)

📦 Phase 2/4 — Fields
  ✅ chinook/Artist — 1 field(s)
  ✅ chinook/Album — 3 field(s)
  …

📦 Phase 3/4 — Relationships
  ✅ chinook/Album → chinook/Artist (album.artist_id → artist.ArtistId)
  …

📦 Phase 4/4 — M2M junctions
  ✅ chinook/Album ↔ chinook/Track via PlaylistTrack (many-to-many)
  …

✅ Import complete — 11 models in app/modules/chinook/
```

> **Using the interactive wizard** — omit `--url`, `--module`, and `--tables` and
> the command walks you through a database-type picker, connection form, curses
> table selector, and module-name prompt.  The `--tables all` flag used here
> skips directly to the import.

### What gets skipped

- **Audit columns** — `created_at`, `updated_at`, `modified_at`, `deleted_at` are
  auto-detected and omitted from the generated models (your source table already
  has them).
- **Binary columns** — BLOB / BYTEA columns are skipped (not renderable in the
  default UI).

### Run generate and apply the migration

```bash
veloiq generate       # regenerate api.py + frontend TypeScript schemas
veloiq db upgrade     # apply the Alembic migration
```

---

## Section 3 — What was generated

Open `backend/app/modules/chinook/` — you'll find:

```
chinook/
├── models.py            ← 11 SQLModel classes, one per table
├── api.py               ← auto-generated CRUD router (do not edit)
├── custom_api.py         ← empty stub for your custom endpoints
└── admin/
    └── admin_views.py   ← SQLAdmin view stubs
```

### models.py — a typical generated model

```python
# app/modules/chinook/models.py
from typing import TYPE_CHECKING, List, Optional
from sqlmodel import Field, SQLModel
from veloiq_framework import jm_relationship

if TYPE_CHECKING:
    from app.modules.chinook.models import Artist, Invoiceitem

class Album(SQLModel, table=True):
    __tablename__ = "Album"

    AlbumId: int = Field(primary_key=True)
    Title: str
    ArtistId: int = Field(foreign_key="Artist.ArtistId")

    artist: Optional["Artist"] = jm_relationship(back_populates="albums")
    tracks: List["Track"] = jm_relationship(back_populates="album")
```

Key points:

- `__tablename__` matches the source table exactly
- The **primary key** and type come from the source schema
- **Foreign key** columns include `foreign_key=` so SQLAlchemy tracks the relationship
- **Relationships** are generated on both sides of every FK
- **M2M junctions** (e.g. `PlaylistTrack`) become `SQLModel` link classes with
  `jm_relationship` on both parent models
- Uses **plain `SQLModel`**, not `TimestampedModel` — the source tables already
  have their own PK columns and audit columns

### Frontend schemas

In `frontend/src/pages/chinook/` you'll find `chinookSchema.gen.ts` — the
TypeScript field definitions that the React UI uses to render forms, tables,
and relation cards for every imported model.

---

## Section 4 — Verify in the browser

```bash
veloiq run                   # start the backend on http://localhost:8000
cd frontend && npm run dev   # start the Vite dev server on http://localhost:5173
```

Open **http://localhost:5173**.  The sidebar now shows a **Chinook** section with
every imported model:

- **Artist** — list, create, edit, show
- **Album** — list, create, edit, show, with a relation chip to its Artist
- **Track** — list, create, edit, show, with relation chips to Album, Genre, MediaType
- **Playlist ↔ Track** — the many-to-many relationship renders as a two-panel
  relation table on both the Playlist and Track Show pages
- **Invoice** — with relation chips to Customer, plus a child table of InvoiceLine items

Navigate through the data: click an Album to see its Tracks, click a Track's Album
chip to jump to that Album, and so on.  Every relation is navigable without writing
a single line of code.

---

## Section 5 — Making adjustments

The imported models are plain Python — edit them just like hand-written models.

### Add model title fields

By default, record labels use the first string field (e.g. `Name` for Artist,
`Title` for Album).  Add a `titleFields` to control exactly how records are
displayed:

```python
# In models.py — add to the Customer class
class Customer(SQLModel, table=True):
    __tablename__ = "Customer"
    __titleFields__ = ["FirstName", "LastName"]   # ← add this line
    # … rest of the fields
```

After adding `__titleFields__`, re-run `veloiq generate`.  Customer records
now appear as *"Luís Gonçalves"* instead of just *"Luís"*.

### Tweak field labels

The importer uses the database column names as labels (`ArtistId`, `AlbumId`).
To make them more readable, open `custom_api.py` and override the model's
label configuration:

```python
# app/modules/chinook/custom_api.py
from veloiq_framework.model_label_utils import register_model_labels

register_model_labels(
    "Album",
    field_labels={
        "Title": "Album Title",
        "ArtistId": "Artist",
    },
)
```

Re-run `veloiq generate` and the form labels update everywhere.

### Add a custom show page

The convention-based override system works on imported models too — drop a
`custom_show.tsx` in the model's page directory:

```tsx
// frontend/src/pages/chinook/Album/custom_show.tsx
import React from "react";
import { Alert } from "antd";

export default function AlbumCustomShow({ model, allModels }: any) {
  return <Alert type="info" message="Custom album detail" />;
}
```

Run `veloiq generate` — the generator reports `📄 Custom show override: cw_album → …`
and the Album Show page renders your custom component.

### Add custom endpoints

Since imported models are regular VeloIQ modules, you can add custom API
endpoints to `custom_api.py` the same way you would for any hand-written module:

```python
# app/modules/chinook/custom_api.py
from fastapi import Depends
from sqlmodel import Session, select
from veloiq_framework import get_session
from app.modules.chinook.models import Track
from .api import router

@router.get("/api/chinook/top-tracks")
def top_tracks(session: Session = Depends(get_session), limit: int = 10):
    return session.exec(
        select(Track).order_by(Track.UnitPrice.desc()).limit(limit)
    ).all()
```

---

## Next steps

| What | Where |
|---|---|
| Import from PostgreSQL / MySQL / MSSQL | `veloiq import-schema --url postgresql+psycopg2://…` |
| Interactive import wizard | `veloiq import-schema` (no flags) |
| CLI reference (all options) | [docs/cli-tools.md#veloiq-import-schema](cli-tools.md#veloiq-import-schema) |
| Add RBAC to imported models | [Tutorial: Task Manager · Section 4](tutorial-task-manager.md#section-4--role-based-access-control-rbac) |
| Add a dashboard over imported models | [Tutorial: Task Manager · Section 8](tutorial-task-manager.md#section-8--dashboard) |
| Build the full tutorial app from scratch | [Tutorial: Task Manager](tutorial-task-manager.md) |