# Changelog

All notable changes to **veloiq-framework** and **@juicemantics/veloiq-ui** are documented here.

## [0.9.5] — 2026-07-18

### Features

- **Online Retail extension pattern** — the framework now documents a
  standard architecture for adding e-commerce capabilities to existing
  vertical applications.  New modules (online_store, shopping_cart,
  orders, payments, customers) follow the GoodRelations Product →
  Individual → Offering model separation with Schema.org structured
  data support.

- **Payment gateway abstraction** — `PaymentGateway` ABC with Stripe
  and PayPal adapters.  Authorize/capture/refund with a unified
  `GatewayResult` return type.  Adding a new gateway requires only a
  single adapter class.

- **Segment-aware pricing and promotions** — `customer_segment` field
  on `ProductPrice` and `ActivePromotion` models supports per-segment
  pricing without a loyalty app.  `loyalty_only` flag gates promotions
  behind future loyalty integration.  DateTime-precise effective
  windows per ARTS ODM.

- **JuiceMantics webhook integration** — `/webhooks/juicemantics/price-update`
  and `/webhooks/juicemantics/promo-update` endpoints receive pricing
  and promotion pushes from the JuiceMantics merchandising engine.
  GS1 GTIN/GLN identifiers resolve to internal product/store IDs.

### Standards

- **Schema.org** — Product, Offer, PriceSpecification structured data
  on the customer-facing storefront for SEO and marketplace syndication.
- **GoodRelations** — Product (abstract SKU) → Individual (physical
  item) → Offering (business promise per store) model separation.
- **UNSPSC** — Product category classification taxonomy.
- **ARTS ODM** — RetailPrice and RetailPriceModifier mapping for
  datetime-precise price/promotion windows.
- **GS1** — GTIN product identifiers, GLN store location identifiers,
  EPCIS inventory events.

### Website

- **Omnichannel Retail solutions card** — updated to reflect Online
  Commerce capabilities (Shopping Cart, Online Payments, Schema.org).
- **Omnichannel Retail website** — hero, standards badges, module
  cards, and standards table updated with e-commerce features.

## [0.9.4] — 2026-07-17

### Features

- **License-aware menu filtering** — the navigation sidebar now automatically hides
  modules whose license has expired or is not entitled for the current tenant.
  The module disappears from the nav and its routes become inaccessible — fully
  transparent to end users.  Works with the built-in licensing resolver and
  custom entitlement providers.  Applies only when the licensing system has been
  activated; the framework never filters unlicensed modules by default.

- **`useStandardEditTabs` hook** — the tab-generation logic from `DynamicEdit`
  has been extracted into a reusable hook.  Extension and custom Edit pages can
  call `useStandardEditTabs(resource, record)` to obtain the same tab
  definitions (Details, Relations, Configurations, Timeline, etc.) that
  `DynamicEdit` uses, then mix in their own custom tabs without duplicating the
  standard set.

- **`section_html_snippet` rendering** — `SectionCellContent` now renders the
  `html_snippet` field from section configs on Show pages.  Embedded `<style>`
  blocks are extracted and injected into the document head, letting page-config
  sections ship self-contained rich HTML snippets with scoped CSS.

- **`section_css_class` pipeline** — page config templates gain a
  `section_css_class` property that flows through the factory and into
  `StandardCrud`, allowing per-section CSS class overrides directly from
  configuration without touching frontend code.

- **Growth KPIs — historical comparison with outlier replacement** — the KPI
  comparison engine now compares current-period values against the historical
  mean (instead of only a fixed target), with automatic outlier detection and
  replacement.  Thresholds are relaxed by default, producing more stable KPI
  signals in noisy data.

- **Custom HTML sanitization control** — `jm_satinize_custom_html` now accepts
  an `apply_sanitization` parameter, giving callers explicit control over
  whether HTML sanitization is applied.  The SQLAdmin `column_list` also uses
  title resolution for improved readability in the back-office.

- **Business Applications hub** — a new `solutions.html` page showcases
  VeloIQ-powered applications organised by vertical (Retail & Distribution,
  Supply Chain, Financial Services, Government & Public Sector, Healthcare
  & Life Sciences, and Education), with nav links across all website pages.

### Fixes

