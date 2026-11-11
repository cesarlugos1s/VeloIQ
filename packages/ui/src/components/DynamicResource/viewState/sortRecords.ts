/**
 * Sorts records by the shared multi-sort list: the first entry is the most
 * significant, the next ones break ties. Used by view types that order records
 * themselves instead of through table headers (kanban, gallery, calendar).
 */
import type { FieldDef } from "../types";
import type { ColumnSortState } from "../utils/sorting";

export type FieldValueComparer = (field: FieldDef, a: any, b: any) => number;

/** A sorted copy of `records`; sort entries whose field is not in `fields` are ignored (dormant). */
export function sortRecordsBySortList<T>(
    records: T[],
    sortList: ColumnSortState[],
    fields: FieldDef[],
    compareValues: FieldValueComparer,
): T[] {
    const applicable = sortList
        .map((entry) => ({ field: fields.find((field) => field.key === entry.fieldKey), descending: entry.order === "descend" }))
        .filter((entry): entry is { field: FieldDef; descending: boolean } => Boolean(entry.field));
    if (applicable.length === 0) return records;
    return [...records].sort((a, b) => {
        for (const { field, descending } of applicable) {
            const result = compareValues(field, a, b);
            if (result !== 0) return descending ? -result : result;
        }
        return 0;
    });
}
