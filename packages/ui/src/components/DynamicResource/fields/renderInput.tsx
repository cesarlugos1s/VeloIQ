import React, { lazy, Suspense, useState } from "react";
import { Input, Select, Checkbox, DatePicker, InputNumber, TimePicker, Skeleton, Tabs, Alert, Rate } from "antd";
import type { FieldDef, ModelDef } from "../types";
import { hasReferenceModel, isFileModel, resolveResourcePath } from "../utils/model";
import { applyRelationFieldOverrides, normalizeFieldViewType } from "../utils/viewConfig";
import { RelationSelect } from "./RelationSelect";
import { FileUploadInput } from "./FileUploadInput";
import { AsyncSelectInput } from "./AsyncSelectInput";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

const ReactMarkdown = lazy(() => import("react-markdown").then((m) => ({ default: m.default })));

const MarkdownEditor: React.FC<{ value?: string; onChange?: (v: string) => void }> = ({ value = "", onChange }) => {
    const [activeTab, setActiveTab] = useState<string>("edit");
    return (
        <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            size="small"
            style={{ marginBottom: 0 }}
            items={[
                {
                    key: "edit",
                    label: _("Edit"),
                    children: (
                        <Input.TextArea
                            value={value}
                            onChange={(e) => onChange?.(e.target.value)}
                            autoSize={{ minRows: 3, maxRows: 18 }}
                            style={{ resize: "vertical" }}
                        />
                    ),
                },
                {
                    key: "preview",
                    label: _("Preview"),
                    children: (
                        <div style={{ minHeight: 60, padding: "4px 0" }}>
                            <Suspense fallback={<Skeleton.Input active size="small" style={{ width: 200 }} />}>
                                <ReactMarkdown>{value}</ReactMarkdown>
                            </Suspense>
                        </div>
                    ),
                },
            ]}
        />
    );
};

