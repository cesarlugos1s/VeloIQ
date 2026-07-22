import React from "react";
import { Tag } from "antd";
import type { ModelTone } from "../../../utils/modelTone";
import type { FieldDef } from "../types";

export const ToneSharedStyles = () => (
    <style>
        {`
            .jm-tone-scope .ant-form-item .ant-form-item-label > label {
                color: #475569 !important;
                font-weight: 400;
            }
            .jm-tone-scope .ant-table-thead > tr > th {
                color: var(--jm-table-header-text, #475569) !important;
            }
            .jm-tone-scope .ant-table-column-title {
                color: var(--jm-table-header-text, #475569) !important;
                font-weight: 400;
            }
            .jm-tone-scope .ant-table-thead > tr > th .ant-table-filter-column,
            .jm-tone-scope .ant-table-thead > tr > th .ant-table-column-sorters {
                color: var(--jm-table-header-text, #475569) !important;
            }
            .jm-tone-scope .ant-table-thead > tr > th .ant-table-filter-trigger,
            .jm-tone-scope .ant-table-thead > tr > th .ant-table-column-sorter,
            .jm-tone-scope .ant-table-thead > tr > th .ant-dropdown-trigger {
                color: var(--jm-table-header-accent, #64748b) !important;
            }
            .jm-tone-scope .ant-table-thead > tr > th.ant-table-column-sort,
            .jm-tone-scope .ant-table-thead > tr > th.ant-table-cell-fix-left,
            .jm-tone-scope .ant-table-thead > tr > th.ant-table-cell-fix-right {
                background: inherit !important;
            }
            .jm-tone-scope .ant-table-filter-dropdown {
                min-width: 420px !important;
                padding: 8px !important;
            }
            .jm-tone-scope .ant-table-filter-dropdown .ant-dropdown-menu-item,
            .jm-tone-scope .ant-table-filter-dropdown .ant-dropdown-menu-submenu-title,
            .jm-tone-scope .ant-table-filter-dropdown .ant-checkbox-wrapper,
            .jm-tone-scope .ant-table-filter-dropdown .ant-tree-title {
                font-size: 24px !important;
                line-height: 1.2 !important;
                font-weight: 400 !important;
                padding-top: 8px !important;
                padding-bottom: 8px !important;
            }
            .jm-tone-scope .ant-table-filter-dropdown .ant-checkbox {
                transform: none;
                margin-inline-end: 12px !important;
            }
            .jm-tone-scope .ant-table-filter-dropdown .ant-input {
                height: 44px !important;
                font-size: 18px !important;
            }
            .jm-tone-tab-label {
                position: relative;
                transition: transform 0.18s ease, background-color 0.18s ease;
            }
            .jm-tone-tab-label::after {
                content: "";
                position: absolute;
                left: 8px;
                right: 8px;
                bottom: -3px;
                height: 3px;
                border-radius: 2px;
                background: var(--tone-tab-underline, #94a3b8);
                transform: scaleX(0.15);
                opacity: 0;
                transition: transform 0.2s ease, opacity 0.2s ease;
            }
            .jm-tone-tab-label:hover::after {
                transform: scaleX(1);
                opacity: 1;
            }
        `}
    </style>
);

export const toneScopeStyle = (tone: ModelTone): React.CSSProperties => ({
    ["--jm-table-header-text" as any]: tone.text,
    ["--jm-table-header-accent" as any]: tone.solid,
});

export const renderToneTabLabel = (label: string, tone: ModelTone) => (
    <span
        className="jm-tone-tab-label"
        style={{
            ["--tone-tab-underline" as any]: tone.solid,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "2px 8px",
            borderRadius: 6,
            background: "transparent",
            color: tone.text,
            fontWeight: 600,
        }}
    >
        {label}
    </span>
);

export const isDarkColor = (color?: string) => {
    if (!color) return false;
    const value = color.trim();
    if (value.startsWith("#")) {
        let hex = value.slice(1);
        if (hex.length === 3) {
            hex = hex.split("").map((c) => c + c).join("");
        }
        if (hex.length !== 6) return false;
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        return luminance < 0.5;
    }
    if (value.startsWith("rgb")) {
        const parts = value.replace(/rgba?\(|\)/g, "").split(",").map((v) => Number(v.trim()));
        if (parts.length < 3 || parts.some((v) => Number.isNaN(v))) return false;
        const [r, g, b] = parts as [number, number, number];
        const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        return luminance < 0.5;
    }
    return false;
};

const VALUE_TAG_COLORS = [
    "blue",
    "geekblue",
    "cyan",
    "green",
    "gold",
    "orange",
    "volcano",
    "magenta",
    "purple",
    "lime",
];

const fieldValueColorCache = new WeakMap<FieldDef, Record<string, string>>();

export const getFieldValueColors = (field: FieldDef) => {
    if (field.valueColors && Object.keys(field.valueColors).length > 0) return field.valueColors;
    if (!field.options || field.options.length === 0) return {};
    const cached = fieldValueColorCache.get(field);
    if (cached) return cached;
    const map: Record<string, string> = {};
    field.options.forEach((option, index) => {
        if (!option) return;
        map[String(option.value)] = VALUE_TAG_COLORS[index % VALUE_TAG_COLORS.length];
    });
    fieldValueColorCache.set(field, map);
    return map;
};

export const getFallbackColor = (value: string) => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash * 31 + value.charCodeAt(i)) | 0;
    }
    return VALUE_TAG_COLORS[Math.abs(hash) % VALUE_TAG_COLORS.length];
};

export const renderOptionTag = (field: FieldDef, rawValue: any) => {
    if (rawValue === null || rawValue === undefined) return "-";
    const option = field.options?.find((entry) => entry && entry.value === rawValue);
    const label = option?.label ?? String(rawValue);
    const colorMap = getFieldValueColors(field);
    const color = colorMap[String(rawValue)] || getFallbackColor(label);
    return (
        <Tag color={color} style={{ marginInlineEnd: 0, borderRadius: 8, fontWeight: 500 }}>
            {label}
        </Tag>
    );
};
