# Shared view state

Every list page and every related-model block keeps one view state, shared by
all the view types it can show. Switching from a table to a list, a kanban, a
gallery, a calendar or a crosstab keeps the same filters, sorting, field
sequence, page size and summary functions, wherever the new view type supports
them.

## What the state holds

| Part | Meaning |
| --- | --- |
| Column filters | Filters by field values (the filter icons on table headers). |
| Advanced filter rules | The helper-based builder for several conditions. |
| Sort list | Multi-column sort, most significant first. |
| Field sequence | The visible fields and their order, shared by every view type. |
| Page size and page | Pagination. |
| Summary functions | Sum, average, count... per field (totals-details, crosstab). |
| Analyze | Open, position and orientation of the Analyze section. |

## Three layers

From lowest to highest precedence:

1. **Defaults** from the page configuration or a template. A relation entry's
   `limit` is the starting page size of its block. The fields a template
   expands for a block are the starting field sequence.
2. **Saved preferences**, stored with the existing view preferences of the page
   ("Save layout"). Preferences saved before this feature keep loading.
3. **Temporary changes**, kept in the browser until the page is reloaded and
   never sent to the server. Saving copies this layer into the saved one.

A temporary view type switch wins over the view type of the configuration or
the template. A template supplies defaults only and never overwrites saved
preferences.

## Keyed by page block

State is kept per page and per block: the list itself, or one relation of a
show or edit page. If the same model appears in two blocks, each keeps its own
state. Embedded pages (dashboard cells, kanban columns) keep their state in the
component.

## What each view type supports

| View type | Filters | Multi-sort | Advanced filter | Pagination | Field sequence | Summaries | Analyze |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Table, editable table | yes | yes | yes | yes | yes | no | yes |
| List, editable list | yes | yes | yes | yes | yes | no | yes |
| CSV, editable CSV | yes | yes | yes | yes | yes | no | no |
| Totals-details | yes | yes | yes | yes | yes | yes | yes |
| Crosstab, editable crosstab | yes | yes (headers) | yes | no | field picker | yes | yes |
| Kanban | yes | yes (cards) | yes | yes (per column) | yes (cards) | no | yes |
| Gallery, image | yes | yes | yes | yes | yes (captions) | no | no |
| Calendar | yes | same-day order | yes | no | yes (event popup) | no | no |
| Primary | no | no | no | no | yes | no | no |

An option a view type does not support is hidden but kept: it applies again
with its last value when the user returns to a view type that supports it.

## How the views use the state

- **Field sequence.** Table, list and CSV use it as the column or field order.
  Kanban cards, gallery captions and calendar event popups show the first
  fields of the sequence. A primary view puts the fields into the slots of each
  configured section in sequence order. A crosstab does not follow it.
  Role fields (image, date, grouping, crosstab dimensions) are not part of it.
- **Kanban.** Filters, advanced filter and multi-sort apply once to the whole
  board; the cards are then split into columns. Each column pages its own cards
  with the shared page size, and hides its own filter, sort and field controls.
- **Crosstab.** The sort list orders the headers of the axis each sorted field
  is placed on. Several sorted fields on one axis nest in sort list order. A
  sorted field on no axis stays dormant. Sorting headers by summarized values
  is not included.
- **Server-side parity.** Views without table headers (gallery, primary) send
  the sort to the server when rows are paged there, so results do not change
  when the data volume crosses a threshold.

## For developers

Code lives in `packages/ui/src/components/DynamicResource/viewState/`:

- `viewTypeCapabilities.ts` declares what each view type supports. A new view
  type adds one entry.
- `viewStateLayers.ts` resolves the layers, builds block keys and maps the
  legacy preferences to the shared schema.
- `useSharedViewState.ts` gives a page block its resolved state and setters.
- Shared controls: `AdvancedFilterBuilder`, `MultiSortControl`,
  `FieldSequenceEditor`, `SummaryFunctionsEditor`.
- Pure helpers: `sortRecords.ts`, `orderCrosstabHeaders.ts`,
  `sequenceCaptions.ts`, `orderSectionFieldRows.ts`, `fieldSequenceOperations.ts`.

Temporary changes are stored by `updateTemporaryViewState` in
`temporaryLayout/temporaryPageLayoutStore.tsx`.
