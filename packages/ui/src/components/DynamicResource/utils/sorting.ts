export type ColumnSortOrder = "ascend" | "descend";
export type ColumnSortState = { fieldKey: string; order: ColumnSortOrder };
export type ColumnSortIntent = { fieldKey: string; additive: boolean } | null;
export type TotalsSummaryFn = "sum" | "avg" | "count" | "max" | "min" | "stddev" | "distinct";

export const normalizeFilterRules = (rules: any[] | undefined | null) => {
    if (!Array.isArray(rules)) return [];
    return rules
        .filter((rule) => rule && typeof rule === "object")
        .map((rule, index) => ({
            id: rule.id ?? `${Date.now()}-${index}-${Math.random()}`,
            fieldKey: rule.fieldKey ?? rule.field ?? undefined,
            operator: rule.operator,
            value: rule.value,
            value2: rule.value2,
        }));
};

export const normalizeColumnSortPreference = (value: any): ColumnSortState[] => {
    const toSortState = (item: any): ColumnSortState | null => {
        if (!item || typeof item !== "object") return null;
        const rawField = item.fieldKey ?? item.field ?? item.columnKey ?? item.dataIndex;
        const order = item.order;
        if ((order !== "ascend" && order !== "descend") || rawField === undefined || rawField === null) return null;
        const fieldKey = Array.isArray(rawField) ? rawField.join(".") : String(rawField);
        if (!fieldKey) return null;
        return { fieldKey, order };
    };

    const items = Array.isArray(value) ? value : [value];
    const deduped = new Map<string, ColumnSortState>();
    items.forEach((item) => {
        const next = toSortState(item);
        if (!next) return;
        deduped.set(next.fieldKey, next);
    });
    return Array.from(deduped.values());
};

export const normalizeSorterPayload = (sorter: any): ColumnSortState[] => {
    const items = Array.isArray(sorter) ? sorter : [sorter];
    return normalizeColumnSortPreference(items);
};

export const resolveNextColumnSort = (
    current: ColumnSortState[],
    sorterPayload: any,
    sortIntent: ColumnSortIntent,
): ColumnSortState[] => {
    const nextFromTable = normalizeSorterPayload(sorterPayload);
    if (!sortIntent) {
        return nextFromTable.length > 0 ? nextFromTable : current;
    }
    const { fieldKey, additive } = sortIntent;
    const clickedSort = nextFromTable.find((item) => item.fieldKey === fieldKey);
    if (!additive) {
        return clickedSort ? [clickedSort] : [];
    }
    const withoutClicked = current.filter((item) => item.fieldKey !== fieldKey);
    return clickedSort ? [...withoutClicked, clickedSort] : withoutClicked;
};

export const getSortPriority = (columnSort: ColumnSortState[], fieldKey: string): number => {
    const index = columnSort.findIndex((item) => item.fieldKey === fieldKey);
    return index === -1 ? 1 : columnSort.length - index + 1;
};
