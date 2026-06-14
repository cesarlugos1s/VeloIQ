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

**Examples:**

```bash
# Simple optional string field
veloiq add-field Task notes str --description "Internal notes"

# Required float with description
veloiq add-field project budget float --required --description "Budget cap in USD"

# Enum field — automatically uses veloiq_field() and emits options to gen.ts
veloiq add-field task priority str \
  --options low,medium,high,critical \
  --default medium \
  --description "Task urgency level"

# Date field
veloiq add-field task resolved_at date --description "When the task was closed"
```

After running, the field is inserted into the model's `models.py` just before the relationship definitions. Run `veloiq generate` to update the TypeScript schemas.

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
