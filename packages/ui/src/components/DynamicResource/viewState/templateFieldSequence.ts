/**
 * The field sequence a page template expands for a list page: its field rows in
 * the template's order (sections top to bottom and left to right, then rows and
 * columns). It is the starting field sequence of the page's list block; a saved
 * or temporary sequence overrides it and a template never overwrites saved
 * preferences.
 */
import type { ViewConfigRow } from "../types";

export function fieldSequenceFromTemplateRows(rows: ViewConfigRow[], formType: string): string[] {
    const fieldRows = rows
        .filter((row) => row.form_type === formType && row.attribute_or_relation_type === "attribute" && row.name)
        .map((row, index) => ({ row, index }))
        .sort((a, b) =>
            (a.row.section_grid_row ?? 0) - (b.row.section_grid_row ?? 0)
            || (a.row.section_grid_col ?? 0) - (b.row.section_grid_col ?? 0)
            || (a.row.row ?? 0) - (b.row.row ?? 0)
            || (a.row.column ?? 0) - (b.row.column ?? 0)
            || a.index - b.index);
    const keys: string[] = [];
    fieldRows.forEach(({ row }) => { if (!keys.includes(row.name)) keys.push(row.name); });
    return keys;
}
