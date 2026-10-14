import type { FieldDef } from "../types";

// Guarded so this module also runs outside a browser (the shared aggregation fixtures run under vitest).
const _ = (text: string): string => {
    const translate = typeof window !== "undefined" ? ((window as any)._ as ((t: string) => string) | undefined) : undefined;
    return translate ? translate(text) : text;
};

/** Summary functions offered by the Analyze section. */
export type SummaryFn = "sum" | "avg" | "count" | "max" | "min" | "stddev";

/** Synthetic series key used when the model has no numeric field: one row counts as 1. */
export const COUNT_SERIES_KEY = "__count__";

/** Separator placed between category values when several categories build one label (Category 1 • 2 • 3). */
export const CATEGORY_LABEL_SEPARATOR = " • ";

/** One aggregated chart group: a category label and one summarised value per series. */
export interface AnalyzeGroup {
    key: string;
    label: string;
    values: Record<string, number>;
}

/** Result of {@link aggregateChartData}, consumed by the chart and the ranking filter. */
export interface AnalyzeChartData {
    groups: AnalyzeGroup[];
    seriesKeys: string[];
    seriesLabels: Record<string, string>;
    /** Source rows that belong to the groups kept after the ranking filter. */
    filteredRawRows: any[];
}

/**
 * Translated options for the summary-function selectors (chart and crosstab).
 *
 * Built on each call so the labels follow the active locale.
 */
export const getSummaryFnOptions = (): Array<{ label: string; value: SummaryFn }> => [
    { label: _("Sum"), value: "sum" },
    { label: _("Average"), value: "avg" },
    { label: _("Count"), value: "count" },
    { label: _("Max"), value: "max" },
    { label: _("Min"), value: "min" },
    { label: _("Std Dev"), value: "stddev" },
];

/**
 * Summarise a list of numbers with one summary function.
 *
 * This is the single place in the frontend where Sum, Average, Count, Max, Min
 * and Std Dev are computed: chart groups, heatmap cells, crosstab cells, the
 * statistics on the back of the Analyze card and the totals boxes all call it.
 * The backend applies the same rules, and test-fixtures/charts.json checks
 * both layers against the same cases.
 *
 * Std Dev is the sample standard deviation (divisor n - 1), as pandas and
 * Excel's STDEV compute it; a single value has a standard deviation of 0.
 *
 * @param values numbers of one group and series; an empty list summarises to 0.
 * @param fn     summary function to apply.
 */
export const summarizeValues = (values: number[], fn: SummaryFn): number => {
    if (values.length === 0) return 0;
    switch (fn) {
        case "count":
            return values.length;
        case "avg":
            return values.reduce((acc, val) => acc + val, 0) / values.length;
        case "max":
            // reduce, not Math.max(...values): spreading a long list overflows the call stack.
            return values.reduce((acc, val) => (val > acc ? val : acc), values[0]);
        case "min":
            return values.reduce((acc, val) => (val < acc ? val : acc), values[0]);
        case "stddev": {
            if (values.length < 2) return 0;
            const mean = values.reduce((acc, val) => acc + val, 0) / values.length;
            const variance = values.reduce((acc, val) => acc + (val - mean) ** 2, 0) / (values.length - 1);
            return Math.sqrt(variance);
        }
        case "sum":
        default:
            return values.reduce((acc, val) => acc + val, 0);
    }
};

/**
 * Builds the function that labels a record with its category values,
 * joined with CATEGORY_LABEL_SEPARATOR (e.g. "Open • High • North").
 *
 * @param fields every field of the model.
 * @param categoryKeys the category field keys, in order; empty/null keys are skipped.
 * @param formatCategoryValue display text of one category value of a record.
 */
export const buildCategoryLabeler = (
    fields: FieldDef[],
    categoryKeys: Array<string | null | undefined>,
    formatCategoryValue: (field: FieldDef | undefined, record: any) => string,
) => {
    const categoryFields = categoryKeys
        .filter((key): key is string => Boolean(key))
        .map((key) => fields.find((field) => field.key === key))
        .filter((field): field is FieldDef => Boolean(field));
    if (categoryFields.length === 0) {
        return (record: any) => formatCategoryValue(undefined, record);
    }
    return (record: any) => categoryFields.map((field) => formatCategoryValue(field, record)).join(CATEGORY_LABEL_SEPARATOR);
};

/** Number in `record[seriesKey]`, 1 for the count series, or null when not a number. */
export const seriesValueOf = (record: any, seriesKey: string): number | null => {
    if (seriesKey === COUNT_SERIES_KEY) return 1;
    const raw = record?.[seriesKey];
    if (raw === undefined || raw === null || raw === "") return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
};

/** A two-dimension summary (heatmap): row labels, column labels and one value per cell. */
export interface AnalyzeMatrix {
    rowLabels: string[];
    colLabels: string[];
    /** values[row][col]; a cell without rows is null. */
    values: Array<Array<number | null>>;
}

/**
 * Summarise one series over a row × column grid of categories.
 *
 * @param rows source records.
 * @param rowLabelOf label of a record's row (Category 1).
 * @param colLabelOf label of a record's column (Category 2, plus Category 3).
 * @param seriesKey series to summarise; COUNT_SERIES_KEY counts records.
 * @param fn summary function.
 */
