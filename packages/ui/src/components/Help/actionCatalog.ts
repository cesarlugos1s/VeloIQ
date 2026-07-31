import { authenticatedFetch } from "../../utils/authenticatedFetch";

/**
 * Context handed to a HelpAction executor: enough to act on the page the
 * Help drawer is currently open over, without reaching into that page's own
 * component state.
 */
export interface HelpActionContext {
    /** The resource parsed out of the current page_key (e.g. "task"). */
    resource: string;
    /** Base API URL (from useApiUrl()), e.g. "/api". */
    apiUrl: string;
    /** The current record's id, when the page is about one specific record
     * (Show/Edit) — null on List/Create, where there's no single target. */
    recordId: string | number | null;
    /** Sets one query-string param on the current URL, preserving the rest. */
    setSearchParam: (key: string, value: string) => void;
    /** refine's navigation helper, e.g. go({ to: { resource, action: "show", id } }).
     * Mirrors refine's own discriminated union (useGo's GoConfigWithResource):
     * "create"/"list" take no id, "edit"/"show"/"clone" require one. */
    go: (params: {
        to:
            | { resource: string; action: "create" | "list" }
            | { resource: string; action: "edit" | "show" | "clone"; id: string | number };
    }) => void;
}

export type HelpActionExecutor = (ctx: HelpActionContext) => void | Promise<void>;

export interface HelpActionCatalogEntry {
    execute: HelpActionExecutor;
    /** Raw (untranslated) one-line description of what clicking this action
     * does — wrapped in _() at render time by HelpDrawer, not here, since
     * the app's translation catalog may not be ready at module-eval time. */
    description: string;
}

// Same request DynamicList's own "Export selected (CSV)" button makes
// (DynamicResource/index.tsx handleExport) — page-agnostic, so it's safely
// callable from outside that component's closure.
const exportCsv: HelpActionExecutor = async (ctx) => {
    const response = await authenticatedFetch(`${ctx.apiUrl}/${ctx.resource}/export-csv`);
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${ctx.resource}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * Small, explicit, hardcoded catalog of runnable Help actions. Deliberately
 * not exhaustive — only safe, generic, page-agnostic actions belong here
 * (single target, non-destructive, no live form state). Grow this list as
 * new generic actions are needed; it is not meant to cover every possible
 * action a page could offer — see the Phase-2 plan's action inventory for
 * what was deliberately excluded and why (bulk actions, Delete, Save,
 * Duplicate, the Actions-preferences gear).
 */
export const HELP_ACTION_CATALOG: Record<string, HelpActionCatalogEntry> = {
    "switch_view_type:gallery": {
        execute: (ctx) => ctx.setSearchParam("view_type", "gallery"),
        description: "Switches this list to gallery view.",
    },
    "switch_view_type:calendar": {
        execute: (ctx) => ctx.setSearchParam("view_type", "calendar"),
        description: "Switches this list to calendar view.",
    },
    export_csv: {
        execute: exportCsv,
        description: "Downloads the current list as a CSV file.",
    },
    create_new: {
        execute: (ctx) => ctx.go({ to: { resource: ctx.resource, action: "create" } }),
        description: "Opens a form to create a new record.",
    },
    open_import: {
        execute: (ctx) => ctx.setSearchParam("import", "1"),
        description: "Opens the CSV import dialog for this list.",
    },
    open_metadata: {
        execute: (ctx) => ctx.setSearchParam("metadata", "1"),
        description: "Shows technical metadata about this model.",
    },
    open_view_config: {
        execute: (ctx) => ctx.setSearchParam("view_config", "1"),
        description: "Opens the view configuration panel (columns and filters).",
    },
    go_to_list: {
        execute: (ctx) => ctx.go({ to: { resource: ctx.resource, action: "list" } }),
        description: "Goes back to the list of records.",
    },
    go_to_show: {
        execute: (ctx) => ctx.recordId != null && ctx.go({ to: { resource: ctx.resource, action: "show", id: ctx.recordId } }),
        description: "Opens this record in view mode.",
    },
    go_to_edit: {
        execute: (ctx) => ctx.recordId != null && ctx.go({ to: { resource: ctx.resource, action: "edit", id: ctx.recordId } }),
        description: "Opens this record in edit mode.",
    },
    pin_to_dashboard: {
        execute: async (ctx) => {
            if (ctx.recordId == null) return;
            await authenticatedFetch(`${ctx.apiUrl}/dashboard/pinned-records`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ resource: ctx.resource, record_id: ctx.recordId }),
            });
        },
        description: "Pins this record to your Dashboard for quick access later.",
    },
    open_explore: {
        execute: (ctx) => ctx.setSearchParam("explore", "1"),
        description: "Opens the relation explorer for this record.",
    },
};
