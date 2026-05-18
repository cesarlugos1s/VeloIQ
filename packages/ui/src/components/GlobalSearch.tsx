import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { AutoComplete, Input, Typography, Space, Spin } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useMenu } from "@refinedev/core";
import { useAllModels } from "../contexts/AllModelsContext";
import { authenticatedFetch } from "../utils/authenticatedFetch";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

const API_URL = "/api";

interface SearchResult {
    value: string;
    label: React.ReactNode;
    key: string;
}

interface SearchGroup {
    label: React.ReactNode;
    options: SearchResult[];
}

interface SearchConfig {
    entity_types: string[];
    attribute_types: string[];
}

interface FlatResource {
    name: string;
    label: string;
    moduleLabel: string;
    listPath: string;
}

const flattenMenuItems = (items: any[], parentLabel = ""): FlatResource[] => {
    const result: FlatResource[] = [];
    for (const item of items) {
        if (item.children?.length) {
            result.push(...flattenMenuItems(item.children, item.label || item.name || ""));
        } else if (item.route && !item.meta?.hide) {
            result.push({
                name: item.name,
                label: item.label || item.name,
                moduleLabel: parentLabel,
                listPath: item.route,
            });
        }
    }
    return result;
};

export const GlobalSearch: React.FC = () => {
    const { menuItems } = useMenu();
    const allSystemModels = useAllModels();
    const navigate = useNavigate();
    const [searchText, setSearchText] = useState("");
    const [backendResults, setBackendResults] = useState<SearchGroup[]>([]);
    const [searching, setSearching] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const [searchConfig, setSearchConfig] = useState<SearchConfig | null>(null);

    // Fetch search config (entity types + attribute types) once
    useEffect(() => {
        authenticatedFetch(`${API_URL}/config/search`)
            .then((r) => { if (!r.ok) throw new Error("unavailable"); return r.json(); })
            .then((data: SearchConfig) => setSearchConfig(data))
            .catch(() => {});
    }, []);

    // Build searchable resource entries from the Refine menu tree
    const searchableResources = useMemo(() => flattenMenuItems(menuItems), [menuItems]);

    // Get searchable models using config/entity_types_classification CSVs.
    const searchableModels = useMemo(() => {
        if (!searchConfig) return [];

        const entityTypesLower = searchConfig.entity_types.map((e) => e.toLowerCase());
        const preferredFields = searchConfig.attribute_types;
        const useAllStringFields = preferredFields.length === 0;

        return allSystemModels
            .filter((m: any) => entityTypesLower.includes((m.name || "").toLowerCase()))
            .map((m: any) => {
                const stringFields = (m.fields || []).filter((f: any) => f.type === "string");

                // When no fields are configured, search all string fields of the model.
                if (useAllStringFields) {
                    return {
                        name: m.name,
                        label: m.label || m.name,
                        resource: m.resource || m.name,
                        searchFields: stringFields.map((f: any) => f.key),
                    };
                }

                const matched = new Set<string>();

                // 1st pass: exact key matches
                for (const pref of preferredFields) {
                    if (stringFields.some((f: any) => f.key === pref)) matched.add(pref);
                }
                // 2nd pass: suffix matches (e.g. "description" matches "hierarchy_description")
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

    // Client-side: filter resources/modules by query
    const resourceResults = useMemo((): SearchGroup[] => {
        const q = searchText.toLowerCase().trim();
        if (!q) return [];
        const matches = searchableResources.filter(
            (r) =>
                r.label.toLowerCase().includes(q) ||
                r.name.toLowerCase().includes(q) ||
                r.moduleLabel.toLowerCase().includes(q)
        );
        if (matches.length === 0) return [];
        return [
            {
                label: (
                    <Typography.Text type="secondary" strong style={{ fontSize: 11 }}>
                        {_("Go to")}
                    </Typography.Text>
                ),
                options: matches.slice(0, 10).map((r) => ({
                    value: `nav:${r.listPath}`,
                    key: `nav-${r.name}`,
                    label: (
                        <Space size={4}>
                            <Typography.Text>{r.label}</Typography.Text>
                            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                                {r.moduleLabel}
                            </Typography.Text>
                        </Space>
                    ),
                })),
            },
        ];
    }, [searchText, searchableResources]);

    // Backend search with debounce
    const doBackendSearch = useCallback(
        (query: string) => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (abortRef.current) abortRef.current.abort();

            const q = query.trim();
            if (q.length < 2) {
                setBackendResults([]);
                setSearching(false);
                return;
            }

            setSearching(true);
            debounceRef.current = setTimeout(async () => {
                const controller = new AbortController();
                abortRef.current = controller;

                const modelsToSearch = searchableModels.slice(0, 8);
                const results: SearchGroup[] = [];

                try {
                    const fetches = modelsToSearch.map(async (m) => {
                        try {
                            const fieldFetches = m.searchFields.map(async (field: string) => {
                                const url = `${API_URL}/${m.resource}?_start=0&_end=5&${field}__ilike=${encodeURIComponent(q)}`;
                                const resp = await authenticatedFetch(url, { signal: controller.signal });
                                if (!resp.ok) return [];
                                const data = await resp.json();
                                return Array.isArray(data) ? data : [];
                            });
                            const allResults = (await Promise.all(fieldFetches)).flat();
                            const seen = new Set<number>();
                            const unique = allResults.filter((r: any) => {
                                const id = r.eid ?? r.id;
                                if (seen.has(id)) return false;
                                seen.add(id);
                                return true;
                            });
                            if (unique.length === 0) return null;
                            return { model: m, records: unique };
                        } catch {
                            return null;
                        }
                    });

                    const responses = await Promise.all(fetches);
                    for (const resp of responses) {
                        if (!resp) continue;
                        results.push({
                            label: (
                                <Typography.Text type="secondary" strong style={{ fontSize: 11 }}>
                                    {resp.model.label}
                                </Typography.Text>
                            ),
                            options: resp.records.slice(0, 5).map((record: any) => {
                                const id = record.eid ?? record.id;
                                const label = record._label || `#${id}`;
                                return {
                                    value: `record:/${resp.model.resource}/show/${id}`,
                                    key: `record-${resp.model.name}-${id}`,
                                    label: (
                                        <Typography.Text>{String(label)}</Typography.Text>
                                    ),
                                };
                            }),
                        });
                    }
                } catch {
                    // aborted or network error
                }

                if (!controller.signal.aborted) {
                    setBackendResults(results);
                    setSearching(false);
                }
            }, 300);
        },
        [searchableModels]
    );

    const onSearch = useCallback(
        (value: string) => {
            setSearchText(value);
            doBackendSearch(value);
        },
        [doBackendSearch]
    );

    const onSelect = useCallback(
        (value: string) => {
            const path = value.replace(/^(nav:|record:)/, "");
            navigate(path);
            setSearchText("");
            setBackendResults([]);
        },
        [navigate]
    );

    const options = useMemo(() => {
        const groups: SearchGroup[] = [...resourceResults, ...backendResults];
        return groups;
    }, [resourceResults, backendResults]);

    const [focused, setFocused] = useState(false);
    const inputRef = useRef<any>(null);

    // Listen for Ctrl+K to focus the search field
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    return (
        <div style={{ position: "relative", width: focused ? 320 : 56, transition: "width 0.25s ease" }}>
            <AutoComplete
                options={options}
                onSearch={onSearch}
                onSelect={(value) => { onSelect(value); setFocused(false); inputRef.current?.blur(); }}
                value={searchText}
                style={{ width: focused ? 320 : 56 }}
                popupMatchSelectWidth={400}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
            >
                <Input
                    ref={inputRef}
                    placeholder={focused ? `${_("Search")}...` : ""}
                    prefix={searching ? <Spin size="small" /> : <SearchOutlined />}
                    suffix={
                        !focused ? (
                            <Typography.Text type="secondary" style={{ fontSize: 9 }}>
                                ⌃K
                            </Typography.Text>
                        ) : undefined
                    }
                    allowClear
                    size="small"
                    style={!focused ? { paddingInline: 2 } : undefined}
                />
            </AutoComplete>
        </div>
    );
};
