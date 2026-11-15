/**
 * The one source of truth for view types: every token the framework knows, its
 * label, the other spellings configurations use for it, the places that offer it
 * and what the model's fields must provide for it to make sense.
 *
 * Selectors, configuration tools and view type normalizers read this catalog;
 * none of them keeps a list of its own. Adding a view type means adding one entry
 * to backend/veloiq_framework/view_types.json, which the Python backend reads too
 * (plus its declaration in viewState/viewTypeCapabilities.ts).
 */
import { translateText } from "./i18n";
// backend/veloiq_framework/view_types.json: shared with the Python backend (veloiq_framework.view_types).
import viewTypeCatalogFile from "../../../../../../backend/veloiq_framework/view_types.json";

/** What the model's fields must provide for a view type to be worth offering. */
export type ViewTypeFieldRequirement = "image-source" | "number-field" | "date-field" | "split-field" | "map-location";

/**
 * Where a view type selector is offered. "configuration" is for tools that
 * assign a view type to a page or relation (every known view type);
 * "default-setting" is for the default view type settings of System
 * Configuration; the others are the temporary selectors shown to users.
 */
export type ViewTypeSelectorContext = "list-page" | "relation-show" | "relation-edit" | "kanban-column" | "default-setting" | "configuration";

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

/** Every view type, in the order selectors list them (read from the file the backend reads too). */
export const VIEW_TYPE_CATALOG: readonly ViewTypeCatalogEntry[] = viewTypeCatalogFile.viewTypes as ViewTypeCatalogEntry[];

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
