/**
 * In-page rows: data that exists only in the browser page (for example the
 * editable list of a form before the form is saved), shown and edited with the
 * standard view types like any other resource.
 *
 * A store holds the rows of one in-page resource, whose name starts with
 * IN_PAGE_ROWS_RESOURCE_PREFIX. The two HTTP helpers (`authenticatedFetch` and
 * `httpClient`, i.e. Refine's data provider) answer the URLs of such a resource
 * from its store instead of the network, with the REST contract of the backend
 * CRUD routers: list with filters, search, sort and paging (`x-total-count`),
 * get, create, update (PUT/PATCH), delete and export-csv. Every view type
 * (DynamicList, relation views, grid cells) therefore works with in-page rows
 * without code of its own: this module is the one place their behavior lives.
 *
 * Pages normally use the `useInPageRowsStore` hook, which creates the store and
 * removes it when the page closes.
 */
import type { FieldDef, ModelDef } from "../components/DynamicResource/types";

const _ = (text: string): string => {
    const translate = (globalThis as any).window?._;
    return typeof translate === "function" ? translate(text) : text;
};

/** Resource names of in-page row stores start with this prefix. */
export const IN_PAGE_ROWS_RESOURCE_PREFIX = "in_page_rows__";

/** Query-string text of the two boolean values (JSON literals, as the browser sends them). */
const BOOLEAN_QUERY_TEXT_VALUES: Record<string, boolean> = { true: true, false: false, "1": true, "0": false };
/** Operator suffixes of the list query parameters, longest first so `__ilike` wins over `_like`. */
const FILTER_OPERATOR_SUFFIXES = ["__ilike", "__in", "_like", "_gte", "_lte", "_ne"];

/** The rows of one in-page resource. */
export interface InPageRowsStore {
    /** The resource name (IN_PAGE_ROWS_RESOURCE_PREFIX + store name). */
    resource: string;
    /** The ModelDef the views use for these rows. */
    model: ModelDef;
    /** The current rows, as plain objects with their `eid`. */
    getRows: () => any[];
    /** Replace every row (each gets an `eid` when it has none). */
    setRows: (rows: any[]) => void;
}

interface StoreState {
    store: InPageRowsStore;
    rows: any[];
    nextRowNumber: number;
}

/** Every in-page row store, keyed by resource name. */
const inPageRowsStoresByResource = new Map<string, StoreState>();
/** The state of each store object, so a removed store can be registered again with its rows. */
const storeStateByStore = new WeakMap<InPageRowsStore, StoreState>();

/** Return the `eid` of a new row: its key field's value, or a page-unique number. */
function newRowEid(state: StoreState, row: any): string {
    const keyField = state.store.model.pkField;
    const keyValue = keyField && keyField !== "eid" ? row?.[keyField] : undefined;
    if (keyValue !== undefined && keyValue !== null && keyValue !== "") return String(keyValue);
    state.nextRowNumber += 1;
    return String(state.nextRowNumber);
}

/**
 * Create (or replace) the in-page row store `storeName`.
 *
 * @param storeName Page-unique name; the resource is IN_PAGE_ROWS_RESOURCE_PREFIX + storeName.
 * @param model     The rows' fields and labels (its `resource` and `pkField` are set here).
 * @param rows      The initial rows.
 */
export function createInPageRowsStore(storeName: string, model: Omit<ModelDef, "resource">, rows: any[] = []): InPageRowsStore {
    const resource = `${IN_PAGE_ROWS_RESOURCE_PREFIX}${storeName}`;
    const storeModel: ModelDef = {
        ...model,
        resource,
        pkField: model.pkField || "eid",
        isNonModelData: true,
    };
    const state: StoreState = {
        rows: [],
        nextRowNumber: 0,
        store: {
            resource,
            model: storeModel,
            getRows: () => state.rows.map((row) => ({ ...row })),
            setRows: (nextRows: any[]) => {
                state.rows = nextRows.map((row) => ({ ...row, eid: row?.eid ?? newRowEid(state, row) }));
            },
        },
    };
    state.store.setRows(rows);
    inPageRowsStoresByResource.set(resource, state);
    storeStateByStore.set(state.store, state);
    return state.store;
}

/** Register `store` again, with its rows, after removeInPageRowsStore (e.g. a remounted page). */
export function registerInPageRowsStore(store: InPageRowsStore): void {
    const state = storeStateByStore.get(store);
    if (state) inPageRowsStoresByResource.set(store.resource, state);
}

/** Remove the in-page row store of `resource` (when its page closes). */
export function removeInPageRowsStore(resource: string): void {
    inPageRowsStoresByResource.delete(resource);
}

// ---------------------------------------------------------------------------
// List queries (the backend's filter, search, sort and paging rules)
// ---------------------------------------------------------------------------

