import React, { useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Tooltip, Button, theme, Empty } from "antd";
import {
    SettingOutlined,
    FullscreenOutlined,
    MinusSquareOutlined,
    ArrowLeftOutlined,
    ArrowRightOutlined,
    ArrowUpOutlined,
    ArrowDownOutlined,
} from "@ant-design/icons";
import type { DashboardCell, DashboardConfig } from "./hooks/useDashboardConfig";
import { CellConfigDrawer } from "./CellConfigDrawer";
import { computeGridDims, groupCellsByRow, moveCellInConfig, resizeCellInConfig, type MoveDirection } from "./hooks/gridCellOps";
import { useCellWindowState } from "./hooks/useCellWindowState";
import { computeRowTrackHeight, useFitRowHeight, type GridDensity } from "./hooks/gridDensity";
import { FitRowCellCarousel, type FitRowCellCarouselHandle } from "./FitCellCarousel";

/** "Original" step's row-height floor for SectionsGrid — its section cards
 * historically had no floor at all (`minmax(80px, auto)`), much shorter
 * than ViewsGrid's dashboard cells (320px), so it keeps its own value
 * rather than inheriting ViewsGrid's. */
const SECTIONS_ORIGINAL_MIN_ROW_PX = 80;

// ---------------------------------------------------------------------------
// SectionsGrid — a grid of named section cards with ViewsGrid cell chrome.
// Used inside the Details and custom config tabs of show/edit pages.
// ---------------------------------------------------------------------------

interface Props {
    // All cells for this tab (source_type "field" or "relation")
    cells: DashboardCell[];
    // Synthetic DashboardConfig for CellConfigDrawer (single tab containing all cells)
    config: DashboardConfig;
    tabId: string;
    renderContent: (cell: DashboardCell) => React.ReactNode;
    onConfigChange: (next: DashboardConfig) => void;
    isConfiguring?: boolean;
    /** Cell-size preference — shared across every tab of one Show/Edit page
     * instance (its selector lives at the right edge of that page's own
     * tab bar, not inside SectionsGrid — see useStandardShowTabs/
     * useStandardEditTabs, which own the state and thread it into every
     * SectionsGrid call for the page). Defaults to "original" so this
     * matches SectionsGrid's pre-existing look until a user opts in. */
    gridDensity?: GridDensity;
}

/** Imperative handle for SectionsGrid.
 *
 * goToFirstRow/goToLastRow forward to the "fit-row"/"fit-cell" carousel's
 * own handle (see FitRowCellCarouselHandle) when that density is active; a
 * no-op otherwise, since every other density is a normal scrollable stacked
 * layout a caller can already scroll to directly (e.g. NLChatShow's own
 * conversationScrollRef) -- and, being a continuous scrollable area rather
 * than a paginated view, "first row"/"last row" isn't a meaningful notion
 * there the way "the start/end of the list" already is via plain scrolling.
 *
 * goToRow(index), unlike those two, DOES work in every density: it jumps
 * the carousel to that row, or scrollIntoView()s that row's cell in a
 * stacked layout -- there's no equivalent "just scroll" shortcut a caller
 * can already reach for to land on one specific ARBITRARY row (as opposed
 * to the start/end of the scrollable area), e.g. NLChatShow positioning on
 * whichever sentence a save just edited. */
export interface SectionsGridHandle {
    goToFirstRow: () => void;
    goToLastRow: () => void;
    goToRow: (index: number) => void;
}

// ---------------------------------------------------------------------------
// Single section cell
// ---------------------------------------------------------------------------

