# Documentation workflow — `veloiq docs`

Keeps the change documents (epics, user stories, designs) and the Product Specification (journeys, capabilities,
features, business rules, algorithms, non-functional requirements, implementation elements, data model) in sync,
all as files in the project's git repository under `openspec/`.

[OpenSpec](https://github.com/Fission-AI/OpenSpec) (pinned to 2.2.0, run through `npx`) manages the change folders and
merges approved changes into `openspec/specs/`. VeloIQ adds, with deterministic steps, what OpenSpec does not: the
front matter of each element (dates, versions, origin, prerequisites, code references), the data model generated from
the code, help document drafts and the documentation site.

## Commands

| Command | What it does |
| --- | --- |
| `veloiq docs init` | Install OpenSpec in the project with the `veloiq-docs` schema, templates and the assistant commands `/docs-propose`, `/docs-implement`, `/docs-apply` |
| `veloiq docs change new <change-name>` | Create a change folder from the schema, with `proposal.md`, `design/high-level-design.md` and `tasks.md` started from the templates |
| `veloiq docs epic new <epic-name> --change <change>` | Create the epic with name, type, change and today's date filled in and its sections ready; you write the text |
| `veloiq docs story new <story-name> --epic <epic> --change <change>` | Create the user story linked to its epic (and list it in the epic), pre-filled; you write the text |
| `veloiq docs element new <type> <name> --change <change> [--story S] [--capability C] [--data-not-applicable REASON]` | Create the delta of a journey, capability, feature, business rule, algorithm, non-functional requirement, entity definition or implementation element, pre-filled; an entity definition also gets `definition.md`; an element that already exists becomes a modification; it is also listed in the proposal |
| `veloiq docs change validate <change-name>` | `openspec validate`, then our checks: descriptive unique names, stories link to epics, features belong to a capability, prerequisites resolve with no cycles |
| `veloiq docs change apply <change-name> [--product-version V]` | Validate, strip the front matter of removed elements, `openspec archive` (merge and archive), then stamp front matter, copy extra files (such as `journey.json`) and write `openspec/CHANGELOG.md` |
| `veloiq docs spec generate-data-model` | Write `openspec/specs/data-model/<Entity>/spec.md` from the application's models |
| `veloiq docs spec index-code` | Read `# spec: <element-name>` markers and write `implemented-by`, the implementation status (`planned`, `partial` or `implemented`, with the version) and the reverse views in `openspec/reverse-views/` |
| `veloiq docs spec check` | Fail when the data model or the code references differ from the code |
| `veloiq docs help sync <change-name> [--overwrite]` | Draft help documents in `openspec/help-drafts/` for the features and journeys of an applied change; an existing draft is kept unless `--overwrite` is given |
| `veloiq docs help screenshots [--base-url URL] [--username U]` | Log in to the running app and capture the screenshots listed in the drafts into `frontend/public/help-screenshots/` (password from `VELOIQ_DOCS_PASSWORD`, or a prompt; needs `pip install playwright` and `playwright install chromium`) |
| `veloiq docs help import [--dry-run] [--include-unreviewed]` | Write the reviewed drafts into the application's help documents and action buttons |
| `veloiq docs site build [--git-tag TAG]` | Stage and build the MkDocs Material site for a version (needs `pip install mkdocs-material`) |

## Technical design of a story

A user story names the technical design it is built from in the front matter key `design`, a list of design files of its change:
`high-level-design` and `low-level-design/<file name without .md>`. `veloiq docs story new` writes `design: [high-level-design]`; add the
low-level files as they are written. `veloiq docs change validate` refuses a name that is not a design file of the change, and the site shows a
"technical design" row on the story page and a "Stories built from this design" list on the design page. A feature reaches its design through its stories.

## Layout

```
openspec/
  specs/<element-type>/<element-name>/spec.md     Product Specification, current state
  changes/<change-name>/                          proposal, epics/, stories/, specs/ (deltas), design/, tasks.md
  changes/archive/<date>-<change-name>/           finished changes
  CHANGELOG.md, reverse-views/, help-drafts/      generated
```

Element names are descriptive kebab-case (never numbered). Data model entities, fields and relations use the names in
the code. Everything is written in English.

## Data of features and entity definitions

Each entity is defined once, and requirements point to it, so that a person can design and build a feature from the specification without the values being repeated:

- **Entity definitions** (`specs/entity-definitions/<Entity>/`, element type `entity-definitions`): each entity is defined once. `definition.md`
  has a `## Fields` table (Field, Description, Type, Required, Allowed values, Default) and a `## Relations` table (Subject entity, Relation,
  Object entity, Subject cardinality, Object cardinality). A cardinality is `one`, `zero or one`, `one or more` or `zero or more`.
  Subject cardinality is how many subjects are linked to one object, and object cardinality is how many objects are linked to one
  subject. For `Flow has steps Step` with `one` and `one or more`, a step belongs to one flow and a flow has one or more steps.
  The generated `data-model` specification is separate: it describes what the code has, and is not edited.
- **Requirements point to the data** instead of copying it: inside a requirement, a line `Data: Entity.field, Entity.field` and
  a line `Relation: Subject > relation name > Object` name what the requirement relies on. The values (description, required, allowed
  values, default, cardinalities) are written only in the entity definition; the documentation site fills them in as a table next to
  the requirement. Every reference must be defined by its entity.
- **Capabilities do not point to data**: their features do. `veloiq docs change validate` rejects `Data:` and `Relation:` lines in a capability.
- **Features whose requirements use no data**, such as a change to a business rule, a user journey or a UI design: put the reason in the
  feature's front matter, `data-not-applicable: <reason>`, or create it with `--data-not-applicable`.
- **Setting:** `[documentation] require_feature_data = true` in `veloiq.toml` (the default). When true, `veloiq docs change validate`
  and `apply` fail for an added or modified feature with no `Data:` or `Relation:` line and no reason. Set it to `false` to turn the
  requirement off; references that exist are still checked.
- The site shows the entity's definition on its page, the data table next to each requirement that points to it, and "Not applicable"
  with the reason for a feature that has none.

### Naming conventions

Entity definitions follow the conventions of the VeloIQ applications (the `models.py` of the vertical apps and of JuiceMantics),
so a specification maps straight onto the code. `veloiq docs change validate` checks them.

| What | Convention | Example |
| --- | --- | --- |
| Entity | Singular, PascalCase; its table is the same name in snake_case | `CashAccount`, table `cash_account` |
| Field | Lowercase words joined by underscores | `risk_tolerance` |
| Link to another entity | The relation name; the foreign key column is `<relation>_id` | `owner_id` |
| Yes or no field | Starts with `is_` or `has_` | `is_active`, `has_header` |
| Date field | Ends with `_date` | `expiration_date` |
| Date and time field | Ends with `_at` | `started_at` |
| Choice values | Lowercase words joined by underscores | `full_service` |
| Relation | The subject in snake_case, a verb phrase, then the object in snake_case, joined by underscores; the object's side is the same name with `_reverse` | `allocation_strategy_has_allocation_plan` |

Both entities of a relation list it in their Relations table: the subject lists the relation, and the object lists the same name
with `_reverse`, with the subject and object swapped and the two cardinalities swapped. `veloiq docs change validate` fails when the
reverse side is missing or differs.

A relation is named from its subject: `Position` belongs to an `Investor` is `position_belongs_to_investor`, and the investor's side
is `position_belongs_to_investor_reverse`. The verb phrase is always in the middle.

## Implementation status

Whether an element is built, and in which product version, is computed from evidence and never typed:

- Put `# spec: <element-name> :: <Requirement name>` above the function or component that implements one requirement of the element
  (`// spec:` in TypeScript). A marker without `:: <Requirement name>` covers every requirement of the element, which is weaker evidence,
  so prefer requirement markers.
- `veloiq docs spec index-code` writes `implementation-status` into the element's front matter:
  `planned` (no marker), `partial` (some requirements have a marker, with `requirements-implemented` and `requirements-total`) or
  `implemented` (every requirement has a marker). A capability is rolled up from its features (`features-implemented`, `features-total`).
- `implemented-in-version` is the oldest git tag that contains the commit that added the marker. For an element it is the latest of its
  requirements. A marker that is not committed yet, or that no tag contains, gives `unreleased`. It needs the git history and tags.
- A new element starts as `planned` when its change is applied.
- `veloiq docs spec check` fails when the status is out of date, for example when a marker was deleted, or when a marker names a
  requirement the element does not have.
- The site shows an **implementation** row on each element, the status of each feature on its capability page, and the page
  *implementation-status-by-epic* under Traceability, which lists what is still to build.
- The home page, the changelog and the three Traceability pages (*implemented-by-module*, *implemented-by-epic*, *implementation-status-by-epic*) are tables on the
  site, built when it is staged from the same source files (`CHANGELOG.md` and `openspec/reverse-views/`, which stay as they are). The home page has a row for each
  element type with how many elements are implemented, partial and planned; the changelog has a table for each version (change, date, and the elements it added,
  modified and removed, linked to their pages); the module and epic views have a row for each module or epic and element; the status view starts with a summary of the
  statuses and has a row for each epic and element with its status and detail. The changelog and the three Traceability pages can be sorted by clicking a column header and,
  with ten rows or more, filtered by a text box and by a list for each column that has few values (the script is bundled with the site and needs no network). A line that does not have the expected form is kept as it was below the table.

### Requirements implemented in another application, or set by hand

A marker is only looked for in the application the specification belongs to, so a requirement implemented in another application would show as
planned. List it, and any requirement whose status you want to set by hand, in `openspec/implementation-status-overrides.yaml`:

```yaml
features/add-event-id-timestamp-and-origin-to-webhook-events:
  Event identity:
    status: implemented          # implemented or planned
    where: Advanced Development  # where the code is (optional, shown on the page)
    since: unreleased            # the product version that has it (optional, unreleased when omitted)
  "*":                           # every requirement of the element that has no entry of its own
    status: planned
```

- An entry for a requirement wins over the markers; with no entry the markers decide. The element and its capability are rolled up as usual,
  and the page says how many requirements were marked by hand and where (`marked-by-hand-in` in the front matter).
- Editing the file needs no specification change and survives `veloiq docs change apply`.
- `veloiq docs spec check` reports an entry that is malformed, names an element or requirement that does not exist, or says `implemented` for a
  requirement that a marker in the application already covers (remove the entry then).

A marker proves that code exists for a requirement, not that it works.

## Authoring a change

Create the files with the scaffold commands (`change new`, `epic new`, `story new`, `element new`): the front matter, dates,
links and section headings are filled in, names are checked (descriptive kebab-case, never numbered) and parents must
exist. Then write the text in any markdown editor, or ask Claude Code with `/docs-propose`. OpenSpec itself has no editor.

Delta specs start with front matter that OpenSpec ignores and the VeloIQ step reads after the archive:
`name`, `capability` (features), `journeys`, `stories` (story file names), `requires`, `prerequisites`, `rule-id`.
A story starts with its epic's prerequisites and may mark inherited ones in `not-applicable`. The body uses OpenSpec's
format (`## Purpose`, `## ADDED|MODIFIED|REMOVED Requirements`, `### Requirement:`, `#### Scenario:`).
Put content that does not fit a requirement (journey steps, rule JSON) in an extra file beside `spec.md`.

To rename an element, remove the old one (a `## REMOVED Requirements` delta) and add the new one in the same change;
`veloiq docs change apply` handles the front matter OpenSpec would otherwise refuse to retire.

## Help documents

`veloiq docs help sync` writes a draft per feature and journey from its purpose, requirements and scenarios. Complete the
draft, then review it:

1. **Pages.** `page_keys` lists the help pages it belongs to, using the help convention (`job_posting:show`, or any
   string for a custom page). It is filled from the element's `help-pages` front matter when that is set.
2. **Actions.** Under `## Actions`, one button per line: `- go_to_edit: Edit the vacancy`. The keys are the catalog of
   [contextual help](contextual-help.md); an unknown key stops the import.
3. **Screenshots.** List `{file, route, caption}` entries under `screenshots` in the front matter, then run
   `veloiq docs help screenshots`. The images are written to `frontend/public/help-screenshots/` and appear in the draft;
   they are served after `veloiq build` (or by the dev server).
4. **Approve.** An administrator reviews the text and sets `status: reviewed`. Only reviewed drafts are imported.
5. **Import.** `veloiq docs help import` (try `--dry-run` first). The text goes into the help page inside a marked block,
   below the page's existing generic text, so importing again replaces that block and never duplicates it. Actions the
   page does not have yet are added; existing ones are kept.

## From the terminal explorer and VeloIQ Studio

Both show the same actions, explanations and next-step advice (they read `documentation_workflow_guide.py`).

- **`veloiq` with no arguments** → press `4` (or `d`) on the home screen. The Documentation screen shows whether the
  workflow is set up, the changes in progress, the applied changes, the number of specification elements and help
  drafts, and a **Next step** suggestion. Move with the arrow keys; the selected action explains what it does and when
  to use it, and shows the command it runs. Press the action's key (`i` set up, `n` new change, `v` validate, `a` apply,
  `e` epic, `t` story, `l` element, `d` data model, `x` index code, `c` check, `h` help drafts, `p` screenshots, `r` import preview, `o` import, `s` site) or Enter. Actions that need a change offer the
  changes that exist as defaults, and every command asks for confirmation before it runs.
- **Studio** (`/veloiq-studio/`, dev mode) → **Documentation** under Dev tools. Each action is a card with its
  explanation, the inputs it needs (changes in progress and applied changes appear as choices) and a **Run** button that
  streams the command's output. Documentation commands never trigger an automatic `veloiq generate`.
