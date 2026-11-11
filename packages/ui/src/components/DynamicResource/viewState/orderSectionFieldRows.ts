/**
 * Applies the shared field sequence to a primary view: inside every section the
 * field rows keep the section's slots (their rows and columns, so the layout
 * configured in the views configuration stays) and the fields take those slots
 * in sequence order. Fields outside the sequence follow in their own order.
 */
import type { ViewConfigRow } from "../types";

const sectionKeyOf = (row: ViewConfigRow): string => `${row.tab_name ?? ""}::${row.section_id || row.section || ""}`;

export function orderSectionFieldRows(rows: ViewConfigRow[], sequenceKeys: string[]): ViewConfigRow[] {
    if (sequenceKeys.length === 0) return rows;
    const positionInSequence = new Map(sequenceKeys.map((key, index) => [key, index]));
    const fieldIndexesBySection = new Map<string, number[]>();
    rows.forEach((row, index) => {
        if (row.attribute_or_relation_type !== "attribute") return;
        const sectionKey = sectionKeyOf(row);
        fieldIndexesBySection.set(sectionKey, [...(fieldIndexesBySection.get(sectionKey) ?? []), index]);
    });

    const result = [...rows];
    fieldIndexesBySection.forEach((indexes) => {
        if (indexes.length < 2) return;
        const slots = indexes
            .map((index) => ({ row: rows[index].row ?? 0, column: rows[index].column ?? 0 }))
            .sort((a, b) => a.row - b.row || a.column - b.column);
        const fieldsInOrder = [...indexes].sort((indexA, indexB) => {
            const positionA = positionInSequence.get(rows[indexA].name);
            const positionB = positionInSequence.get(rows[indexB].name);
            if (positionA === undefined && positionB === undefined) return indexA - indexB;
            if (positionA === undefined) return 1;
            if (positionB === undefined) return -1;
            return positionA - positionB;
        });
        fieldsInOrder.forEach((fieldIndex, slotIndex) => {
            result[fieldIndex] = { ...rows[fieldIndex], row: slots[slotIndex].row, column: slots[slotIndex].column };
        });
    });
    return result;
}