- **`view_configurations` endpoint** — the `/views/configurations` endpoint
  now supports `list` and `create` view types in addition to `show` and
  `edit`, and resolves a case-mismatch issue in configuration lookups.

- **PyInstaller onedir compatibility** — the framework now resolves the
  project root from `sys._MEIPASS` when running inside a PyInstaller onedir
  bundle, so the CLI and runtime work correctly in packaged desktop
  distributions.

- **Windows compatibility** — `veloiq new` and `veloiq build` now resolve
  `npm` via `shutil.which` instead of relying on POSIX path assumptions,
  making the CLI work out-of-the-box on Windows.

- **Core dependency declarations** — `dateparser` and `plotly` are now
  declared as unconditional core dependencies, fixing `ModuleNotFoundError`
  crashes in host apps that only installed the base package.

- **Scaffold extension registry** — generated apps now check extension
  Show/Edit/Create/List registries before falling back to `Dynamic*` pages,
  preventing custom extension overrides from being silently ignored.

- **`section_css_class` vs `css_class`** — `StandardCrud.tsx` now reads the
  correct `section_css_class` property (not the deprecated `css_class`),
  matching the factory pipeline behaviour.

- **MultiPane panel sizing on refresh** — replaced the fragile imperative
  resize effect with `PanelGroup`'s declarative `defaultLayout` prop, so
  panel sizes persist correctly across page refreshes.  Also fixed DTS build
  errors (non-null assertions, optional chaining on `allModels`, type cast
  for `setFilters`).

- **MultiPaneLayout scrollbar** — the layout no longer renders an unnecessary
  vertical scrollbar when all content fits within the viewport.

- **Duplicate relation blocks** — when a Show and Edit page share the same
  custom tab configuration, relation blocks are no longer rendered twice.

- **`/debug/ddl-trace` sink path** — the debug endpoint now writes DDL trace
  output to a `tempfile`-managed sink instead of a hardcoded `/tmp` path,
  avoiding cross-platform permission issues.

- **SectionCellContent `<style>` blocks** — `<style>` blocks embedded in
  `html_snippet` fields are now parsed and extracted by `SectionCellContent`,
  preventing them from being rendered as visible text inside the section body.

### Website

- **Google Analytics 4 tracking** — all website pages now include GA4
  measurement tags (G-FV2WK2VW5K).

- **Answers Showcase nav link** — the Answers Showcase navigation link now
  appears on all website pages.

- **Trademark and branding polish** — VeloIQ now includes the ™ symbol
  across all pages, and app names carry the "VeloIQ" prefix on the
  solutions hub.

- **Solutions page styling** — compact layout with 3 solution cards per row,
  reduced whitespace, and smaller cards.  The hero CTA buttons were removed
  in favour of a CTA band at the bottom; copy refinements across the page.

- **JuiceMantics on Solutions page** — JuiceMantics moved from the index
  page to the Solutions hub as the first card under Retail & Distribution.
  Private GitHub repo links were removed from the hub.

- **iqvigilant showcase link** — corrected the iqvigilant showcase URL from
  `.dev` to `.ai` across all website pages.

### Documentation

- **System Configuration console** — a new section in the configuration
  reference covers the System Configuration console, its available settings,
  and how to override them via environment variables.

### Sample App

- **Business rules and journey configuration** — the task-manager sample app
  now ships with fully populated business rules, journey instances, journey
  configurations, and an updated API tools registry, providing realistic
  fixture data for testing and demonstration purposes.

---

## [0.9.3] — 2026-07-03

### Features

- **Expanded database engine support** — the framework now ships first-class
  support for **12 database engines**: SQLite, PostgreSQL, MySQL, MariaDB,
  SQL Server, Oracle, Snowflake, DuckDB, ClickHouse, BigQuery, DB2, and
  Informix.  All 12 appear in the TUI selector, the CLI `--help` text, the
  Schema Browser dropdowns, and the documentation.  Any other SQLAlchemy
  dialect is accepted via a custom value (press `Enter` on the *DB type* field
  in the TUI, or pass `--url` on the CLI).  Driver hints now cover every
  supported engine.
