import React, { useCallback, useEffect, useState } from "react";
import { Select, Spin, Alert, message } from "antd";
import { useApiUrl } from "@refinedev/core";
import { authenticatedFetch } from "../../../utils/authenticatedFetch";
import type { ModelDef, RelationDef } from "../types";
import { getRecordDisplayLabel, resolveResourcePath } from "../utils/model";
import { useRelatedInlineItems } from "./hooks";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export const RelatedObjectsEditableCsv: React.FC<{
    rel: RelationDef;
    record: any;
    allModels?: ModelDef[];
}> = ({ rel, record, allModels }) => {
    const apiUrl = useApiUrl();
    const { items: fetchedItems, loading, error } = useRelatedInlineItems({ rel, record, allModels });
    const [saving, setSaving] = useState(false);
    const [allOptions, setAllOptions] = useState<Array<{ value: number; label: string }>>([]);
    const [optionsLoading, setOptionsLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [baselineIds, setBaselineIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        const ids = fetchedItems.map((item) => Number(item.id));
        setSelectedIds(ids);
        setBaselineIds(new Set(ids));
    }, [fetchedItems]);

    useEffect(() => {
        if (!rel.otherResource) return;
        let cancelled = false;
        const fetchOptions = async () => {
            setOptionsLoading(true);
            try {
                const resource = rel.otherResourcePath || resolveResourcePath(rel.otherResource!, allModels);
                const params = new URLSearchParams({ _start: "0", _end: "50000" });
                const response = await authenticatedFetch(`${apiUrl}/${resource}?${params.toString()}`);
                if (!response.ok) throw new Error("Failed to load options");
                const data = await response.json();
                if (!cancelled && Array.isArray(data)) {
                    setAllOptions(data.map((item: any) => ({
                        value: item.eid ?? item.id,
                        label: getRecordDisplayLabel(item),
                    })));
                }
            } catch {
                // silently ignore
            } finally {
                if (!cancelled) setOptionsLoading(false);
            }
        };
        fetchOptions();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiUrl, rel.otherResource]);

    const handleChange = useCallback(async (newIds: number[]) => {
        if (!rel.otherKey || !rel.targetKey) return;
        const recordId = record?.eid ?? record?.id;
        if (recordId === undefined || recordId === null) return;

        const newSet = new Set(newIds);
        const toAdd = newIds.filter((id) => !baselineIds.has(id));
        const toRemove = [...baselineIds].filter((id) => !newSet.has(id));
        setSelectedIds(newIds);
        setSaving(true);
        const errors: string[] = [];

        try {
            const relationResource = rel.resourcePath || resolveResourcePath(rel.resource, allModels);
            for (const id of toRemove) {
                const deleteId = rel.targetKey === "eid_from" ? `${recordId}:${id}` : `${id}:${recordId}`;
                const resp = await authenticatedFetch(`${apiUrl}/${relationResource}/${encodeURIComponent(deleteId)}`, { method: "DELETE" });
                if (!resp.ok) errors.push(`Failed to remove (${resp.status})`);
            }
            for (const id of toAdd) {
                const payload = { [rel.targetKey]: recordId, [rel.otherKey]: id };
                const resp = await authenticatedFetch(`${apiUrl}/${relationResource}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (!resp.ok) errors.push(`Failed to add (${resp.status})`);
            }
            if (errors.length === 0) {
                setBaselineIds(newSet);
            } else {
                message.error(errors.join("; "));
                setSelectedIds([...baselineIds]);
            }
        } finally {
            setSaving(false);
        }
    }, [apiUrl, rel, record, allModels, baselineIds]);

    if (loading) return <Spin size="small" />;
    if (error) return <Alert type="error" message={error} showIcon />;
    if (!rel.otherResource || !rel.otherKey) {
        return <Alert type="warning" message={_("editable-csv requires a many-to-many relation")} showIcon />;
    }

    return (
        <Select
            mode="multiple"
            value={selectedIds}
            onChange={handleChange}
            options={allOptions}
            loading={optionsLoading || saving}
            style={{ width: "100%" }}
            placeholder={`${_("Select")} ${_(rel.label)}...`}
            optionFilterProp="label"
            showSearch
            allowClear
        />
    );
};
