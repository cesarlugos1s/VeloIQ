import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useAllModels } from "../contexts/AllModelsContext";
import { authenticatedFetch } from "../utils/authenticatedFetch";

const API_URL = "/api";

interface SearchConfig {
    entity_types: string[];
    attribute_types: string[];
}

export interface RecordResult {
    id: number | string;
    label: string;
}

export interface ModelSearchResult {
    modelName: string;
    modelLabel: string;
    resource: string;
    records: RecordResult[];
}

export interface UseRecordSearchReturn {
    results: ModelSearchResult[];
    searching: boolean;
    search: (query: string) => void;
    clear: () => void;
}

export function useRecordSearch(): UseRecordSearchReturn {
    const allSystemModels = useAllModels();
    const [searchConfig, setSearchConfig] = useState<SearchConfig | null>(null);
    const [results, setResults] = useState<ModelSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        authenticatedFetch(`${API_URL}/config/search`)
            .then((r) => { if (!r.ok) throw new Error("unavailable"); return r.json(); })
            .then((d: SearchConfig) => setSearchConfig(d))
            .catch(() => {});
    }, []);

    const searchableModels = useMemo(() => {
        if (!searchConfig) return [];
        const entityTypesLower = searchConfig.entity_types.map((e) => e.toLowerCase());
        const preferredFields = searchConfig.attribute_types;
        const useAllStringFields = preferredFields.length === 0;

        return allSystemModels
            .filter((m: any) => entityTypesLower.includes((m.name || "").toLowerCase()))
            .map((m: any) => {
                const stringFields = (m.fields || []).filter((f: any) => f.type === "string");
                if (useAllStringFields) {
                    return {
                        name: m.name,
                        label: m.label || m.name,
                        resource: m.resource || m.name,
                        searchFields: stringFields.map((f: any) => f.key),
                    };
                }
                const matched = new Set<string>();
                for (const pref of preferredFields) {
                    if (stringFields.some((f: any) => f.key === pref)) matched.add(pref);
                }
                for (const pref of preferredFields) {
                    const suffix = stringFields.find(
                        (f: any) => !matched.has(f.key) && f.key !== pref && f.key.endsWith(`_${pref}`)
                    );
                    if (suffix) matched.add(suffix.key);
                }
                return {
                    name: m.name,
                    label: m.label || m.name,
                    resource: m.resource || m.name,
                    searchFields: Array.from(matched),
                };
            })
            .filter((m) => m.searchFields.length > 0);
    }, [allSystemModels, searchConfig]);

    const search = useCallback(
        (query: string) => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (abortRef.current) abortRef.current.abort();

            const q = query.trim();
            if (q.length < 2) {
                setResults([]);
                setSearching(false);
                return;
            }

            setSearching(true);
            debounceRef.current = setTimeout(async () => {
                const controller = new AbortController();
                abortRef.current = controller;
                const newResults: ModelSearchResult[] = [];

                try {
                    const fetches = searchableModels.slice(0, 8).map(async (m) => {
                        try {
                            const fieldFetches = m.searchFields.map(async (field: string) => {
                                const url = `${API_URL}/${m.resource}?_start=0&_end=5&${field}__ilike=${encodeURIComponent(q)}`;
                                const resp = await authenticatedFetch(url, { signal: controller.signal });
                                if (!resp.ok) return [];
                                const data = await resp.json();
                                return Array.isArray(data) ? data : [];
                            });
                            const allRecords = (await Promise.all(fieldFetches)).flat();
                            const seen = new Set<number | string>();
                            const unique = allRecords.filter((r: any) => {
                                const id = r.eid ?? r.id;
                                if (seen.has(id)) return false;
                                seen.add(id);
                                return true;
                            });
                            if (unique.length === 0) return null;
                            return {
                                modelName: m.name,
                                modelLabel: m.label,
                                resource: m.resource,
                                records: unique.slice(0, 5).map((r: any) => ({
                                    id: r.eid ?? r.id,
                                    label: String(r._label || `#${r.eid ?? r.id}`),
                                })),
                            } satisfies ModelSearchResult;
                        } catch {
                            return null;
                        }
                    });

                    const responses = await Promise.all(fetches);
                    for (const r of responses) {
                        if (r) newResults.push(r);
                    }
                } catch {
                    // aborted or network error
                }

                if (!controller.signal.aborted) {
                    setResults(newResults);
                    setSearching(false);
                }
            }, 300);
        },
        [searchableModels]
    );

    const clear = useCallback(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (abortRef.current) abortRef.current.abort();
        setResults([]);
        setSearching(false);
    }, []);

    return { results, searching, search, clear };
}