- **Oracle driver updated to `oracledb`** — the obsolete `cx_Oracle` driver
  is replaced by `python-oracledb` (package `oracledb`).  This fixes macOS
  compatibility and aligns with Oracle's current recommendation.  The
  `veloiq new`, `veloiq configure-db`, `veloiq import-schema` commands, the
  TUI, and the Studio all generate `oracle+oracledb://...` URLs automatically.
- **`veloiq configure-db` and `veloiq new` auto-resolve drivers** — passing
  a bare dialect name (`--db-type oracle`, `--db-type mssql`) now
  automatically expands to the full dialect+driver form
  (`oracle+oracledb`, `mssql+pyodbc`) and adds the ODBC query parameter
  for MSSQL.  Previously only `import-schema` did this.
- **Navigate to related** — a new bulk action on every list page. Select one or
  more rows, then choose a relation from the dropdown (with search/filter by
  relation name or target model name) to navigate to the related model's list
  page, automatically filtered to show only records connected to your selection.
  Works with both forward (ONETOMANY) and reverse (FK reference) relations,
  supports recursive list-to-list navigation, and includes a pre-filter banner
  with a "Clear filter" button and right-click browser-native
  "open in new tab/window" support via standard hyperlink URLs.
- **Append related list** — stack filtered related-model list pages directly
  below the current one; each appended list is fully functional and can
  itself append further lists, enabling multi-level drill-down without
  leaving the page.
- **Right-click context menu** — right-click any list row to access bulk
  actions (change field value, export CSV, navigate/append related, clone,
  pin/unpin, delete) plus *Open show page*, *Open in new tab*, and *Open in
  new window* — with theme-aware contrast.
- **Backend `__in` query operator** — the CRUD list endpoint now supports
  `?field__in=1,2,3` for comma-separated IN-clause filtering on any column.

### Fixes

- **Self-referential relationships via `add-relation`** — calling
  `veloiq add-relation Habitacion Habitacion` now correctly generates
  `sa_relationship_kwargs={"foreign_keys": "...", "remote_side": "..."}`
  on the many-to-one side, fixing the ORM mapper error *"both of the same
  direction ONETOMANY"*.
- **Self-referential disambiguation patches sibling models** — when a
  self-referential FK is added, the disambiguation logic now correctly finds
  the owning class for every existing relationship in the file (not just the
  source/target class), preventing *"Could not determine join condition"*
  errors on unrelated models.
- **Studio Model Detail prefill** — navigating between models in the Schema
  Browser no longer shows stale values in the Add Field / Add Relation /
  Scaffold Page cards.  Each card now carries a `key` tied to the model's
  resource so React re-mounts it with the correct prefill.
- **Scaffold `extensions.gen.tsx` exports** — added missing
  `exceptionAlertBannerComponent`, `exceptionAlertListWrapperComponent`, and
  `exceptionAlertAwareResources` exports to the scaffold template, fixing
  `veloiq build` failures on newly created apps.

### Documentation

- **Database support tables** — the README, website, `getting-started.md`,
  and `cli-tools.md` now list all 12 supported engines with driver
  installation commands.
- **Custom dialect examples** — the TUI, Studio, and CLI help texts now
  include concrete examples of custom dialect+driver strings (e.g.
  `cockroachdb+psycopg2`).
- **Self-referential relation examples** — the `add-relation` CLI docs now
  include self-referential FK examples.

---

## [0.9.2] — 2026-06-26

### Features

- **Adaptive Detail slider expanded to 7 levels** — the Data Detail Level slider
  on show and edit pages grew from 5 to 7 levels with two new modes and a redesigned
  behaviour for custom pages:

  | Level | Label | Behaviour |
  |---|---|---|
  | 0 | Original | Restores each relation to its originally configured view type — no slider overrides applied |
  | 1 | Minimal | All relations forced to CSV view — ideal for quick summary scanning |
  | 2 | Compact | All relations forced to List view — good for rapid browsing |
  | 3 | Summary | Relations shown as Crosstab — designed for trend analysis |
  | 4 | Expandable | Totals-Details view — expand from summaries down to individual records |
  | 5 | Expanded | Full Tables — suited for heavy editing and deep-dive exploration |
  | 6 | Analyze | List view with the Analyze (chart) panel open by default — dashboard-style overviews |

  Each level now has a descriptive tooltip in English and Spanish.

