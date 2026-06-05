import React, { useCallback, useMemo, useRef } from "react";
import { Empty, InputNumber, Modal, theme, Typography } from "antd";
import type { FieldDef, ModelDef } from "../types";
import { formatNumberValue } from "../utils/formatting";
import { renderNumericValueBar } from "../utils/statistics";
import { renderFieldValue } from "../fields/renderFieldValue";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export type CrosstabSummaryFn = "sum" | "avg" | "count" | "max" | "min" | "stddev";

/** Proration is only meaningful for sum/avg; other aggregations can only be edited
 * when a cell maps to a single underlying record. */
export const CROSSTAB_PRORATABLE_FNS: CrosstabSummaryFn[] = ["sum", "avg"];

export interface CrosstabEditConfig {
    /** Record primary-key field used to key staged edits. */
    pkField: string;
    /** Returns the pending/staged value for a record+field, if any (from the edit form). */
    getStagedValue?: (recordId: string | number, fieldKey: string) => any;
    /** Stage the resolved per-record edits (writes them into the shared edit form). */
    onCommitCell: (updates: Array<{ recordId: string | number; fieldKey: string; value: number }>) => void;
    /** Show a confirmation listing the proration distribution before staging multi-record edits. */
    confirmProration?: boolean;
}

export interface CrosstabTableProps {
    /** Raw records to pivot. */
    rows: any[];
    /** Row dimension field key. */
    rowField: string | null;
    /** Column dimension field key — null collapses to a single implicit column (grouped totals). */
    colField: string | null;
    /** Numeric field keys shown in each cell (one sub-column per field). Empty → record count. */
    cellFieldKeys: string[];
    /** Display labels for the cell fields, keyed by field key. */
    cellFieldLabels?: Record<string, string>;
    allFields: FieldDef[];
    /** Needed to render non-numeric cell fields with their configured field view type. */
    allModels?: ModelDef[];
    summaryFn: CrosstabSummaryFn;
    formatCategoryValue: (field: FieldDef | undefined, record: any) => string;
    numericBarColor: string;
    /** Optional caption rendered above the table. */
    caption?: string;
    /** Enables in-cell editing; cells stage edits via onCommitCell. */
    editable?: CrosstabEditConfig;
}

const COUNT_KEY = "__count__";

