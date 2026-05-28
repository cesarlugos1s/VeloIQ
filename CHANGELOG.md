# Changelog

All notable changes to **veloiq-framework** and **@juicemantics/veloiq-ui** are documented here.

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
