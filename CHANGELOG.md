# Changelog

All notable changes to **veloiq-framework** and **@juicemantics/veloiq-ui** are documented here.

---

## [0.8.1] — 2026-06-15

### Features

#### VeloIQ Studio — browser-based developer dashboard
A new browser UI mounted automatically at `/veloiq-studio/` by `create_veloiq_app()`.
No host-app changes required; available whenever the server is running.

- **Schema Browser** — module/model tree with field and relation detail. Many-to-one FK
  parent references are shown in the Relations section alongside one-to-many and
  many-to-many ORM relations.
- **Contextual commands** — Add Model appears on the module page; Add Field, Add Relation,
  and Scaffold Page appear on the model page, all pre-filled with the selected context.
- **Add Field** — optional literals (`--options`), default value (`--default`), and
  nullable/required toggle.
- **Add Relation** — relation type selector (`many-to-one` / `many-to-many`) and optional
  min/max item cardinality inputs.
- **Dashboard and Search pages** — view current config and toggle models/fields.
- **Extensions page** — view installed extensions and enable/disable them.
- **Auto-generate** — every successful command automatically runs `veloiq generate` and
  refreshes the schema in the browser without a page reload.
- **Reload recovery** — when `uvicorn --reload` restarts the worker mid-command, the
  studio detects the dropped SSE stream, polls until the server is back, then completes
  the generate and refresh cycle.
- **Access control** — read access requires the `Admin` role; write access additionally
  requires `VELOIQ_DEV=true` in the environment.

### Fixes

- **`add-relation`** — disambiguation check now scopes FK detection to the specific model
  class body rather than the whole file, preventing false disambiguation when sibling
  models in the same file already reference the target table.
- **`veloiq generate`** — aborts immediately (with a clear error message) if
  `configure_mappers()` fails, preserving existing `*Schema.gen.ts` files instead of
  overwriting them with empty arrays.
- **`veloiq run`** — adds `--reload-delay 2` so watchfiles waits 2 seconds before
  reloading, giving multi-file CLI writes (e.g. `add-relation`) time to complete both
  file writes before the worker restarts.

---

## [0.8.0] — 2026-06-14

### Features

#### Model Builder CLI — `veloiq add-model`, `add-field`, `add-relation`
Three new interactive CLI commands let you grow your schema from the terminal
without hand-editing Python files or migration scripts:

- **`veloiq add-model`** — interactively define a new SQLModel class (name, table
  name, fields, base class) and write it directly into the right `models.py`; also
  handles models that live in the same file as existing ones
- **`veloiq add-field`** — add a field to an existing model and immediately run
  Alembic `autogenerate` + `upgrade` so the column lands in the database without
  a separate migration step
- **`veloiq add-relation`** — wire up a FK or many-to-many relation between any
  two models; auto-disambiguates `foreign_keys=` when multiple FK paths exist
  between the same pair of models; TUI integration via `[r]` on any model screen

All three commands are also launchable from the TUI.

#### `veloiq scaffold-page` — custom page overrides
- `veloiq scaffold-page <module> <model>` generates a custom React page component
  (list, show, or both) pre-wired to the framework's data hooks, so you can
  override DynamicList / DynamicShow for any resource without boilerplate
- The scaffold patches `custom_pages.ts` and `App.tsx` automatically

#### `veloiq check` — project health checks
- Scans the project for common issues: missing dashboard config, unindexed search
  models, models without descriptions; reports errors vs. hints with actionable
  suggestions
- Accessible from the TUI home screen and as a standalone CLI command

#### TUI — richer model inspection
- Model detail screen shows the **path to `models.py`**, field defaults, options
  (as `{label, value}[]` objects), and model docstrings
- Many-to-one FK relations now appear in the **Relations** section, not Fields
- Reverse references, endpoint summary, filter, and follow-relation navigation added
- `[a]` shortcut on a model screen opens `add-field` inline
- Horizontal dividers between sections for readability
- Custom page overrides (scaffolded via `scaffold-page`) are listed in model detail

#### Schema generator improvements
- Field `options` are now emitted as `{label, value}[]` typed objects instead of
  plain strings — no manual conversion needed in `{module}Schema.manual.ts`
- Model docstrings and field descriptions flow through to generated TypeScript comments
- Richer field defaults and inherited-base metadata included in generated schemas

#### Friendlier interactive app creation
- The "create new project" form shows each field's effective default as a dim hint
  (`admin`, `veloiq`, ports `8000`/`5173`, etc.) before you type
- **DB type** is now a ←/→ selector; press Enter to type any custom SQLAlchemy dialect
- DB host/port/user/password fields dim out automatically when SQLite is selected

