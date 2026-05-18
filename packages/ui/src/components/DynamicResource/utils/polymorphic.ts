import type { ModelDef, RelationDef } from "../types";
import { authenticatedFetch } from "../../../utils/authenticatedFetch";
import { resolveResourcePath, resolveModelByEntityType, matchesPolymorphicType } from "./model";

export const INLINE_RELATION_MAX_ITEMS = 80;
export const GALLERY_RELATION_MAX_ITEMS = 120;
export const POLYMORPHIC_RELATION_MAX_ROWS = 120;

export const filterIdsByPolymorphicType = async (
    apiUrl: string,
    ids: Array<string | number>,
    polymorphicType: string,
    signal?: AbortSignal,
): Promise<Set<string | number>> => {
    if (ids.length === 0) return new Set();
    try {
        const resp = await authenticatedFetch(`${apiUrl}/_meta/entity-types`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
            signal,
        });
        if (resp.ok) {
            const data = await resp.json();
            const types: Record<string, string> = data?.types || {};
            const target = polymorphicType.toLowerCase();
            const matching = new Set<string | number>();
            ids.forEach((id) => {
                const entityType = types[String(id)];
                if (entityType && entityType.toLowerCase() === target) {
                    matching.add(id);
                }
            });
            return matching;
        }
    } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") throw err;
    }
    return new Set(ids);
};

export const fetchPolymorphicGroups = async ({
    apiUrl,
    rel,
    recordId,
    referenceResource,
    allModels,
}: {
    apiUrl: string;
    rel: RelationDef;
    recordId: string | number;
    referenceResource: string;
    allModels: ModelDef[];
}) => {
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
        if (relationRows.length >= POLYMORPHIC_RELATION_MAX_ROWS) {
            relationRows = relationRows.slice(0, POLYMORPHIC_RELATION_MAX_ROWS);
            break;
        }
        if (pageRows.length < pageSize) break;
        start += pageSize;
    }
    const relatedIds = relationRows
        .map((row: any) => row?.[rel.otherKey as string])
        .filter((value: any) => value !== undefined && value !== null);
    if (relatedIds.length === 0) {
        return { groups: new Map<string, Set<string | number>>(), unresolved: [] as Array<string | number> };
    }
    const uniqueIds = Array.from(new Set(relatedIds));
    const referenceRecords: any[] = [];
    const batchSize = 20;
    for (let index = 0; index < uniqueIds.length; index += batchSize) {
        const batch = uniqueIds.slice(index, index + batchSize);
        const batchResults = await Promise.all(batch.map(async (id) => {
            try {
                const response = await authenticatedFetch(`${apiUrl}/${referenceResource}/${id}`);
                if (!response.ok) return null;
                return response.json();
            } catch {
                return null;
            }
        }));
        referenceRecords.push(...batchResults.filter(Boolean));
    }
    const typeById = new Map<any, string>(
        referenceRecords
            .filter((item) => item?.type)
            .map((item) => [item?.eid ?? item?.id, String(item.type)])
    );
    const groups = new Map<string, Set<string | number>>();
    const unresolved: Array<string | number> = [];
    const labelsById = new Map<string | number, string>();
    referenceRecords.forEach((item) => {
        const id = item?.eid ?? item?.id;
        if (id === undefined || id === null) return;
        const label = item?._label || item?.name || item?.description;
        if (label) labelsById.set(id, String(label));
    });
    uniqueIds.forEach((id) => {
        const typeName = typeById.get(id);
        const targetModel = resolveModelByEntityType(allModels, typeName);
        if (!targetModel) {
            unresolved.push(id);
            return;
        }
        if (!matchesPolymorphicType(rel, typeName)) return;
        const existing = groups.get(targetModel.name) || new Set<string | number>();
        existing.add(id);
        groups.set(targetModel.name, existing);
    });
    return { groups, unresolved, labelsById };
};