- **Adaptive Detail slider now appears on custom pages** — a new
  `DataDetailLevelContext` (React context) and `DataDetailLevelStore` (module-level
  singleton) carry the slider state from `useStandardShowTabs` (which owns the state) to
  `StandardShow` / `StandardEdit` (which render the slider). Custom pages that wrap
  their content in `StandardShow` or `StandardEdit` automatically inherit the slider
  without any per-page code changes.

- **Level 6 "Analyze" controls list table visibility** — relations at level 6 open the
  Analyze panel by default and hide the list table. A new `defaultListVisible` property
  on `RelationDef` controls this behaviour, and `RelatedObjectsTable` polls the
  module-level store to react to level changes even when rendered inside a cached Ant
  Design tab pane.

- **`applyToRelations` no longer mutates input** — the function that applies slider
  overrides to relation definitions now returns fresh copies instead of mutating the
  originals, preventing stale overrides from leaking between renders.

### Fixes

- **Scaffold pinned old UI version** — `veloiq new` was copying a scaffold
  template that pinned `@juicemantics/veloiq-ui` to `^0.8.4`, causing new
  apps to miss the menu color inversion feature introduced in v0.9.0. The
  scaffold now pins `^0.9.0` so new apps get the inverted menu
  header/sidebar contrast by default. Also bumped the `_FALLBACK_UI_VERSION`
  in `migrate.py` to stay in sync.

---

## [0.9.1] — 2026-06-26

### Fixes

- **Search input text invisible in header** — when `plain_color_base_hex` is
  configured in `veloiq.toml`, the framework injects CSS overrides that force
  all header elements to a single text color. The search `Input` has its own
  background from the Ant Design theme, causing the text to match the background
  in both light and dark modes. Fixed with two layers: (1) CSS wildcard selectors
  now exclude `input`, `textarea`, `.ant-input`, and similar form elements via
  `:not()` so they keep their native theme colors, and (2) `GlobalSearch` sets
  `color: token.colorText` directly on the `Input` as a runtime guard.

- **SQLAdmin NLChat/DbConnector/NLAnswer list crash** — models that use
  `sa_column=Column("jm_eid", primary_key=True)` with a Python attribute name
  different from the DB column name (e.g. `eid` → `jm_eid`) crashed SQLAdmin
  list/detail pages with `AttributeError: 'NLChat' object has no attribute
  'jm_eid'`. The existing fix only patched Jinja2 template globals; the internal
  `_build_url_for` method called `get_object_identifier` via a module-level
  `from X import Y` binding that was not updated. Now monkey-patched across all
  six SQLAdmin modules that import the function by name.

- **SQLAdmin auto-sort crash** — auto-generated admin views that reference a
  sort column defined only as a `column_property` (not a real table column)
  no longer crash on list pages. Sort columns are now restricted to real
  SQLAlchemy `Column` objects.

- **Admin SPA blank page** — the admin single-page application fallback route
  now uses `router.default` instead of `mount` for the static file handler,
  preventing blank pages in certain deployment configurations.

### Improvements

- **Visual polish** — inverted menu header/sidebar
  colors for better contrast, switched the default theme color to teal
  (`#1e708a`), reduced field borders to single lines, and increased page title
  sizes.

### Documentation

- **`import-schema` tutorial** — added TUI/Studio alternatives for every CLI
  step; revised to use CLI/TUI/Studio commands instead of manual edits.

---

## [0.9.0] — 2026-06-26

### Features

- **Convention-based page overrides for all page types** — drop a
  `custom_show.tsx`, `custom_edit.tsx`, `custom_create.tsx`, or `custom_list.tsx`
  into a model's subdirectory under `pages/<module>/<Model>/` and re-run
  `veloiq generate`. The generator detects the file, registers it in
  `extensions.gen.tsx` under the corresponding resource key, and `App.tsx`
  renders the custom component instead of the default `Dynamic*` page at
  runtime. Extensions can now declare `edit_overrides`, `create_overrides`,
  and `list_overrides` in their manifest alongside the existing
  `show_overrides`.

- **Literal type → dropdowns** — the API-schema generator now detects
  `Literal["a", "b"]` type annotations on SQLModel fields and emits them as
  enumerated dropdown selects in the generated form. Fields with
  `Field(default=...)` also now pre-populate the Create form with the
  declared default value.

