import React, { useCallback, useMemo, useRef, useState } from "react";
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
                <div style={toolbarStyle}>
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

export const SectionsGrid: React.FC<Props> = ({ cells, config, tabId, renderContent, onConfigChange, isConfiguring = false }) => {
    const [maximizedCellId, setMaximizedCellId] = useState<string | null>(null);
    const [minimizedCellIds, setMinimizedCellIds] = useState<Set<string>>(new Set());
    const [drawerCellId, setDrawerCellId] = useState<string | null>(null);

    const handleMaximize = useCallback((cellId: string) => {
        setMaximizedCellId((prev) => (prev === cellId ? null : cellId));
    }, []);

    const handleMinimize = useCallback((cellId: string) => {
        setMinimizedCellIds((prev) => {
            const next = new Set(prev);
            next.has(cellId) ? next.delete(cellId) : next.add(cellId);
            return next;
        });
    }, []);

    const handleMove = useCallback((cellId: string, direction: "left" | "right" | "up" | "down") => {
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
            return {
                ...tab,
                cells: tab.cells.map((c) => {
                    if (c.id === cellId) return { ...c, row: newRow, col: newCol };
                    if (neighbor && c.id === neighbor.id) return { ...c, row: cell.row, col: cell.col };
                    return c;
                }),
            };
        });
        onConfigChange({ ...config, tabs: nextTabs });
    }, [config, tabId, onConfigChange]);

    const handleResize = useCallback((cellId: string, minWidth: string | null, minHeight: string | null) => {
        const nextTabs = config.tabs.map((tab) => {
            if (tab.id !== tabId) return tab;
            return {
                ...tab,
                cells: tab.cells.map((c) => {
                    if (c.id !== cellId) return c;
                    return {
                        ...c,
                        ...(minWidth !== null ? { min_width: minWidth } : {}),
                        ...(minHeight !== null ? { min_height: minHeight } : {}),
                    };
                }),
            };
        });
        onConfigChange({ ...config, tabs: nextTabs });
    }, [config, tabId, onConfigChange]);

    const numCols = useMemo(() => {
        if (!cells.length) return 1;
        return Math.max(...cells.map((c) => c.col)) + 1;
    }, [cells]);

    const numRows = useMemo(() => {
        if (!cells.length) return 1;
        return Math.max(...cells.map((c) => c.row)) + 1;
    }, [cells]);

    // Rows occupied by exactly one section — those cells should span all columns.
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
        gridTemplateRows: maximizedCellId ? "1fr" : `repeat(${numRows}, minmax(80px, auto))`,
        gap: 8,
        padding: 8,
        boxSizing: "border-box",
    };

    if (!cells.length) {
        return <Empty description="No sections configured" style={{ padding: 24 }} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    const drawerCell = isConfiguring && drawerCellId ? cells.find((c) => c.id === drawerCellId) ?? null : null;

    return (
        <>
            <div style={gridStyle}>
                {visibleCells.map((cell) => (
                    <div
                        key={cell.id}
                        style={{
                            gridColumn: maximizedCellId || soloRows.has(cell.row) ? "1 / -1" : `${cell.col + 1}`,
                            gridRow: maximizedCellId ? "1 / -1" : `${cell.row + 1}`,
                        }}
                    >
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
                    </div>
                ))}
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
};

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
