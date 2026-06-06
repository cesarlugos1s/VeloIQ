# Open-Core Model

VeloIQ is distributed as an open-core product.

## Free tier (MIT License)

The open-source core is fully functional for building any standard web
application.  It is intentionally not crippled — a developer can build and
ship a complete, production-ready application using only the free tier.

**Included:**

- `veloiq-framework` Python package — `create_veloiq_app()`, module
  auto-loading, `FrameworkModel` / `TimestampedModel` / `StandardModel`,
  `create_crud_router()`, JWT auth middleware, SQLAdmin integration
- `VeloIQExtension` base class and `discover_extensions()` — the extension
  package contract and discovery mechanism; any developer can build and
  distribute their own extension package using these
- `veloiq` CLI — `new`, `generate`, `run`, `db`, `add-module`, `add-dashboard`,
  `search`, `migrate`, `new-extension`, `add-licensing`; bare `veloiq` opens the
  interactive project explorer
- `api_schema_gen` — generates `api.py` CRUD endpoints and TypeScript schemas
  from SQLModel definitions; also syncs installed extension schemas on `veloiq generate`
- `@juicemantics/veloiq-ui` npm package — `DynamicResource` (full CRUD rendering
  engine), `LayoutWrapper`, `GlobalSearch`, `HierarchyView`, `MultiPane`,
  auth providers, all standard UI components

**License:** MIT.  Use freely in commercial and open-source projects.

## Extension package architecture

Pro features are distributed as pip-installable **extension packages** rather than
as monolithic framework additions.  Each extension:

- Declares itself to the framework via a `veloiq.extensions` Python entry point
- Ships its own backend modules (loaded alongside the host app's modules **once the host enables the extension**)
- Ships frontend schema files (copied into the host app by `veloiq generate`)
- Manages its own licensing through a bundled license module with RS256 JWT enforcement
- Optionally ships pre-built React bundles for genuinely custom UX, served at `/ext/{name}/`

**Explicit opt-in.** Installing an extension into the virtualenv does **not** load
it automatically — that would leak an extension into every app sharing the venv.
A host app loads only the extensions it lists in its `veloiq.toml`
(`[extensions].enabled`). Enable one with `veloiq extend-package <name>`, disable
with `veloiq remove-package <name>`, and inspect installed-vs-enabled with
`veloiq list-extensions`. With no `veloiq.toml` (and no `VELOIQ_EXTENSIONS`
override), no extensions load. The same allowlist gates both app startup and
`veloiq generate`, so runtime and generated frontend never diverge.

### Third-party extensions

The same architecture is available to any developer.  `veloiq new-extension <name>`
scaffolds a complete extension package including the backend module structure, frontend
schema layout, a fully functional license module, and a `generate_license.py` CLI for
issuing signed JWT license keys.  See [module-authoring.md](module-authoring.md) for
the full contract.

## Pro / Enterprise tier (Commercial License)

Pro features are distributed as two extension packages that install on top of
the free core.

```bash
pip install iqvigilant    # Personalization + Natural Language
pip install vantageiq     # Benefit Realization Management
```

After installation, enable the extension for the host app and sync its schemas:

```bash
veloiq extend-package iqvigilant   # adds it to the app's veloiq.toml
veloiq generate                    # sync schemas/menus into the frontend
# then restart the backend so its modules load
```

Each package manages its own license keys through its own License Management page.

### IQVigilant (`pip install iqvigilant`)

The Pro tier targets CTOs and CFOs who need to move faster, govern more
safely, and deploy AI without the risks that come with unconstrained
generative tools.  IQVigilant unlocks three categories of capability:
**Personalization**, **Natural Language**, and **Enterprise Governance**.

**Licensed module groups:**

- **Personalization** — `pageconfig` + `journey` modules.  License JWT claims: `max_page_configurations`, `max_journey_definitions` (in addition to `start_date` / `end_date`).
- **Natural Language** — `nlp` module.  License JWT claims: `max_nlp_users` (seat-based), `start_date` / `end_date`.

### VantageIQ (`pip install vantageiq`)

Benefit Realization Management for organisations that need to define measurable
business goals and track objectives, benefits, and enablers with planned versus
actual measures.  Also includes Goal-Seeking Scenarios powered by AI forecasting.

---

### Drag-and-Drop WYSIWYG Page Builder

Non-technical stakeholders can compose and iterate on frontend pages at
runtime — field panels, relation tables, charts, and custom blocks —
without touching code.  Changes are stored as JSON configuration; developers
retain full control over what building blocks are available.

---

### Business Orchestration Engine — User Journeys

Guide users through multi-step business processes with conditional branching,
data validation at each step, and full execution traceability.  Every journey
run is recorded with the data it generated, giving managers an audit trail of
who did what and when across every business process in the system.

---

### The Intelligence (IQ) Suite

**Natural Language NLP Module**
Users query any entity in plain language; the module translates intent into
SQL, executes it, and renders the results as tables or dynamic charts.
Powered by configurable LLM backends (OpenAI, Watsonx.ai, Ollama, Mistral).

**Deterministic Agent Engine — Safe AI**
An execution layer that translates high-level intent into hardened, auditable
system actions.  Unlike open-ended generative agents, every action is
deterministic, observable, and reversible — giving organisations the benefits
of AI automation without the hallucination risk.

---

### Enterprise Governance

**Advanced ReBAC**
Graph-based Relationship-Based Access Control for complex organisations — for
example, "a user may access a record only if they are a member of the project
that owns it."  Goes beyond the role and ownership patterns in the free tier
to model arbitrary permission graphs.

**SSO & IAM**
One-click integration for SAML 2.0, Okta, and Azure Active Directory.
Users log in through your existing identity provider; no password management
required.

**Hardened Multi-Tenancy**
Schema-level data isolation for high-compliance industries (HIPAA, finance,
government).  Each tenant's data lives in a separate database schema,
eliminating any risk of cross-tenant data leakage.

**Compliance Audit Logs**
Automated "Who, What, When" tracking for every write operation in the system.
Built for SOC 2 and ISO 27001 readiness out of the box.

---

### Benefit Realization Management

Define measurable business goals and track their objectives, benefits, and
enablers with planned versus actual measures.  Gives leadership a live view
of whether the organisation is realising the value that justified each
initiative.

---

### Goal-Seeking Scenarios

Propose, analyse, evaluate, and select complete business strategies designed
to achieve a measured goal.  AI forecasts each scenario's potential outcomes
and trade-offs — empowering managers to choose the strategy that best achieves
their goals — then generates a ready-to-implement action plan.

---

**License:** Commercial.  Contact sales for pricing.

## Design principle

The boundary between free and Pro is defined by business capability, not by
UI sophistication.  Standard CRUD, hierarchy views, multi-pane layouts, global
search, RBAC, ReBAC, and the full DynamicResource component are all free
because every serious application needs them.  Pro features are the ones where
the ROI conversation happens at the executive level: speed to market, AI safety,
regulatory compliance, and strategic decision support.