export const aggregateMatrix = (
    rows: any[],
    rowLabelOf: (record: any) => string,
    colLabelOf: (record: any) => string,
    seriesKey: string,
    fn: SummaryFn,
): AnalyzeMatrix => {
    const rowLabels: string[] = [];
    const colLabels: string[] = [];
    const cells = new Map<string, number[]>();
    (rows || []).forEach((record) => {
        const rowLabel = rowLabelOf(record);
        const colLabel = colLabelOf(record);
        if (!rowLabels.includes(rowLabel)) rowLabels.push(rowLabel);
        if (!colLabels.includes(colLabel)) colLabels.push(colLabel);
        const cellKey = `${rowLabel}\u0000${colLabel}`;
        if (!cells.has(cellKey)) cells.set(cellKey, []);
        const value = seriesValueOf(record, seriesKey);
        if (value !== null) cells.get(cellKey)!.push(value);
    });
    const values = rowLabels.map((rowLabel) => colLabels.map((colLabel) => {
        const cellValues = cells.get(`${rowLabel}\u0000${colLabel}`);
        return cellValues ? summarizeValues(cellValues, fn) : null;
    }));
    return { rowLabels, colLabels, values };
};

/**
 * The series a chart shows and their labels: the selected numeric fields that still
 * exist, else every numeric field, else a row count when the model has none.
 */
export const resolveSeries = (
    numericFields: FieldDef[],
    selectedSeriesKeys: string[] | null,
): { seriesKeys: string[]; seriesLabels: Record<string, string> } => {
    const numericKeys = new Set(numericFields.map((field) => field.key));
    const rawSeriesKeys = numericFields.length > 0 ? numericFields.map((field) => field.key) : [COUNT_SERIES_KEY];
    const selectedValid = (selectedSeriesKeys || []).filter((key) => {
        if (key === COUNT_SERIES_KEY && numericFields.length === 0) return true;
        return numericKeys.has(key);
    });
    const seriesLabels = numericFields.reduce<Record<string, string>>((acc, field) => {
        acc[field.key] = field.label;
        return acc;
    }, { [COUNT_SERIES_KEY]: _("Count") });
    return { seriesKeys: selectedValid.length > 0 ? selectedValid : rawSeriesKeys, seriesLabels };
};

/** Inputs of {@link aggregateChartData}. */
export interface AggregateChartDataParams {
    rows: any[];
    fields: FieldDef[];
    numericFields: FieldDef[];
    categoryField1: string | null;
    categoryField2: string | null | undefined;
    categoryField3?: string | null;
    selectedSeriesKeys: string[] | null;
    summaryFn: SummaryFn;
    rankingMode: "none" | "top" | "bottom";
    rankingFieldKey: string | null;
    rankingN: number;
    formatCategoryValue: (field: FieldDef | undefined, record: any) => string;
}

/**
 * Group rows by their category values, summarise every selected series per
 * group, then apply the Top N / Bottom N ranking filter.
 *
 * The ranking column is aggregated even when it is not a selected series, so
 * the ranking can sort on it.
 */
export const aggregateChartData = ({
    rows,
    fields,
    numericFields,
    categoryField1,
    categoryField2,
    categoryField3,
    selectedSeriesKeys,
    summaryFn,
    rankingMode,
    rankingFieldKey,
    rankingN,
    formatCategoryValue,
}: AggregateChartDataParams): AnalyzeChartData => {
    const data = Array.isArray(rows) ? rows : [];
    const numericFieldMap = new Map<string, FieldDef>(numericFields.map((field) => [field.key, field]));
    const { seriesKeys, seriesLabels } = resolveSeries(numericFields, selectedSeriesKeys);
    const rankingSeriesKey = rankingFieldKey && numericFieldMap.has(rankingFieldKey) ? rankingFieldKey : null;
    const aggregationKeys = Array.from(new Set([...seriesKeys, ...(rankingSeriesKey ? [rankingSeriesKey] : [])]));

    // Label of the group a row belongs to (Category 1, plus Categories 2 and 3 when set).
    const groupLabelOf = buildCategoryLabeler(fields, [categoryField1 || "", categoryField2, categoryField3], formatCategoryValue);

    const groupMap = new Map<string, AnalyzeGroup>();
    const valuesMap = new Map<string, Record<string, number[]>>();
    data.forEach((record: any) => {
        const groupKey = groupLabelOf(record);
        if (!groupMap.has(groupKey)) {
            groupMap.set(groupKey, { key: groupKey, label: groupKey, values: Object.fromEntries(aggregationKeys.map((key) => [key, 0])) });
            valuesMap.set(groupKey, Object.fromEntries(aggregationKeys.map((key) => [key, []])));
        }
        const groupValues = valuesMap.get(groupKey)!;
        if (numericFields.length === 0) {
            groupValues[COUNT_SERIES_KEY]?.push(1);
            return;
        }
        aggregationKeys.forEach((key) => {
            if (!numericFieldMap.has(key)) return;
            const value = seriesValueOf(record, key);
            if (value !== null && groupValues[key]) {
                groupValues[key].push(value);
            }
        });
    });
    groupMap.forEach((group, groupKey) => {
        const groupValues = valuesMap.get(groupKey);
        if (!groupValues) return;
        aggregationKeys.forEach((key) => {
            group.values[key] = summarizeValues(groupValues[key] || [], summaryFn);
        });
    });

    let groups = Array.from(groupMap.values());
    if (rankingMode !== "none" && rankingFieldKey) {
        const limit = Math.max(1, Math.floor(rankingN || 10));
        groups = [...groups]
            .sort((a, b) => {
                const aVal = Number(a.values[rankingFieldKey] ?? 0);
                const bVal = Number(b.values[rankingFieldKey] ?? 0);
                if (aVal === bVal) return a.label.localeCompare(b.label);
                return rankingMode === "top" ? bVal - aVal : aVal - bVal;
            })
            .slice(0, limit);
    }
    const allowedGroupKeys = new Set(groups.map((group) => group.key));
    const filteredRawRows = data.filter((record: any) => allowedGroupKeys.has(groupLabelOf(record)));
    return { groups, seriesKeys, seriesLabels, filteredRawRows };
};
