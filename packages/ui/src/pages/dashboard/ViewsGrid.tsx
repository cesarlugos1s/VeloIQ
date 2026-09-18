import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCan } from "@refinedev/core";
import { Tabs, Tooltip, Button, theme, Empty, Spin } from "antd";
import {
    SettingOutlined,
    FullscreenOutlined,
    MinusSquareOutlined,
    LinkOutlined,
    ArrowLeftOutlined,
    ArrowRightOutlined,
    ArrowUpOutlined,
    ArrowDownOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";
import type { ModelDef } from "../../components/DynamicResource/types";
import { DynamicList } from "../../components/DynamicResource";
import { findModelByName } from "../../components/DynamicResource/utils/model";
import { getModelTone } from "../../utils/modelTone";
import { translateText } from "../../components/DynamicResource/utils/i18n";
import { InlinePlotlyHtml } from "../../components/InlinePlotlyHtml";
import { authenticatedFetch } from "../../utils/authenticatedFetch";
import { API_URL } from "../../providers/constants";
import type { DashboardCell, DashboardConfig, DashboardTab } from "./hooks/useDashboardConfig";
import { CellConfigDrawer } from "./CellConfigDrawer";
import { CellSizeSelector } from "./CellSizeSelector";
import { DashboardCellHelp } from "../../components/Help/DashboardCellHelp";
import { DashboardTabHelp } from "../../components/Help/DashboardTabHelp";
import { computeGridDims, groupCellsByRow, moveCellInConfig, resizeCellInConfig, type MoveDirection } from "./hooks/gridCellOps";
import { useCellWindowState } from "./hooks/useCellWindowState";
import {
    buildGridDensityLabelText,
    buildGridDensityMarks,
    computeRowTrackHeight,
    GRID_DENSITY_STEPS,
    useFitRowHeight,
    useGridDensity,
    type GridDensity,
} from "./hooks/gridDensity";
import { FitRowCellCarousel } from "./FitCellCarousel";

// Resolved at call time (not module load) so it always reflects whatever
// catalog loadLocale() has installed on window._ by the time it runs — see
// utils/i18n.ts's translateText for why a module-load-time capture would
// freeze the English fallback in place.
const _ = (text: string): string => translateText(text, text);

interface Props {
    config: DashboardConfig;
    allModels: ModelDef[];
    onConfigChange: (next: DashboardConfig) => void;
    /** Extension point (see list_header_button_components in the VeloIQ
     * extension manifest contract): rendered inside each model-backed cell's
     * own toolbar. Signature intentionally matches that extension point's
     * per-component call signature so the same generated helper can be
     * passed straight through. */
    cellExtraActions?: (resource: string, model: ModelDef | undefined, allModels: ModelDef[]) => React.ReactNode;
    /** Extension point (see dashboard_tab_header_components in the VeloIQ
     * extension manifest contract): rendered next to each tab's name. */
    tabExtraActions?: (tab: DashboardTab, allModels: ModelDef[]) => React.ReactNode;
}

interface CellSelection {
    cell: DashboardCell;
    tabId: string;
}

// ---------------------------------------------------------------------------
// Global cell-size slider — a view-only preference (persisted to
// localStorage, never written into the dashboard config) that scales every
// cell in the grid uniformly regardless of what content type it holds
// (model list, plotly_chart-backed chart, journey card, NL Sentence card,
// etc.) by changing the CSS grid's row track height. "Fit page" is computed
// per tab from the tab's own row count and its container's rendered height.
// The density concept itself (steps/labels/row-height math) is shared with
// SectionsGrid's own cell-size selector — see hooks/gridDensity.tsx.
// ---------------------------------------------------------------------------

const GRID_DENSITY_STORAGE_KEY = "veloiq.dashboard.cellSize";

/** Card-content scale floor (see InlinePlotlyHtml's `minScale` prop) for the
 * fixed density steps (Small/Medium/Large/Original) — a deliberately chosen
 * fixed size, where staying legible matters more than guaranteeing zero
 * scroll. */
const FIXED_DENSITY_CARD_MIN_SCALE = 0.6;

/** Card-content scale floor for "Fit page" specifically. Its entire purpose
 * is guaranteeing nothing needs to scroll, so it keeps shrinking non-Plotly
 * card content (journey/NL Sentence cards) far past the point where the
 * fixed steps would give up and fall back to scrolling. Not 0: an
 * arbitrarily thin sliver is still preferable to a literal zero-size
 * collapse, and this stays reachable only in genuinely crowded dashboards —
 * a normal few-cell tab never needs to shrink this far. */
const FIT_CARD_MIN_SCALE = 0.15;

// ---------------------------------------------------------------------------
// Plotly chart cell content — fetches server-rendered chart HTML
// ---------------------------------------------------------------------------

const PlotlyChartContent: React.FC<{ chartUrl: string; refreshNonce: number; minScale: number }> = ({ chartUrl, refreshNonce, minScale }) => {
    const [chartHtml, setChartHtml] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchChart = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const apiUrl = typeof API_URL === "string" ? API_URL : "";
            // chartUrl may be absolute (/api/...) or relative — prepend API_URL base if needed,
            // but avoid double-prefixing when chartUrl already starts with the API base
            // (some seeded chart registries store the /api-prefixed path directly).
            const chartPath = apiUrl && chartUrl.startsWith(`${apiUrl}/`) ? chartUrl.slice(apiUrl.length) : chartUrl;
            const fullUrl = chartPath.startsWith("http") ? chartPath : `${apiUrl}${chartPath}`;
            const sep = fullUrl.includes("?") ? "&" : "?";
            const lang = (() => {
                try {
                    return (localStorage.getItem("locale") || navigator.language || "en").split("-")[0].toLowerCase();
                } catch { return "en"; }
            })();
            const res = await authenticatedFetch(`${fullUrl}${sep}lang=${encodeURIComponent(lang)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setChartHtml(data.chart_html || "");
        } catch (e: any) {
            setError(e?.message ?? String(e));
        } finally {
            setLoading(false);
        }
    }, [chartUrl]);

    useEffect(() => { fetchChart(); }, [fetchChart, refreshNonce]);

    if (loading) {
        return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", minHeight: 200 }}><Spin /></div>;
    }
    if (error) {
        return <Empty description={`Chart error: ${error}`} style={{ padding: 20 }} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }
    if (!chartHtml) {
        return <Empty description="No chart data" style={{ padding: 20 }} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }
    return <InlinePlotlyHtml html={chartHtml} style={{ padding: 8, height: "100%", overflow: "auto" }} minScale={minScale} />;
};

// ---------------------------------------------------------------------------
// Single grid cell
// ---------------------------------------------------------------------------

const DashboardGridCell: React.FC<{
    cell: DashboardCell;
    allModels: ModelDef[];
    isMaximized: boolean;
    isMinimized: boolean;
    canConfigureLayout: boolean;
    /** Floor for the card-content scale-to-fit in InlinePlotlyHtml (see
     * MIN_CARD_SCALE there). "Fit page" passes a much lower floor than the
     * fixed density steps: its whole point is guaranteeing no scrolling, so
     * it should keep shrinking non-Plotly card content (journey/NL Sentence
     * cards) rather than stop at a "still legible" floor and fall back to
     * scroll — whereas a user who deliberately picked "Small" is choosing a
     * fixed size knowing content may not fully fit, so legibility wins there. */
    cardMinScale: number;
    /** Cell-size slider's current step. Used only to re-trigger the
     * initial-scroll effect below whenever the user changes it — a
     * resize alone (e.g. switching between two fixed steps that share the
     * same cardMinScale) wouldn't otherwise be distinguishable from any
     * other resize the cell goes through while loading. */
    gridDensity: GridDensity;
    onConfigure: () => void;
    onMaximize: () => void;
    onMinimize: () => void;
    onResize: (minWidth: string | null, minHeight: string | null) => void;
    onMove: (direction: "left" | "right" | "up" | "down") => void;
    cellExtraActions?: (resource: string, model: ModelDef | undefined, allModels: ModelDef[]) => React.ReactNode;
}> = ({ cell, allModels, isMaximized, isMinimized, canConfigureLayout, cardMinScale, gridDensity, onConfigure, onMaximize, onMinimize, onResize, onMove, cellExtraActions }) => {
    const { token } = theme.useToken();
    const model = findModelByName(allModels, cell.model);
    const cellRef = useRef<HTMLDivElement>(null);

    // Parsed once so both the outer wrapper and the toolbar/body backgrounds
    // (which would otherwise paint over a custom background-color) can react
    // to it consistently.
    const parsedHtmlStyle = cell.html_style ? parseInlineStyle(cell.html_style) : {};
    const hasCustomBackground = Boolean(
        (parsedHtmlStyle as Record<string, unknown>).background
        || (parsedHtmlStyle as Record<string, unknown>).backgroundColor
    );

    const cellStyle: React.CSSProperties = {
        position: "relative",
        // Fills whatever height the grid assigns its track (the cell-size
        // slider in ViewsGrid sets a fixed row track for its non-"original"
        // steps). Against an "auto" track (the default "Original" step) a
        // percentage height resolves to auto per the CSS spec, so this is a
        // no-op there and content sizes exactly as it did before the slider
        // existed — it only takes effect once the track has a definite size,
        // which is what lets `overflow: hidden` below actually clip content
        // instead of the cell silently growing past its grid row.
        height: "100%",
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: token.colorBgContainer,
        ...(cell.min_width ? { minWidth: cell.min_width } : {}),
        ...(cell.max_width ? { maxWidth: cell.max_width } : {}),
        ...(cell.min_height ? { minHeight: cell.min_height } : {}),
        ...(cell.max_height ? { maxHeight: cell.max_height } : {}),
        ...parsedHtmlStyle,
        ...(isMaximized ? { gridColumn: "1 / -1" } : {}),
        ...(isMinimized ? { minHeight: 0 } : {}),
    };

    const toolbarStyle: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "2px 8px",
        gap: 2,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: hasCustomBackground ? "transparent" : token.colorBgContainer,
        flexShrink: 0,
        minHeight: 32,
        position: "relative",
    };

    const isPlotlyChart = cell.source_type === "plotly_chart";
    const resource = model?.resource || cell.model;
    const isModelLike = cell.source_type === "model" || cell.source_type === "named_query";
    const cellTitle = isPlotlyChart
        ? (cell.chart_title || cell.model)
        : isModelLike
            ? (model?.label || cell.model)
            : (cell.section_name || cell.model);
    const tone = (isModelLike && model) ? getModelTone(model) : null;

    // Refresh nonce for plotly chart cells — incrementing triggers re-fetch
    const [chartRefreshNonce, setChartRefreshNonce] = useState(0);

    // Model-list cells stack a toolbar + a compact list preview above their
    // own "Analyze" chart panel, so a cell short enough to need scrolling
    // opens showing mostly toolbar/list and very little of the actual
    // chart. Nudging the initial scroll position down reveals more chart
    // right away, at the cost of the toolbar; this is a one-shot jump on
    // first content settle, not a floor — later content changes or the
    // user's own scrolling are left alone.
    //
    // IQVigilant's NL Sentence cells (source_type "plotly_chart", chart_url
    // pointing at /nlsentence/{id}/chart) get the same treatment, but only
    // need a small nudge past their own header — 10% rather than 40%.
    // `cell.model` carries an "iqvigilant:nlsentence:{id}" identifier for
    // these; there's no dedicated field for it since the framework treats
    // all plotly_chart cells generically otherwise.
    const isNlSentenceCell = isPlotlyChart && typeof cell.model === "string" && cell.model.toLowerCase().includes("nlsentence");
    const initialScrollFraction = isModelLike ? 0.4 : isNlSentenceCell ? 0.1 : null;
    const cellBodyRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (initialScrollFraction === null) return;
        const body = cellBodyRef.current;
        if (!body) return;

        let applied = false;
        let settleTimer: ReturnType<typeof setTimeout> | null = null;

        const applyInitialScroll = () => {
            if (applied || body.scrollHeight <= body.clientHeight) return;
            applied = true;
            // scrollTop ranges over [0, scrollHeight - clientHeight], not
            // [0, scrollHeight] — the visible viewport's own height is
            // already "on screen" and isn't part of the distance left to
            // scroll through. Multiplying scrollHeight directly landed at a
            // larger fraction of that actual range than intended (e.g. ~60%
            // of the way down a track instead of 40%).
            body.scrollTop = Math.round((body.scrollHeight - body.clientHeight) * initialScrollFraction);
            observer.disconnect();
        };

        // The toolbar, list preview, and "Analyze" chart panel render in
        // separate passes as their own data loads, so scrollHeight moves
        // several times in quick succession before settling. Jumping on
        // the first tick that merely has SOME overflow (e.g. once just the
        // toolbar+list has loaded, before the chart adds its own height)
        // set the scroll position too early — Chrome's scroll-anchoring
        // then nudges scrollTop further as the chart's later growth gets
        // inserted above it, so the two effects compounded into far more
        // than 40%. Waiting for a short quiet period with no further
        // resizes before jumping avoids racing that growth in the first
        // place, rather than fighting the browser's own scroll-anchoring
        // after the fact.
        const scheduleApply = () => {
            if (settleTimer) clearTimeout(settleTimer);
            settleTimer = setTimeout(applyInitialScroll, 250);
        };

        const observer = new ResizeObserver(scheduleApply);
        observer.observe(body);
        scheduleApply();
        return () => {
            if (settleTimer) clearTimeout(settleTimer);
            observer.disconnect();
        };
    }, [initialScrollFraction, resource, gridDensity]);

    // Resize via pointer drag on bottom / right / corner handles.
    const startResize = useCallback((
        e: React.PointerEvent,
        dir: "s" | "e" | "se",
    ) => {
        e.preventDefault();
        e.stopPropagation();
        const el = cellRef.current;
        if (!el) return;
        const { width: startW, height: startH } = el.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const handle = e.currentTarget as HTMLElement;
        handle.setPointerCapture(e.pointerId);
        const prevCursor = document.body.style.cursor;
        document.body.style.cursor = dir === "s" ? "ns-resize" : dir === "e" ? "ew-resize" : "nwse-resize";

        const onMove = (ev: PointerEvent) => {
            if (dir !== "e") el.style.minHeight = `${Math.max(200, Math.round(startH + ev.clientY - startY))}px`;
            if (dir !== "s") el.style.minWidth  = `${Math.max(200, Math.round(startW + ev.clientX - startX))}px`;
        };
        const onUp = (ev: PointerEvent) => {
            handle.removeEventListener("pointermove", onMove);
            handle.removeEventListener("pointerup", onUp);
            document.body.style.cursor = prevCursor;
            const newH = dir !== "e" ? `${Math.max(200, Math.round(startH + ev.clientY - startY))}px` : null;
            const newW = dir !== "s" ? `${Math.max(200, Math.round(startW + ev.clientX - startX))}px` : null;
            onResize(newW, newH);
        };
        handle.addEventListener("pointermove", onMove);
        handle.addEventListener("pointerup", onUp);
    }, [onResize]);

    const handleBase: React.CSSProperties = {
        position: "absolute", zIndex: 10,
    };

    return (
        <div ref={cellRef} style={cellStyle} className="jm-dashboard-cell">
            <style>{`
                .jm-dashboard-cell .jm-cell-actions  { opacity: 0; transition: opacity 0.15s; }
                .jm-dashboard-cell:hover .jm-cell-actions  { opacity: 1; }
                .jm-dashboard-cell .jm-resize-handle { opacity: 0; transition: opacity 0.15s; background: transparent; }
                .jm-dashboard-cell:hover .jm-resize-handle { opacity: 1; }
                .jm-resize-handle:hover { background: rgba(128,128,128,0.25) !important; }
                .jm-resize-handle:active { background: rgba(128,128,128,0.45) !important; }
                ${hasCustomBackground ? `
                .jm-dashboard-cell-body-transparent,
                .jm-dashboard-cell-body-transparent .ant-card,
                .jm-dashboard-cell-body-transparent .ant-table,
                .jm-dashboard-cell-body-transparent .ant-table-container,
                .jm-dashboard-cell-body-transparent .ant-table-content,
                .jm-dashboard-cell-body-transparent .ant-table-cell,
                .jm-dashboard-cell-body-transparent table {
                    background: transparent !important;
                }
                ` : ""}
            `}</style>

            {canConfigureLayout && (
                <>
                    {/* Bottom edge */}
                    <div className="jm-resize-handle" style={{ ...handleBase, bottom: 0, left: 12, right: 12, height: 6, cursor: "ns-resize" }}
                        onPointerDown={(e) => startResize(e, "s")} />
                    {/* Right edge */}
                    <div className="jm-resize-handle" style={{ ...handleBase, top: 12, right: 0, bottom: 12, width: 6, cursor: "ew-resize" }}
                        onPointerDown={(e) => startResize(e, "e")} />
                    {/* Corner */}
                    <div className="jm-resize-handle" style={{ ...handleBase, bottom: 0, right: 0, width: 12, height: 12, cursor: "nwse-resize", borderRadius: `0 0 ${token.borderRadiusLG}px 0` }}
                        onPointerDown={(e) => startResize(e, "se")} />
                </>
            )}

            <div style={toolbarStyle}>
                <span style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: tone ? tone.solid : token.colorText,
                    paddingLeft: 4,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    letterSpacing: "-0.01em",
                }}>
                    {cellTitle}
                </span>
                <div className="jm-cell-actions" style={{ display: "flex", alignItems: "center", gap: 2 }}>
                {canConfigureLayout && (
                <>
                <Tooltip title="Move left">
                    <Button
                        type="text" size="small"
                        icon={<ArrowLeftOutlined style={{ fontSize: 10 }} />}
                        onClick={() => onMove("left")}
                        style={{ color: token.colorTextTertiary, padding: "0 4px", height: 22, minWidth: 22 }}
                    />
                </Tooltip>
                <Tooltip title="Move up">
                    <Button
                        type="text" size="small"
                        icon={<ArrowUpOutlined style={{ fontSize: 10 }} />}
                        onClick={() => onMove("up")}
                        style={{ color: token.colorTextTertiary, padding: "0 4px", height: 22, minWidth: 22 }}
                    />
                </Tooltip>
                <Tooltip title="Move down">
                    <Button
                        type="text" size="small"
                        icon={<ArrowDownOutlined style={{ fontSize: 10 }} />}
                        onClick={() => onMove("down")}
                        style={{ color: token.colorTextTertiary, padding: "0 4px", height: 22, minWidth: 22 }}
                    />
                </Tooltip>
                <Tooltip title="Move right">
                    <Button
                        type="text" size="small"
                        icon={<ArrowRightOutlined style={{ fontSize: 10 }} />}
                        onClick={() => onMove("right")}
                        style={{ color: token.colorTextTertiary, padding: "0 4px", height: 22, minWidth: 22 }}
                    />
                </Tooltip>
                <Tooltip title="Configure cell">
                    <Button
                        type="text" size="small"
                        icon={<SettingOutlined style={{ fontSize: 11 }} />}
                        onClick={onConfigure}
                        style={{ color: token.colorTextTertiary, padding: "0 4px", height: 22, minWidth: 22 }}
                    />
                </Tooltip>
                </>
                )}
                {isModelLike && model && cellExtraActions ? cellExtraActions(resource, model, allModels) : null}
                {isModelLike && resource ? <DashboardCellHelp resource={resource} /> : null}
                {isModelLike || cell.source_type === "relation" ? (
                    <Tooltip title="Open full page">
                        <Link to={`/${resource}`} style={{ color: token.colorTextTertiary, display: "flex", alignItems: "center", padding: "0 4px" }}>
                            <LinkOutlined style={{ fontSize: 11 }} />
                        </Link>
                    </Tooltip>
                ) : null}
                <Tooltip title={isMaximized ? "Restore" : "Maximize"}>
                    <Button
                        type="text" size="small"
                        icon={<FullscreenOutlined style={{ fontSize: 11 }} />}
                        onClick={onMaximize}
                        style={{ color: token.colorTextTertiary, padding: "0 4px", height: 22, minWidth: 22 }}
                    />
                </Tooltip>
                <Tooltip title={isMinimized ? "Restore" : "Minimize"}>
                    <Button
                        type="text" size="small"
                        icon={<MinusSquareOutlined style={{ fontSize: 11 }} />}
                        onClick={onMinimize}
                        style={{ color: token.colorTextTertiary, padding: "0 4px", height: 22, minWidth: 22 }}
                    />
                </Tooltip>
                </div>
            </div>
            {!isMinimized && (
                <div
                    ref={cellBodyRef}
                    className={hasCustomBackground ? "jm-dashboard-cell-body-transparent" : undefined}
                    style={{ flex: 1, overflow: "auto", minHeight: 0, overflowAnchor: "none" }}
                >
                    {isPlotlyChart && cell.chart_url ? (
                        <PlotlyChartContent chartUrl={cell.chart_url} refreshNonce={chartRefreshNonce} minScale={cardMinScale} />
                    ) : model ? (
                        <DynamicList
                            key={`${resource}-${cell.view_type ?? ''}`}
                            model={model}
                            allModels={allModels}
                            isEmbedded
                            preferencesResourceOverride={`dashboard:${resource}`}
                            defaultListVisible={Boolean(cell.view_type)}
                            listViewType={
                                cell.view_type
                                    ? (cell.view_type as any)
                                    : model.listViewType
                            }
                        />
                    ) : (
                        <Empty
                            description={`Model "${cell.model}" not found`}
                            style={{ padding: 24 }}
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Tab content — one CSS grid
// ---------------------------------------------------------------------------

const DashboardTabContent: React.FC<{
    tab: DashboardTab;
    allModels: ModelDef[];
    maximizedCellId: string | null;
    minimizedCellIds: Set<string>;
    canConfigureLayout: boolean;
    gridDensity: GridDensity;
    onMaximize: (cellId: string) => void;
    onMinimize: (cellId: string) => void;
    onConfigure: (cell: DashboardCell) => void;
    onResize: (cellId: string, minWidth: string | null, minHeight: string | null) => void;
    onMove: (cellId: string, direction: "left" | "right" | "up" | "down") => void;
    cellExtraActions?: (resource: string, model: ModelDef | undefined, allModels: ModelDef[]) => React.ReactNode;
}> = ({ tab, allModels, maximizedCellId, minimizedCellIds, canConfigureLayout, gridDensity, onMaximize, onMinimize, onConfigure, onResize, onMove, cellExtraActions }) => {
    const cells = tab.cells;
    const containerRef = useRef<HTMLDivElement>(null);

    const { numCols, numRows } = useMemo(() => computeGridDims(cells), [cells]);

    const gridGap = 12;
    const gridPadding = 12; // must match gridStyle.padding below

    // null until the very first measurement lands — see useFitRowHeight's
    // own comment for why the "fit row"/"fit cell" Carousel below must never
    // mount before this is final.
    const fitRowHeight = useFitRowHeight(containerRef, gridDensity, numRows, gridGap, gridPadding);

    // When a cell is maximized, hide all others.
    const visibleCells = maximizedCellId
        ? cells.filter((c) => c.id === maximizedCellId)
        : cells;

    const cardMinScale = (gridDensity === "fit" || gridDensity === "fit-row" || gridDensity === "fit-cell") ? FIT_CARD_MIN_SCALE : FIXED_DENSITY_CARD_MIN_SCALE;

    const gridStyle: React.CSSProperties = {
        display: "grid",
        gridTemplateColumns: maximizedCellId
            ? "1fr"
            : `repeat(${numCols}, 1fr)`,
        gridTemplateRows: maximizedCellId
            ? "1fr"
            : `repeat(${numRows}, ${computeRowTrackHeight(gridDensity, fitRowHeight)})`,
        gap: gridGap,
        padding: gridPadding,
        height: "100%",
        boxSizing: "border-box",
        overflowX: "auto",
    };

    if (!cells.length) {
        return <Empty description={_("No models in this tab")} style={{ padding: 48 }} />;
    }

    const renderCell = (cell: DashboardCell) => (
        <DashboardGridCell
            cell={cell}
            allModels={allModels}
            isMaximized={maximizedCellId === cell.id}
            isMinimized={minimizedCellIds.has(cell.id)}
            canConfigureLayout={canConfigureLayout}
            cardMinScale={cardMinScale}
            gridDensity={gridDensity}
            onConfigure={() => onConfigure(cell)}
            onMaximize={() => onMaximize(cell.id)}
            onMinimize={() => onMinimize(cell.id)}
            onResize={(w, h) => onResize(cell.id, w, h)}
            onMove={(dir) => onMove(cell.id, dir)}
            cellExtraActions={cellExtraActions}
        />
    );

    // A maximized cell already shows one cell full-bleed via the ordinary
    // grid path below (visibleCells filtered to it, gridStyle collapsed to
    // 1x1) — carousel navigation only kicks in when nothing is maximized.
    if (!maximizedCellId && (gridDensity === "fit-row" || gridDensity === "fit-cell")) {
        // Nothing to mount the Carousel against yet — see useFitRowHeight's
        // comment for why this must not fall back to a default height
        // instead. This state is resolved synchronously so this branch is
        // not user-visible.
        if (fitRowHeight === null) {
            return <div ref={containerRef} style={{ height: "100%" }} />;
        }
        return (
            <div ref={containerRef} style={{ height: "100%", boxSizing: "border-box" }}>
                <FitRowCellCarousel
                    cellsByRow={groupCellsByRow(cells)}
                    gridDensity={gridDensity}
                    rowHeight={fitRowHeight}
                    gridGap={gridGap}
                    gridPadding={gridPadding}
                    renderCell={renderCell}
                />
            </div>
        );
    }

    return (
        <div ref={containerRef} style={gridStyle}>
            {visibleCells.map((cell) => (
                <div
                    key={cell.id}
                    style={{
                        gridColumn: maximizedCellId ? "1 / -1" : `${cell.col + 1}`,
                        gridRow: maximizedCellId ? "1 / -1" : `${cell.row + 1}`,
                        // Grid items default to min-width: auto, which lets a
                        // cell with wide intrinsic content (a table with many
                        // columns, an embedded show page) force its 1fr track
                        // wider than its fair share instead of scrolling —
                        // this is what actually lets the grid's overflowX:
                        // auto above kick in for that case.
                        minWidth: 0,
                        overflow: "hidden",
                    }}
                >
                    {renderCell(cell)}
                </div>
            ))}
        </div>
    );
};

// ---------------------------------------------------------------------------
// ViewsGrid — the reusable top-level component
// ---------------------------------------------------------------------------

export const ViewsGrid: React.FC<Props> = ({ config, allModels, onConfigChange, cellExtraActions, tabExtraActions }) => {
    const { token } = theme.useToken();
    const { data: canLayoutData } = useCan({ resource: "veloiq_layout", action: "configure_layout" });
    const canConfigureLayout = canLayoutData?.can !== false;

    const { maximizedCellId, minimizedCellIds, handleMaximize, handleMinimize, reset: resetCellWindowState } = useCellWindowState();
    const [drawerSelection, setDrawerSelection] = useState<CellSelection | null>(null);
    const { gridDensity, setGridDensityByStep: handleGridDensityChange } = useGridDensity(GRID_DENSITY_STORAGE_KEY, "original");

    // Order must track GRID_DENSITY_STEPS. Labels are wrapped in a smaller
    // font than the antd Slider's default mark size — seven marks on one
    // track otherwise crowd/overlap each other.
    const gridDensityMarks = useMemo(() => buildGridDensityMarks(_), []);

    // Plain-text form of the same labels (the marks above are JSX, sized
    // down to fit seven of them on one track) — used for the trigger
    // button's own text, which shows the currently selected option instead
    // of a fixed caption (matching DataDetailSlider's "Data Detail Level"
    // pattern in DynamicShow/DynamicEdit).
    const gridDensityLabelText = buildGridDensityLabelText(_);

    const handleOpenDrawer = useCallback((tabId: string, cell: DashboardCell) => {
        setDrawerSelection({ tabId, cell });
    }, []);

    const handleSaveConfig = useCallback((nextConfig: DashboardConfig) => {
        onConfigChange(nextConfig);
        setDrawerSelection(null);
    }, [onConfigChange]);

    const handleMoveCell = useCallback((tabId: string, cellId: string, direction: MoveDirection) => {
        onConfigChange(moveCellInConfig(config, tabId, cellId, direction));
    }, [config, onConfigChange]);

    const handleResizeCell = useCallback((tabId: string, cellId: string, minWidth: string | null, minHeight: string | null) => {
        onConfigChange(resizeCellInConfig(config, tabId, cellId, minWidth, minHeight));
    }, [config, onConfigChange]);

    const tabItems = useMemo(() =>
        config.tabs.map((tab) => ({
            key: tab.id,
            label: (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {tab.name}
                    {tabExtraActions ? tabExtraActions(tab, allModels) : null}
                    <DashboardTabHelp tabId={tab.id} />
                </span>
            ),
            children: (
                <DashboardTabContent
                    tab={tab}
                    allModels={allModels}
                    maximizedCellId={maximizedCellId}
                    minimizedCellIds={minimizedCellIds}
                    canConfigureLayout={canConfigureLayout}
                    gridDensity={gridDensity}
                    onMaximize={handleMaximize}
                    onMinimize={handleMinimize}
                    onConfigure={(cell) => handleOpenDrawer(tab.id, cell)}
                    onResize={(cellId, w, h) => handleResizeCell(tab.id, cellId, w, h)}
                    onMove={(cellId, dir) => handleMoveCell(tab.id, cellId, dir)}
                    cellExtraActions={cellExtraActions}
                />
            ),
        })),
        [config.tabs, allModels, maximizedCellId, minimizedCellIds, canConfigureLayout, gridDensity, handleMaximize, handleMinimize, handleOpenDrawer, handleResizeCell, handleMoveCell, cellExtraActions, tabExtraActions]
    );

    if (!config.tabs.length) {
        return <Empty description={_("No tabs configured. Run veloiq add-dashboard to add models.")} style={{ padding: 48 }} />;
    }

    return (
        <>
            <Tabs
                items={tabItems}
                onChange={resetCellWindowState}
                style={{ height: "100%" }}
                tabBarStyle={{ paddingLeft: 12, marginBottom: 0 }}
                tabBarExtraContent={{
                    right: (
                        <CellSizeSelector
                            label={_("Cell size")}
                            stepCount={GRID_DENSITY_STEPS.length}
                            marks={gridDensityMarks}
                            value={GRID_DENSITY_STEPS.indexOf(gridDensity)}
                            onChange={handleGridDensityChange}
                            currentLabelText={gridDensityLabelText[gridDensity]}
                        />
                    ),
                }}
            />
            <CellConfigDrawer
                open={Boolean(drawerSelection)}
                cell={drawerSelection?.cell ?? null}
                tabId={drawerSelection?.tabId ?? null}
                config={config}
                onClose={() => setDrawerSelection(null)}
                onSave={handleSaveConfig}
            />
        </>
    );
};

// ---------------------------------------------------------------------------
// Minimal inline-style parser (CSS string → CSSProperties object)
// ---------------------------------------------------------------------------

function parseInlineStyle(cssText: string): React.CSSProperties {
    const result: Record<string, string> = {};
    cssText.split(";").forEach((declaration) => {
        const idx = declaration.indexOf(":");
        if (idx < 0) return;
        const prop = declaration.slice(0, idx).trim();
        const value = declaration.slice(idx + 1).trim();
        if (!prop || !value) return;
        // Convert kebab-case to camelCase.
        const camel = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        result[camel] = value;
    });
    return result as React.CSSProperties;
}
