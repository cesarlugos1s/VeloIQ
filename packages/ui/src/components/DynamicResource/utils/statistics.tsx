import React from "react";
import type { FieldDef } from "../types";
import { escapeHtml, formatNumberValue, formatDateValue } from "./formatting";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export const openPdfWindow = (title: string, bodyHtml: string) => {
    const pdfWindow = window.open("", "_blank", "width=960,height=720");
    if (!pdfWindow) return;
    pdfWindow.document.write(`<!doctype html>
<html>
<head>
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
    h2 { margin: 0 0 16px; }
    h3 { margin: 18px 0 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { border: 1px solid #e0e0e0; padding: 6px 8px; font-size: 12px; text-align: left; vertical-align: top; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>${bodyHtml}</body>
</html>`);
    pdfWindow.document.close();
    const triggerPrint = () => {
        pdfWindow.focus();
        pdfWindow.print();
    };
    if (pdfWindow.document.readyState === "complete") {
        setTimeout(triggerPrint, 250);
    } else {
        pdfWindow.onload = () => setTimeout(triggerPrint, 250);
    }
};

export const buildStatsHtml = (statsSummary: { numericStats: any[]; categoricalStats: any[] }) => {
    const formatStatValue = (value: any) => {
        if (value === null || value === undefined) return "-";
        return escapeHtml(formatNumberValue(value));
    };
    const numericRows = statsSummary.numericStats
        .map((row) => `
            <tr>
              <td>${escapeHtml(row.label)}</td>
              <td>${formatStatValue(row.sum)}</td>
              <td>${formatStatValue(row.avg)}</td>
              <td>${formatStatValue(row.min)}</td>
              <td>${formatStatValue(row.max)}</td>
              <td>${formatStatValue(row.stddev)}</td>
            </tr>
        `)
        .join("");
    const numericSection = statsSummary.numericStats.length > 0
        ? `
            <h3>${_("Numeric columns")}</h3>
            <table>
              <thead>
                <tr>
                  <th>${_("Field")}</th>
                  <th>${_("Sum")}</th>
                  <th>${_("Average")}</th>
                  <th>${_("Min")}</th>
                  <th>${_("Max")}</th>
                  <th>${_("Std Dev")}</th>
                </tr>
              </thead>
              <tbody>${numericRows}</tbody>
            </table>
        `
        : "";
    const categoricalSection = statsSummary.categoricalStats.length > 0
        ? statsSummary.categoricalStats
            .map((field) => {
                const countRows = field.counts
                    .map((entry: any) => `
                        <tr>
                          <td>${escapeHtml(entry.value)}</td>
                          <td>${formatStatValue(entry.count)}</td>
                        </tr>
                    `)
                    .join("");
                return `
                    <h3>${escapeHtml(field.label)}</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>${_("Value")}</th>
                          <th>${_("Count")}</th>
                        </tr>
                      </thead>
                      <tbody>${countRows}</tbody>
                    </table>
                `;
            })
            .join("")
        : "";
    return `
        <h2>${_("Stats")}</h2>
        ${numericSection}
        ${categoricalSection}
    `;
};

export const buildStatsSummary = (
    rows: any[],
    fields: FieldDef[],
    labelCache: Record<string, string>,
) => {
    const numericStats: Array<{
        key: string;
        label: string;
        sum: number | null;
        avg: number | null;
        min: number | null;
        max: number | null;
        stddev: number | null;
    }> = [];
    const categoricalStats: Array<{
        key: string;
        label: string;
        counts: Array<{ value: string; count: number }>;
    }> = [];

    const formatCategoricalValue = (field: FieldDef, raw: any) => {
        if (raw === undefined || raw === null) return "-";
        if (field.reference) {
            const cacheKey = `${field.reference}:${raw}`;
            return labelCache[cacheKey] || String(raw);
        }
        if (field.options) {
            // Guard the predicate itself, not just the .find() result -- a
            // null/undefined entry in field.options (seen from some
            // dynamically-built option lists) throws inside the predicate
            // before .find() ever gets to return, which an `?.label` on the
            // outside doesn't protect against.
            return field.options.find((option) => option && option.value === raw)?.label || String(raw);
        }
        if (field.type === "boolean") return raw ? _("Yes") : _("No");
        if (field.type === "date") return formatDateValue(raw);
        return String(raw);
    };

    fields.forEach((field) => {
        if (field.type === "number" && !field.reference) {
            const values = rows
                .map((row) => Number(row?.[field.key]))
                .filter((value) => !Number.isNaN(value));
            if (values.length === 0) {
                numericStats.push({
                    key: field.key,
                    label: field.label,
                    sum: null,
                    avg: null,
                    min: null,
                    max: null,
                    stddev: null,
                });
                return;
            }
            const count = values.length;
            const sum = values.reduce((acc, val) => acc + val, 0);
            const avg = sum / count;
            const min = Math.min(...values);
            const max = Math.max(...values);
            const variance = values.reduce((acc, val) => acc + (val - avg) ** 2, 0) / count;
            const stddev = Math.sqrt(variance);
            numericStats.push({
                key: field.key,
                label: field.label,
                sum,
                avg,
                min,
                max,
                stddev,
            });
            return;
        }

        const counts = new Map<string, number>();
        rows.forEach((row) => {
            const raw = row?.[field.key];
            const value = formatCategoricalValue(field, raw);
            counts.set(value, (counts.get(value) || 0) + 1);
        });
        if (counts.size === 0 || counts.size >= 20) return;
        categoricalStats.push({
            key: field.key,
            label: field.label,
            counts: Array.from(counts.entries())
                .map(([value, count]) => ({ value, count }))
                .sort((a, b) => b.count - a.count),
        });
    });

    return { numericStats, categoricalStats };
};

export const renderStatBar = (value: number | null, maxValue: number, formatter: (val: number) => string) => {
    if (value === null || maxValue <= 0) return <span>-</span>;
    const ratio = Math.min(1, Math.abs(value) / maxValue);
    return (
        <div style={{ position: "relative", height: 20 }}>
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    background: "rgba(22, 119, 255, 0.12)",
                    transform: `scaleX(${ratio})`,
                    transformOrigin: "left",
                    borderRadius: 4,
                }}
            />
            <span style={{ position: "relative", paddingLeft: 6 }}>{formatter(value)}</span>
        </div>
    );
};

export const renderNumericValueBar = (value: any, maxValue: number, formattedValue: React.ReactNode, barColor: string) => {
    if (value === null || value === undefined || maxValue <= 0) return <span>{formattedValue}</span>;
    const parsed = Number(value);
    if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return <span>{formattedValue}</span>;
    const ratio = Math.min(1, Math.abs(parsed) / maxValue);
    return (
        <div style={{ position: "relative", minHeight: 24 }}>
            <div
                style={{
                    position: "absolute",
                    inset: "3px 0",
                    width: `${ratio * 100}%`,
                    background: barColor,
                    borderRadius: 6,
                }}
            />
            <span style={{ position: "relative", display: "inline-block", paddingLeft: 6, width: "100%", textAlign: "right" }}>
                {formattedValue}
            </span>
        </div>
    );
};
