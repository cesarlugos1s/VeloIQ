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
