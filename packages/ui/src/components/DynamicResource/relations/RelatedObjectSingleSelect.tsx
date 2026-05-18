import React, { useState, useEffect, useCallback } from "react";
import { Select, Spin, message } from "antd";
import { useApiUrl } from "@refinedev/core";
import { useSelect } from "@refinedev/antd";
import { authenticatedFetch } from "../../../utils/authenticatedFetch";
import type { ModelDef, RelationDef } from "../types";
import { resolveResourcePath, getRecordId } from "../utils/model";

export const RelatedObjectSingleSelect: React.FC<{
    rel: RelationDef;
    record: any;
    allModels?: ModelDef[];
    required?: boolean;
}> = ({ rel, record, allModels, required }) => {
    const apiUrl = useApiUrl();
    const [currentLinkRow, setCurrentLinkRow] = useState<any | null>(null);
    const [currentValue, setCurrentValue] = useState<number | null>(null);
    const [loadingCurrent, setLoadingCurrent] = useState(true);
    const [saving, setSaving] = useState(false);

    const relatedResource = rel.otherResourcePath || resolveResourcePath(rel.otherResource || "", allModels);
    const linkResource = rel.resourcePath || resolveResourcePath(rel.resource, allModels);
    const relatedModel = allModels?.find((m) => m.name === rel.otherResource);
    const relatedPkField = relatedModel?.fields.find((f) => f.isPk)?.key ?? "id";

    useEffect(() => {
        const recordId = getRecordId(record);
        if (!recordId || !rel.targetKey || !rel.otherKey) {
            setLoadingCurrent(false);
            return;
        }
        let isMounted = true;
        const load = async () => {
            setLoadingCurrent(true);
            try {
                const params = new URLSearchParams();
                params.set("_start", "0");
                params.set("_end", "2");
                params.set(rel.targetKey, String(recordId));
                const resp = await authenticatedFetch(`${apiUrl}/${linkResource}?${params.toString()}`);
                if (!resp.ok) return;
                const rows = await resp.json();
                if (!isMounted) return;
                if (Array.isArray(rows) && rows.length > 0) {
                    const row = rows[0];
                    setCurrentLinkRow(row);
                    setCurrentValue(row[rel.otherKey!] ?? null);
                } else {
                    setCurrentLinkRow(null);
                    setCurrentValue(null);
                }
            } finally {
                if (isMounted) setLoadingCurrent(false);
            }
        };
        load();
        return () => { isMounted = false; };
    }, [apiUrl, getRecordId(record), rel.targetKey, rel.otherKey, linkResource]);

    const { selectProps } = useSelect({
        resource: relatedResource,
        optionLabel: "_label",
        optionValue: relatedPkField,
        filters: [],
        pagination: { current: 1, pageSize: 2000, mode: "server" },
    });

    const handleChange = useCallback(async (newValue: any) => {
        const recordId = getRecordId(record);
        if (!recordId || !rel.otherKey) return;
        setSaving(true);
        try {
            if (currentLinkRow) {
                const linkId = getRecordId(currentLinkRow);
                const del = await authenticatedFetch(`${apiUrl}/${linkResource}/${linkId}`, { method: "DELETE" });
                if (!del.ok) throw new Error("Failed to remove existing relation");
            }
            if (newValue !== null && newValue !== undefined) {
                const payload: Record<string, any> = {};
                payload[rel.targetKey] = recordId;
                payload[rel.otherKey!] = newValue;
                const create = await authenticatedFetch(`${apiUrl}/${linkResource}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                if (!create.ok) throw new Error("Failed to create relation");
                const newRow = await create.json();
                setCurrentLinkRow(newRow);
            } else {
                setCurrentLinkRow(null);
            }
            setCurrentValue(newValue ?? null);
            message.success("Saved.");
        } catch (err) {
            message.error(err instanceof Error ? err.message : "Failed to update relation");
        } finally {
            setSaving(false);
        }
    }, [apiUrl, currentLinkRow, linkResource, getRecordId(record), rel.otherKey, rel.targetKey]);

    if (loadingCurrent) return <Spin size="small" />;

    return (
        <Select
            {...selectProps}
            value={currentValue ?? undefined}
            onChange={handleChange}
            loading={saving}
            allowClear={!required}
            showSearch
            optionFilterProp="label"
            style={{ width: "100%" }}
            placeholder={`Select ${rel.label}...`}
        />
    );
};
