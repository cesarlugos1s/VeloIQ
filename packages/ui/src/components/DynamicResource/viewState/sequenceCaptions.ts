/**
 * Caption lines drawn from the shared field sequence, for view types that show
 * a few fields around a record (gallery captions, calendar event popups).
 * Role fields (the image source, the calendar date field) are left out, a view
 * shows only the first fields that fit and never reorders them.
 */
import type { FieldDef } from "../types";

export interface SequenceCaptionOptions {
    /** Field keys that play a role in the view (image, date, grouping) and are not captions. */
    excludedFieldKeys?: string[];
    /** The most lines shown. */
    maximumLines: number;
    /** Text already shown elsewhere (the record's label); a line with the same value is skipped. */
    labelText?: string;
}

export function buildSequenceCaptionLines(
    record: any,
    fields: FieldDef[],
    sequenceKeys: string[],
    formatValue: (field: FieldDef, record: any) => string,
    { excludedFieldKeys = [], maximumLines, labelText }: SequenceCaptionOptions,
): string[] {
    const lines: string[] = [];
    for (const key of sequenceKeys) {
        if (lines.length >= maximumLines) break;
        if (excludedFieldKeys.includes(key)) continue;
        const field = fields.find((candidate) => candidate.key === key);
        if (!field) continue;
        const text = formatValue(field, record);
        if (!text || text === labelText) continue;
        lines.push(`${field.label}: ${text}`);
    }
    return lines;
}
