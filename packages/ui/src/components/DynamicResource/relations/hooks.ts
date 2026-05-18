import { useState, useEffect } from "react";
import { useApiUrl } from "@refinedev/core";
import { authenticatedFetch } from "../../../utils/authenticatedFetch";
import type { ModelDef, RelationDef } from "../types";
import { resolveResourcePath, resolveModelName, getRecordDisplayLabel } from "../utils/model";
import { filterIdsByPolymorphicType, GALLERY_RELATION_MAX_ITEMS } from "../utils/polymorphic";

export const INLINE_DEFAULT_PAGE_SIZE = 10;
export const INLINE_PAGE_SIZE_OPTIONS = ["10", "20", "50", "100"];

export const useRelatedInlineItems = ({
    rel,
    record,
    allowedRelatedIds,
    allModels,
    page = 1,
    pageSize = INLINE_DEFAULT_PAGE_SIZE,
}: {
    rel: RelationDef;
    record: any;
    allowedRelatedIds?: Set<string | number>;
    allModels?: ModelDef[];
    page?: number;
    pageSize?: number;
}) => {
    const apiUrl = useApiUrl();
    const [items, setItems] = useState<Array<{ id: any; label: string; resource: string }>>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        const recordId = record?.eid ?? record?.id;
        if (!recordId || !rel.resource || !rel.targetKey) {
            setItems([]);
            setTotal(0);
            return;
        }
        let isMounted = true;
        const controller = new AbortController();
        const { signal } = controller;
        const fetchItems = async () => {
            setLoading(true);
            setError(null);
            try {
                const start = (page - 1) * pageSize;
                const end = start + pageSize;
                const params = new URLSearchParams();
                params.set("_start", String(start));
                params.set("_end", String(end));
                params.append(rel.targetKey, String(recordId));
                const relationResource = rel.resourcePath || resolveResourcePath(rel.resource, allModels);
                const relationResponse = await authenticatedFetch(`${apiUrl}/${relationResource}?${params.toString()}`, { signal });
                if (!relationResponse.ok) {
                    throw new Error(`Failed to load ${rel.label} relations`);
                }
                const relationRows = await relationResponse.json();
                if (!Array.isArray(relationRows)) {
                    if (isMounted) { setItems([]); setTotal(0); }
                    return;
                }
                const totalCountHeader = relationResponse.headers.get("x-total-count");
                const serverTotal = totalCountHeader ? parseInt(totalCountHeader, 10) : relationRows.length;
                if (isMounted) setTotal(serverTotal);

                if (rel.otherResource && rel.otherKey) {
                    let relatedIds = relationRows
                        .map((row: any) => row?.[rel.otherKey as string])
                        .filter((value: any) => value !== undefined && value !== null);

                    let effectiveRelationRows = relationRows;
                    if (rel.polymorphicType && relatedIds.length > 0) {
                        const polyMatchingIds = await filterIdsByPolymorphicType(
                            apiUrl, Array.from(new Set(relatedIds)), rel.polymorphicType, signal,
                        );
                        relatedIds = relatedIds.filter((id: any) => polyMatchingIds.has(id));
                        effectiveRelationRows = relationRows.filter((row: any) => polyMatchingIds.has(row?.[rel.otherKey as string]));
                    }

                    const filteredRelationRows = allowedRelatedIds
                        ? effectiveRelationRows.filter((row: any) => allowedRelatedIds.has(row?.[rel.otherKey as string]))
                        : effectiveRelationRows;
                    const filteredRelatedIds = allowedRelatedIds
                        ? relatedIds.filter((value: any) => allowedRelatedIds.has(value))
                        : relatedIds;
                    if (filteredRelatedIds.length === 0) {
                        if (isMounted) setItems([]);
                        return;
                    }
                    const uniqueIds = Array.from(new Set(filteredRelatedIds));

                    let relatedRecords: any[] = [];
                    const relatedResource = rel.otherResourcePath || resolveResourcePath(rel.otherResource, allModels);
                    try {
                        const bulkResponse = await authenticatedFetch(`${apiUrl}/_meta/bulk-read`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ resource: relatedResource, ids: uniqueIds }),
                            signal,
                        });
                        if (bulkResponse.ok) {
                            const bulkData = await bulkResponse.json();
                            if (Array.isArray(bulkData?.items)) {
                                relatedRecords = bulkData.items;
                            }
                        }
                    } catch (bulkError) {
                        if (bulkError instanceof DOMException && bulkError.name === "AbortError") throw bulkError;
                    }
                    if (relatedRecords.length === 0 && uniqueIds.length > 0 && !rel.polymorphicType) {
                        const batchSize = 20;
                        for (let index = 0; index < uniqueIds.length; index += batchSize) {
                            const batch = uniqueIds.slice(index, index + batchSize);
                            const batchResults = await Promise.all(batch.map(async (id) => {
                                try {
                                    const resp = await authenticatedFetch(`${apiUrl}/${relatedResource}/${id}`, { signal });
                                    if (!resp.ok) { console.warn(`Failed to load ${relatedResource} ${id}`); return null; }
                                    return resp.json();
                                } catch (fetchError) {
                                    if (fetchError instanceof DOMException && fetchError.name === "AbortError") throw fetchError;
                                    console.warn(`Failed to load ${relatedResource} ${id}`, fetchError);
                                    return null;
                                }
                            }));
                            relatedRecords.push(...batchResults.filter(Boolean));
                        }
                    }

                    const relatedById = new Map<any, any>(
                        relatedRecords.map((item) => [item?.eid ?? item?.id, item])
                    );
                    const orderedItems = filteredRelationRows
                        .map((relationRow: any) => {
                            const relatedId = relationRow?.[rel.otherKey as string];
                            const relatedRecord = relatedById.get(relatedId);
                            if (!relatedRecord) return null;
                            return {
                                id: relatedRecord?.eid ?? relatedRecord?.id ?? relatedId,
                                label: getRecordDisplayLabel(relatedRecord),
                                resource: resolveModelName(rel.otherResource, allModels),
                            };
                        })
                        .filter(Boolean) as Array<{ id: any; label: string; resource: string }>;
                    if (isMounted) setItems(orderedItems);
                    return;
                }

                const directItems = relationRows.map((row: any) => ({
                    id: row?.eid ?? row?.id,
                    label: getRecordDisplayLabel(row),
                    resource: resolveModelName(rel.resource, allModels),
                }));
                if (isMounted) setItems(directItems);
            } catch (err) {
                if (err instanceof DOMException && err.name === "AbortError") return;
                if (isMounted) {
                    setError(err instanceof Error ? err.message : "Failed to load related records");
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchItems();
        return () => {
            isMounted = false;
            controller.abort();
        };
    }, [apiUrl, record?.eid, record?.id, rel.label, rel.otherKey, rel.otherResource, rel.resource, rel.targetKey, rel.resourcePath, rel.otherResourcePath, allowedRelatedIds, allModels, page, pageSize]);

    return { items, loading, error, total };
};

