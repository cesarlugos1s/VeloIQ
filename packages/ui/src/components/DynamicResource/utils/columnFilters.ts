import type React from "react";
import type { FieldDef } from "../types";

/**
 * Shared column-filter helpers used by the table/editable-table/crosstab view types.
 *
 * Filter dropdowns show individual distinct values up to `distinctLimit`; once the
 * number of distinct values for a field exceeds `rangeCount`, the values are bucketed
 * into ranges so the list stays usable. Range options are encoded into the option
 * value with a prefix so they can be decoded back at filter time:
 *   - `__range__:lo:hi`        numeric ranges
 *   - `__daterange__:lo:hi`    date/datetime ranges (lo/hi are URI-encoded YYYY-MM-DD)
 *   - `__catrange__:lo:hi`     alphabetical ranges for string fields and the eid label
 *
 * Both the builder and the matcher live here so every view type stays in sync and we
 * never present an incomplete/inconsistent value list.
 */

export interface ColumnFilterOption {
    text: string;
    value: string;
}

export interface BuildColumnFilterOptionsParams {
    fields: FieldDef[];
    data: readonly any[];
    /** Distinct count above which values are bucketed into ranges. */
    rangeCount?: number;
    /** Max individual distinct values listed when not bucketing. */
    distinctLimit?: number;
}

const truncateLabel = (s: string) => (s.length > 15 ? s.substring(0, 15) + "…" : s);

/**
 * Build the grouped filter options for each field, keyed by field.key.
 * Extracted verbatim (behaviour-preserving) from the DynamicList implementation so it
 * can be reused by relation tables and crosstab views.
 */
export function buildColumnFilterOptions({
    fields,
    data,
    rangeCount = 20,
    distinctLimit = 50,
}: BuildColumnFilterOptionsParams): Map<string, ColumnFilterOption[]> {
    const filtersMap = new Map<string, ColumnFilterOption[]>();

    for (const field of fields) {
        // eid column: ranges are based on the _label (__str__) values, not the numeric eid.
        if (field.key === "eid") {
            const labelValues: string[] = [];
            for (const record of data) {
                const lbl = record?._label;
                if (lbl === undefined || lbl === null || lbl === "") continue;
                labelValues.push(String(lbl));
            }
            const distinctLabelSet = new Set(labelValues);
            if (distinctLabelSet.size > rangeCount) {
                const sorted = Array.from(distinctLabelSet).sort((a, b) => a.localeCompare(b));
                const step = Math.ceil(sorted.length / rangeCount);
                const options: ColumnFilterOption[] = [];
                for (let i = 0; i < sorted.length; i += step) {
                    const lo = sorted[i];
                    const hi = sorted[Math.min(i + step - 1, sorted.length - 1)];
                    options.push({
                        text: `${truncateLabel(lo)} – ${truncateLabel(hi)}`,
                        value: `__catrange__:${encodeURIComponent(lo)}:${encodeURIComponent(hi)}`,
                    });
                }
                filtersMap.set(field.key, options);
                continue;
            }
            // Fewer than rangeCount distinct labels — fall through to default (handles eid specially)
        }

        // Numeric fields (non-reference): use ranges when distinct count exceeds rangeCount,
        // only including ranges that contain at least one actual value.
        if (field.type === "number" && !field.reference) {
            const numericValues: number[] = [];
            for (const record of data) {
                const v = record?.[field.key];
                if (v === undefined || v === null) continue;
                const n = Number(v);
                if (!isNaN(n)) numericValues.push(n);
            }
            const distinctSet = new Set(numericValues);
            if (distinctSet.size > rangeCount) {
                let min = Infinity, max = -Infinity;
                for (const n of numericValues) {
                    if (n < min) min = n;
                    if (n > max) max = n;
                }
                const step = (max - min) / rangeCount;
                const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
                const options: ColumnFilterOption[] = [];
                for (let i = 0; i < rangeCount; i++) {
                    const lo = min + i * step;
                    const hi = i === rangeCount - 1 ? max : min + (i + 1) * step;
                    if (numericValues.some((n) => n >= lo && n <= hi)) {
                        options.push({ text: `${fmt(lo)} – ${fmt(hi)}`, value: `__range__:${lo}:${hi}` });
                    }
                }
                filtersMap.set(field.key, options);
                continue;
            }
            // Fewer than rangeCount distinct numeric values — fall through to individual values
        }

        // Date/datetime fields: use date ranges when distinct count exceeds rangeCount,
        // only including ranges that contain at least one actual value.
        if (field.type === "date" || field.type === "datetime") {
            const dateValues: string[] = [];
            for (const record of data) {
                const v = record?.[field.key];
                if (v === undefined || v === null || v === "") continue;
                const d = String(v).substring(0, 10);
                if (d) dateValues.push(d);
            }
            const distinctDateSet = new Set(dateValues);
            if (distinctDateSet.size > rangeCount) {
                const sorted = Array.from(distinctDateSet).sort();
                const step = Math.ceil(sorted.length / rangeCount);
                const options: ColumnFilterOption[] = [];
                for (let i = 0; i < sorted.length; i += step) {
                    const lo = sorted[i];
                    const hi = sorted[Math.min(i + step - 1, sorted.length - 1)];
                    options.push({
                        text: `${lo} – ${hi}`,
                        value: `__daterange__:${encodeURIComponent(lo)}:${encodeURIComponent(hi)}`,
                    });
                }
                filtersMap.set(field.key, options);
                continue;
            }
            // Fewer than rangeCount distinct dates — fall through to individual values
        }

        // String fields (non-reference): use alphabetical ranges when distinct count exceeds
        // rangeCount, only including ranges that contain at least one actual value.
        if (field.type === "string" && !field.reference) {
            const strValues: string[] = [];
            for (const record of data) {
                const v = record?.[field.key];
                if (v === undefined || v === null || v === "") continue;
                strValues.push(String(v));
            }
            const distinctStrSet = new Set(strValues);
            if (distinctStrSet.size > rangeCount) {
                const sorted = Array.from(distinctStrSet).sort((a, b) => a.localeCompare(b));
                const step = Math.ceil(sorted.length / rangeCount);
                const options: ColumnFilterOption[] = [];
                for (let i = 0; i < sorted.length; i += step) {
                    const lo = sorted[i];
                    const hi = sorted[Math.min(i + step - 1, sorted.length - 1)];
                    options.push({
                        text: `${truncateLabel(lo)} – ${truncateLabel(hi)}`,
                        value: `__catrange__:${encodeURIComponent(lo)}:${encodeURIComponent(hi)}`,
                    });
                }
                filtersMap.set(field.key, options);
                continue;
            }
            // Fewer than rangeCount distinct string values — fall through to individual values
        }

        // Default: show individual distinct values (up to distinctLimit).
        const seen = new Set<string>();
        const options: ColumnFilterOption[] = [];
        for (const record of data) {
            let value = record?.[field.key];
            let label = value;
            if (field.key === "eid" && record?._label) {
                value = record.eid;
                label = record._label;
            }
            if (value === undefined || value === null) continue;
            const key = String(value);
            if (seen.has(key)) continue;
            seen.add(key);
            options.push({ text: String(label), value: key });
            if (options.length >= distinctLimit) break;
        }
        filtersMap.set(field.key, options);
    }

    return filtersMap;
}

