import { useEffect, useMemo, useState } from "react";
import { useApiUrl } from "@refinedev/core";
import { authenticatedFetch } from "../../../utils/authenticatedFetch";
import type { FieldDef, ModelDef } from "../types";
import { hasReferenceModel, resolveResourcePath } from "./model";

const IDS_PER_REQUEST = 200;

/** The key under which the title of the record `id` of a reference field is kept (as in a list's label cache). */
export const referenceTitleKey = (reference: string, id: string | number) => `${reference}:${id}`;

/**
 * The titles of the records the reference fields of `rows` point to, by `referenceTitleKey`.
 * Titles the caller already knows (`knownTitles`) are not fetched again; the others are read with
 * one `/_meta/bulk-read` request per `IDS_PER_REQUEST` ids and kept until the component unmounts.
 * Column filters use them to list titles instead of ids.
 */
export const useReferenceTitles = (
    fields: FieldDef[],
    rows: readonly any[],
    allModels: ModelDef[] | undefined,
    knownTitles: Record<string, string>,
): Record<string, string> => {
    const apiUrl = useApiUrl();
    const [fetchedTitles, setFetchedTitles] = useState<Record<string, string>>({});

    const referenceFields = useMemo(
        () => fields.filter((field) => field.reference && hasReferenceModel(field.reference, allModels)),
        [fields, allModels],
    );

    const missingIdsByField = useMemo(() => {
        const missing: Array<{ field: FieldDef; ids: Array<string | number> }> = [];
        for (const field of referenceFields) {
            const ids = new Set<string | number>();
            for (const row of rows) {
                const id = row?.[field.key];
                if (id === undefined || id === null || id === "") continue;
                const key = referenceTitleKey(field.reference!, id);
                if (knownTitles[key] === undefined && fetchedTitles[key] === undefined) ids.add(id);
            }
            if (ids.size > 0) missing.push({ field, ids: Array.from(ids) });
        }
        return missing;
    }, [referenceFields, rows, knownTitles, fetchedTitles]);

    useEffect(() => {
        if (missingIdsByField.length === 0) return;
        let cancelled = false;
        (async () => {
            const found: Record<string, string> = {};
            for (const { field, ids } of missingIdsByField) {
                const resource = resolveResourcePath(field.referencePath || field.reference!, allModels);
                for (let start = 0; start < ids.length; start += IDS_PER_REQUEST) {
                    const chunk = ids.slice(start, start + IDS_PER_REQUEST);
                    try {
                        const response = await authenticatedFetch(`${apiUrl}/_meta/bulk-read`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ resource, ids: chunk }),
                        });
                        if (!response.ok) continue;
                        const items = (await response.json())?.items;
                        for (const item of Array.isArray(items) ? items : []) {
                            const id = item?.eid ?? item?.id;
                            const title = item?._label ?? item?.name ?? item?.description;
                            if (id !== undefined && id !== null && title !== undefined && title !== null) {
                                found[referenceTitleKey(field.reference!, id)] = String(title);
                            }
                        }
                    } catch {
                        // Best effort: a filter option without its title shows the id.
                    }
                    // Ids without a record (e.g. a deleted one) are not asked again.
                    for (const id of chunk) {
                        const key = referenceTitleKey(field.reference!, id);
                        if (found[key] === undefined) found[key] = String(id);
                    }
                }
            }
            if (!cancelled && Object.keys(found).length > 0) {
                setFetchedTitles((previous) => ({ ...previous, ...found }));
            }
        })();
        return () => { cancelled = true; };
    }, [missingIdsByField, apiUrl, allModels]);

    return useMemo(() => ({ ...fetchedTitles, ...knownTitles }), [fetchedTitles, knownTitles]);
};
