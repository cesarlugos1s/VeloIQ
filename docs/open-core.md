# Open-Core Model

SafeMantIQ is distributed as an open-core product.

## Free tier (MIT License)

The open-source core is fully functional for building any standard web
application.  It is intentionally not crippled — a developer can build and
ship a complete, production-ready application using only the free tier.

**Included:**

- `safemantiq-framework` Python package — `create_safem_app()`, module
  auto-loading, `FrameworkModel` / `TimestampedModel` / `StandardModel`,
  `create_crud_router()`, JWT auth middleware, SQLAdmin integration
- `safem` CLI — `new`, `generate`, `run`, `db`
- `api_schema_gen` — generates `api.py` CRUD endpoints and TypeScript schemas
  from SQLModel definitions
- `@safemantiq/ui` npm package — `DynamicResource` (full CRUD rendering
  engine), `LayoutWrapper`, `GlobalSearch`, `HierarchyView`, `MultiPane`,
  auth providers, all standard UI components

**License:** MIT.  Use freely in commercial and open-source projects.

## Pro / Enterprise tier (Commercial License)

Pro features are sold as modules that install on top of the free core.  They
target the high-ROI capabilities that a developer's manager or CEO would pay
to have available immediately rather than wait weeks for a custom build.

**Planned Pro modules:**

### WYSIWYG Page Builder
A drag-and-drop JSON page configuration tool that lets non-developers build
custom layouts for any entity without touching code.  Admins compose pages
from field panels, relation tables, charts, and custom blocks at runtime.

### AI Querying and Charting
Natural language querying of any database entity through the NLP module.
Users type questions in plain language; the agent translates them to SQL,
executes them, and renders the results as tables or charts.  Powered by
configurable LLM backends (OpenAI, Watsonx.ai, Ollama, Mistral).

### Deterministic Agent Execution Engine
A structured AI planning and execution engine for multi-step workflows.
Developers define deterministic plans as sequences of typed steps; the engine
executes them with observable state, retry logic, and audit trails.  Combines
with the AI Querying module for agentic ERP automation.

### Enterprise Features *(roadmap)*
- RBAC templates with role inheritance and per-module access control
- Audit logging — full write history with user attribution
- Multi-tenant scaffolding with Stripe billing integration

**License:** Commercial.  Contact sales for pricing.

## Design principle

The boundary between free and Pro is defined by business capability, not by
UI sophistication.  Standard CRUD, hierarchy views, multi-pane layouts,
global search, and the full DynamicResource component are all free because
every serious web application needs them.  Pro features are the ones where
the ROI conversation happens at the company level: "We can buy this for $X
or spend three weeks building it."
