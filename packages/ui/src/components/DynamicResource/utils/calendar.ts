import dayjs from "dayjs";
import type { FieldDef } from "../types";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export const CALENDAR_WEEKDAYS = [_("Sun"), _("Mon"), _("Tue"), _("Wed"), _("Thu"), _("Fri"), _("Sat")];
const CALENDAR_DATE_FOOTER_FIELDS = new Set(["creation_date", "modification_date"]);

export const isCalendarDateField = (field: FieldDef) => {
    const rawType = String((field as any)?.type || "").trim().toLowerCase();
    return rawType === "date" || rawType === "datetime";
};

export const getCalendarDateFieldOptions = (fields: FieldDef[]) => {
    const dateFields = fields.filter(isCalendarDateField);
    if (dateFields.length === 0) return [];
    const regularFields: FieldDef[] = [];
    const footerFields: FieldDef[] = [];
    dateFields.forEach((field) => {
        const key = String(field.key || "").trim().toLowerCase();
        if (CALENDAR_DATE_FOOTER_FIELDS.has(key)) {
            footerFields.push(field);
            return;
        }
        regularFields.push(field);
    });
    footerFields.sort((a, b) => {
        const order = (key: string) => (key === "creation_date" ? 1 : key === "modification_date" ? 2 : 3);
        return order(String(a.key || "").trim().toLowerCase()) - order(String(b.key || "").trim().toLowerCase());
    });
    return [...regularFields, ...footerFields];
};

export const getCalendarRecordDate = (record: any, fieldKey: string) => {
    const rawValue = record?.[fieldKey];
    if (rawValue === undefined || rawValue === null || rawValue === "") return null;
    const parsed = dayjs(rawValue);
    if (!parsed.isValid()) return null;
    return parsed.startOf("day");
};

export const isCalendarHeatmapField = (field: FieldDef) => field.type === "number" && !field.reference;

export const getCalendarHeatmapFieldOptions = (fields: FieldDef[]) => fields.filter(isCalendarHeatmapField);

const toHeatmapNumber = (value: any) => {
    if (value === undefined || value === null || value === "" || typeof value === "boolean") return null;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

/** Sum of the heatmap field per visible day; days without a numeric value are left out. */
export const getCalendarHeatmapTotals = (
    entriesByDate: Map<string, Array<{ record: any }>>,
    dayKeys: string[],
    fieldKey: string,
) => {
    const totals = new Map<string, number>();
    if (!fieldKey) return totals;
    dayKeys.forEach((dayKey) => {
        let total: number | null = null;
        (entriesByDate.get(dayKey) || []).forEach((entry) => {
            const value = toHeatmapNumber(entry.record?.[fieldKey]);
            if (value !== null) total = (total ?? 0) + value;
        });
        if (total !== null) totals.set(dayKey, total);
    });
    return totals;
};

/** Soft background for a day cell: the accent color mixed into the cell background in proportion to the day's total. */
export const getCalendarHeatmapBackground = (
    total: number | undefined,
    totals: Map<string, number>,
    accentColor: string,
    baseColor: string,
) => {
    if (total === undefined || totals.size === 0) return undefined;
    const values = Array.from(totals.values());
    const min = Math.min(...values);
    const max = Math.max(...values);
    const ratio = max === min ? 1 : (total - min) / (max - min);
    const percent = Math.round(8 + ratio * 37);
    return `color-mix(in srgb, ${accentColor} ${percent}%, ${baseColor})`;
};

export const formatCalendarHeatmapTotal = (total: number) =>
    total.toLocaleString(undefined, { maximumFractionDigits: 2 });
