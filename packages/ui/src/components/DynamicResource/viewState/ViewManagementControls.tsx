/**
 * The saved-views and layout controls of the "View configuration" card, the
 * same on list pages and related-model blocks: which saved views are shown and
 * in what order, the active view, rename, delete and save, and the layout
 * toggles (filters, list, Analyze and its orientation and position).
 */
import React from "react";
import { Button, Select, Tooltip, theme } from "antd";
import {
    ArrowDownOutlined, ArrowUpOutlined, ColumnHeightOutlined, DeleteOutlined, FilterOutlined,
    SaveOutlined, SwapOutlined, UnorderedListOutlined,
} from "@ant-design/icons";
import { AnalyzeToggleButton } from "./AnalyzeToggleButton";
import { translateText } from "../utils/i18n";

// Resolved at call time, see translateText in utils/i18n.ts.
const _ = (text: string): string => translateText(text, text);

export interface ViewManagementControlsProps {
    selectedViewNames: string[];
    availableViewNames: string[];
    isLoadingViewNames: boolean;
    onSelectedViewNamesChange: (next: string[]) => void;
    onMoveView: (name: string, direction: "up" | "down") => void;
    /** The control that picks the active view (a select or tabs, built by the page). */
    viewSelector: React.ReactNode;
    /** Rename and delete are offered only when saved views are enabled. */
    savedViewsEnabled: boolean;
    onRename: () => void;
    onDelete: () => void;
    /** Save layout needs a layout preference type and saved views. */
    canSaveLayout: boolean;
    isSavingLayout: boolean;
    onSaveLayout: () => void;
    filtersCollapsed: boolean;
    onToggleFilters: () => void;
    /** Shows or hides the data itself ("View list"); omitted where the page header offers it. */
    onToggleList?: () => void;
    /** The Analyze buttons appear only where the view type supports Analyze. */
    analyzeAvailable: boolean;
    analyzeOpen: boolean;
    onToggleAnalyze: () => void;
    onToggleAnalyzeOrientation: () => void;
    onToggleAnalyzePosition: () => void;
}

export const ViewManagementControls: React.FC<ViewManagementControlsProps> = ({
    selectedViewNames, availableViewNames, isLoadingViewNames, onSelectedViewNamesChange, onMoveView, viewSelector,
    savedViewsEnabled, onRename, onDelete, canSaveLayout, isSavingLayout, onSaveLayout,
    filtersCollapsed, onToggleFilters, onToggleList, analyzeAvailable, analyzeOpen, onToggleAnalyze,
    onToggleAnalyzeOrientation, onToggleAnalyzePosition,
}) => {
    const { token } = theme.useToken();
    return (
        <>
            <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, color: token.colorTextSecondary, fontWeight: 600 }}>{_("Views shown")}</div>
                <Select
                    mode="multiple"
                    size="small"
                    value={selectedViewNames}
                    onChange={(values) => {
                        const chosen = values as string[];
                        onSelectedViewNamesChange([
                            ...selectedViewNames.filter((name) => chosen.includes(name)),
                            ...chosen.filter((name) => !selectedViewNames.includes(name)),
                        ]);
                    }}
                    loading={isLoadingViewNames}
                    options={availableViewNames.map((name) => ({ label: name, value: name }))}
                    style={{ minWidth: 240 }}
                />
                {selectedViewNames.length > 1 && (
                    <div style={{ display: "grid", gap: 6 }}>
                        {selectedViewNames.map((name, index) => (
                            <div key={name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ flex: 1 }}>{name}</div>
                                <Tooltip title={_("Move up")}>
                                    <Button size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => onMoveView(name, "up")} />
                                </Tooltip>
                                <Tooltip title={_("Move down")}>
                                    <Button size="small" icon={<ArrowDownOutlined />} disabled={index === selectedViewNames.length - 1} onClick={() => onMoveView(name, "down")} />
                                </Tooltip>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, color: token.colorTextSecondary, fontWeight: 600 }}>{_("Active view")}</div>
                {viewSelector}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                {savedViewsEnabled && (
                    <>
                        <Button size="small" onClick={onRename}>{_("Rename view")}</Button>
                        <Button size="small" danger icon={<DeleteOutlined />} disabled={availableViewNames.length <= 1} onClick={onDelete}>
                            {_("Delete view")}
                        </Button>
                    </>
                )}
                {canSaveLayout && savedViewsEnabled && (
                    <Button size="small" icon={<SaveOutlined />} onClick={onSaveLayout} loading={isSavingLayout}>
                        {_("Save layout")}
                    </Button>
                )}
                <Button size="small" icon={<FilterOutlined />} onClick={onToggleFilters}>
                    {filtersCollapsed ? _("Show Filters") : _("Hide Filters")}
                </Button>
                {onToggleList && (
                    <Button size="small" icon={<UnorderedListOutlined />} onClick={onToggleList}>
                        {_("View list")}
                    </Button>
                )}
                {analyzeAvailable && <AnalyzeToggleButton open={analyzeOpen} onToggle={onToggleAnalyze} showLabel />}
                {analyzeAvailable && (
                    <Button size="small" icon={<ColumnHeightOutlined />} onClick={onToggleAnalyzeOrientation}>
                        {_("Switch orientation")}
                    </Button>
                )}
                {analyzeAvailable && (
                    <Button size="small" icon={<SwapOutlined />} onClick={onToggleAnalyzePosition}>
                        {_("Switch positions")}
                    </Button>
                )}
            </div>
        </>
    );
};