export const CrosstabTable: React.FC<CrosstabTableProps> = ({
    rows,
    rowField,
    colField,
    cellFieldKeys,
    cellFieldLabels,
    allFields,
    allModels,
    summaryFn,
    formatCategoryValue,
    numericBarColor,
    caption,
    editable,
}) => {
    const { token } = theme.useToken();

    const modelField = useCallback(
        (key: string | null | undefined) => (key ? allFields.find((field) => field.key === key) : undefined),
        [allFields]
    );

    const activeSeriesKeys = cellFieldKeys.length > 0 ? cellFieldKeys : [COUNT_KEY];
    const seriesLabel = useCallback(
        (seriesKey: string) => {
            if (seriesKey === COUNT_KEY) return _("Count");
            return cellFieldLabels?.[seriesKey] || modelField(seriesKey)?.label || seriesKey;
        },
        [cellFieldLabels, modelField]
    );

    const recordId = useCallback(
        (record: any) => record?.[editable?.pkField || "eid"] ?? record?.eid ?? record?.id,
        [editable?.pkField]
    );

    const effectiveValue = useCallback(
        (record: any, fieldKey: string): number | null => {
            if (fieldKey === COUNT_KEY) return 1;
            const staged = editable?.getStagedValue?.(recordId(record), fieldKey);
            const raw = staged !== undefined ? staged : record?.[fieldKey];
            if (raw === undefined || raw === null || raw === "") return null;
            const num = Number(raw);
            return Number.isNaN(num) ? null : num;
        },
        [editable, recordId]
    );

    const summarize = useCallback(
        (values: number[]): number => {
            if (values.length === 0) return 0;
            switch (summaryFn) {
                case "count":
                    return values.length;
                case "avg":
                    return values.reduce((acc, val) => acc + val, 0) / values.length;
                case "max":
                    return Math.max(...values);
                case "min":
                    return Math.min(...values);
                case "stddev": {
                    const mean = values.reduce((acc, val) => acc + val, 0) / values.length;
                    const variance = values.reduce((acc, val) => acc + (val - mean) ** 2, 0) / values.length;
                    return Math.sqrt(variance);
                }
                case "sum":
                default:
                    return values.reduce((acc, val) => acc + val, 0);
            }
        },
        [summaryFn]
    );

    const colFieldDef = modelField(colField);
    const rowFieldDef = modelField(rowField);
    const hasColDimension = Boolean(colField);
    const hasRowDimension = Boolean(rowField);

    // Build pivot: row labels, col labels, and per-cell+series contributing records.
    const pivot = useMemo(() => {
        const rowLabels: string[] = [];
        const colLabels: string[] = [];
        // cellKey -> seriesKey -> records[]
        const cellRecords = new Map<string, Map<string, any[]>>();

        (rows || []).forEach((row) => {
            // formatCategoryValue(undefined, …) yields the "All" bucket — used for a collapsed axis.
            const rowLabel = formatCategoryValue(rowFieldDef, row);
            const colLabel = formatCategoryValue(colFieldDef, row);
            if (!rowLabels.includes(rowLabel)) rowLabels.push(rowLabel);
            if (!colLabels.includes(colLabel)) colLabels.push(colLabel);
            const cellKey = `${rowLabel}::${colLabel}`;
            if (!cellRecords.has(cellKey)) cellRecords.set(cellKey, new Map());
            const seriesMap = cellRecords.get(cellKey)!;
            activeSeriesKeys.forEach((seriesKey) => {
                if (!seriesMap.has(seriesKey)) seriesMap.set(seriesKey, []);
                seriesMap.get(seriesKey)!.push(row);
            });
        });
        return { rowLabels, colLabels, cellRecords };
    }, [rows, rowFieldDef, colFieldDef, hasColDimension, formatCategoryValue, activeSeriesKeys]);

    const { rowLabels, colLabels, cellRecords } = pivot;

    // A cell field is aggregated (sum/avg/… with a value bar) only when it's a plain numeric
    // field with no configured view type. Otherwise the field is rendered with its own field
    // view type (e.g. a markdown description) per underlying record.
    const isAggregatedField = useCallback((seriesKey: string): boolean => {
        if (seriesKey === COUNT_KEY) return true;
        const field = modelField(seriesKey);
        // Numeric (non-reference) fields aggregate with a value bar; everything else renders
        // its value(s) using the field's configured view type.
        return Boolean(field && field.type === "number" && !field.reference);
    }, [modelField]);

    // All records mapped into a cell+series (regardless of numeric value) — used to render
    // non-aggregated cell fields with their configured view type.
    const cellAllRecords = useCallback(
        (rowLabel: string, colLabel: string, seriesKey: string): any[] => {
            return cellRecords.get(`${rowLabel}::${colLabel}`)?.get(seriesKey) || [];
        },
        [cellRecords]
    );

    // Records that actually contribute a numeric value to a cell+series (for aggregation & editing).
    const contributingRecords = useCallback(
        (rowLabel: string, colLabel: string, seriesKey: string): any[] => {
            const records = cellRecords.get(`${rowLabel}::${colLabel}`)?.get(seriesKey) || [];
            return records.filter((rec) => effectiveValue(rec, seriesKey) !== null);
        },
        [cellRecords, effectiveValue]
    );

    const cellAggregate = useCallback(
        (rowLabel: string, colLabel: string, seriesKey: string): number | null => {
            const values = contributingRecords(rowLabel, colLabel, seriesKey).map((rec) => effectiveValue(rec, seriesKey) as number);
            return values.length > 0 ? summarize(values) : null;
        },
        [contributingRecords, effectiveValue, summarize]
    );

    // Per-series max (absolute) for the in-cell value bars.
    const seriesMaxes = useMemo(() => {
        return activeSeriesKeys.reduce<Record<string, number>>((acc, seriesKey) => {
            let maxForSeries = 0;
            rowLabels.forEach((rowLabel) => {
                colLabels.forEach((colLabel) => {
                    const summarized = cellAggregate(rowLabel, colLabel, seriesKey);
                    if (summarized !== null) maxForSeries = Math.max(maxForSeries, Math.abs(summarized));
                });
            });
            acc[seriesKey] = maxForSeries;
            return acc;
        }, {});
    }, [activeSeriesKeys, rowLabels, colLabels, cellAggregate]);

    // ---- Editable cell support --------------------------------------------------
    const inputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
    const cellAddr = (r: number, c: number) => `${r}:${c}`;
    const editableColumns = colLabels.length * activeSeriesKeys.length;

    const focusCell = useCallback((r: number, c: number) => {
        if (r < 0 || c < 0 || r >= rowLabels.length || c >= editableColumns) return;
        const el = inputRefs.current.get(cellAddr(r, c));
        if (el) {
            el.focus();
            el.select?.();
        }
    }, [rowLabels.length, editableColumns]);

    const isSeriesEditable = useCallback(
        (rowLabel: string, colLabel: string, seriesKey: string): boolean => {
            // Only aggregated numeric cells are editable (proration / direct set).
            if (!editable || seriesKey === COUNT_KEY || !isAggregatedField(seriesKey)) return false;
            const n = contributingRecords(rowLabel, colLabel, seriesKey).length;
            if (n === 0) return false;
            if (CROSSTAB_PRORATABLE_FNS.includes(summaryFn)) return true;
            // max/min/stddev/count: only editable when the cell maps to a single record.
            return n === 1;
        },
        [editable, contributingRecords, summaryFn, isAggregatedField]
    );

    const computeProration = useCallback(
        (records: any[], seriesKey: string, newAggregate: number): Array<{ recordId: string | number; fieldKey: string; value: number }> => {
            const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
            const n = records.length;
            if (n === 1) {
                return [{ recordId: recordId(records[0]), fieldKey: seriesKey, value: round2(newAggregate) }];
            }
            const oldValues = records.map((rec) => effectiveValue(rec, seriesKey) as number);
            if (summaryFn === "sum") {
                const oldSum = oldValues.reduce((acc, v) => acc + v, 0);
                const raw = oldValues.map((v) => (oldSum !== 0 ? v * (newAggregate / oldSum) : newAggregate / n));
                const rounded = raw.map(round2);
                // Push the rounding residual onto the largest-magnitude record so the parts still
                // sum exactly to the entered total.
                const targetTotal = round2(newAggregate);
                const residual = round2(targetTotal - rounded.reduce((acc, v) => acc + v, 0));
                if (residual !== 0) {
                    let maxIdx = 0;
                    for (let i = 1; i < raw.length; i++) {
                        if (Math.abs(raw[i]) > Math.abs(raw[maxIdx])) maxIdx = i;
                    }
                    rounded[maxIdx] = round2(rounded[maxIdx] + residual);
                }
                return records.map((rec, idx) => ({ recordId: recordId(rec), fieldKey: seriesKey, value: rounded[idx] }));
            }
            // avg
            const oldAvg = oldValues.reduce((acc, v) => acc + v, 0) / n;
            return records.map((rec, idx) => ({
                recordId: recordId(rec),
                fieldKey: seriesKey,
                value: round2(oldAvg !== 0 ? oldValues[idx] * (newAggregate / oldAvg) : newAggregate),
            }));
        },
        [recordId, effectiveValue, summaryFn]
    );

    const commitCellEdit = useCallback(
        (rowLabel: string, colLabel: string, seriesKey: string, newAggregate: number | null) => {
            if (!editable || newAggregate === null || Number.isNaN(newAggregate)) return;
            const records = contributingRecords(rowLabel, colLabel, seriesKey);
            if (records.length === 0) return;
            const current = cellAggregate(rowLabel, colLabel, seriesKey);
            if (current !== null && Math.abs(current - newAggregate) < 1e-9) return;
            const updates = computeProration(records, seriesKey, newAggregate);

            if (records.length > 1 && editable.confirmProration !== false) {
                Modal.confirm({
                    title: _("Distribute value across records"),
                    width: 520,
                    content: (
                        <div>
                            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                                {_("This cell covers N records. The entered value will be distributed (prorated) as:")
                                    .replace("N", String(records.length))}
                            </Typography.Paragraph>
                            <div style={{ maxHeight: 240, overflow: "auto" }}>
                                {records.map((rec, idx) => (
                                    <div key={String(recordId(rec))} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, padding: "2px 0" }}>
                                        <span>{rec?._label ?? recordId(rec)}</span>
                                        <span style={{ color: token.colorTextTertiary }}>
                                            {formatNumberValue(effectiveValue(rec, seriesKey) as number)} → <b>{formatNumberValue(updates[idx].value)}</b>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ),
                    okText: _("Apply"),
                    cancelText: _("Cancel"),
                    onOk: () => editable.onCommitCell(updates),
                });
                return;
            }
            editable.onCommitCell(updates);
        },
        [editable, contributingRecords, cellAggregate, computeProration, recordId, effectiveValue, token.colorTextTertiary]
    );

    if (!rowField && !colField) {
        return <Empty description={_("Crosstab needs at least one category field.")} />;
    }
    if (rowLabels.length === 0) {
        return (
            <div style={{ padding: 24, color: token.colorTextTertiary, textAlign: "center" }}>
                {_("No data available for this view.")}
            </div>
        );
    }

    const headerCellStyle: React.CSSProperties = {
        background: token.colorBgLayout,
        color: token.colorText,
        fontWeight: "normal",
    };

    return (
        <div style={{ display: "grid", gap: 8 }}>
            {caption && <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{caption}</div>}
            <div style={{ overflow: "auto", border: `1px solid ${token.colorBorder}`, borderRadius: 8 }}>
                <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "max-content", fontSize: 12 }}>
                    <thead>
                        {hasColDimension && (
                            <tr>
                                <th style={{ position: "sticky", left: 0, zIndex: 1, ...headerCellStyle, borderBottom: `1px solid ${token.colorBorderSecondary}`, borderRight: `2px solid ${token.colorBorderSecondary}`, padding: "8px 10px", textAlign: "left", wordBreak: "break-word", maxWidth: 180 }}>
                                    {colFieldDef?.label || colField}
                                </th>
                                {colLabels.map((colLabel, colIndex) => (
                                    <th
                                        key={`crosstab-col-${colLabel}`}
                                        colSpan={activeSeriesKeys.length}
                                        style={{
                                            ...headerCellStyle,
                                            borderBottom: `1px solid ${token.colorBorderSecondary}`,
                                            borderLeft: colIndex === 0 ? `4px solid ${token.colorTextQuaternary}` : `1px solid ${token.colorBorderSecondary}`,
                                            borderRight: `4px solid ${token.colorTextQuaternary}`,
                                            padding: "8px 6px 4px",
                                            textAlign: "center",
                                            verticalAlign: "bottom",
                                        }}
                                    >
                                        <div style={{ writingMode: "vertical-rl", transform: "rotate(210deg)", whiteSpace: "normal", wordBreak: "break-word", display: "inline-block", lineHeight: 1.2, maxHeight: 200 }}>
                                            {colLabel}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        )}
                        <tr>
                            <th style={{ position: "sticky", left: 0, zIndex: 1, ...headerCellStyle, borderBottom: `2px solid ${token.colorBorderSecondary}`, borderRight: `2px solid ${token.colorBorderSecondary}`, padding: "8px 10px", textAlign: "left", wordBreak: "break-word", maxWidth: 180 }}>
                                {hasRowDimension ? (rowFieldDef?.label || rowField) : ""}
                            </th>
                            {colLabels.flatMap((colLabel) =>
                                activeSeriesKeys.map((seriesKey, seriesIndex) => (
                                    <th
                                        key={`crosstab-head-${colLabel}-${seriesKey}`}
                                        style={{
                                            ...headerCellStyle,
                                            borderBottom: `2px solid ${token.colorBorderSecondary}`,
                                            borderLeft: seriesIndex === 0 ? `4px solid ${token.colorTextQuaternary}` : undefined,
                                            borderRight: seriesIndex === activeSeriesKeys.length - 1 ? `4px solid ${token.colorTextQuaternary}` : `1px solid ${token.colorBorder}`,
                                            padding: "6px 4px 4px",
                                            textAlign: "center",
                                            verticalAlign: "bottom",
                                            maxWidth: 48,
                                            minWidth: 36,
                                        }}
                                    >
                                        <div style={{ writingMode: "vertical-rl", transform: "rotate(210deg)", whiteSpace: "normal", wordBreak: "break-word", display: "inline-block", lineHeight: 1.2, maxHeight: 200 }}>
                                            {seriesLabel(seriesKey)}
                                        </div>
                                    </th>
                                ))
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {rowLabels.map((rowLabel, rowIndex) => (
                            <tr key={`crosstab-row-${rowLabel}`}>
                                <th style={{ position: "sticky", left: 0, zIndex: 1, background: token.colorBgContainer, color: token.colorText, borderBottom: `1px solid ${token.colorBorder}`, borderRight: `2px solid ${token.colorBorderSecondary}`, padding: "8px 10px", textAlign: "left", fontWeight: "normal" }}>
                                    {rowLabel}
                                </th>
                                {colLabels.flatMap((colLabel, colIndex) =>
                                    activeSeriesKeys.map((seriesKey, seriesIndex) => {
                                        const summarized = cellAggregate(rowLabel, colLabel, seriesKey);
                                        const editableCell = isSeriesEditable(rowLabel, colLabel, seriesKey);
                                        const flatCol = colIndex * activeSeriesKeys.length + seriesIndex;
                                        const cellStyle: React.CSSProperties = {
                                            borderBottom: `1px solid ${token.colorBorder}`,
                                            borderLeft: seriesIndex === 0 ? `4px solid ${token.colorTextQuaternary}` : undefined,
                                            borderRight: seriesIndex === activeSeriesKeys.length - 1 ? `4px solid ${token.colorTextQuaternary}` : `1px solid ${token.colorBorder}`,
                                            padding: editableCell ? "2px 4px" : "8px 10px",
                                            textAlign: "right",
                                            whiteSpace: "nowrap",
                                        };
                                        const key = `crosstab-cell-${rowLabel}-${colLabel}-${seriesKey}`;
                                        if (editableCell) {
                                            return (
                                                <td key={key} style={cellStyle}>
                                                    <InputNumber
                                                        size="small"
                                                        variant="borderless"
                                                        controls={false}
                                                        defaultValue={summarized ?? undefined}
                                                        style={{ width: "100%", textAlign: "right" }}
                                                        ref={(node: any) => {
                                                            const el = node?.input ?? node?.nativeElement?.querySelector?.("input") ?? null;
                                                            inputRefs.current.set(cellAddr(rowIndex, flatCol), el);
                                                        }}
                                                        onPressEnter={(e) => {
                                                            const next = Number((e.target as HTMLInputElement).value);
                                                            commitCellEdit(rowLabel, colLabel, seriesKey, Number.isNaN(next) ? null : next);
                                                            focusCell(rowIndex + 1, flatCol);
                                                        }}
                                                        onBlur={(e) => {
                                                            const next = Number((e.target as HTMLInputElement).value);
                                                            commitCellEdit(rowLabel, colLabel, seriesKey, Number.isNaN(next) ? null : next);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "ArrowUp") { e.preventDefault(); focusCell(rowIndex - 1, flatCol); }
                                                            else if (e.key === "ArrowDown") { e.preventDefault(); focusCell(rowIndex + 1, flatCol); }
                                                            else if (e.key === "ArrowLeft" && (e.target as HTMLInputElement).selectionStart === 0) { e.preventDefault(); focusCell(rowIndex, flatCol - 1); }
                                                            else if (e.key === "ArrowRight") {
                                                                const input = e.target as HTMLInputElement;
                                                                if (input.selectionStart === input.value.length) { e.preventDefault(); focusCell(rowIndex, flatCol + 1); }
                                                            }
                                                        }}
                                                    />
                                                </td>
                                            );
                                        }
                                        // Non-aggregated cell field: render each underlying record's value
                                        // using the field's configured view type (e.g. markdown description).
                                        if (!isAggregatedField(seriesKey)) {
                                            const field = modelField(seriesKey);
                                            const records = cellAllRecords(rowLabel, colLabel, seriesKey);
                                            const seen = new Set<string>();
                                            const rendered: React.ReactNode[] = [];
                                            records.forEach((rec, i) => {
                                                const raw = rec?.[seriesKey];
                                                const dedupeKey = raw === undefined || raw === null ? "" : String(raw);
                                                if (dedupeKey !== "" && seen.has(dedupeKey)) return;
                                                seen.add(dedupeKey);
                                                if (dedupeKey === "") return;
                                                rendered.push(
                                                    <div key={`${key}-v${i}`} style={{ marginBottom: records.length > 1 ? 4 : 0 }}>
                                                        {field ? renderFieldValue(field, rec, allModels, true) : String(raw)}
                                                    </div>
                                                );
                                            });
                                            return (
                                                <td key={key} style={{ ...cellStyle, textAlign: "left", whiteSpace: "normal", minWidth: 160, maxWidth: 320 }}>
                                                    {rendered.length > 0 ? rendered : "–"}
                                                </td>
                                            );
                                        }
                                        const display = summarized !== null
                                            ? renderNumericValueBar(summarized, seriesMaxes[seriesKey] || 0, formatNumberValue(summarized), numericBarColor)
                                            : "–";
                                        return (
                                            <td key={key} style={cellStyle}>
                                                {display}
                                            </td>
                                        );
                                    })
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
