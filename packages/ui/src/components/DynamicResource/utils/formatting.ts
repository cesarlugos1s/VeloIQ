import React from "react";

export const wrappedPageTitleStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    margin: 0,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    lineHeight: 1.2,
};

export const renderWrappedPageTitle = (title: React.ReactNode) => {
    if (title === null || title === undefined || title === false) return title;
    return React.createElement("div", { style: wrappedPageTitleStyle }, title);
};

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const formatNumberValue = (value: any) => {
    if (value === null || value === undefined) return value;
    const parsed = Number(value);
    if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return value;
    if (Number.isInteger(parsed)) return numberFormatter.format(parsed);
    return decimalFormatter.format(parsed);
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
});

export const formatDateValue = (value: any) => {
    if (!value) return value;
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return dateFormatter.format(parsed);
};

export const formatDateTimeValue = (value: any) => {
    if (!value) return value;
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return dateTimeFormatter.format(parsed);
};

export const formatTimeValue = (value: any) => {
    if (!value) return String(value ?? "-");
    // Time-only strings like "14:30:00" — parse as today's date to format
    if (typeof value === "string" && /^\d{2}:\d{2}/.test(value)) {
        const parsed = new Date(`1970-01-01T${value}`);
        if (!Number.isNaN(parsed.getTime())) return timeFormatter.format(parsed);
    }
    const parsed = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return timeFormatter.format(parsed);
};

export const escapeHtml = (value: any) => {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
};

export const parseInlineStyle = (styleText?: string): React.CSSProperties => {
    if (!styleText) return {};
    return styleText
        .split(";")
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .reduce<React.CSSProperties>((acc, rule) => {
            const [rawKey, rawValue] = rule.split(":").map((part) => part.trim());
            if (!rawKey || !rawValue) return acc;
            const camelKey = rawKey.replace(/-([a-z])/g, (_, char) => char.toUpperCase()) as keyof React.CSSProperties;
            (acc as any)[camelKey] = rawValue;
            return acc;
        }, {});
};
