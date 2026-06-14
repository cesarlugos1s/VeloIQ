# CLI Tools & Interactive Explorer

VeloIQ ships a rich CLI (`veloiq`) and an interactive terminal explorer (TUI) to help developers understand, navigate, and evolve their project without leaving the terminal.

---

## Interactive Explorer (TUI)

Run `veloiq` with no arguments from any directory inside a VeloIQ project:

```bash
veloiq
```

The TUI loads your project's modules, models, fields, relations, dashboard configuration, search enrollment, extension state, and custom-page scaffolds from the generated schema files.

### Navigation

| Key | Action |
|-----|--------|
| `↑ ↓` / `j k` | Move cursor |
| `Enter` | Drill into selected item |
| `b` / `Backspace` / `Esc` | Go back |
| `q` | Quit |
| `g` | Run `veloiq generate` (with confirmation) |
| `c` | Run `veloiq check` — health report (from home screen) |

### Model list — type-to-filter

Inside a module's model list, press `/` to open a filter prompt. Type any substring of a model name or resource key and press Enter — the list narrows instantly. Press `x` to clear the filter.

```
  Filter: "task"  (2/5 models)  [/] change  [x] clear
```

### Model detail screen

Selecting a model opens a scrollable detail screen showing:

- **Path** to `models.py` in the repository
- **Model description** from the class docstring
- **Fields** — type, required/read-only flag, default value, valid options, per-field description, and RBAC roles
- **Relations** — inferred type (`one-to-many`, `self-ref`, `many-to-many`), target resource, and via-key
- **Referenced by** — which other models have a FK pointing to this model
- **Configuration** — dashboard tab, search enrollment, permissions, ReBAC, custom-page scaffolds
- **Endpoints** — the five REST routes generated for the resource with access summary

#### Jump to a related model — `[f] follow`

Press `f` in the model detail screen to jump directly to a related model's detail page without navigating back through the module list. A numbered prompt lists all navigable targets (relations + FK references):

```
  Jump to: [1] Tasks  [2] Owner  [Esc] cancel
```

Press the corresponding number key to navigate. Press `Esc` to cancel.

#### Actions from model detail

| Key | Action |
|-----|--------|
| `f` | Follow → jump to a related model |
| `a` | Add a field — prompts for name and type, runs `veloiq add-field` |
| `d` / `D` | Add / remove from dashboard |
| `s` / `S` | Enroll / remove from search |
| `p` | Scaffold a custom page for this model |
| `g` | Run `veloiq generate` |
| `b` | Back to module |

---

## `veloiq check`

Run a health check on the current project and surface common configuration gaps:

```bash
veloiq check
veloiq check --strict        # exit 1 if any warnings found
veloiq check --root ./my-app # specify project root explicitly
```

Reports:

| Issue | Severity |
|-------|----------|
| Model has no class docstring | Warning |
| Required field has no `description=` | Warning |
| Enum field has options but no default value | Warning |
| Model not on dashboard | Warning |
| Model not enrolled in search | Warning |

**Example output:**

```
Found 0 error(s) and 3 warning(s) in my-app

WARNINGS
  ⚠️   team/TeamMember                         No model description — add a class docstring
  ⚠️   team/TeamMember.name                    Required field has no description
  ⚠️   team/TeamMember.email                   Required field has no description
```

Run `veloiq check` as part of CI to enforce description coverage or dashboard enrollment before a release.

---

## `veloiq add-field`

Add a field to an existing model without editing `models.py` manually:

```bash
veloiq add-field <model> <field_name> [field_type] [options]
```

| Argument / Option | Description |
|-------------------|-------------|
| `MODEL` | Model class name (`Task`) or resource/table name (`task`) |
| `FIELD_NAME` | Snake-case attribute name for the new field |
| `FIELD_TYPE` | `str` (default), `text`, `int`, `float`, `bool`, `date`, `datetime` |
| `--optional / --required` | Make the field `Optional` (nullable). Default: `--optional` |
| `--default VALUE` | Default value (e.g. `active`, `0`, `true`) |
| `--description TEXT` | Field description shown in TUI and emitted to gen.ts |
| `--options a,b,c` | Comma-separated valid values — uses `veloiq_field()` automatically |
| `--migrate` | Automatically run `alembic autogenerate` + `upgrade head` (no prompt) |
| `--no-migrate` | Skip migration entirely (useful in CI or when batching changes) |

**Examples:**

```bash
# Simple optional string field (will prompt to run migration)
veloiq add-field Task notes str --description "Internal notes"

# Required float with description
veloiq add-field project budget float --required --description "Budget cap in USD"

# Enum field — automatically uses veloiq_field() and emits options to gen.ts
veloiq add-field task priority str \
  --options low,medium,high,critical \
  --default medium \
  --description "Task urgency level"

# Date field — skip migration prompt (run manually later)
veloiq add-field task resolved_at date --description "When the task was closed" --no-migrate

# Auto-apply migration without prompting (CI / scripted workflows)
veloiq add-field task resolved_at date --migrate
```

After writing the field, `veloiq add-field` checks whether Alembic is configured in the project's `backend/` directory. If `alembic.ini` is found, it prompts:

```
   Run database migration now? (alembic autogenerate + upgrade head) [Y/n]:
```