export const useRelatedGalleryRecords = ({
    rel,
    record,
    allowedRelatedIds,
    allModels,
}: {
    rel: RelationDef;
    record: any;
    allowedRelatedIds?: Set<string | number>;
    allModels?: ModelDef[];
}) => {
    const apiUrl = useApiUrl();
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const recordId = record?.eid ?? record?.id;
        if (!recordId || !rel.resource || !rel.targetKey) {
            setRecords([]);
            return;
        }
        let isMounted = true;
        const fetchRecords = async () => {
            setLoading(true);
            setError(null);
            try {
                const pageSize = 500;
                let start = 0;
                let relationRows: any[] = [];
                while (true) {
                    const params = new URLSearchParams();
                    params.set("_start", String(start));
                    params.set("_end", String(start + pageSize));
                    params.append(rel.targetKey, String(recordId));
                    const relationResource = rel.resourcePath || resolveResourcePath(rel.resource, allModels);
                    const relationResponse = await authenticatedFetch(`${apiUrl}/${relationResource}?${params.toString()}`);
                    if (!relationResponse.ok) {
                        throw new Error(`Failed to load ${rel.label} relations`);
                    }
                    const pageRows = await relationResponse.json();
                    if (!Array.isArray(pageRows)) break;
                    relationRows = relationRows.concat(pageRows);
                    if (relationRows.length >= GALLERY_RELATION_MAX_ITEMS) {
                        relationRows = relationRows.slice(0, GALLERY_RELATION_MAX_ITEMS);
                        break;
                    }
                    if (pageRows.length < pageSize) break;
                    start += pageSize;
                }

                if (rel.otherResource && rel.otherKey) {
                    let relatedIds = relationRows
                        .map((row: any) => row?.[rel.otherKey as string])
                        .filter((value: any) => value !== undefined && value !== null);

                    if (rel.polymorphicType && relatedIds.length > 0) {
                        const polyMatchingIds = await filterIdsByPolymorphicType(
                            apiUrl, Array.from(new Set(relatedIds)), rel.polymorphicType,
                        );
                        relatedIds = relatedIds.filter((id: any) => polyMatchingIds.has(id));
                        relationRows = relationRows.filter((row: any) => polyMatchingIds.has(row?.[rel.otherKey as string]));
                    }

                    const filteredRelationRows = allowedRelatedIds
                        ? relationRows.filter((row: any) => allowedRelatedIds.has(row?.[rel.otherKey as string]))
                        : relationRows;
                    const filteredRelatedIds = allowedRelatedIds
                        ? relatedIds.filter((value: any) => allowedRelatedIds.has(value))
                        : relatedIds;
                    if (filteredRelatedIds.length === 0) {
                        if (isMounted) setRecords([]);
                        return;
                    }
                    const uniqueIds = Array.from(new Set(filteredRelatedIds));
                    const relatedRecords: any[] = [];
                    const batchSize = 20;
                    for (let index = 0; index < uniqueIds.length; index += batchSize) {
                        const batch = uniqueIds.slice(index, index + batchSize);
                        const batchResults = await Promise.all(batch.map(async (id) => {
                            try {
                                const relatedResource = rel.otherResourcePath || resolveResourcePath(rel.otherResource, allModels);
                                const relatedResponse = await authenticatedFetch(`${apiUrl}/${relatedResource}/${id}`);
                                if (!relatedResponse.ok) return null;
                                return relatedResponse.json();
                            } catch {
                                return null;
                            }
                        }));
                        relatedRecords.push(...batchResults.filter(Boolean));
                    }
                    const relatedById = new Map<any, any>(
                        relatedRecords.map((item) => [item?.eid ?? item?.id, item])
                    );
                    const ordered = filteredRelationRows
                        .map((relationRow: any) => {
                            const relatedId = relationRow?.[rel.otherKey as string];
                            return relatedById.get(relatedId) || null;
                        })
                        .filter(Boolean);
                    if (isMounted) setRecords(ordered);
                    return;
                }

                if (isMounted) setRecords(relationRows);
            } catch (err) {
                if (isMounted) {
                    setError(err instanceof Error ? err.message : "Failed to load related records");
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchRecords();
        return () => {
            isMounted = false;
        };
    }, [apiUrl, record?.eid, record?.id, rel.label, rel.otherKey, rel.otherResource, rel.resource, rel.targetKey, allowedRelatedIds, allModels]);

    return { records, loading, error };
};
