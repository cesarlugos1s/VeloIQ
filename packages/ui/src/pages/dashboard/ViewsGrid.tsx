import React, { useCallback, useMemo, useRef, useState } from "react";
import { useCan } from "@refinedev/core";
import { Tabs, Tooltip, Button, theme, Empty } from "antd";
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
import type { DashboardCell, DashboardConfig, DashboardTab } from "./hooks/useDashboardConfig";
import { CellConfigDrawer } from "./CellConfigDrawer";

interface Props {
    config: DashboardConfig;
    allModels: ModelDef[];
    onConfigChange: (next: DashboardConfig) => void;
}

interface CellSelection {
    cell: DashboardCell;
    tabId: string;
}

// ---------------------------------------------------------------------------
// Single grid cell
// ---------------------------------------------------------------------------

const DashboardGridCell: React.FC<{
    cell: DashboardCell;
    allModels: ModelDef[];
    isMaximized: boolean;
    isMinimized: boolean;
    canConfigureLayout: boolean;
    onConfigure: () => void;
    onMaximize: () => void;
    onMinimize: () => void;
    onResize: (minWidth: string | null, minHeight: string | null) => void;
    onMove: (direction: "left" | "right" | "up" | "down") => void;
}> = ({ cell, allModels, isMaximized, isMinimized, canConfigureLayout, onConfigure, onMaximize, onMinimize, onResize, onMove }) => {
    const { token } = theme.useToken();
    const model = findModelByName(allModels, cell.model);
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

    const resource = model?.resource || cell.model;
    const isModelLike = cell.source_type === "model" || cell.source_type === "named_query";
    const cellTitle = isModelLike
        ? (model?.label || cell.model)
        : (cell.section_name || cell.model);
    const tone = (isModelLike && model) ? getModelTone(model) : null;

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
                    {model ? (
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
    onMaximize: (cellId: string) => void;
    onMinimize: (cellId: string) => void;
    onConfigure: (cell: DashboardCell) => void;
    onResize: (cellId: string, minWidth: string | null, minHeight: string | null) => void;
    onMove: (cellId: string, direction: "left" | "right" | "up" | "down") => void;
}> = ({ tab, allModels, maximizedCellId, minimizedCellIds, canConfigureLayout, onMaximize, onMinimize, onConfigure, onResize, onMove }) => {
    const cells = tab.cells;

    const numCols = useMemo(() => {
        if (!cells.length) return 2;
        return Math.max(...cells.map((c) => c.col)) + 1;
    }, [cells]);

    const numRows = useMemo(() => {
        if (!cells.length) return 1;
        return Math.max(...cells.map((c) => c.row)) + 1;
    }, [cells]);

    // When a cell is maximized, hide all others.
    const visibleCells = maximizedCellId
        ? cells.filter((c) => c.id === maximizedCellId)
        : cells;

    const gridStyle: React.CSSProperties = {
        display: "grid",
        gridTemplateColumns: maximizedCellId
            ? "1fr"
            : `repeat(${numCols}, 1fr)`,
        gridTemplateRows: maximizedCellId
            ? "1fr"
            : `repeat(${numRows}, minmax(320px, auto))`,
        gap: 12,
        padding: 12,
        height: "100%",
        boxSizing: "border-box",
    };

    if (!cells.length) {
        return <Empty description="No models in this tab" style={{ padding: 48 }} />;
    }

    return (
        <div style={gridStyle}>
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
                        onConfigure={() => onConfigure(cell)}
                        onMaximize={() => onMaximize(cell.id)}
                        onMinimize={() => onMinimize(cell.id)}
                        onResize={(w, h) => onResize(cell.id, w, h)}
                        onMove={(dir) => onMove(cell.id, dir)}
                    />
                </div>
            ))}
        </div>
    );
};

// ---------------------------------------------------------------------------
// ViewsGrid — the reusable top-level component
// ---------------------------------------------------------------------------

export const ViewsGrid: React.FC<Props> = ({ config, allModels, onConfigChange }) => {
    const { data: canLayoutData } = useCan({ resource: "veloiq_layout", action: "configure_layout" });
    const canConfigureLayout = canLayoutData?.can !== false;

    const [maximizedCellId, setMaximizedCellId] = useState<string | null>(null);
    const [minimizedCellIds, setMinimizedCellIds] = useState<Set<string>>(new Set());
    const [drawerSelection, setDrawerSelection] = useState<CellSelection | null>(null);

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
            label: tab.name,
            children: (
                <DashboardTabContent
                    tab={tab}
                    allModels={allModels}
                    maximizedCellId={maximizedCellId}
                    minimizedCellIds={minimizedCellIds}
                    canConfigureLayout={canConfigureLayout}
                    onMaximize={handleMaximize}
                    onMinimize={handleMinimize}
                    onConfigure={(cell) => handleOpenDrawer(tab.id, cell)}
                    onResize={(cellId, w, h) => handleResizeCell(tab.id, cellId, w, h)}
                    onMove={(cellId, dir) => handleMoveCell(tab.id, cellId, dir)}
                />
            ),
        })),
        [config.tabs, allModels, maximizedCellId, minimizedCellIds, canConfigureLayout, handleMaximize, handleMinimize, handleOpenDrawer, handleResizeCell, handleMoveCell]
    );

    if (!config.tabs.length) {
        return <Empty description="No tabs configured. Run veloiq add-dashboard to add models." style={{ padding: 48 }} />;
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
