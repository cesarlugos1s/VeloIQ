# Custom Page Scaffolding — `veloiq scaffold-page`

When the auto-generated Dynamic pages (`DynamicList`, `DynamicShow`, `DynamicEdit`, `DynamicCreate`) are not enough — e.g. you want to add a custom panel, reorder sections, or embed a chart — `veloiq scaffold-page` generates a ready-to-customize TypeScript component and wires it into your app automatically.

## Usage

```bash
veloiq scaffold-page <resource> <page_type>
```

- **resource** — the resource key for the model (e.g. `task`, `project`, `team_member`)
- **page_type** — one of `list`, `show`, `edit`, `create`

### Examples

```bash
veloiq scaffold-page task show          # custom show page for Task
veloiq scaffold-page project list       # custom list page for Project
veloiq scaffold-page task edit          # custom edit page for Task
veloiq scaffold-page team_member create # custom create page for TeamMember
```

Run the command as many times as needed — each invocation scaffolds one page type. Re-running with the same resource and page type is a no-op (existing files are never overwritten).

## What gets generated

Running `veloiq scaffold-page task show` produces:

### 1. `frontend/src/pages/tasks/CustomTaskShow.tsx`

A TypeScript/React component that wraps `DynamicShow`. It starts with a detailed header comment and a subtle scaffold indicator badge:

```
frontend/src/pages/tasks/CustomTaskShow.tsx
```

The header comment describes:
- The model's fields (label, key, type, required, FK target)
- Forward relations (FKs in this model pointing to other models)
- Backward relations (other models referencing this model)
- Which route this component is registered on
- How to navigate to/from this page in other custom components
- How to remove the override

The **scaffold indicator badge** appears in the bottom-right corner of the page while you're developing. It's a faint dashed border with the component name (`⚙ Custom Task Show`). To remove it, delete the `<div>` block inside the comment markers — no other change is needed.

### 2. `frontend/src/custom_pages.ts` (created or updated)

A registry file that maps resource names to custom page components:

```typescript
import { CustomTaskShow } from "./pages/tasks/CustomTaskShow";

export const customShowComponents: Record<string, React.ComponentType> = {
    "task": CustomTaskShow,
};
```

This file is safe to edit manually. Running `scaffold-page` again for a different resource or page type adds to the existing maps without touching what's already there.

### 3. `frontend/src/App.tsx` (patched once)

On the first run, App.tsx is patched to:
- Import all four `custom*Components` maps from `./custom_pages`
- Add `_renderList`, `_renderShow`, `_renderCreate`, `_renderEdit` helpers that check the registry before falling back to the Dynamic component
- Update the `allSystemModels.map` loop to use those helpers
- Update `PrimaryShowRenderer` to check `customShowComponents` (used when clicking a row in multi-pane layout)

Subsequent runs detect that `custom_pages` is already in App.tsx and skip this step.

## Customizing the scaffold

Open the generated `.tsx` file and replace the `DynamicXxx` call with your own layout. The model definition and allModels array are already imported and available as local constants:

```tsx
// Before (scaffold default):
export const CustomTaskShow: React.FC = () => {
    return (
        <>
            {/* scaffold badge ... */}
            <DynamicShow model={model} allModels={allModels} />
        </>
    );
};

// After (customized):
export const CustomTaskShow: React.FC = () => {
    return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* scaffold badge removed */}
            <DynamicShow model={model} allModels={allModels} />
            <MyCustomMetricsPanel />
        </div>
    );
};
```

### Injecting content above the form tabs (`beforeTabs`)

`DynamicShow` accepts an optional `beforeTabs?: React.ReactNode` prop whose content is rendered **between the sticky standard header** (breadcrumbs, title, action buttons) **and the form tabs** — useful for a custom panel that should appear with the record's standard chrome but above the Details / relation tabs:

```tsx
<DynamicShow model={model} allModels={allModels} beforeTabs={<MyConversationPanel record={record} />} />
```

You can also mix in standard Refine hooks (`useShow`, `useList`, `useGo`) or Ant Design components.

## Navigating between custom pages

Inside any custom page component, navigate to another resource using Refine's `useGo` hook:

```tsx
import { useGo } from "@refinedev/core";

const MyComponent = () => {
    const go = useGo();
    return (
        <button onClick={() => go({ to: { resource: "task", action: "show", id: 42 }, type: "push" })}>
            View Task 42
        </button>
    );
};
```

Or use `react-router-dom` directly:

```tsx
import { useNavigate } from "react-router-dom";

const navigate = useNavigate();
navigate(`/task/show/${id}`);
```

## Removing a custom page override

To revert a resource to the auto-generated Dynamic page, remove its entry from `frontend/src/custom_pages.ts`:

```typescript
// Remove the "task" entry from customShowComponents:
export const customShowComponents: Record<string, React.ComponentType> = {
    // "task": CustomTaskShow,  ← delete this line
};
```

You do **not** need to edit App.tsx. The `_renderShow` helper automatically falls back to `DynamicShow` for any resource not in the registry.

You can also delete the `.tsx` file for the removed custom page, but only after removing it from `custom_pages.ts` — otherwise TypeScript will error on the missing import.

## TUI shortcut

From the VeloIQ project explorer (`veloiq` with no arguments), navigate to any model's detail screen and press `[p]` to scaffold a page:

```
[p] scaffold-page
```

A prompt appears at the bottom of the screen:

```
Scaffold page type: [1] list  [2] show  [3] edit  [4] create  [Esc] cancel
```

Select a type and confirm. The explorer runs `veloiq scaffold-page <resource> <page_type>` and exits so the shell shows the output.

## New projects

Projects created with `veloiq new` already include `custom_pages.ts` (with empty maps) and an App.tsx that imports it. Running `scaffold-page` in a new project skips the App.tsx patch and only creates the component file and adds to `custom_pages.ts`.

## File summary

| File | Action |
|---|---|
| `frontend/src/pages/{module}/Custom{Model}{PageType}.tsx` | Created (never overwritten) |
| `frontend/src/custom_pages.ts` | Created or updated |
| `frontend/src/App.tsx` | Patched once (idempotent) |