/**
 * Decode a single selected filter value (which may be a range-encoded bucket) and test
 * whether `record` matches it. Callers test a multi-select by OR-ing across values:
 *   selectedValues.some((v) => matchesColumnFilterValue(field, record, v))
 * and antd's `onFilter(value, record)` calls it directly with the single value.
 */
export function matchesColumnFilterValue(field: FieldDef, record: any, value: React.Key | string | number | boolean): boolean {
    const strValue = String(value);

    if (field.type === "number" && !field.reference && strValue.startsWith("__range__:")) {
        const parts = strValue.split(":");
        const lo = Number(parts[1]);
        const hi = Number(parts[2]);
        const recordVal = Number(record?.[field.key]);
        if (isNaN(recordVal)) return false;
        return recordVal >= lo && recordVal <= hi;
    }
    if ((field.type === "date" || field.type === "datetime") && strValue.startsWith("__daterange__:")) {
        const sub = strValue.substring("__daterange__:".length);
        const sepIdx = sub.indexOf(":");
        const lo = decodeURIComponent(sub.substring(0, sepIdx));
        const hi = decodeURIComponent(sub.substring(sepIdx + 1));
        const recordVal = String(record?.[field.key] ?? "").substring(0, 10);
        return recordVal >= lo && recordVal <= hi;
    }
    if (field.type === "string" && !field.reference && strValue.startsWith("__catrange__:")) {
        const sub = strValue.substring("__catrange__:".length);
        const sepIdx = sub.indexOf(":");
        const lo = decodeURIComponent(sub.substring(0, sepIdx));
        const hi = decodeURIComponent(sub.substring(sepIdx + 1));
        const recordVal = String(record?.[field.key] ?? "");
        return recordVal.localeCompare(lo) >= 0 && recordVal.localeCompare(hi) <= 0;
    }
    if (field.key === "eid" && strValue.startsWith("__catrange__:")) {
        const sub = strValue.substring("__catrange__:".length);
        const sepIdx = sub.indexOf(":");
        const lo = decodeURIComponent(sub.substring(0, sepIdx));
        const hi = decodeURIComponent(sub.substring(sepIdx + 1));
        const recordLabel = String(record?._label ?? "");
        return recordLabel.localeCompare(lo) >= 0 && recordLabel.localeCompare(hi) <= 0;
    }
    if (field.key === "eid" && record?._label) {
        return String(record._label) === strValue || String(record.eid) === strValue;
    }
    return String(record?.[field.key]) === strValue;
}

/** True when a list of selected filter values contains a range-encoded bucket. */
export function hasRangeEncodedValue(values: Array<string | number | boolean>): boolean {
    return values.some((v) => {
        const s = String(v);
        return s.startsWith("__range__:") || s.startsWith("__catrange__:") || s.startsWith("__daterange__:");
    });
}
