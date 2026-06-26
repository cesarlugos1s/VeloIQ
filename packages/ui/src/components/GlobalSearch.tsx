import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { AutoComplete, Input, Typography, Space, Spin, theme } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useMenu } from "@refinedev/core";
import { useRecordSearch } from "../hooks/useRecordSearch";
import type { ModelSearchResult } from "../hooks/useRecordSearch";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

interface SearchResult {
    value: string;
    label: React.ReactNode;
    key: string;
}

interface SearchGroup {
    label: React.ReactNode;
    options: SearchResult[];
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
    const navigate = useNavigate();
    const [searchText, setSearchText] = useState("");
    const { results: backendResults, searching, search, clear } = useRecordSearch();
    const { token } = theme.useToken();

    const searchableResources = useMemo(() => flattenMenuItems(menuItems), [menuItems]);

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

    const backendGroups = useMemo((): SearchGroup[] =>
        backendResults.map((result: ModelSearchResult) => ({
            label: (
                <Typography.Text type="secondary" strong style={{ fontSize: 11 }}>
                    {result.modelLabel}
                </Typography.Text>
            ),
            options: result.records.map((record) => ({
                value: `record:/${result.resource}/show/${record.id}`,
                key: `record-${result.modelName}-${record.id}`,
                label: <Typography.Text>{record.label}</Typography.Text>,
            })),
        })),
        [backendResults]
    );

    const onSearch = useCallback(
        (value: string) => {
            setSearchText(value);
            search(value);
        },
        [search]
    );

    const onSelect = useCallback(
        (value: string) => {
            const path = value.replace(/^(nav:|record:)/, "");
            navigate(path);
            setSearchText("");
            clear();
        },
        [navigate, clear]
    );

    const options = useMemo(
        () => [...resourceResults, ...backendGroups],
        [resourceResults, backendGroups]
    );

    const [focused, setFocused] = useState(false);
    const inputRef = useRef<any>(null);

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
                    style={!focused ? { paddingInline: 2, color: token.colorText } : { color: token.colorText }}
                />
            </AutoComplete>
        </div>
    );
};