const SectionCell: React.FC<{
    cell: DashboardCell;
    isConfiguring: boolean;
    isMaximized: boolean;
    isMinimized: boolean;
    onConfigure: () => void;
    onMaximize: () => void;
    onMinimize: () => void;
    onMove: (direction: "left" | "right" | "up" | "down") => void;
    onResize: (minWidth: string | null, minHeight: string | null) => void;
    children: React.ReactNode;
}> = ({ cell, isConfiguring, isMaximized, isMinimized, onConfigure, onMaximize, onMinimize, onMove, onResize, children }) => {
    const { token } = theme.useToken();
    const cellRef = useRef<HTMLDivElement>(null);

    const cellStyle: React.CSSProperties = {
        position: "relative",
        // Fills whatever height the grid assigns its track. Against an
        // "auto" track (the default "Original" density) a percentage
        // height resolves to auto per the CSS spec, so this is a no-op
        // there — it only takes effect once the track has a definite size
        // (a fixed density step, or the fit-row/fit-cell carousel).
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
        background: token.colorBgContainer,
        flexShrink: 0,
        position: "relative",
    };

    const startResize = useCallback((e: React.PointerEvent, dir: "s" | "e" | "se") => {
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
            if (dir !== "e") el.style.minHeight = `${Math.max(80, Math.round(startH + ev.clientY - startY))}px`;
            if (dir !== "s") el.style.minWidth = `${Math.max(200, Math.round(startW + ev.clientX - startX))}px`;
        };
        const onUp = (ev: PointerEvent) => {
            handle.removeEventListener("pointermove", onMove);
            handle.removeEventListener("pointerup", onUp);
            document.body.style.cursor = prevCursor;
            const newH = dir !== "e" ? `${Math.max(80, Math.round(startH + ev.clientY - startY))}px` : null;
            const newW = dir !== "s" ? `${Math.max(200, Math.round(startW + ev.clientX - startX))}px` : null;
            onResize(newW, newH);
        };
        handle.addEventListener("pointermove", onMove);
        handle.addEventListener("pointerup", onUp);
    }, [onResize]);

    const handleBase: React.CSSProperties = { position: "absolute", zIndex: 10 };
    const btnStyle: React.CSSProperties = { color: token.colorTextTertiary, padding: "0 4px", height: 22, minWidth: 22 };

    return (
        <div ref={cellRef} style={cellStyle} className={`jm-section-cell ${cell.section_css_class || ''}`.trim()}>
            {isConfiguring && (
                <style>{`
                    .jm-section-cell .jm-cell-actions { opacity: 0; transition: opacity 0.15s; }
                    .jm-section-cell:hover .jm-cell-actions { opacity: 1; }
                    .jm-section-cell .jm-resize-handle { opacity: 0; transition: opacity 0.15s; background: transparent; }
                    .jm-section-cell:hover .jm-resize-handle { opacity: 1; }
                    .jm-resize-handle:hover { background: rgba(128,128,128,0.25) !important; }
                    .jm-resize-handle:active { background: rgba(128,128,128,0.45) !important; }
                    /* Collapsed by default (not just faded) so its space is actually
                       reclaimed by the cell's content, not merely hidden underneath
                       it — reveals (and only then claims its height) on hover or
                       keyboard focus, same trigger the buttons above already use. */
                    .jm-section-cell .jm-cell-toolbar {
                        max-height: 0;
                        overflow: hidden;
                        border-bottom: 1px solid transparent;
                        transition: max-height 0.15s ease, border-color 0.15s ease;
                    }
                    .jm-section-cell:hover .jm-cell-toolbar,
                    .jm-section-cell:focus-within .jm-cell-toolbar {
                        max-height: 32px;
                        border-bottom-color: ${token.colorBorderSecondary};
                    }
                `}</style>
            )}

            {isConfiguring && (
                <>
                    <div className="jm-resize-handle" style={{ ...handleBase, bottom: 0, left: 12, right: 12, height: 6, cursor: "ns-resize" }}
                        onPointerDown={(e) => startResize(e, "s")} />
                    <div className="jm-resize-handle" style={{ ...handleBase, top: 12, right: 0, bottom: 12, width: 6, cursor: "ew-resize" }}
                        onPointerDown={(e) => startResize(e, "e")} />
                    <div className="jm-resize-handle" style={{ ...handleBase, bottom: 0, right: 0, width: 12, height: 12, cursor: "nwse-resize", borderRadius: `0 0 ${token.borderRadiusLG}px 0` }}
                        onPointerDown={(e) => startResize(e, "se")} />
                </>
            )}

            {isConfiguring && (
                <div className="jm-cell-toolbar" style={toolbarStyle}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: token.colorText, paddingLeft: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {cell.section_name || cell.id}
                    </span>
                    <div className="jm-cell-actions" style={{ display: "flex", alignItems: "center", gap: 2 }}>
                        <Tooltip title="Move left">
                            <Button type="text" size="small" icon={<ArrowLeftOutlined style={{ fontSize: 10 }} />} onClick={() => onMove("left")} style={btnStyle} />
                        </Tooltip>
                        <Tooltip title="Move up">
                            <Button type="text" size="small" icon={<ArrowUpOutlined style={{ fontSize: 10 }} />} onClick={() => onMove("up")} style={btnStyle} />
                        </Tooltip>
                        <Tooltip title="Move down">
                            <Button type="text" size="small" icon={<ArrowDownOutlined style={{ fontSize: 10 }} />} onClick={() => onMove("down")} style={btnStyle} />
                        </Tooltip>
                        <Tooltip title="Move right">
                            <Button type="text" size="small" icon={<ArrowRightOutlined style={{ fontSize: 10 }} />} onClick={() => onMove("right")} style={btnStyle} />
                        </Tooltip>
                        <Tooltip title="Configure section">
                            <Button type="text" size="small" icon={<SettingOutlined style={{ fontSize: 11 }} />} onClick={onConfigure} style={btnStyle} />
                        </Tooltip>
                        <Tooltip title={isMaximized ? "Restore" : "Maximize"}>
                            <Button type="text" size="small" icon={<FullscreenOutlined style={{ fontSize: 11 }} />} onClick={onMaximize} style={btnStyle} />
                        </Tooltip>
                        <Tooltip title={isMinimized ? "Restore" : "Minimize"}>
                            <Button type="text" size="small" icon={<MinusSquareOutlined style={{ fontSize: 11 }} />} onClick={onMinimize} style={btnStyle} />
                        </Tooltip>
                    </div>
                </div>
            )}
            {(!isMinimized || !isConfiguring) && (
                <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
                    {children}
                </div>
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------
// SectionsGrid
// ---------------------------------------------------------------------------

export const SectionsGrid = React.forwardRef<SectionsGridHandle, Props>(({ cells, config, tabId, renderContent, onConfigChange, isConfiguring = false, gridDensity = "original" }, ref) => {
    const { maximizedCellId, minimizedCellIds, handleMaximize, handleMinimize } = useCellWindowState();
    const [drawerCellId, setDrawerCellId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const carouselRef = useRef<FitRowCellCarouselHandle>(null);
    // Only populated by the plain-grid (stacked) branch below, one entry per
    // row index -- purely so goToRow() has something to scrollIntoView when
    // gridDensity isn't fit-row/fit-cell. Not used to render anything (no
    // per-row chrome in stacked densities -- see SectionsGridHandle's own
    // comment for why goToFirstRow/goToLastRow don't get this fallback too).
    const rowRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

    useImperativeHandle(ref, () => ({
        goToFirstRow: () => carouselRef.current?.goToFirstRow(),
        goToLastRow: () => carouselRef.current?.goToLastRow(),
        goToRow: (index: number) => {
            if (carouselRef.current) carouselRef.current.goToRowIndex(index);
            else rowRefs.current.get(index)?.scrollIntoView({ behavior: "smooth", block: "start" });
        },
    }), []);

    const handleMove = useCallback((cellId: string, direction: MoveDirection) => {
        onConfigChange(moveCellInConfig(config, tabId, cellId, direction));
    }, [config, tabId, onConfigChange]);

    const handleResize = useCallback((cellId: string, minWidth: string | null, minHeight: string | null) => {
        onConfigChange(resizeCellInConfig(config, tabId, cellId, minWidth, minHeight));
    }, [config, tabId, onConfigChange]);

    const { numCols, numRows } = useMemo(() => computeGridDims(cells), [cells]);
    const gridGap = 8;
    const gridPadding = 8; // must match gridStyle.padding below

    // null until the very first measurement lands — see useFitRowHeight's
    // own comment for why the "fit row"/"fit cell" Carousel below must never
    // mount before this is final.
    const fitRowHeight = useFitRowHeight(containerRef, gridDensity, numRows, gridGap, gridPadding);

    // Rows occupied by exactly one section — those cells should span all
    // columns. Only meaningful for the plain CSS-grid rendering below: the
    // carousel branch already gives every row's cells the full available
    // width evenly (a solo row there is just a 1-cell `repeat(1, 1fr)`).
    const soloRows = useMemo(() => {
        const counts = new Map<number, number>();
        for (const c of cells) counts.set(c.row, (counts.get(c.row) ?? 0) + 1);
        const solo = new Set<number>();
        for (const [row, count] of counts) if (count === 1) solo.add(row);
        return solo;
    }, [cells]);

    const visibleCells = maximizedCellId
        ? cells.filter((c) => c.id === maximizedCellId)
        : cells;

    const gridStyle: React.CSSProperties = {
        display: "grid",
        gridTemplateColumns: maximizedCellId ? "1fr" : `repeat(${numCols}, 1fr)`,
        gridTemplateRows: maximizedCellId
            ? "1fr"
            : `repeat(${numRows}, ${computeRowTrackHeight(gridDensity, fitRowHeight, SECTIONS_ORIGINAL_MIN_ROW_PX, gridDensity === "large")})`,
        gap: gridGap,
        padding: gridPadding,
        boxSizing: "border-box",
    };

    if (!cells.length) {
        return <Empty description="No sections configured" style={{ padding: 24 }} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    const drawerCell = isConfiguring && drawerCellId ? cells.find((c) => c.id === drawerCellId) ?? null : null;

    const renderCell = (cell: DashboardCell) => (
        <SectionCell
            cell={cell}
            isConfiguring={isConfiguring}
            isMaximized={maximizedCellId === cell.id}
            isMinimized={minimizedCellIds.has(cell.id)}
            onConfigure={() => setDrawerCellId(cell.id)}
            onMaximize={() => handleMaximize(cell.id)}
            onMinimize={() => handleMinimize(cell.id)}
            onMove={(dir) => handleMove(cell.id, dir)}
            onResize={(w, h) => handleResize(cell.id, w, h)}
        >
            {renderContent(cell)}
        </SectionCell>
    );

    // A maximized cell already shows one cell full-bleed via the ordinary
    // grid path below — carousel navigation only kicks in when nothing is
    // maximized.
    const gridBody = (!maximizedCellId && (gridDensity === "fit-row" || gridDensity === "fit-cell")) ? (
        // Nothing to mount the Carousel against yet — see useFitRowHeight's
        // comment for why this must not fall back to a default height
        // instead. This state is resolved synchronously so this branch is
        // not user-visible.
        fitRowHeight === null ? null : (
            <FitRowCellCarousel
                ref={carouselRef}
                cellsByRow={groupCellsByRow(cells)}
                gridDensity={gridDensity}
                rowHeight={fitRowHeight}
                gridGap={gridGap}
                gridPadding={gridPadding}
                renderCell={renderCell}
            />
        )
    ) : (
        <div style={gridStyle}>
            {visibleCells.map((cell) => (
                <div
                    key={cell.id}
                    ref={(el) => { rowRefs.current.set(cell.row, el); }}
                    style={{
                        gridColumn: maximizedCellId || soloRows.has(cell.row) ? "1 / -1" : `${cell.col + 1}`,
                        gridRow: maximizedCellId ? "1 / -1" : `${cell.row + 1}`,
                    }}
                >
                    {renderCell(cell)}
                </div>
            ))}
        </div>
    );

    return (
        <>
            <div ref={containerRef} style={{ height: "100%", boxSizing: "border-box" }}>
                {gridBody}
            </div>
            <CellConfigDrawer
                open={Boolean(drawerCell)}
                cell={drawerCell}
                tabId={tabId}
                config={config}
                onClose={() => setDrawerCellId(null)}
                onSave={(nextConfig) => {
                    onConfigChange(nextConfig);
                    setDrawerCellId(null);
                }}
            />
        </>
    );
});
SectionsGrid.displayName = "SectionsGrid";

// ---------------------------------------------------------------------------
// Inline-style parser (CSS string → CSSProperties)
// ---------------------------------------------------------------------------

function parseInlineStyle(cssText: string): React.CSSProperties {
    const result: Record<string, string> = {};
    cssText.split(";").forEach((declaration) => {
        const idx = declaration.indexOf(":");
        if (idx < 0) return;
        const prop = declaration.slice(0, idx).trim();
        const value = declaration.slice(idx + 1).trim();
        if (!prop || !value) return;
        const camel = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        result[camel] = value;
    });
    return result as React.CSSProperties;
}
