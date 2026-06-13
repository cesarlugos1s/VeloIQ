# Changelog

All notable changes to **veloiq-framework** and **@juicemantics/veloiq-ui** are documented here.

---

## [Unreleased]

### Improvements

#### Friendlier interactive app creation (`veloiq` TUI)
- The "create new project" form now shows each field's effective default as a dim hint (admin user `admin`, DB user `veloiq`, ports `8000`/`5173`, etc.), so the values you'll get are visible before creating
- **DB type** is now a selector cycled with ←/→ or Space instead of a free-text field; press Enter on it to type any custom SQLAlchemy dialect
- DB host/port/user/password fields dim out when SQLite is selected, since they aren't used

#### Expanded database engine support
- `--db-type` (on `veloiq new` and `veloiq configure-db`) and the TUI selector now offer `sqlite`, `postgresql`, `mysql`, `mariadb`, `mssql`, `oracle`, `db2`, and `informix`, with correct default ports for each
- The previous hardcoded 4-engine restriction is lifted — any SQLAlchemy dialect string (e.g. `postgresql+asyncpg`, `cockroachdb`) is accepted; `dialect+driver` forms resolve the default port from the base dialect
- SQLite and PostgreSQL drivers still ship with the framework; other engines require their driver installed (`pymysql`, `pyodbc`, `cx_Oracle`, `ibm-db-sa`, `IfxAlchemy`)

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
