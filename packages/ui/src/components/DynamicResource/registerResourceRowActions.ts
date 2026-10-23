/**
 * Row actions of a resource wherever it is listed.
 *
 * DynamicList shows a resource's rows on its own page, inside other records'
 * pages (relation lists), in grid cells and in custom pages. A package that
 * adds actions to the resource's rows (e.g. "Pin" / "Block" on a tool's
 * provider candidates) registers them once here, when its code loads, and
 * every DynamicList of that resource shows them, as if passed in `rowActions`.
 */
import type { RowActionDef } from "./types";

/** Registered row actions, keyed by resource name. */
const rowActionsByResource = new Map<string, RowActionDef[]>();

/** Register the row actions of `resource` (replacing any registered before). */
export function registerResourceRowActions(resource: string, rowActions: RowActionDef[]): void {
    rowActionsByResource.set(resource, rowActions);
}

/** Return the row actions registered for `resource` (empty when none). */
export function registeredResourceRowActions(resource: string): RowActionDef[] {
    return rowActionsByResource.get(resource) ?? [];
}
