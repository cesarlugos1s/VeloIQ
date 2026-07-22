import React from "react";
import { useOne } from "@refinedev/core";
import { Spin, Tooltip } from "antd";
import type { ModelDef } from "../types";
import { getListViewFields, hasReferenceModel, resolveResourcePath } from "../utils/model";
import { ReferenceField } from "../fields/ReferenceField";

export const RelatedObjectPreview: React.FC<{ resource: string; id: number; model?: ModelDef; allModels?: ModelDef[]; fallbackLabel?: React.ReactNode }> = ({ resource, id, model, allModels, fallbackLabel }) => {
    const { data, isLoading } = useOne({ resource, id, queryOptions: { enabled: !!id } });
    const record = data?.data;
    const label = record?._label || record?.name || record?.description || id;
    const previewFields = model ? getListViewFields(model) : [];
    if (isLoading) return <Spin size="small" />;
    if (!record || previewFields.length === 0) return <span>{fallbackLabel ?? label}</span>;
    return (
        <Tooltip
            placement="right"
            overlayStyle={{ maxWidth: 720 }}
            overlayInnerStyle={{ width: 720 }}
            title={
                <div style={{ width: "100%" }}>
                    {previewFields.map((field) => (
                        <div key={field.key} style={{ display: "grid", gridTemplateColumns: "180px 1fr", columnGap: 8 }}>
                            <span style={{ fontWeight: 500 }}>{field.label}</span>
                            <span style={{ whiteSpace: "normal", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                                {field.reference && record?.[field.key] && hasReferenceModel(field.reference, allModels) ? (
                                    <ReferenceField id={record[field.key]} resource={resolveResourcePath(field.referencePath || field.reference, allModels)} />
                                ) : field.options && record?.[field.key] ? (
                                    field.options.find((option) => option && option.value === record[field.key])?.label || record[field.key]
                                ) : (
                                    record?.[field.key] ?? "-"
                                )}
                            </span>
                        </div>
                    ))}
                </div>
            }
        >
            <span>{label}</span>
        </Tooltip>
    );
};
