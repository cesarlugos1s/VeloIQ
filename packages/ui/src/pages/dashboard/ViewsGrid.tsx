import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCan } from "@refinedev/core";
import { Tabs, Tooltip, Button, theme, Empty, Spin, Slider } from "antd";
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
import { DashboardCellHelp } from "../../components/Help/DashboardCellHelp";
import { DashboardTabHelp } from "../../components/Help/DashboardTabHelp";

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
// ---------------------------------------------------------------------------

/** Ordered slider steps; the index is the value the antd <Slider> tracks. */
const GRID_DENSITY_STEPS = ["original", "small", "fit", "medium", "large"] as const;
type GridDensity = (typeof GRID_DENSITY_STEPS)[number];

/** Fixed row height (px) for each non-"original"/non-"fit" step. */
const GRID_DENSITY_ROW_HEIGHT: Record<Exclude<GridDensity, "original" | "fit">, number> = {
    small: 180,
    medium: 320,
    large: 480,
};

/** Minimum row height "fit page" will ever compute down to, so a tab with
 * many rows degrades to scrolling instead of squashing cells unreadably. */
const FIT_PAGE_MIN_ROW_HEIGHT = 120;

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

const GRID_DENSITY_STORAGE_KEY = "veloiq.dashboard.cellSize";

