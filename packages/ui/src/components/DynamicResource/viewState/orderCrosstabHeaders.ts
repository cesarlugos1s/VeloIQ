/**
 * Orders the headers of one crosstab axis by the shared multi-sort list.
 * A crosstab has no record rows, so each sorted field orders the headers of
 * the axis it is placed on. Several sorted fields on the same axis nest in the
 * order of the sort list. A sorted field on no axis is dormant.
 */
import type { FieldDef } from "../types";
import type { ColumnSortState } from "../utils/sorting";

export type HeaderValueComparer = (field: FieldDef, a: any, b: any) => number;

/**
 * @param labels          header labels in first-seen order
 * @param representatives one record per label, carrying that header's field values
 * @param axisFields      the fields placed on this axis
 */
export function orderCrosstabHeaders(
    labels: string[],
    representatives: Map<string, any>,
    axisFields: Array<FieldDef | undefined>,
    sortList: ColumnSortState[],
    compareValues: HeaderValueComparer,
): string[] {
    const axisKeys = new Set(axisFields.filter((field): field is FieldDef => Boolean(field)).map((field) => field.key));
    const applicable = sortList
        .filter((entry) => axisKeys.has(entry.fieldKey))
        .map((entry) => ({ field: axisFields.find((field) => field?.key === entry.fieldKey) as FieldDef, descending: entry.order === "descend" }));
    if (applicable.length === 0) return labels;
    return [...labels].sort((labelA, labelB) => {
        const recordA = representatives.get(labelA);
        const recordB = representatives.get(labelB);
        for (const { field, descending } of applicable) {
            const result = compareValues(field, recordA, recordB);
            if (result !== 0) return descending ? -result : result;
        }
        return 0;
    });
}
