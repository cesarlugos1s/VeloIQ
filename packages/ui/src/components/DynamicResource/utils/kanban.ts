import type { FieldDef } from "../types";

/** Separator of the values of the split fields in a kanban column's header. */
export const KANBAN_COLUMN_LABEL_SEPARATOR = " - ";
/** Columns shown when the [views] setting maximum_columns_in_kanban_view is not set. */
export const DEFAULT_MAXIMUM_COLUMNS_IN_KANBAN_VIEW = 10;

/**
 * The view types a kanban column's content can be shown with: the standard list view types.
 * Kanban itself is not one of them (a column would hold a kanban of its own), nor are the editable
 * types (a column shows a copy of its records, so an edit would not reach the data).
 */
export const KANBAN_COLUMN_VIEW_TYPES = [
    "list", "table", "gallery", "image", "primary", "totals-details", "crosstab", "calendar",
] as const;
export type KanbanColumnViewType = (typeof KANBAN_COLUMN_VIEW_TYPES)[number];
export const DEFAULT_KANBAN_COLUMN_VIEW_TYPE: KanbanColumnViewType = "list";

export interface KanbanColumn {
    /** The column's header: the split fields' values joined with KANBAN_COLUMN_LABEL_SEPARATOR. */
    label: string;
    /** The records that have this combination of values. */
    records: any[];
}

/** A field whose values form a small set: it lists its valid values, is a flag, or points to another record. */
export const isKanbanSplitField = (field: FieldDef): boolean =>
    Boolean(field.options?.length) || field.type === "boolean" || Boolean(field.reference);

/** The fields a kanban can split its columns by. */
export const getKanbanSplitFieldOptions = (fields: FieldDef[]): FieldDef[] =>
    fields.filter(isKanbanSplitField);

/**
 * The field a kanban splits by when the user has not chosen: the first field that lists its
 * valid values, else the first other categorical field. Empty when the model has none.
 */
export const getDefaultKanbanSplitFieldKeys = (fields: FieldDef[]): string[] => {
    const withValidValues = fields.find((field) => Boolean(field.options?.length));
    const first = withValidValues ?? getKanbanSplitFieldOptions(fields)[0];
    return first ? [first.key] : [];
};

/** The fields a kanban card can show: every field of the frontend schema. */
export const getKanbanCardFieldOptions = (fields: FieldDef[]): FieldDef[] => fields;

/**
 * Split *records* into kanban columns, one per distinct combination of the split fields' values.
 *
 * With more combinations than *maximumColumns*, only the columns with the most records are kept.
 * Columns are ordered by header, left to right.
 *
 * @param formatValue Text of a record's value in a field (e.g. the option's label).
 * @param emptyValueLabel Text of a missing value.
 * @param noSplitLabel Header of the only column when no split field is chosen.
 */
export const buildKanbanColumns = (
    records: any[],
    splitFields: FieldDef[],
    maximumColumns: number,
    formatValue: (field: FieldDef, record: any) => string,
    emptyValueLabel: string,
    noSplitLabel: string,
): KanbanColumn[] => {
    const columnsByLabel = new Map<string, KanbanColumn>();
    for (const record of records) {
        const label = splitFields.length === 0
            ? noSplitLabel
            : splitFields
                .map((field) => {
                    const raw = record?.[field.key];
                    if (raw === undefined || raw === null || raw === "") return emptyValueLabel;
                    return formatValue(field, record);
                })
                .join(KANBAN_COLUMN_LABEL_SEPARATOR);
        const column = columnsByLabel.get(label);
        if (column) column.records.push(record);
        else columnsByLabel.set(label, { label, records: [record] });
    }
    const limit = Math.max(1, Math.floor(maximumColumns) || DEFAULT_MAXIMUM_COLUMNS_IN_KANBAN_VIEW);
    return [...columnsByLabel.values()]
        .sort((a, b) => b.records.length - a.records.length || a.label.localeCompare(b.label))
        .slice(0, limit)
        .sort((a, b) => a.label.localeCompare(b.label));
};
