# Contextual Help

Every host app built on VeloIQ ships with a "Help" button in the app-shell
header that opens a non-modal right-side drawer with curated, per-page
markdown content — plus small self-contained Help popovers on the Dashboard
page's cells and tabs. Content is authored per page, auto-seeded with a
generic starting template so no page ever opens to an empty drawer, and
editable by any permissioned user without a developer involved.

## Where content lives

Help content is two built-in models, `veloiq_help_document` and
`veloiq_help_action` — no different from any other model in a host app, just
framework-provided instead of user-defined.

| Field | Model | Notes |
|---|---|---|
| `page_key` | `HelpDocument` | Unique string identifying the page — see convention below |
| `title` | `HelpDocument` | Short label |
| `body` | `HelpDocument` | Markdown, rendered read-only in the drawer, edited via the `editable-markdown` field type |
| `document_id` | `HelpAction` | FK to the owning `HelpDocument` |
| `label` | `HelpAction` | Button text |
| `action_key` | `HelpAction` | One entry from the fixed catalog below |
| `order` | `HelpAction` | Display order among a document's actions |

### `page_key` convention

| Page | `page_key` |
|---|---|
| A resource's List page | `"<resource>:list"` |
| A resource's Show page | `"<resource>:show"` |
| A resource's Edit page | `"<resource>:edit"` |
| A resource's Create page | `"<resource>:create"` |
| A resource's Dashboard cell | `"<resource>:dashboard-cell"` |
| The Dashboard page itself | `"_dashboard:main"` (fixed, not per-resource) |
| A Dashboard tab | `"dashboard-tab:<tab id>"` |
| A bespoke/custom page | any string you choose — see below |

## Editing help content

An auto-generated admin page lives under the username dropdown's
**Configurations → Help Content** menu entry — a normal, auto-generated
List/Show/Edit/Create flow for the `veloiq_help_document` model (with its
related `veloiq_help_action` rows editable inline), governed by the same
RBAC role permissions as any other model. No bespoke admin UI was built for
this; it's the same `editable-markdown` field type and generic CRUD router
every other model gets.

If a page has no help document yet, the drawer shows a "Write help for
this" link (gated by the viewer's create permission on
`veloiq_help_document`) that deep-links to the Create form with `page_key`
pre-filled and hidden.

## Auto-seeded generic templates

On first boot, every host-app resource gets a `veloiq_help_document` row for
each of `list`/`show`/`edit`/`create`/`dashboard-cell`, pre-filled with a
generic template describing that page type's shared mechanics (view
switching, bulk row actions, right-panel navigation, field types,
save/cancel, and so on) — so nothing is ever empty. A single extra row seeds
`"_dashboard:main"` for the Dashboard page itself.

This seeding is strictly **insert-if-missing** — once a row exists, whether
seeded or hand-written, it's permanent; a later restart never overwrites it.
Dashboard **tab** documents (`"dashboard-tab:<tab id>"`) are the one
exception that's never auto-seeded: tabs are an arbitrary frontend-only
grouping the backend has no way to enumerate, so those start at the
no-content fallback until an author writes one for that specific tab.

## Action buttons

A `HelpAction` row renders as a real button next to the document's markdown,
with a tooltip describing what clicking it does. Only safe, single-target
actions are in the catalog:

| `action_key` | Page | What it does |
|---|---|---|
| `create_new` | List | Opens the Create form |
| `export_csv` | List | Downloads the current list as CSV |
| `open_import` | List | Opens the CSV import dialog |
| `open_metadata` | List | Shows model metadata |
| `open_view_config` | List | Opens the view configuration panel (columns/filters) |
| `switch_view_type:gallery` / `:calendar` | List | Switches the list's view type — add only where the model actually supports that view |
| `go_to_list` | Show | Navigates back to the list |
| `go_to_show` | Edit | Navigates to Show for the current record |
| `go_to_edit` | Show | Navigates to Edit for the current record |
| `pin_to_dashboard` | Show | Pins the current record to the Dashboard |
| `open_explore` | Show | Opens the relation explorer for the current record |

**Deliberately excluded, on purpose, not by oversight:** Delete and Save
(destructive, or dependent on live in-memory form state a generic executor
can't safely replay), Duplicate (would need full `ModelDef` field awareness
to replicate its exclusion logic safely), and the Actions-preferences gear
(a multi-toggle settings panel, not a single action). These stay
describable in the markdown body, just without a runnable button.

## Dashboard cells and tabs

Unlike List/Show/Edit/Create — where exactly one page is ever "current" —
a Dashboard can have several cells and several tab labels mounted
simultaneously. There's no single "current page" a shared drawer could
represent, so Dashboard cells and tabs each get their own small, independent
`Popover` (fetching their own content directly, not through the shared
drawer's context) — the same shape the framework already uses elsewhere for
tight toolbar spaces. The Dashboard page itself still uses the main shared
drawer, exactly like any other page.

## Custom/bespoke pages

A page that isn't one of the framework's Dynamic pages (a hand-built React
route) can opt in with one line:

```tsx
import { useSetHelpPageKey } from "@juicemantics/veloiq-ui";

useSetHelpPageKey("my-custom-page");
```

Passing `null` is a no-op, not a clear — this is what lets embedded/nested
renders (a relation list inside a Show page, a Dashboard cell's embedded
list) safely decline to own the ambient page's help key without stomping
whatever the enclosing page already set.

## Extension-contributed help text

An extension's own header buttons (via `list_header_button_components` /
`show_header_button_components` — see
[docs/module-authoring.md](module-authoring.md#adding-buttons-to-every-resources-default-listshow-page))
can add an optional `help_text` string to their `global_components` entry;
it's appended under the page's own curated content in the drawer, authored
once in the extension's Python manifest rather than through the admin page.

## Authoring guidance for code assistants

A scaffolded app's `CLAUDE.md` and `llms.txt` both include a "Contextual
help" / authoring-contract section instructing a code assistant to write
only what's specific to a given page — its fields, its business meaning,
any custom actions — rather than restating the generic mechanics every page
already starts with.