#### Expanded database engine support
- `--db-type` (on `veloiq new` and `veloiq configure-db`) and the TUI selector now
  accept `sqlite`, `postgresql`, `mysql`, `mariadb`, `mssql`, `oracle`, `db2`,
  `informix`, and any other SQLAlchemy dialect string (e.g. `postgresql+asyncpg`)
- `dialect+driver` forms resolve the default port from the base dialect
- SQLite and PostgreSQL drivers ship with the framework; other engines require their
  driver (`pymysql`, `pyodbc`, `cx_Oracle`, `ibm-db-sa`, `IfxAlchemy`)

### Fixes

- **UI** — relation tables now display the related entity's label instead of raw `eid`/`eid_to` values
- **UI** — config relations resolve correctly by `resourcePath` when `relationName` is absent
- **Alembic scaffold** — `naming_convention` added to `env.py` so constraint names are deterministic across databases
- **Alembic scaffold** — `render_as_batch=True` added so `ALTER TABLE` works on SQLite during migrations
- **Schema generator** — options emitted as `{label,value}[]` objects (was plain strings)

---

## [0.7.0] — 2026-06-11

### Features

#### Internationalisation (i18n)
- `veloiq_framework.utils.i18n_utils._()` — PO-file-based translation helper available in all custom endpoints and repositories
- Locale resolved per request from the `Accept-Language` header; per-catalog caching keyed on file mtime so edits are picked up without restart
- `VELOIQ_I18N_LOCALES_DIR` and `VELOIQ_I18N_DEFAULT_LOCALE` env vars (and matching `VeloIQConfig` fields) control catalog location and fallback locale
- Catalog lookup normalises underscores to spaces and strips extra whitespace, so `_("total_amount")` matches `msgid "total amount"`

#### Utilities package
- `veloiq_framework.utils` — new `i18n_utils`, `data_mgmt_utils`, and `views_utils` sub-modules available for use in custom endpoints and repositories
- `jm_config.ini` defaults wired in; i18n integration configurable via `VeloIQConfig`

#### Schema generator: system fields excluded from UI schemas
- `cwuri`, `creation_date`, and `modification_date` (fields inherited from `StandardEidModel`) are now excluded from all generated TypeScript schemas — they no longer appear as table columns or form inputs
- Fields that should remain hidden can be overridden per-model in `{module}Schema.manual.ts`

#### M2M relation schema generation
- `veloiq generate` now produces full TypeScript schemas for many-to-many relations, including automatic link-table discovery across all modules
- FK back-relations for link tables are filtered from generated schemas to avoid duplicate relation tabs

#### TUI improvements
- Interactive new-app creation from inside the TUI — answer prompts and the framework scaffolds, installs deps, and opens the project automatically
- Various TUI bug fixes

#### Error handling
- `_OrmModelUnavailable` exception raised when a model references a missing table or model class; prevents silent failures in generated API code

### Fixes

- **Primary key access** — `id` and `eid` fields both resolve correctly across CRUD operations
- **Command Center / menu** — many-to-many junction models are excluded from Command Center and sidebar menu
- **Schema generator** — models are matched by exact module path (not `startswith`) preventing cross-module class leakage when module names share a prefix
- **MultiPaneLayout** — panel sizes persist correctly on page refresh; legacy `pane[0]=...` search-param format handled to avoid layout reset

---

## [0.6.0] — 2026-06-05

### Features

#### Modular Extension Architecture
Pip-installable extension packages can now add modules, schemas, frontend pages,
and licensing to any host app **without modifying the host app's code**.

- `VeloIQExtension` base class + `veloiq.extensions` entry-point discovery — an
  extension declares itself in `pyproject.toml` and is loaded at app startup
- `veloiq new-extension <name>` scaffolds a complete extension package; each
  extension ships its own license module (RS256 JWT enforcement with grace period)
- `veloiq add-licensing` scaffolds license enforcement into a host app's own modules
- **Explicit per-app opt-in** via `veloiq.toml` `[extensions] enabled = [...]` —
  only listed extensions load, at both startup and `veloiq generate`, regardless
  of what is pip-installed. Manage with `veloiq extend-package` / `list-extensions`
- Extension frontend delivery: `veloiq generate` copies extension routes, page
  components, and user-menu items into the host app (`extensions.gen.tsx`)
- Per-resource Show-page overrides — extensions can replace `DynamicShow` for a
  specific resource via a generated `extensionShowComponents` map
- Extension user-menu items are grouped into a **Configurations** submenu

#### Journeys in Navigation & Command Center
- Journeys are auto-listed under their owning module in the sidebar and top menu,
  rendered with the Journey Runner icon (`NodeIndexOutlined`)
- Journeys are injected into the **Command Center** (Ctrl+G) via a recursive,
  generic injection pass

#### Crosstab View Types
- New `crosstab` and `editable-crosstab` view types for pivot-style display and
  inline editing of tabular data

