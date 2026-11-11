/**
 * Layer handling for the shared view state: precedence, block keys and the
 * mapping of preferences saved before the shared state existed.
 */
import { normalizeColumnSortPreference, normalizeFilterRules } from "../utils/sorting";
import type { TotalsSummaryFn } from "../utils/sorting";
import type { SharedViewState, ViewStateLayer, ViewStateLayers } from "./viewStateTypes";

export const DEFAULT_VIEW_STATE: SharedViewState = Object.freeze({
    columnFilters: {},
    advancedFilterRules: [],
    sortList: [],
    fieldSequence: { visibleKeys: [], order: [] },
    pageSize: 10,
    page: 1,
    summaryFunctions: {},
    analyze: { open: false, first: false, vertical: false },
}) as SharedViewState;

/** Merges one layer over another, key by key; keys a layer does not set fall through. */
function overlay(base: ViewStateLayer, top: ViewStateLayer | undefined): ViewStateLayer {
    if (!top) return base;
    const merged: Record<string, unknown> = { ...base };
    (Object.keys(top) as Array<keyof SharedViewState>).forEach((key) => {
        if (top[key] !== undefined) merged[key] = top[key];
    });
    return merged as ViewStateLayer;
}

/** Defaults, then saved preferences, then temporary changes (highest precedence). */
export function resolveViewState(layers: ViewStateLayers): SharedViewState {
    const resolved = overlay(overlay(overlay({}, layers.defaults), layers.saved), layers.temporary);
    return { ...DEFAULT_VIEW_STATE, ...resolved } as SharedViewState;
}

/** Saving copies the temporary layer into the saved layer (same shape). */
export function copyTemporaryIntoSaved(saved: ViewStateLayer | undefined, temporary: ViewStateLayer | undefined): ViewStateLayer {
    return overlay(saved ?? {}, temporary);
}

/**
 * Key of a block: the page plus what shows the data (the list itself or one
 * relation), never the resource alone or a row position.
 */
export function buildViewStateBlockKey(pageKey: string, blockId: string): string {
    return `${pageKey}#${blockId}`;
}

/** Block id of the page's own list. */
export const LIST_BLOCK_ID = "list";

/** Block id of a related-model block. */
/**
 * The name that identifies a relation among the relations of a page: its relation name, or the
 * resource and key when it has none (several relations can point at one resource, for example
 * "Movements" and "Authorized Movements").
 */
export function getRelationIdentityName(relation: { relationName?: string; resource?: string; targetKey?: string; label?: string }, fallbackName: string): string {
    if (relation.relationName) return relation.relationName;
    if (relation.resource) return relation.targetKey ? `${relation.resource}:${relation.targetKey}` : relation.resource;
    return relation.label || fallbackName;
}

export function buildRelationBlockId(relationName: string): string {
    return `relation:${relationName}`;
}

/**
 * Maps the preferences the list page saved before the shared state existed
 * (`rowsPerPage`, `tableColumns`, `columnSort`, ...) to the shared schema.
 * Only keys present in the saved object appear in the result.
 */
export function mapLegacyPreferencesToViewStateLayer(prefs: Record<string, any> | null | undefined): ViewStateLayer {
    const layer: ViewStateLayer = {};
    if (!prefs || typeof prefs !== "object") return layer;

    if (Array.isArray(prefs.filters)) {
        layer.advancedFilterRules = normalizeFilterRules(prefs.filters);
    }
    if (prefs.columnFilters && typeof prefs.columnFilters === "object") {
        layer.columnFilters = prefs.columnFilters;
    }
    if (prefs.columnSort) {
        layer.sortList = normalizeColumnSortPreference(prefs.columnSort);
    }
    const pageSize = Number(prefs.rowsPerPage);
    if ("rowsPerPage" in prefs && Number.isFinite(pageSize) && pageSize > 0) {
        layer.pageSize = pageSize;
    }
    if (prefs.tableColumns) {
        const columns = prefs.tableColumns;
        const visibleKeys = Array.isArray(columns.selectedKeys) ? columns.selectedKeys : Array.isArray(columns) ? columns : null;
        const order = Array.isArray(columns.order) ? columns.order : Array.isArray(columns) ? columns : null;
        if (visibleKeys && visibleKeys.length > 0) {
            layer.fieldSequence = { visibleKeys, order: order && order.length > 0 ? order : visibleKeys };
        }
    }
    if (prefs.totalsSummaryFunctions && typeof prefs.totalsSummaryFunctions === "object") {
        layer.summaryFunctions = prefs.totalsSummaryFunctions as Record<string, TotalsSummaryFn>;
    }
    if ("analyzeOpen" in prefs || "isAnalyzeFirst" in prefs || "isAnalyzeVertical" in prefs) {
        layer.analyze = {
            open: Boolean(prefs.analyzeOpen),
            first: Boolean(prefs.isAnalyzeFirst),
            vertical: Boolean(prefs.isAnalyzeVertical),
        };
    }
    return layer;
}

/** The inverse mapping, used when saving: the legacy keys the list page already stores. */
export function mapViewStateToLegacyPreferences(state: SharedViewState): Record<string, unknown> {
    return {
        filters: state.advancedFilterRules,
        rowsPerPage: state.pageSize,
        tableColumns: state.fieldSequence.visibleKeys.length > 0
            ? {
                selectedKeys: state.fieldSequence.visibleKeys,
                order: state.fieldSequence.order.length > 0 ? state.fieldSequence.order : state.fieldSequence.visibleKeys,
            }
            : null,
        columnFilters: state.columnFilters,
        columnSort: state.sortList.length > 0 ? state.sortList : null,
        totalsSummaryFunctions: state.summaryFunctions,
        analyzeOpen: state.analyze.open,
        isAnalyzeFirst: state.analyze.first,
        isAnalyzeVertical: state.analyze.vertical,
    };
}