Answering **Y** runs:
1. `alembic revision --autogenerate -m "add <field_name> to <model>"`
2. `alembic upgrade head`

This ensures the database column is created immediately, avoiding the `OperationalError: no such column` error when the backend restarts.

> **Note:** New models created with `veloiq add-module` do not require explicit migrations — VeloIQ calls `SQLModel.metadata.create_all()` on startup, which creates missing tables automatically. Migrations are only needed when adding columns to **existing** tables.

**Type reference:**

| CLI type | Python annotation | Notes |
|----------|------------------|-------|
| `str` | `str` | Standard VARCHAR column |
| `text` | `str` | Uses `Column(Text)` for long content |
| `int` | `int` | Integer column |
| `float` | `float` | Floating-point column |
| `bool` | `bool` | Boolean column |
| `date` | `datetime.date` | Date-only column |
| `datetime` | `datetime.datetime` | Full timestamp column |

---

## `veloiq add-relation`

Add a relation between two models without editing `models.py` manually:

```bash
veloiq add-relation <source> <target> [options]
```

| Argument / Option | Description |
|-------------------|-------------|
| `SOURCE` | Model that holds the FK or initiates the relation (e.g., `Task`) |
| `TARGET` | Model being referenced (e.g., `Project`) |
| `--type fk\|many-to-many` | Relation type (default: `fk`) |
| `--attr NAME` | Attribute name on source (default: snake_case of TARGET) |
| `--back-attr NAME` | Attribute name on target for `back_populates` (default: snake_case of SOURCE + `s`) |
| `--min-items INT` | Minimum cardinality on the List side (default: `0`) |
| `--max-items INT` | Maximum cardinality on the List side (default: unlimited) |
| `--required / --optional` | Make FK non-nullable (`fk` type only). Default: optional |
| `--no-back` | Skip adding the reverse relationship to the target model |
| `--migrate / --no-migrate` | Run Alembic migration after adding. Default: prompt |

**Examples:**

```bash
# Task belongs to Project (adds FK column + relationship on Task, reverse on Project)
veloiq add-relation Task Project

# Explicit names + required FK
veloiq add-relation Task Project --attr project --back-attr tasks --required

# Enforce that a project must have at least one task
veloiq add-relation Task Project --min-items 1

# Many-to-many: Task ↔ Tag (creates TaskTagLink table, List relations on both sides)
veloiq add-relation Task Tag --type many-to-many

# Many-to-many with custom attr names
veloiq add-relation Task Tag --type many-to-many --attr tags --back-attr tasks
```

**What gets written — FK (many-to-one):**

In `source/models.py`:
```python
# FK column (before existing relationships)
project_id: Optional[int] = Field(default=None, foreign_key="project.id")

# Relationship (after existing relationships)
project: Optional["Project"] = jm_relationship(back_populates="tasks")
```

In `target/models.py`:
```python
tasks: List["Task"] = jm_relationship(back_populates="project")
```

Both files get the correct `TYPE_CHECKING` import guard automatically.

**What gets written — many-to-many:**

In `source/models.py` (link class added above the main class):
```python
class TaskTagLink(SQLModel, table=True):
    __tablename__ = "task_tag_link"
    task_id: Optional[int] = Field(default=None, foreign_key="task.id", primary_key=True)
    tag_id: Optional[int] = Field(default=None, foreign_key="tag.id", primary_key=True)

# Inside Task:
tags: List["Tag"] = jm_relationship(back_populates="tasks", link_model=TaskTagLink)
```

In `target/models.py` (`TaskTagLink` imported directly — not inside `TYPE_CHECKING`, since it's needed at runtime):
```python
from app.modules.tasks.models import TaskTagLink

# Inside Tag:
tasks: List["Task"] = jm_relationship(back_populates="tags", link_model=TaskTagLink)
```

After running, the relation is wired in both directions. Run `veloiq generate` to update the TypeScript schemas, then `veloiq db upgrade` to apply the migration (or answer **Y** at the prompt).

---

## `veloiq scaffold-page`

See [Custom Page Scaffolding](scaffold-page.md) for full documentation.

---

## Field metadata conventions

VeloIQ reads metadata from model field declarations and emits it into the TypeScript schema (`gen.ts`) so the frontend can use it:

```python
from sqlmodel import Field
from veloiq_framework import veloiq_field

class Task(TimestampedModel, table=True):
    """A unit of work that belongs to a project."""   # → ModelDef.description

    title: str = Field(description="Short summary")   # → FieldDef.description

    status: str = veloiq_field(
        default="todo",
        options=["todo", "in_progress", "done"],      # → FieldDef.options (Select dropdown)
        description="Current workflow state",
    )
```

- **Class docstring** → `ModelDef.description` — shown in the TUI model detail and available to the frontend
- **`Field(description=...)`** → `FieldDef.description` — shown in the TUI as `└ ...` under each field
- **`veloiq_field(options=[...])`** → `FieldDef.options` — renders as a `<Select>` dropdown in Create/Edit forms
- **`veloiq_field(default=...)`** / **`Field(default=...)`** → `FieldDef.default` — pre-fills the Create form

Run `veloiq generate` after any model change to sync these values into the frontend schema files.
