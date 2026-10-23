/**
 * Rows that exist only in this page (e.g. a form's editable list before the
 * form is saved), shown and edited with the standard views:
 *
 *     const lines = useInPageRowsStore("order_lines", orderLineModel, initialLines);
 *     <DynamicList model={lines.model} listViewType="editable-table" isEmbedded />
 *     ... on submit: save(lines.getRows())
 *
 * The store answers the views' requests (see utils/serveInPageRowsStores), so
 * paging, search, sorting, filters, Analyze, inline editing, adding and
 * deleting rows all work. It is created on the first render (before the views'
 * first request) and removed when the page closes.
 */
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useInvalidate } from "@refinedev/core";
import type { ModelDef } from "../components/DynamicResource/types";
import { IN_PAGE_ROWS_RESOURCE_PREFIX, createInPageRowsStore, registerInPageRowsStore, removeInPageRowsStore, type InPageRowsStore } from "../utils/serveInPageRowsStores";

export interface InPageRowsStoreHandle {
    /** The ModelDef to give the views (its `resource` is the store's resource). */
    model: ModelDef;
    /** The current rows, as plain objects with their `eid`. */
    getRows: () => any[];
    /** Replace every row and refresh the views showing them. */
    setRows: (rows: any[]) => void;
}

/**
 * Create the in-page row store `storeName` for this page.
 *
 * @param storeName   Page-unique name of the rows (e.g. "order_lines").
 * @param model       Their fields and labels (no `resource`: the store sets it).
 * @param initialRows The rows the store starts with.
 */
export function useInPageRowsStore(storeName: string, model: Omit<ModelDef, "resource">, initialRows: any[] = []): InPageRowsStoreHandle {
    const invalidate = useInvalidate();
    const storeRef = useRef<InPageRowsStore | null>(null);
    if (storeRef.current === null || storeRef.current.resource !== `${IN_PAGE_ROWS_RESOURCE_PREFIX}${storeName}`) {
        storeRef.current = createInPageRowsStore(storeName, model, initialRows);
    }
    const store = storeRef.current;

    useEffect(() => {
        // Registered again when the page mounts a second time (React StrictMode runs effects twice).
        registerInPageRowsStore(store);
        const resource = store.resource;
        return () => removeInPageRowsStore(resource);
    }, [store]);

    const setRows = useCallback((rows: any[]) => {
        store.setRows(rows);
        void invalidate({ resource: store.resource, invalidates: ["list", "many", "detail"] });
    }, [store, invalidate]);

    return useMemo(() => ({ model: store.model, getRows: store.getRows, setRows }), [store, setRows]);
}
