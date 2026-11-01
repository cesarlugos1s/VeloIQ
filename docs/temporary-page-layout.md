# Temporary page layout

Users can change how the page they are using looks **for the moment**, without
changing the page configuration. Nothing is saved or sent to the server: the
changes last until the browser page is reloaded.

The buttons appear in the page header, next to the data detail (density)
selector, on list, show, edit and create pages. Pages embedded in another page
(relation lists, previews, dashboard cells) do not show them.

| Control | List | Show | Edit | Create | Notes |
|---|---|---|---|---|---|
| View type (first option of **Design options**) | yes | - | - | - | Table, list, gallery, calendar, kanban, crosstab, primary, ... The calendar is offered only when the model has a date field. |
| Template | yes | yes | yes | yes | Shown only when an extension registers a page template provider. "Configured layout" returns to the page configuration. |
| Analyze on/off (switch in **Design options**) | yes | - | - | - | Only where the resource has an Analyze area. |
| Analyze position | yes | - | - | - | Before/after the data, stacked/side by side. |
| Cell size | - | yes | yes | - | Replaces the cell size selector that used to sit in the tab bar. |
| Action buttons position | yes | yes | yes | yes | Top right, left or right. |
| Side panels layout | all | all | all | all | Stack, breadcrumb, overlay or scroll. Applies to the whole application until reload. |

"Back to the configured layout" in the **Design options** popover removes
every temporary change of the page.

## Page templates (for extension authors)

The framework does not know about templates. An extension supplies them by
calling `registerPageTemplateProvider` (exported by `@juicemantics/veloiq-ui`):

```ts
registerPageTemplateProvider({
    listTemplatesForPage: async (model, pageType) => [{ name: "two-columns", label: "Two columns" }],
    resolveTemplateRows: async (model, pageType, templateName) => viewConfigRows,
});
```

Both methods receive the page's `ModelDef` (its fields and relations are what a template expands). `resolveTemplateRows` returns the same `ViewConfigRow[]` the page configuration
produces; the page renders them in place of the configured rows.

## Where it lives

`packages/ui/src/components/DynamicResource/temporaryLayout/`:
`temporaryPageLayoutStore.tsx` (overrides, keyed `<resource>:<pageType>`),
`pageTemplateProviderRegistry.ts`, `useTemporaryTemplateRows.ts` and
`TemporaryPageLayoutControls.tsx`.

The **Design options** button (table icon) holds the view type, Analyze position,
cell size, action buttons position and side-panel layout. It stays in the header
after a view type is chosen, including when the choice turns the page into a
single-record form.
