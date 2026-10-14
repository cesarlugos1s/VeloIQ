import dayjs from "dayjs";
import type { FieldDef } from "../types";

/**
 * Filters of a list, in the forms the list's backend endpoints accept. Shared by
 * the list page's own requests (all rows, server-side filter rules) and the
 * Analyze section's server-side aggregation, so both send the same filters.
 */

/** A refine-style filter: field, operator and value. */
export interface ListFilter {
    field: string;
    operator?: string;
    value: any;
}

/**
 * Query-string params for the CRUD list endpoints (``?field=v``, ``?field_gte=v``...)
 * from refine-style filters. Filters holding a client-only range bucket
 * (``__range__:...``) are left out: the browser applies those itself.
 */
export const buildListFilterParams = (filters: ReadonlyArray<ListFilter | any>): URLSearchParams => {
    const params = new URLSearchParams();
    (filters || []).forEach((filterItem: any) => {
        if (!filterItem?.field || filterItem?.value === undefined || filterItem?.value === null) return;
        const vals = Array.isArray(filterItem.value) ? filterItem.value : [filterItem.value];
        if (vals.some((v: any) => String(v).startsWith("__range__:"))) return;
        const op = filterItem.operator;
        const suffix = op && op !== "eq" ? `_${op}` : "";
        params.append(`${filterItem.field}${suffix}`, String(filterItem.value));
    });
    return params;
};

/**
 * Server-side equivalents of the list's advanced filter rules.
 *
 * @param filterRules The rules of the "Advanced filters" panel.
 * @param fields The model's fields.
 * @param resolveRelativeDate Resolves a relative date rule value ("last 7 days"...) to dates.
 */
export const buildServerFiltersFromRules = (
    filterRules: ReadonlyArray<any>,
    fields: ReadonlyArray<FieldDef>,
    resolveRelativeDate: (value: any, asRange: boolean) => any,
): ListFilter[] => {
    const resolveServerDate = (val: any, forRange: boolean) => {
        if (val?.mode === "relative") {
            const resolved = resolveRelativeDate(val, forRange);
            if (forRange) return { start: resolved.start?.toISOString(), end: resolved.end?.toISOString() };
            return { date: resolved.date?.toISOString() };
        }
        const date = dayjs(val?.date || val);
        if (!date.isValid()) return {};
        if (forRange) return { start: date.startOf("day").toISOString(), end: date.endOf("day").toISOString() };
        return { date: date.startOf("day").toISOString() };
    };
    return filterRules
        .filter((rule) => rule.fieldKey && rule.operator && rule.value !== undefined && rule.value !== null && rule.value !== "")
        .flatMap((rule): ListFilter[] => {
            const field = fields.find((f) => f.key === rule.fieldKey);
            if (!field) return [];
            const fieldKey = field.key;
            const op = rule.operator;
            if (field.type === "string") {
                return [{ field: fieldKey, operator: op === "contains" ? "contains" : "eq", value: rule.value }];
            }
            if (field.type === "number") {
                if (op === "between") {
                    return [
                        { field: fieldKey, operator: "gte", value: rule.value },
                        { field: fieldKey, operator: "lte", value: rule.value2 },
                    ];
                }
                return [{ field: fieldKey, operator: op!, value: rule.value }];
            }
            if (field.type === "boolean") {
                return [{ field: fieldKey, operator: "eq", value: Boolean(rule.value) }];
            }
            if (field.type === "date" || field.type === "datetime") {
                if (op === "between") {
                    const start = resolveServerDate(rule.value, true).start;
                    const end = resolveServerDate(rule.value2, true).end;
                    return [
                        { field: fieldKey, operator: "gte", value: start },
                        { field: fieldKey, operator: "lte", value: end },
                    ];
                }
                const operatorMap: Record<string, string> = { before: "lt", after: "gt", on: "eq" };
                const dateVal = resolveServerDate(rule.value, false).date;
                return [{ field: fieldKey, operator: (op && operatorMap[op]) || "eq", value: dateVal }];
            }
            return [];
        });
};
