/**
 * The shared view state of one page block: everything a user can set on the
 * data a block shows, independent of the view type that renders it. Every view
 * type reads and writes this one shape instead of keeping private state.
 */
import type { ColumnSortState, TotalsSummaryFn } from "../utils/sorting";

/** One condition of the advanced filter builder. */
export interface AdvancedFilterRule {
    id?: string | number;
    fieldKey?: string;
    operator?: string;
    value?: unknown;
    value2?: unknown;
}

/**
 * The field sequence: which fields are visible and in what order.
 * `order` lists every known field in the user's order (hidden ones keep their
 * position, so showing a field again puts it back where the user chose);
 * `visibleKeys` is the visible subset.
 */
export interface FieldSequence {
    visibleKeys: string[];
    order: string[];
}

/** Analyze section state. */
export interface AnalyzeViewState {
    open: boolean;
    first: boolean;
    vertical: boolean;
}

export interface SharedViewState {
    /** Filters by field values: field key to the selected values. */
    columnFilters: Record<string, string[]>;
    /** Advanced filter builder conditions. */
    advancedFilterRules: AdvancedFilterRule[];
    /** Multi-column sort, most significant first. */
    sortList: ColumnSortState[];
    fieldSequence: FieldSequence;
    pageSize: number;
    page: number;
    /** Summary function per field key. */
    summaryFunctions: Record<string, TotalsSummaryFn>;
    analyze: AnalyzeViewState;
}

/** A layer holds only the keys it sets; an absent key means "not set in this layer". */
export type ViewStateLayer = Partial<SharedViewState>;

export type ViewStateKey = keyof SharedViewState;

/** The three layers, lowest precedence first when merged. */
export interface ViewStateLayers {
    defaults?: ViewStateLayer;
    saved?: ViewStateLayer;
    temporary?: ViewStateLayer;
}
