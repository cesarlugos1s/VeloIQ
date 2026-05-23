import React, { lazy, Suspense } from "react";
import { Input, Skeleton, Rate, Progress, Tooltip } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import type { FieldDef, ModelDef } from "../types";
import { hasReferenceModel, resolveResourcePath } from "../utils/model";
import { formatNumberValue, formatDateValue, formatDateTimeValue, formatTimeValue } from "../utils/formatting";
import { renderOptionTag } from "../utils/colors";
import { normalizeFieldViewType } from "../utils/viewConfig";
import { ReferenceField } from "./ReferenceField";

dayjs.extend(relativeTime);

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

const ReactMarkdown = lazy(() => import("react-markdown").then((m) => ({ default: m.default })));
const QRCodeSVG = lazy(() => import("qrcode.react").then((m) => ({ default: m.QRCodeSVG })));

function formatDuration(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const parts: string[] = [];
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    if (s || !parts.length) parts.push(`${s}s`);
    return parts.join(" ");
}

const TALL_VIEW_TYPE_TOKENS = new Set([
    "read-only-markdown", "read-only-json", "read-only-code", "read-only-textarea", "read-only-image-url",
]);

const renderFieldViewTypeReadOnly = (token: string, value: any, inTable?: boolean): React.ReactNode => {
    const str = value === null || value === undefined ? "" : String(value);
    const isEmpty = str === "" || str === "null" || str === "undefined";
    if (isEmpty && token !== "read-only-password" && token !== "read-only-progress" && token !== "read-only-rating") return "-";
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
        case "read-only-currency": {
            const num = parseFloat(str);
            if (isNaN(num)) return str || "-";
            return <>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num)}</>;
        }
        case "read-only-percentage": {
            const num = parseFloat(str);
            if (isNaN(num)) return str || "-";
            return <>{`${num} %`}</>;
        }
        case "read-only-progress": {
            const num = Math.max(0, Math.min(100, parseFloat(str) || 0));
            return <Progress percent={num} size="small" style={{ marginBottom: 0 }} />;
        }
        case "read-only-rating": {
            const num = parseFloat(str) || 0;
            return <Rate disabled value={num} />;
        }
        case "read-only-duration": {
            const secs = parseInt(str) || 0;
            return <>{formatDuration(secs)}</>;
        }
        case "read-only-phone":
            return <a href={`tel:${str}`}>{str}</a>;
        case "read-only-color":
            return (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ display: "inline-block", width: 16, height: 16, background: str, border: "1px solid #d9d9d9", borderRadius: 2, flexShrink: 0 }} />
                    {str}
                </span>
            );
        case "read-only-code":
            return <pre style={{ margin: 0, fontSize: 12, fontFamily: "monospace", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{str}</pre>;
        case "read-only-image-url":
            return (
                <a href={str} target="_blank" rel="noopener noreferrer">
                    <img src={str} alt="" style={{ maxWidth: "100%", maxHeight: 200, objectFit: "contain", borderRadius: 4, display: "block" }} />
                </a>
            );
        case "read-only-qrcode":
            return (
                <Suspense fallback={<Skeleton.Input active size="small" style={{ width: 128 }} />}>
                    <QRCodeSVG value={str} size={128} />
                </Suspense>
            );
        case "read-only-relative": {
            const parsed = dayjs(str);
            if (!parsed.isValid()) return str || "-";
            return <>{parsed.fromNow()}</>;
        }
        case "read-only-truncated-text":
            return (
                <Tooltip title={str}>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "default" }}>
                        {str}
                    </span>
                </Tooltip>
            );
        default:
            return str || "-";
    }
};

const wrapForTable = (node: React.ReactNode): React.ReactNode => (
    <div style={{ maxHeight: 120, overflowY: "auto", overflowX: "hidden" }}>{node}</div>
);

export const renderFieldValue = (field: FieldDef, record: any, allModels?: ModelDef[], inTable?: boolean) => {
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
    // Scalar field view_type override (skip for FK fields — "read-only-field" on a reference
    // field means "just the link, no edit icon", handled by the reference branch below)
    const showToken = normalizeFieldViewType(field.showViewType || "");
    if (showToken && showToken.startsWith("read-only-") && !(showToken === "read-only-field" && field.reference)) {
        const node = renderFieldViewTypeReadOnly(showToken, value);
        return inTable && TALL_VIEW_TYPE_TOKENS.has(showToken) ? wrapForTable(node) : node;
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