const loadStoredGridDensity = (): GridDensity => {
    try {
        const stored = localStorage.getItem(GRID_DENSITY_STORAGE_KEY);
        if (stored && (GRID_DENSITY_STEPS as readonly string[]).includes(stored)) {
            return stored as GridDensity;
        }
    } catch {
        // localStorage unavailable (private mode, etc.) — fall back silently.
    }
    return "fit";
};

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
    onConfigure: () => void;
    onMaximize: () => void;
    onMinimize: () => void;
    onResize: (minWidth: string | null, minHeight: string | null) => void;
    onMove: (direction: "left" | "right" | "up" | "down") => void;
    cellExtraActions?: (resource: string, model: ModelDef | undefined, allModels: ModelDef[]) => React.ReactNode;
}> = ({ cell, allModels, isMaximized, isMinimized, canConfigureLayout, cardMinScale, onConfigure, onMaximize, onMinimize, onResize, onMove, cellExtraActions }) => {
    const { token } = theme.useToken();
    const model = findModelByName(allModels, cell.model);
    const cellRef = useRef<HTMLDivElement>(null);

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
        ...(cell.html_style ? parseInlineStyle(cell.html_style) : {}),
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
        background: token.colorBgContainer,
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
                <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
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
    const [fitRowHeight, setFitRowHeight] = useState(FIT_PAGE_MIN_ROW_HEIGHT);

    const numCols = useMemo(() => {
        if (!cells.length) return 2;
        return Math.max(...cells.map((c) => c.col)) + 1;
    }, [cells]);

    const numRows = useMemo(() => {
        if (!cells.length) return 1;
        return Math.max(...cells.map((c) => c.row)) + 1;
    }, [cells]);

    const gridGap = 12;
    const gridPadding = 12; // must match gridStyle.padding below

    // "Fit page": divide the space between the grid's top edge and the
    // bottom of whatever actually clips it on screen evenly across the
    // tab's rows, floored so cells never get squashed past readability (a
    // tab with too many rows falls back to scrolling instead).
    //
    // Deliberately measured via getBoundingClientRect() on the nearest
    // scrollable ancestor rather than the grid container's own
    // clientHeight: this component's height:100% doesn't resolve against a
    // definite ancestor height (antd Tabs' pane doesn't force one), so the
    // div's rendered height ends up driven by its own row-track content —
    // i.e. by fitRowHeight itself. A ResizeObserver on that same element
    // would then see its own output as new input on every tick (grow row
    // height → div grows → observer fires → grow row height again),
    // running away to the top of the screen.
    //
    // window.innerHeight is *not* a safe stand-in for "the bottom of the
    // visible page" either: the actual clipping boundary is whatever
    // ancestor has overflow:auto/scroll (DashboardPage's calc(100vh-140px)
    // wrapper in the framework's own dashboard page) — its rendered bottom
    // edge can sit noticeably above window.innerHeight (extra chrome, a
    // host app's own page shell, etc.), which is what previously left a
    // several-percent gap at the bottom instead of truly filling the page.
    // That ancestor's own height is CSS-driven (not sized by its children),
    // so reading its rect is just as loop-safe as reading window.innerHeight.
    useEffect(() => {
        if (gridDensity !== "fit") return;
        const el = containerRef.current;
        if (!el) return;

        const findScrollableAncestor = (node: HTMLElement): HTMLElement | null => {
            let current = node.parentElement;
            while (current && current !== document.body) {
                const overflowY = window.getComputedStyle(current).overflowY;
                if (overflowY === "auto" || overflowY === "scroll") return current;
                current = current.parentElement;
            }
            return null;
        };

        const recompute = () => {
            const top = el.getBoundingClientRect().top;
            const ancestor = findScrollableAncestor(el);
            const bottomBoundary = ancestor ? ancestor.getBoundingClientRect().bottom : window.innerHeight;
            const availableHeight = bottomBoundary - top;
            // The grid's own top/bottom padding lives inside this same span
            // (gridStyle.padding below) — it must come out of the budget
            // before dividing rows, or every row ends up gridPadding*2 too
            // tall in total and the grid overflows its clipping ancestor.
            const usableHeight = availableHeight - gridGap * Math.max(0, numRows - 1) - gridPadding * 2;
            const rowHeight = Math.max(FIT_PAGE_MIN_ROW_HEIGHT, Math.floor(usableHeight / numRows));
            setFitRowHeight(rowHeight);
        };

        recompute();
        window.addEventListener("resize", recompute);

        // React runs child effects before parent effects, so on first mount
        // this can fire before an ancestor (e.g. DashboardPage's own content
        // wrapper, which measures its real available height asynchronously
        // in its own effect) has settled on its final size — a plain
        // `window resize` listener never sees that later, ancestor-only
        // resize. Watching the ancestor's own box directly catches it. This
        // is the SAME ancestor referenced in `bottomBoundary` above, whose
        // size is driven by its own CSS/state (never by this grid's row
        // heights), so observing it carries none of the self-referential
        // risk called out at the top of this effect.
        const ancestor = findScrollableAncestor(el);
        const observer = ancestor ? new ResizeObserver(recompute) : null;
        if (ancestor && observer) observer.observe(ancestor);

        return () => {
            window.removeEventListener("resize", recompute);
            observer?.disconnect();
        };
    }, [gridDensity, numRows]);

    // When a cell is maximized, hide all others.
    const visibleCells = maximizedCellId
        ? cells.filter((c) => c.id === maximizedCellId)
        : cells;

    const cardMinScale = gridDensity === "fit" ? FIT_CARD_MIN_SCALE : FIXED_DENSITY_CARD_MIN_SCALE;

    const rowTrackHeight = (): string => {
        switch (gridDensity) {
            case "small":
            case "medium":
            case "large":
                return `minmax(${GRID_DENSITY_ROW_HEIGHT[gridDensity]}px, ${GRID_DENSITY_ROW_HEIGHT[gridDensity]}px)`;
            case "fit":
                return `minmax(${fitRowHeight}px, ${fitRowHeight}px)`;
            case "original":
            default:
                return "minmax(320px, auto)";
        }
    };

    const gridStyle: React.CSSProperties = {
        display: "grid",
        gridTemplateColumns: maximizedCellId
            ? "1fr"
            : `repeat(${numCols}, 1fr)`,
        gridTemplateRows: maximizedCellId
            ? "1fr"
            : `repeat(${numRows}, ${rowTrackHeight()})`,
        gap: gridGap,
        padding: gridPadding,
        height: "100%",
        boxSizing: "border-box",
    };

    if (!cells.length) {
        return <Empty description={_("No models in this tab")} style={{ padding: 48 }} />;
    }

    return (
        <div ref={containerRef} style={gridStyle}>
            {visibleCells.map((cell) => (
                <div
                    key={cell.id}
                    style={{
                        gridColumn: maximizedCellId ? "1 / -1" : `${cell.col + 1}`,
                        gridRow: maximizedCellId ? "1 / -1" : `${cell.row + 1}`,
                    }}
                >
                    <DashboardGridCell
                        cell={cell}
                        allModels={allModels}
                        isMaximized={maximizedCellId === cell.id}
                        isMinimized={minimizedCellIds.has(cell.id)}
                        canConfigureLayout={canConfigureLayout}
                        cardMinScale={cardMinScale}
                        onConfigure={() => onConfigure(cell)}
                        onMaximize={() => onMaximize(cell.id)}
                        onMinimize={() => onMinimize(cell.id)}
                        onResize={(w, h) => onResize(cell.id, w, h)}
                        onMove={(dir) => onMove(cell.id, dir)}
                        cellExtraActions={cellExtraActions}
                    />
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

    const [maximizedCellId, setMaximizedCellId] = useState<string | null>(null);
    const [minimizedCellIds, setMinimizedCellIds] = useState<Set<string>>(new Set());
    const [drawerSelection, setDrawerSelection] = useState<CellSelection | null>(null);
    const [gridDensity, setGridDensity] = useState<GridDensity>(loadStoredGridDensity);

    const handleGridDensityChange = useCallback((stepIndex: number) => {
        const next = GRID_DENSITY_STEPS[stepIndex] ?? "original";
        setGridDensity(next);
        try {
            localStorage.setItem(GRID_DENSITY_STORAGE_KEY, next);
        } catch {
            // localStorage unavailable — the preference just won't persist across reloads.
        }
    }, []);

    // Order must track GRID_DENSITY_STEPS above (Original, Small, Fit, Medium, Large).
    const gridDensityMarks = useMemo(() => ({
        0: _("Original"),
        1: _("Small"),
        2: _("Fit page"),
        3: _("Medium"),
        4: _("Large"),
    }), []);

    const handleMaximize = useCallback((cellId: string) => {
        setMaximizedCellId((prev) => (prev === cellId ? null : cellId));
    }, []);

    const handleMinimize = useCallback((cellId: string) => {
        setMinimizedCellIds((prev) => {
            const next = new Set(prev);
            if (next.has(cellId)) { next.delete(cellId); } else { next.add(cellId); }
            return next;
        });
    }, []);

    const handleOpenDrawer = useCallback((tabId: string, cell: DashboardCell) => {
        setDrawerSelection({ tabId, cell });
    }, []);

    const handleSaveConfig = useCallback((nextConfig: DashboardConfig) => {
        onConfigChange(nextConfig);
        setDrawerSelection(null);
    }, [onConfigChange]);

    const handleMoveCell = useCallback((tabId: string, cellId: string, direction: "left" | "right" | "up" | "down") => {
        const nextTabs = config.tabs.map((tab) => {
            if (tab.id !== tabId) return tab;
            const cell = tab.cells.find((c) => c.id === cellId);
            if (!cell) return tab;
            let newRow = cell.row;
            let newCol = cell.col;
            if (direction === "left")  newCol = Math.max(0, cell.col - 1);
            if (direction === "right") newCol = cell.col + 1;
            if (direction === "up")    newRow = Math.max(0, cell.row - 1);
            if (direction === "down")  newRow = cell.row + 1;
            const neighbor = tab.cells.find((c) => c.id !== cellId && c.row === newRow && c.col === newCol);
            const updatedCells = tab.cells.map((c) => {
                if (c.id === cellId) return { ...c, row: newRow, col: newCol };
                if (neighbor && c.id === neighbor.id) return { ...c, row: cell.row, col: cell.col };
                return c;
            });
            return { ...tab, cells: updatedCells };
        });
        onConfigChange({ ...config, tabs: nextTabs });
    }, [config, onConfigChange]);

    const handleResizeCell = useCallback((tabId: string, cellId: string, minWidth: string | null, minHeight: string | null) => {
        const nextTabs = config.tabs.map((tab) => {
            if (tab.id !== tabId) return tab;
            return {
                ...tab,
                cells: tab.cells.map((c) => {
                    if (c.id !== cellId) return c;
                    return {
                        ...c,
                        ...(minWidth  !== null ? { min_width:  minWidth  } : {}),
                        ...(minHeight !== null ? { min_height: minHeight } : {}),
                    };
                }),
            };
        });
        onConfigChange({ ...config, tabs: nextTabs });
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
                onChange={() => {
                    setMaximizedCellId(null);
                    setMinimizedCellIds(new Set());
                }}
                style={{ height: "100%" }}
                tabBarStyle={{ paddingLeft: 12, marginBottom: 0 }}
                tabBarExtraContent={{
                    right: (
                        // antd centers each mark's label text under its track position, so the
                        // end marks ("Original", "Large") render with text bleeding past the
                        // slider's own declared width on both sides (measured ~18px total in
                        // testing). Left unabsorbed, that bleed escapes into the tab bar and,
                        // from there, into an ancestor with overflow-x: auto — producing a real,
                        // if small, page-level horizontal scrollbar. Generous left/right padding
                        // on this wrapping div (rather than a margin on the Slider itself, which
                        // only ever addressed the left side) contains the bleed within this box
                        // on both ends instead of just shifting where it leaks from.
                        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 40px" }}>
                            <span style={{ fontSize: 13, color: token.colorTextSecondary, whiteSpace: "nowrap", marginRight: 20 }}>
                                {/* The 12px flex `gap` alone isn't enough clearance from the
                                 * "Original" mark's own leftward text bleed (see the note on the
                                 * outer div above) — this margin is what actually keeps the two
                                 * from overlapping; the outer padding only stops that same bleed
                                 * from escaping the whole control into the tab bar. */}
                                {_("Cell size")}
                            </span>
                            <Slider
                                style={{ width: 280 }}
                                min={0}
                                max={GRID_DENSITY_STEPS.length - 1}
                                step={null}
                                marks={gridDensityMarks}
                                value={GRID_DENSITY_STEPS.indexOf(gridDensity)}
                                onChange={handleGridDensityChange}
                                tooltip={{ formatter: (index?: number) => (index !== undefined ? gridDensityMarks[index as keyof typeof gridDensityMarks] : "") ?? "" }}
                            />
                        </div>
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
