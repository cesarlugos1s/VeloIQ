import React, { useCallback, useMemo, useState } from "react";
import { Tabs, Tooltip, Button, theme, Empty } from "antd";
import {
    SettingOutlined,
    FullscreenOutlined,
    MinusSquareOutlined,
    LinkOutlined,
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
    onConfigure: () => void;
    onMaximize: () => void;
    onMinimize: () => void;
}> = ({ cell, allModels, isMaximized, isMinimized, onConfigure, onMaximize, onMinimize }) => {
    const { token } = theme.useToken();
    const model = findModelByName(allModels, cell.model);

    const cellStyle: React.CSSProperties = {
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
    const cellTitle = model?.label || cell.model;
    const tone = model ? getModelTone(model) : null;

    return (
        <div style={cellStyle} className="jm-dashboard-cell">
            <style>{`
                .jm-dashboard-cell .jm-cell-actions { opacity: 0; transition: opacity 0.15s; }
                .jm-dashboard-cell:hover .jm-cell-actions { opacity: 1; }
            `}</style>
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
                <Tooltip title="Configure cell">
                    <Button
                        type="text" size="small"
                        icon={<SettingOutlined style={{ fontSize: 11 }} />}
                        onClick={onConfigure}
                        style={{ color: token.colorTextTertiary, padding: "0 4px", height: 22, minWidth: 22 }}
                    />
                </Tooltip>
                <Tooltip title="Open full page">
                    <Link to={`/${resource}`} style={{ color: token.colorTextTertiary, display: "flex", alignItems: "center", padding: "0 4px" }}>
                        <LinkOutlined style={{ fontSize: 11 }} />
                    </Link>
                </Tooltip>
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
                            model={model}
                            allModels={allModels}
                            isEmbedded
                            preferencesResourceOverride={`dashboard:${resource}`}
                            defaultListVisible={false}
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
    onMaximize: (cellId: string) => void;
    onMinimize: (cellId: string) => void;
    onConfigure: (cell: DashboardCell) => void;
}> = ({ tab, allModels, maximizedCellId, minimizedCellIds, onMaximize, onMinimize, onConfigure }) => {
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
                        onConfigure={() => onConfigure(cell)}
                        onMaximize={() => onMaximize(cell.id)}
                        onMinimize={() => onMinimize(cell.id)}
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
                    onMaximize={handleMaximize}
                    onMinimize={handleMinimize}
                    onConfigure={(cell) => handleOpenDrawer(tab.id, cell)}
                />
            ),
        })),
        [config.tabs, allModels, maximizedCellId, minimizedCellIds, handleMaximize, handleMinimize, handleOpenDrawer]
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