- **`DynamicShow` `beforeTabs` slot** — `DynamicShow` accepts an optional
  `beforeTabs?: React.ReactNode` prop rendered between the sticky header
  (breadcrumbs, title, action buttons) and the form tabs. Allows custom show
  pages to place content (e.g. an NL conversation panel) above the Details /
  relation tabs while keeping the standard header chrome.

- **Bulk-read API** — `POST /api/_meta/bulk-read` accepts a JSON array of
  record IDs and returns the full serialized representation for each.
  Serialization flows through the ORM model so relations resolve correctly.

- **Configurable model title fields** (`titleFields`) — models can declare
  which fields compose their display title (e.g. `first_name` + `last_name`),
  with `{model_name}` and `{pk}` tokens supported. Falls back to
  `dc_title`/`__str__` before the first string field.

- **`veloiq import-schema`** — new CLI command with a guided Studio UI that
  imports an existing database schema into VeloIQ module stubs, preserving
  foreign keys, column types, and defaults.

- **Crosstab chart backend renderer** — backend-rendered crosstab charts with
  fixes for 3D and bubble column resolution in Plotly.

### Fixes

- **Security — removed auth-disable escape hatches** — `VELOIQ_AUTH_DISABLED`
  and `auth_enabled=False` are no longer accepted. All authentication,
  role-based access control, and admin guards are always active. New apps must
  run `veloiq migrate` to seed the admin user before first start.

- **UI — inline Plotly charts** — `ExecutableHtml` strips the external Plotly
  CDN `<script>` tag when rendering inline HTML. The sanitized inline init
  script loads Plotly itself, fixing the race where a slow CDN stalled the
  sequential script runner and charts reserved space but never drew.

- **DynamicResource non-array dataSource** — `filteredDataSource`,
  `columnFilters`, crosstab data derivation, and `currentPageData` now guard
  with `Array.isArray()` instead of `|| []`, preventing `TypeError: X.map is
  not a function` on List, Show, Analyze, and crosstab pages.

- **List page search** — uses the `contains` operator so partial text matches
  work in the default list filter, not just exact-prefix matches.

- **Import-schema multi-FK disambiguation** — junction/link models with
  multiple foreign keys are now ordered correctly during import.

- **Solo sections in configured pages** — now span the full grid width instead
  of being constrained to a single column.

- **CLI — `veloiq run`** — works from the repository root, not just the
  `backend/` subdirectory.

- **i18n — `main.tsx` locale override** — scaffolded `main.tsx` now honors
  the `?lang=` query parameter and `localStorage` locale override.

- **NLP — entity title resolution** — entity titles are resolved via
  `build_model_str_label` and PK columns are properly renamed.

### Documentation

- **i18n request-locale behavior** — clarified that the active locale is set
  per-request via `set_request_locale()`, not automatically from
  `Accept-Language` headers. Documented the `StreamingResponse` caveat.

- **`import-schema`, `add-field` view types, and `bulk-read`** — new
  documentation pages for schema import, extended field view types, and the
  bulk-read endpoint.

### Studio

- Model-name dropdowns, searchable combo-box selectors, and token-expiry
  handling in the Studio UI.
- Build Frontend advisory note split into two paragraphs with per-link support.
- IQVigilant production-hardening nudges at five framework touchpoints plus
  advisory when installed-but-disabled.
- JuiceMantics (Commerce Optimization AI) brand promoted across the website,
  Studio, and CLI.
- IQVigilant URL corrected from `iqvigilant.dev` to `iqvigilant.ai` in all
  touchpoints.

---

## [0.8.5] — 2026-06-16

### Features

- **Dev-mode auto-migration** — `create_veloiq_app()` now calls `_sync_schema()` after
  `SQLModel.metadata.create_all()`. When `VELOIQ_DEV=1`, it detects columns present in the
  model but missing from the database table and issues `ALTER TABLE … ADD COLUMN` automatically,
  so adding a field to a model no longer causes a "no such column" crash at request time or
  requires a manual `veloiq db migrate` / `veloiq db upgrade` cycle in development. Outside dev
  mode the function logs a warning and points at the migration commands instead.