#### Configurable Global View Settings — `veloiq.toml` `[views]`
- Tune how `DynamicResource` renders list / show / edit pages across the whole
  app: color schemas, default view types, gallery image sizes, relation row
  limits, action-button position, and more — served to the frontend via
  `GET /config/views`. Every key is optional and falls back to framework defaults

#### Frontend Configuration Context
- `NavConfigContext` exposes the navigation config to any component via
  `useNavConfig()` / `useNavModules()`
- Saved page-layout configurations now render in `DynamicShow` / `DynamicEdit`

#### Generator & CLI
- `veloiq add-module` always scaffolds `custom_api.py` and updates
  `navigation.config.json`
- Schema generator auto-discovers FK back-relations
- `publish-pypi.sh` — version-guarded release script that refuses to publish
  unless the Python and npm package versions match

### Fixes

- Backend error detail is now surfaced in frontend failure notifications instead
  of a generic message
- `DynamicList` reference cells no longer nest `<a>` inside `<a>`
- License enforcement and navigation config corrected for extension modules
- `license` field in `pyproject.toml` now uses an SPDX string

### Docs & Website

- New "Upgrading an existing app" guide in `getting-started.md`
- UI showcase gallery and documentation screenshots added to the website
- Documented the `crosstab` / `editable-crosstab` view types
- Scaffolded apps now pin `@juicemantics/veloiq-ui ^0.6.0`

---

## [0.5.0] — 2026-05-28

### Features

#### Command Center — Ctrl+G
A full-screen command palette and global search portal, triggered anywhere in
the app with **Ctrl+G**.

- Three-column layout: pinned navigation shortcuts, object search results, and command actions
- Fuzzy search across all enrolled models — results are ranked and navigable with the keyboard
- Pinned items and recent history shown in the empty state so common destinations are one keystroke away
- Keyboard-first: arrow keys select results, Enter navigates, Escape dismisses

#### Unified Page Layout Configuration
Dashboard, Show, and Edit pages now have a live drag-and-drop layout builder built in.

- Drag cells to reorder, resize panels, and configure which relations appear on each page
- Layout preferences are persisted per user
- Relations can be configured even when no layout has been explicitly set up yet
- New `CONFIGURE_LAYOUT` permission gates the builder UI: Admins and Managers can
  configure layouts; Viewers see the configured result but cannot change it

#### Interactive Project Explorer TUI — `veloiq` (no arguments)
Running `veloiq` bare inside a project directory launches a curses-based terminal UI
for exploring the full project structure without reading source files.

- Five screens: Home, Modules list, Module detail, Model detail, Search config
- Surfaces modules, models, fields, relations, dashboard cells, search enrollment,
  permissions, and ReBAC status
- Contextual CLI launcher: highlight any action and press Enter to run the corresponding
  `veloiq` command with a Y/N confirmation prompt

#### Three-File Manual Schema Override
`veloiq generate` now produces three files per module instead of one, making it safe
to customize frontend schemas without losing changes on the next regeneration.

| File | Lifecycle | Purpose |
|---|---|---|
| `{module}Schema.gen.ts` | Always overwritten | Raw generated output from model definitions |
| `{module}Schema.manual.ts` | Created once, never overwritten | Your hand-written overrides and additions |
| `{module}Schema.ts` | Always overwritten | Merged result — what the app consumes |

Override any field property (`showViewType`, `editViewType`, `label`, `options`, `valueColors`),
add virtual fields, or define synthetic models — all changes survive future `veloiq generate` runs.

### Tests

- Added a pytest automation suite (32 fast tests) covering API auth, CRUD endpoints,
  relation traversal, generator file output, and a CLI smoke test (`veloiq new` end-to-end)
- HTML report (`tests/results.html`) and JUnit XML generated on every run
- `run_tests.sh` at the repo root for one-command execution

### Sample App

- Configured rich field view types across all task-manager models:
  currency for cost fields, progress bar for `actual_progress`, star rating for `rating`,
  Markdown for description fields, colored tags for status / priority / role, and
  relative timestamps for `created_at` / `updated_at`

---

## [0.4.1] — 2026-04-xx

- Scaffold fix: generated frontend now installs `@juicemantics/veloiq-ui ^0.3.0`

## [0.4.0] — 2026-04-xx

- Bubble chart auto-sizes bubbles by the first numeric series value in Analyze views
- Global Module Portal (Ctrl+G predecessor) and centralized `navigation.config.json` system

## [0.3.4] — 2026-03-xx

- Required field validation and asterisk indicators on Create, Edit, and Show forms
- `veloiq generate` cross-module back-populate and `veloiq_user` FK resolution fix
- Return HTTP 422 (not 500) when a create payload fails model validation
