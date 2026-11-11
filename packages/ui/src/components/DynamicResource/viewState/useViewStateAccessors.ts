/**
 * The shared view state of a block as the plain values and React-style setters
 * the list page and the related-objects table already use, so their code reads
 * the same whether the state is shared or local. The field sequence is split
 * into visible keys and order; "no custom sequence" reads as null.
 */
import { useCallback } from "react";
import type { SetStateAction } from "react";
import type { ColumnSortState, TotalsSummaryFn } from "../utils/sorting";
import type { SharedViewStateHandle } from "./useSharedViewState";
import type { AdvancedFilterRule } from "./viewStateTypes";

export interface ViewStateFilterRuleDraft {
    id: string;
    fieldKey?: string;
    operator?: string;
    value?: any;
    value2?: any;
}

export function useViewStateAccessors(handle: SharedViewStateHandle) {
    const { state, setValue } = handle;

    const setPageSize = useCallback((next: SetStateAction<number>) => setValue("pageSize", next), [setValue]);
    const setFilterRules = useCallback(
        (next: SetStateAction<ViewStateFilterRuleDraft[]>) => setValue("advancedFilterRules", next as SetStateAction<AdvancedFilterRule[]>),
        [setValue],
    );
    const setColumnFiltersSelected = useCallback((next: SetStateAction<Record<string, string[]>>) => setValue("columnFilters", next), [setValue]);
    const setColumnSort = useCallback((next: SetStateAction<ColumnSortState[]>) => setValue("sortList", next), [setValue]);
    const setTotalsSummaryFunctions = useCallback(
        (next: SetStateAction<Record<string, TotalsSummaryFn>>) => setValue("summaryFunctions", next),
        [setValue],
    );
    const setSelectedColumnKeys = useCallback((next: SetStateAction<string[] | null>) => setValue("fieldSequence", (previous) => {
        const visibleKeys = (typeof next === "function" ? next(previous.visibleKeys.length > 0 ? previous.visibleKeys : null) : next) ?? [];
        return { ...previous, visibleKeys };
    }), [setValue]);
    const setColumnOrder = useCallback((next: SetStateAction<string[] | null>) => setValue("fieldSequence", (previous) => {
        const order = (typeof next === "function" ? next(previous.order.length > 0 ? previous.order : null) : next) ?? [];
        return { ...previous, order };
    }), [setValue]);
    const setAnalyzeOpen = useCallback((next: SetStateAction<boolean>) => setValue("analyze", (previous) => ({
        ...previous, open: typeof next === "function" ? next(previous.open) : next,
    })), [setValue]);
    const setIsAnalyzeFirst = useCallback((next: SetStateAction<boolean>) => setValue("analyze", (previous) => ({
        ...previous, first: typeof next === "function" ? next(previous.first) : next,
    })), [setValue]);
    const setIsAnalyzeVertical = useCallback((next: SetStateAction<boolean>) => setValue("analyze", (previous) => ({
        ...previous, vertical: typeof next === "function" ? next(previous.vertical) : next,
    })), [setValue]);

    return {
        pageSize: state.pageSize, setPageSize,
        filterRules: state.advancedFilterRules as ViewStateFilterRuleDraft[], setFilterRules,
        columnFiltersSelected: state.columnFilters, setColumnFiltersSelected,
        columnSort: state.sortList, setColumnSort,
        totalsSummaryFunctions: state.summaryFunctions, setTotalsSummaryFunctions,
        selectedColumnKeys: state.fieldSequence.visibleKeys.length > 0 ? state.fieldSequence.visibleKeys : null, setSelectedColumnKeys,
        columnOrder: state.fieldSequence.order.length > 0 ? state.fieldSequence.order : null, setColumnOrder,
        analyzeOpenPreference: state.analyze.open, setAnalyzeOpen,
        isAnalyzeFirst: state.analyze.first, setIsAnalyzeFirst,
        isAnalyzeVertical: state.analyze.vertical, setIsAnalyzeVertical,
    };
}