### Fixes

- **Auth CRUD routing** — `/user`, `/role`, `/tenant`, `/user_role`, and `/user_tenant` were
  registered without the `/api` prefix, while the frontend's generic dataProvider always
  requests resources under `/api`. New apps showed empty User/Role/Tenant lists with no error
  (the SPA static-file fallback silently served `index.html` for the mismatched path instead of
  404ing). `make_auth_router()` now returns `(auth_router, crud_router)`; the factory mounts
  `/auth/*` unprefixed and the CRUD router under `/api`, matching every other resource.
- **`veloiq new`** — the automatic `veloiq generate` step after scaffolding was invoking
  `python -m veloiq_framework.cli`, a package with no `__main__.py`, so it always failed
  silently. It now locates the real `veloiq` binary (falling back to the sibling of
  `sys.executable` when it's not on `$PATH`). `veloiq new` also now runs `veloiq build`
  automatically afterward, so a freshly scaffolded app's frontend is built and the app works
  immediately with just `veloiq run` — no manual `generate`/`build` step required.
- **UI — `DynamicResource` crash on non-array dataSource** — `filteredDataSource`,
  `columnFilters`, the crosstab data derivation, and `currentPageData` now all check
  `Array.isArray(tableProps.dataSource)` instead of `|| []`. The previous guard only caught
  `null`/`undefined`; other non-array truthy shapes still triggered
  `TypeError: e.map is not a function` in `buildStatsSummary` and `Y.forEach` in `chartData`
  on List, Show, Analyze, and crosstab pages.

---

## [0.8.3] — 2026-06-16

### Fixes

- **Menu rendering** — `CustomSider`, `HorizontalMenu`, `LayoutWrapper`, and
  `CommandCenterPortal` now guard every menu/journey transform with
  `Array.isArray()` checks. Previously, a transient non-array shape from
  `useMenu()` or a 403 from an unlicensed extension's `/api/journeys`
  endpoint (e.g. an installed-but-not-yet-licensed extension) could throw
  `X.forEach is not a function` and crash the whole layout.

---

## [0.8.2] — 2026-06-15

### Features

#### Named Query Creator — zero-code cross-model queries in Studio
A new dev-mode panel on every model's detail page in the Schema Browser lets developers
define cross-model read queries entirely in the browser — no Python coding required.

- **Declarative JSON storage** — queries are saved to `named_queries.json` in the module
  directory alongside `models.py`. The file is committed to source control and loaded by
  the framework at startup and code-generation time.
- **Relation-based JOINs** — joins are resolved via SQLAlchemy ORM relationships, not raw
  SQL. The framework discovers the correct relationship attribute automatically.
- **Field projection** — toggle individual columns from the root model and any joined model.
  Column aliases and display labels are customisable per-query; field types are read-only
  (inferred from the schema to avoid display inconsistencies).
- **Primary key guarantee** — the root model's pk column is always injected into the SELECT,
  ensuring every result row has a valid `eid` for show/edit navigation. The pk chip in the
  field picker is shown as locked and cannot be deselected.
- **Cross-model default filters** — SQL WHERE clauses baked in at query definition time,
  referencing any selected output column by its alias. Supports `eq`, `ne`, `contains`,
  `gt`, `gte`, `lt`, `lte`.
- **Multi-field sort** — an ordered list of `{field, asc/desc}` entries, fully applied as
  `ORDER BY col1 ASC, col2 DESC …` at the database level.
- **Auto-generate** — after every create or update, the studio automatically runs
  `veloiq generate` and streams the output. The new resource appears in the frontend as soon
  as generation completes, with no manual step required.
- **Light/dark mode toggle** — a theme toggle added to the Studio sidebar persists the
  preference in `localStorage` and respects `prefers-color-scheme` on first load.

#### i18n translation catalogue endpoint
- Added `GET /i18n/{locale}.json` endpoint served by the framework (no host-app code
  needed). Returns the compiled `.po` catalogue as a flat JSON object for the frontend
  i18n client.
- Added `/i18n/` to the auth-exempt path list so translation requests are never blocked by
  JWT middleware.

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
  driver (`pymysql`, `pyodbc`, `oracledb`, `ibm-db-sa`, `IfxAlchemy`)

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