const JsonEditor: React.FC<{ value?: string; onChange?: (v: string) => void }> = ({ value = "", onChange }) => {
    const [error, setError] = useState<string | null>(null);
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const raw = e.target.value;
        onChange?.(raw);
        if (!raw.trim()) { setError(null); return; }
        try { JSON.parse(raw); setError(null); } catch (ex: any) { setError(ex.message); }
    };
    return (
        <div>
            <Input.TextArea
                value={value}
                onChange={handleChange}
                autoSize={{ minRows: 3, maxRows: 18 }}
                style={{ resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
            />
            {error && <Alert type="error" message={error} showIcon style={{ marginTop: 4, padding: "2px 8px", fontSize: 11 }} />}
        </div>
    );
};

const renderEditableFieldViewType = (token: string, value: any, onChange: ((v: any) => void) | undefined): React.ReactNode => {
    const str = value === null || value === undefined ? "" : String(value);
    switch (token) {
        case "editable-password":
            return <Input.Password value={str} onChange={(e) => onChange?.(e.target.value)} />;
        case "editable-textarea":
            return <Input.TextArea value={str} onChange={(e) => onChange?.(e.target.value)} autoSize={{ minRows: 3, maxRows: 18 }} style={{ resize: "vertical" }} />;
        case "editable-markdown":
            return <MarkdownEditor value={str} onChange={onChange} />;
        case "editable-json":
            return <JsonEditor value={str} onChange={onChange} />;
        case "editable-url":
            return (
                <div>
                    <Input value={str} onChange={(e) => onChange?.(e.target.value)} placeholder="https://..." />
                    {str && <div style={{ marginTop: 2, fontSize: 11 }}><a href={str} target="_blank" rel="noopener noreferrer">{str}</a></div>}
                </div>
            );
        case "editable-email":
            return <Input type="email" value={str} onChange={(e) => onChange?.(e.target.value)} placeholder="user@example.com" />;
        case "editable-currency": {
            const num = value === null || value === undefined ? undefined : Number(value);
            return <InputNumber style={{ width: "100%" }} value={isNaN(num as number) ? undefined : num} onChange={onChange} addonBefore="$" precision={2} step={0.01} />;
        }
        case "editable-percentage": {
            const num = value === null || value === undefined ? undefined : Number(value);
            return <InputNumber style={{ width: "100%" }} value={isNaN(num as number) ? undefined : num} onChange={onChange} addonAfter="%" step={0.1} />;
        }
        case "editable-progress": {
            const num = value === null || value === undefined ? undefined : Number(value);
            return <InputNumber style={{ width: "100%" }} value={isNaN(num as number) ? undefined : num} onChange={onChange} min={0} max={100} addonAfter="%" precision={0} />;
        }
        case "editable-rating":
            return <Rate value={Number(value) || 0} onChange={onChange} />;
        case "editable-duration": {
            const num = value === null || value === undefined ? undefined : Number(value);
            return <InputNumber style={{ width: "100%" }} value={isNaN(num as number) ? undefined : num} onChange={onChange} min={0} precision={0} addonAfter="s" />;
        }
        case "editable-phone":
            return <Input type="tel" value={str} onChange={(e) => onChange?.(e.target.value)} placeholder="+1 555 000 0000" />;
        case "editable-color":
            return (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                        type="color"
                        value={str || "#000000"}
                        onChange={(e) => onChange?.(e.target.value)}
                        style={{ width: 36, height: 28, border: "1px solid #d9d9d9", borderRadius: 4, padding: 2, cursor: "pointer", flexShrink: 0 }}
                    />
                    <Input value={str} onChange={(e) => onChange?.(e.target.value)} placeholder="#000000" style={{ flex: 1 }} />
                </div>
            );
        case "editable-code":
            return (
                <Input.TextArea
                    value={str}
                    onChange={(e) => onChange?.(e.target.value)}
                    autoSize={{ minRows: 3, maxRows: 18 }}
                    style={{ resize: "vertical", fontFamily: "monospace", fontSize: 12 }}
                />
            );
        case "editable-image-url":
            return (
                <div>
                    <Input value={str} onChange={(e) => onChange?.(e.target.value)} placeholder="https://..." />
                    {str && (
                        <img
                            src={str}
                            alt=""
                            style={{ marginTop: 4, maxWidth: "100%", maxHeight: 120, objectFit: "contain", borderRadius: 4, display: "block" }}
                        />
                    )}
                </div>
            );
        default:
            return null;
    }
};

export const renderInput = (field: FieldDef, allModels?: ModelDef[], model?: ModelDef, currentId?: string | number) => {
    const resolvedField = model && allModels
        ? applyRelationFieldOverrides(model, allModels).find((item) => item.key === field.key) || field
        : field;
    if (resolvedField.key === "data" && isFileModel(model)) {
        return <FileUploadInput />;
    }
    const isNlSentenceField = resolvedField.key === "nl_sentence" || resolvedField.key === "nl_asks_sentence";
    const sentenceFieldHelper = _(resolvedField.key);
    if (isNlSentenceField) {
        return (
            <Input.TextArea
                autoSize={{ minRows: 3, maxRows: 18 }}
                style={{ resize: "vertical", background: "#f3f6f9" }}
                placeholder={sentenceFieldHelper}
            />
        );
    }
    if (resolvedField.readOnly) {
        return <Input disabled />;
    }
    // Scalar field view_type override
    const editToken = normalizeFieldViewType(resolvedField.editViewType || "");
    if (editToken && editToken.startsWith("editable-")) {
        // renderInput is used inside Form.Item which injects value/onChange — use a wrapper
        const Wrapper: React.FC<{ value?: any; onChange?: (v: any) => void }> = ({ value, onChange }) =>
            renderEditableFieldViewType(editToken, value, onChange) as React.ReactElement;
        return <Wrapper />;
    }
    if (resolvedField.reference && hasReferenceModel(resolvedField.reference, allModels)) {
        const refResource = resolveResourcePath(resolvedField.reference, allModels);
        const modelResource = model ? resolveResourcePath(model.resource || model.name, allModels) : undefined;
        const isSelfRef = refResource && modelResource && refResource === modelResource;
        return <RelationSelect field={resolvedField} allModels={allModels} excludeId={isSelfRef ? currentId : undefined} />;
    }
    if (resolvedField.optionsUrl) return <AsyncSelectInput optionsUrl={resolvedField.optionsUrl} placeholder={`${_("Select")} ${_(resolvedField.label)}...`} />;
    if (resolvedField.options) return <Select options={resolvedField.options} style={{ width: "100%" }} placeholder={`Select ${resolvedField.label}...`} allowClear />;
    switch (resolvedField.type) {
        case "boolean": return <Checkbox />;
        case "date": return <DatePicker style={{ width: "100%" }} placeholder={_("Select date")} />;
        case "datetime": return <DatePicker showTime style={{ width: "100%" }} placeholder={_("Select date and time")} />;
        case "time": return <TimePicker style={{ width: "100%" }} />;
        case "number": return <InputNumber style={{ width: "100%" }} />;
        default: return <Input />;
    }
};
