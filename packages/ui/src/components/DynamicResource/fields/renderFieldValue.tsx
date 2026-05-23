import React, { lazy, Suspense } from "react";
import { Input, Skeleton } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import type { FieldDef, ModelDef } from "../types";
import { hasReferenceModel, resolveResourcePath } from "../utils/model";
import { formatNumberValue, formatDateValue, formatDateTimeValue, formatTimeValue } from "../utils/formatting";
import { renderOptionTag } from "../utils/colors";
import { normalizeFieldViewType } from "../utils/viewConfig";
import { ReferenceField } from "./ReferenceField";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

const ReactMarkdown = lazy(() => import("react-markdown").then((m) => ({ default: m.default })));

const renderFieldViewTypeReadOnly = (token: string, value: any): React.ReactNode => {
    const str = value === null || value === undefined ? "" : String(value);
    if (!str && token !== "read-only-password") return "-";
    switch (token) {
        case "read-only-password":
            return <span style={{ letterSpacing: 2 }}>{str ? "●●●●●●" : "-"}</span>;
        case "read-only-textarea":
            return (
                <Input.TextArea
                    value={str}
                    autoSize={{ minRows: 2, maxRows: 12 }}
                    readOnly
                    style={{ resize: "vertical", background: "transparent", border: "none", padding: 0, boxShadow: "none" }}
                />
            );
        case "read-only-markdown":
            return (
                <Suspense fallback={<Skeleton.Input active size="small" style={{ width: 200 }} />}>
                    <ReactMarkdown>{str}</ReactMarkdown>
                </Suspense>
            );
        case "read-only-json": {
            let formatted = str;
            try { formatted = JSON.stringify(JSON.parse(str), null, 2); } catch { /* use raw */ }
            return <pre style={{ margin: 0, fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{formatted}</pre>;
        }
        case "read-only-url":
            return <a href={str} target="_blank" rel="noopener noreferrer">{str}</a>;
        case "read-only-email":
            return <a href={`mailto:${str}`}>{str}</a>;
        default:
            return str || "-";
    }
};

export const renderFieldValue = (field: FieldDef, record: any, allModels?: ModelDef[]) => {
    const value = record?.[field.key];
    const isNlSentenceField = field.key === "nl_sentence" || field.key === "nl_asks_sentence";
    if (isNlSentenceField) {
        return (
            <Input.TextArea
                value={value === null || value === undefined ? "" : String(value)}
                autoSize={{ minRows: 3, maxRows: 18 }}
                style={{ resize: "vertical", background: "#f3f6f9" }}
                placeholder={_(field.key)}
                readOnly
            />
        );
    }
    // Scalar field view_type override
    const showToken = normalizeFieldViewType(field.showViewType || "");
    if (showToken && showToken.startsWith("read-only-")) {
        return renderFieldViewTypeReadOnly(showToken, value);
    }
    if (field.type === "boolean") {
        return value
            ? <CheckCircleOutlined style={{ color: "green", fontSize: "1.2em" }} />
            : <CloseCircleOutlined style={{ color: "red", fontSize: "1.2em" }} />;
    }
    if (field.reference && value && hasReferenceModel(field.reference, allModels)) {
        return <ReferenceField id={value} resource={resolveResourcePath(field.referencePath || field.reference, allModels)} />;
    }
    if (field.type === "number") {
        return formatNumberValue(value) ?? "-";
    }
    if (field.type === "date") {
        return formatDateValue(value) ?? "-";
    }
    if (field.type === "datetime") {
        return formatDateTimeValue(value) ?? "-";
    }
    if (field.type === "time") {
        return formatTimeValue(value);
    }
    if (field.options && value !== undefined && value !== null) {
        return renderOptionTag(field, value);
    }
    return value ?? "-";
};
