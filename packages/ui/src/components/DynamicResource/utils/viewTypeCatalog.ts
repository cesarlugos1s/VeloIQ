/**
 * The one source of truth for view types: every token the framework knows, its
 * label, the other spellings configurations use for it, the places that offer it
 * and what the model's fields must provide for it to make sense.
 *
 * Selectors, configuration tools and view type normalizers read this catalog;
 * none of them keeps a list of its own. Adding a view type means adding one entry
 * here (plus its declaration in viewState/viewTypeCapabilities.ts).
 */
import { translateText } from "./i18n";

/** What the model's fields must provide for a view type to be worth offering. */
export type ViewTypeFieldRequirement = "image-source" | "number-field" | "date-field" | "split-field";

/**
 * Where a view type selector is offered. "configuration" is for tools that
 * assign a view type to a page or relation (every known view type); the others
 * are the temporary selectors shown to users.
 */
export type ViewTypeSelectorContext = "list-page" | "relation-show" | "relation-edit" | "kanban-column" | "configuration";

type TemporarySelectorContext = Exclude<ViewTypeSelectorContext, "configuration">;

export interface ViewTypeCatalogEntry {
    /** The view type token configurations store. */
    token: string;
    /** Catalog msgid of the label; use `getViewTypeLabel` for the translated text. */
    label: string;
    /** Other spellings of the token that configurations accept (compared without case, spaces, dashes and underscores). */
    aliases?: readonly string[];
    /** The temporary selectors that offer it (a "configuration" selector offers every entry). */
    offeredIn: readonly TemporarySelectorContext[];
    requires?: ViewTypeFieldRequirement;
}

const ALL_TEMPORARY_SELECTORS: readonly TemporarySelectorContext[] = ["list-page", "relation-show", "relation-edit", "kanban-column"];
const NOT_IN_KANBAN: readonly TemporarySelectorContext[] = ["list-page", "relation-show", "relation-edit"];
const EDITABLE: readonly TemporarySelectorContext[] = ["list-page", "relation-edit"];

/** Every view type, in the order selectors list them. */
export const VIEW_TYPE_CATALOG: readonly ViewTypeCatalogEntry[] = [
    { token: "table", label: "Table", offeredIn: ALL_TEMPORARY_SELECTORS },
    { token: "editable-table", label: "Editable table", aliases: ["editable"], offeredIn: EDITABLE },
    { token: "list", label: "List", offeredIn: ALL_TEMPORARY_SELECTORS },
    { token: "editable-list", label: "Editable list", offeredIn: EDITABLE },
    { token: "csv", label: "CSV", offeredIn: ["relation-show", "relation-edit"] },
    { token: "editable-csv", label: "Editable CSV", offeredIn: ["relation-edit"] },
    { token: "crosstab", label: "Crosstab", offeredIn: ALL_TEMPORARY_SELECTORS, requires: "number-field" },
    { token: "editable-crosstab", label: "Editable crosstab", offeredIn: EDITABLE, requires: "number-field" },
    { token: "totals-details", label: "Totals and details", aliases: ["totaldetails"], offeredIn: ALL_TEMPORARY_SELECTORS },
    { token: "gallery", label: "Gallery", offeredIn: ALL_TEMPORARY_SELECTORS, requires: "image-source" },
    { token: "image", label: "Images", aliases: ["images"], offeredIn: ALL_TEMPORARY_SELECTORS, requires: "image-source" },
    { token: "calendar", label: "Calendar", aliases: ["week", "month"], offeredIn: ALL_TEMPORARY_SELECTORS, requires: "date-field" },
    { token: "kanban", label: "Kanban", offeredIn: NOT_IN_KANBAN, requires: "split-field" },
    { token: "primary", label: "Primary", offeredIn: ALL_TEMPORARY_SELECTORS },
    { token: "primary-carousel", label: "Primary carousel", offeredIn: NOT_IN_KANBAN },
    // Known to configurations, but not offered to users to switch to for now.
    { token: "read-and-edit-list", label: "Read and edit list", offeredIn: [] },
    { token: "read-and-edit-csv", label: "Read and edit CSV", offeredIn: [] },
    { token: "tree", label: "Tree", offeredIn: [] },
    { token: "tree-details", label: "Tree with details", offeredIn: [] },
];

/** The entries a selector in the given place can offer, before the model's fields are considered. */
export function getViewTypeCatalogEntries(context: ViewTypeSelectorContext): ViewTypeCatalogEntry[] {
    if (context === "configuration") return [...VIEW_TYPE_CATALOG];
    return VIEW_TYPE_CATALOG.filter((entry) => entry.offeredIn.includes(context));
}

/** Every known view type token. */
export function getAllViewTypes(): string[] {
    return VIEW_TYPE_CATALOG.map((entry) => entry.token);
}

/** The tokens a selector in the given place can offer, before the model's fields are considered. */
export function getViewTypesForContext(context: ViewTypeSelectorContext): string[] {
    return getViewTypeCatalogEntries(context).map((entry) => entry.token);
}

/** The translated label of a view type (the token itself when it is unknown). */
export function getViewTypeLabel(token: string): string {
    const entry = VIEW_TYPE_CATALOG.find((candidate) => candidate.token === token);
    return entry ? translateText(entry.label, entry.label) : token;
}

/** The translated label of every known view type, by token. */
export function buildViewTypeLabels(): Record<string, string> {
    return Object.fromEntries(VIEW_TYPE_CATALOG.map((entry) => [entry.token, getViewTypeLabel(entry.token)]));
}

const looseKey = (raw: string): string => raw.trim().toLowerCase().replace(/[\s_-]/g, "");

/** The token a configuration's spelling stands for ("Editable Table", "totalsdetails", "images"), or "" when unknown. */
export function resolveViewTypeToken(raw: string): string {
    const key = looseKey(String(raw || "")).replace(/view$/, "");
    if (!key) return "";
    const entry = VIEW_TYPE_CATALOG.find((candidate) =>
        looseKey(candidate.token) === key || (candidate.aliases ?? []).some((alias) => looseKey(alias) === key));
    return entry?.token ?? "";
}