/** Return a sort/compare key: typed values first, then text, with empty values last. */
function comparableSortKey(field: FieldDef | undefined, value: any): [number, number | string] {
    if (value === null || value === undefined || value === "") return [2, ""];
    if (field?.type === "number") {
        const number = typeof value === "number" ? value : Number(value);
        if (!Number.isNaN(number)) return [0, number];
    }
    if (field?.type === "boolean") {
        const flag = typeof value === "boolean" ? value : BOOLEAN_QUERY_TEXT_VALUES[String(value).trim().toLowerCase()];
        if (flag !== undefined) return [0, flag ? 1 : 0];
    }
    if (field?.type === "date" || field?.type === "datetime") {
        const time = new Date(String(value)).getTime();
        if (!Number.isNaN(time)) return [0, time];
    }
    return [1, String(value).toLowerCase()];
}

function rowMatchesCondition(row: any, field: FieldDef | undefined, key: string, operator: string, value: string): boolean {
    const cell = row?.[key];
    if (operator === "__in") {
        const wanted = value.split(",").map((part) => part.trim()).filter(Boolean);
        return wanted.some((part) => comparableSortKey(field, cell).join("\u0000") === comparableSortKey(field, part).join("\u0000"));
    }
    if (operator === "__ilike" || operator === "_like") {
        return String(cell ?? "").toLowerCase().includes(value.toLowerCase());
    }
    const left = comparableSortKey(field, cell);
    const right = comparableSortKey(field, value);
    if (operator === "_ne") return left[0] !== right[0] || left[1] !== right[1];
    if (left[0] !== right[0]) return false;
    if (operator === "_gte") return left[1] >= right[1];
    if (operator === "_lte") return left[1] <= right[1];
    return left[1] === right[1];
}

/** Return the rows matching the list query parameters (paging and sort excluded). */
function filterRowsByQueryParameters(model: ModelDef, rows: any[], params: URLSearchParams): any[] {
    const fieldsByKey = new Map<string, FieldDef | undefined>(model.fields.map((field) => [field.key, field]));
    fieldsByKey.set("eid", undefined);
    const conditions: Array<[string, string, string]> = [];
    let search = "";
    params.forEach((value, name) => {
        if (name.startsWith("_") || value === "") return;
        if (name === "q") { search = value.toLowerCase(); return; }
        if (fieldsByKey.has(name)) { conditions.push([name, "", value]); return; }
        const suffix = FILTER_OPERATOR_SUFFIXES.find((candidate) => name.endsWith(candidate) && fieldsByKey.has(name.slice(0, -candidate.length)));
        if (suffix) conditions.push([name.slice(0, -suffix.length), suffix, value]);
    });
    const textKeys = model.fields.filter((field) => field.type === "string").map((field) => field.key);
    return rows.filter((row) =>
        (!search || textKeys.some((key) => String(row?.[key] ?? "").toLowerCase().includes(search)))
        && conditions.every(([key, operator, value]) => rowMatchesCondition(row, fieldsByKey.get(key), key, operator, value)));
}

