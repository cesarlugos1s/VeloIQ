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
| `veloiq docs element new <type> <name> --change <change> [--story S] [--capability C]` | Create the delta of a journey, capability, feature, business rule, algorithm, non-functional requirement or implementation element, pre-filled; an element that already exists becomes a modification; it is also listed in the proposal |
| `veloiq docs change validate <change-name>` | `openspec validate`, then our checks: descriptive unique names, stories link to epics, features belong to a capability, prerequisites resolve with no cycles |
| `veloiq docs change apply <change-name> [--product-version V]` | Validate, strip the front matter of removed elements, `openspec archive` (merge and archive), then stamp front matter, copy extra files (such as `journey.json`) and write `openspec/CHANGELOG.md` |
| `veloiq docs spec generate-data-model` | Write `openspec/specs/data-model/<Entity>/spec.md` from the application's models |
| `veloiq docs spec index-code` | Read `# spec: <element-name>` markers and write `implemented-by` and the reverse views in `openspec/reverse-views/` |
| `veloiq docs spec check` | Fail when the data model or the code references differ from the code |
| `veloiq docs help sync <change-name> [--overwrite]` | Draft help documents in `openspec/help-drafts/` for the features and journeys of an applied change; an existing draft is kept unless `--overwrite` is given |
| `veloiq docs help screenshots [--base-url URL] [--username U]` | Log in to the running app and capture the screenshots listed in the drafts into `frontend/public/help-screenshots/` (password from `VELOIQ_DOCS_PASSWORD`, or a prompt; needs `pip install playwright` and `playwright install chromium`) |
| `veloiq docs help import [--dry-run] [--include-unreviewed]` | Write the reviewed drafts into the application's help documents and action buttons |
| `veloiq docs site build [--git-tag TAG]` | Stage and build the MkDocs Material site for a version (needs `pip install mkdocs-material`) |

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