/** Return the rows sorted by `_sort`/`_order` (several keys, as Refine's simple-rest sends them). */
function sortRowsByQueryParameters(model: ModelDef, rows: any[], params: URLSearchParams): any[] {
    const keys = (params.get("_sort") || "").split(",").map((key) => key.trim()).filter(Boolean);
    const orders = (params.get("_order") || "").split(",").map((order) => order.trim().toLowerCase());
    if (keys.length === 0 && model.defaultSort) {
        keys.push(model.defaultSort.field);
        orders.splice(0, orders.length, model.defaultSort.order);
    }
    const fieldsByKey = new Map(model.fields.map((field) => [field.key, field]));
    return [...rows].sort((left, right) => {
        for (let index = 0; index < keys.length; index += 1) {
            const field = fieldsByKey.get(keys[index]);
            const [leftKind, leftValue] = comparableSortKey(field, left?.[keys[index]]);
            const [rightKind, rightValue] = comparableSortKey(field, right?.[keys[index]]);
            // Empty values stay last in both directions.
            if (leftKind !== rightKind) return leftKind - rightKind;
            if (leftValue === rightValue) continue;
            const ascending = leftValue < rightValue ? -1 : 1;
            return orders[index] === "desc" ? -ascending : ascending;
        }
        return 0;
    });
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Return the payload's values for the model's writable fields, as their types, and the validation errors. */
function validatedRowValues(model: ModelDef, payload: any, existing: any | null): [any, string[]] {
    const row: any = existing ? { ...existing } : {};
    const errors: string[] = [];
    for (const field of model.fields) {
        if (!(field.key in (payload || {})) || field.readOnly) continue;
        let value = payload[field.key];
        if (field.type === "number" && value !== null && value !== "" && value !== undefined) {
            const number = typeof value === "number" ? value : Number(String(value).trim());
            if (Number.isNaN(number) || typeof value === "boolean") {
                errors.push(_("{field}: a number is expected.").replace("{field}", _(field.label)));
                continue;
            }
            value = number;
        }
        if (field.type === "boolean" && typeof value !== "boolean" && value !== null && value !== undefined) {
            const flag = BOOLEAN_QUERY_TEXT_VALUES[String(value).trim().toLowerCase()];
            if (flag === undefined) {
                errors.push(_("{field}: true or false is expected.").replace("{field}", _(field.label)));
                continue;
            }
            value = flag;
        }
        row[field.key] = value;
    }
    for (const field of model.fields) {
        if (field.required && !field.readOnly && (row[field.key] === undefined || row[field.key] === null || row[field.key] === "")) {
            errors.push(_("{field}: a value is required.").replace("{field}", _(field.label)));
        }
    }
    return [row, errors];
}

// ---------------------------------------------------------------------------
// HTTP answers
// ---------------------------------------------------------------------------

/** An answer to an in-page rows request, in the shape the two HTTP helpers turn into a response. */
export interface InPageRowsAnswer {
    status: number;
    headers: Record<string, string>;
    body: any;
}

function jsonAnswer(status: number, body: any, headers: Record<string, string> = {}): InPageRowsAnswer {
    return { status, body, headers: { "content-type": "application/json", ...headers } };
}

function csvCell(value: any): string {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Answer `method url` from an in-page row store, or return null when the URL
 * isn't an in-page resource (the request then goes to the network).
 *
 * @param url    The request URL (absolute, or relative to the page).
 * @param method The HTTP method.
 * @param body   The request body (a JSON string or an object).
 */
export function answerInPageRowsRequest(url: string, method: string | undefined, body?: any): InPageRowsAnswer | null {
    if (!url.includes(IN_PAGE_ROWS_RESOURCE_PREFIX)) return null;
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(url, "http://in-page.local");
    } catch {
        return null;
    }
    const segments = parsedUrl.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
    const resourceIndex = segments.findIndex((segment) => segment.startsWith(IN_PAGE_ROWS_RESOURCE_PREFIX));
    if (resourceIndex < 0) return null;
    const state = inPageRowsStoresByResource.get(segments[resourceIndex]);
    if (!state) return jsonAnswer(404, { detail: _("The data of this list could not be read.") });
    const model = state.store.model;
    const rowSegment = segments[resourceIndex + 1];
    const verb = (method || "GET").toUpperCase();
    const payload = typeof body === "string" ? (() => { try { return JSON.parse(body); } catch { return {}; } })() : (body || {});
    const notFound = () => jsonAnswer(404, { detail: _("The row was not found. It may have been deleted.") });

    if (rowSegment === undefined) {
        if (verb === "GET") {
            const matching = sortRowsByQueryParameters(model, filterRowsByQueryParameters(model, state.rows, parsedUrl.searchParams), parsedUrl.searchParams);
            const start = Math.max(0, Number(parsedUrl.searchParams.get("_start") ?? 0));
            const end = Number(parsedUrl.searchParams.get("_end") ?? matching.length);
            const page = matching.slice(start, Math.max(start, end));
            return jsonAnswer(200, page, {
                "x-total-count": String(matching.length),
                "content-range": `items ${start}-${Math.min(end, matching.length)}/${matching.length}`,
            });
        }
        if (verb === "POST") {
            const [row, errors] = validatedRowValues(model, payload, null);
            if (errors.length > 0) return jsonAnswer(422, { detail: errors.join(" ") });
            row.eid = newRowEid(state, row);
            if (state.rows.some((existing) => existing.eid === row.eid)) {
                return jsonAnswer(422, { detail: _("A row with this key already exists.") });
            }
            state.rows = [...state.rows, row];
            return jsonAnswer(201, { ...row });
        }
        return jsonAnswer(405, { detail: _("This action is not available for this list.") });
    }

    if (rowSegment === "export-csv" && verb === "GET") {
        const matching = filterRowsByQueryParameters(model, state.rows, parsedUrl.searchParams);
        const keys = model.fields.map((field) => field.key);
        const lines = [keys.join(","), ...matching.map((row) => keys.map((key) => csvCell(row[key])).join(","))];
        return { status: 200, headers: { "content-type": "text/csv" }, body: lines.join("\n") + "\n" };
    }

    const index = state.rows.findIndex((row) => String(row.eid) === rowSegment);
    if (index < 0) return notFound();
    if (verb === "GET") return jsonAnswer(200, { ...state.rows[index] });
    if (verb === "PUT" || verb === "PATCH") {
        const [row, errors] = validatedRowValues(model, payload, state.rows[index]);
        if (errors.length > 0) return jsonAnswer(422, { detail: errors.join(" ") });
        state.rows = state.rows.map((existing, position) => (position === index ? row : existing));
        return jsonAnswer(200, { ...row });
    }
    if (verb === "DELETE") {
        state.rows = state.rows.filter((_row, position) => position !== index);
        return { status: 204, headers: {}, body: null };
    }
    return jsonAnswer(405, { detail: _("This action is not available for this list.") });
}
