/**
 * Header buttons that let a user change the layout of the page they are using
 * for the moment, without changing the page configuration. They render next to
 * the data detail (density) selector of the list, show, edit and create pages.
 *
 * - Template button (when an extension registered a page template provider)
 * - "Design options" popover: view type (list pages, always first), Analyze
 *   on/off and placement (where the resource has an Analyze area), cell size, actions button position and side-panel layout
 */
import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button, Dropdown, Popover, Segmented, Select, Switch, Tooltip, Typography } from "antd";
import type { MenuProps } from "antd";
import { LayoutOutlined, TableOutlined } from "@ant-design/icons";
import { GRID_DENSITY_STEPS, buildGridDensityLabelText, type GridDensity } from "../../../pages/dashboard/hooks/gridDensity";
import type { PanesLayoutMode } from "../utils/viewConfig";
import type { ModelDef } from "../types";
import {
    getRegisteredPageTemplateProvider,
    subscribeToPageTemplateProviderRegistration,
    type PageTemplateChoice,
} from "./pageTemplateProviderRegistry";
import {
    updateTemporaryPanesLayoutMode,
    usePublishedListAnalyzeState,
    useTemporaryPanesLayoutMode,
    useTemporaryPageLayoutOfEnclosingPage,
    type TemporaryActionsPosition,
} from "./temporaryPageLayoutStore";

const { Text } = Typography;

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

/** Display text of each list view type; the keys are the framework's view type tokens. */
function buildListViewTypeLabels(): Record<string, string> {
    return {
        "table": _("Table"),
        "editable-table": _("Editable table"),
        "list": _("List"),
        "editable-list": _("Editable list"),
        "gallery": _("Gallery"),
        "image": _("Images"),
        "calendar": _("Calendar"),
        "kanban": _("Kanban"),
        "totals-details": _("Totals and details"),
        "crosstab": _("Crosstab"),
        "editable-crosstab": _("Editable crosstab"),
        "primary": _("Primary"),
        "primary-carousel": _("Primary carousel"),
    };
}

/** Templates available for the page from the registered provider (empty when none). */
function usePageTemplateChoices(model: ModelDef | undefined, pageType: string | undefined): {
    hasProvider: boolean;
    choices: PageTemplateChoice[];
} {
    const provider = useSyncExternalStore(subscribeToPageTemplateProviderRegistration, getRegisteredPageTemplateProvider, getRegisteredPageTemplateProvider);
    const [choices, setChoices] = useState<PageTemplateChoice[]>([]);
    // The list depends on the model's name, not on the identity of its object (which
    // can change on every render), so choosing a template never makes the list reload.
    const latestModel = useRef(model);
    latestModel.current = model;
    const modelName = model?.name;
    useEffect(() => {
        if (!provider || !latestModel.current || !pageType) { setChoices([]); return; }
        let cancelled = false;
        provider.listTemplatesForPage(latestModel.current, pageType as any)
            .then((found) => { if (!cancelled) setChoices(found); })
            .catch(() => { /* keep the choices already shown */ });
        return () => { cancelled = true; };
    }, [provider, modelName, pageType]);
    return { hasProvider: Boolean(provider), choices };
}

export const TemporaryPageLayoutControls: React.FC = () => {
    const { scope, layout, change, reset } = useTemporaryPageLayoutOfEnclosingPage();
    const published = usePublishedListAnalyzeState(scope?.pageKey ?? null);
    const temporaryPanesMode = useTemporaryPanesLayoutMode();
    const { hasProvider: hasTemplateProvider, choices: templateChoices } = usePageTemplateChoices(scope?.model, scope?.pageType);
    const [moreOpen, setMoreOpen] = useState(false);
    if (!scope) return null;

    const isList = scope.pageType === "list";
    const viewTypeLabels = buildListViewTypeLabels();
    const analyzeOpen = layout.analyzeOpen ?? published?.analyzeOpen ?? false;
    const analyzeFirst = layout.analyzeFirst ?? published?.analyzeFirst ?? false;
    const analyzeVertical = layout.analyzeVertical ?? published?.analyzeVertical ?? false;
    const showAnalyze = isList && Boolean(scope.analyzeAvailable);

    const densityLabels = buildGridDensityLabelText(_);
    const showCellSize = Boolean(scope.cellSizeAvailable);
    // Offered whenever an extension supplies templates, and kept while one is applied,
    // so the user can always choose another one (or go back to the configured layout).
    const showTemplate = hasTemplateProvider && (templateChoices.length > 0 || Boolean(layout.templateName));
    const templateMenu: MenuProps = {
        selectable: true,
        selectedKeys: [layout.templateName ?? ""],
        items: [
            { key: "", label: _("Configured layout") },
            ...templateChoices.map((choice) => ({
                key: choice.name,
                label: choice.description ? <Tooltip title={choice.description}><span>{choice.label}</span></Tooltip> : choice.label,
            })),
        ],
        onClick: ({ key }) => change({ templateName: key || undefined }),
    };
    const showViewType = isList && (scope.listViewTypes?.length ?? 0) > 0;
    const moreContent = (
        <div style={{ width: 300, display: "flex", flexDirection: "column", gap: 10 }}>
            <Text strong>{_("Temporary layout")}</Text>
            <Text type="secondary">{_("These changes last until the page is reloaded and do not change the page configuration.")}</Text>
            {showViewType && (
                <>
                    <Text>{_("View type")}</Text>
                    <Select<string>
                        size="small"
                        value={layout.listViewType ?? scope.currentListViewType}
                        options={(scope.listViewTypes ?? []).map((token) => ({ value: token, label: viewTypeLabels[token] ?? token }))}
                        onChange={(value) => change({ listViewType: value })}
                    />
                </>
            )}
            {showAnalyze && (
                <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <Text>{_("Analyze")}</Text>
                        <Switch size="small" checked={analyzeOpen} aria-label={_("Analyze")} onChange={(checked) => change({ analyzeOpen: checked })} />
                    </div>
                    <Text>{_("Analyze position")}</Text>
                    <Segmented
                        block
                        value={analyzeFirst ? "first" : "last"}
                        options={[{ label: _("After the data"), value: "last" }, { label: _("Before the data"), value: "first" }]}
                        onChange={(value) => change({ analyzeFirst: value === "first" })}
                    />
                    <Segmented
                        block
                        value={analyzeVertical ? "vertical" : "horizontal"}
                        options={[{ label: _("Stacked"), value: "horizontal" }, { label: _("Side by side"), value: "vertical" }]}
                        onChange={(value) => change({ analyzeVertical: value === "vertical" })}
                    />
                </>
            )}
            {showCellSize && (
                <>
                    <Text>{_("Cell size")}</Text>
                    <Select<GridDensity>
                        size="small"
                        value={layout.cellSize}
                        placeholder={_("Configured")}
                        allowClear
                        options={GRID_DENSITY_STEPS.map((step) => ({ value: step, label: densityLabels[step] }))}
                        onChange={(value) => change({ cellSize: value })}
                    />
                </>
            )}
            <Text>{_("Action buttons position")}</Text>
            <Segmented
                block
                value={layout.actionsPosition ?? ""}
                options={[
                    { label: _("Configured"), value: "" },
                    { label: _("Top right"), value: "top-right" },
                    { label: _("Left"), value: "left" },
                    { label: _("Right"), value: "right" },
                ]}
                onChange={(value) => change({ actionsPosition: (value || undefined) as TemporaryActionsPosition | undefined })}
            />
            <Text>{_("Side panels layout")}</Text>
            <Select<PanesLayoutMode>
                size="small"
                value={temporaryPanesMode}
                placeholder={_("Configured")}
                allowClear
                options={[
                    { value: "stack", label: _("Stack") },
                    { value: "breadcrumb", label: _("Breadcrumb") },
                    { value: "overlay", label: _("Overlay") },
                    { value: "scroll", label: _("Scroll") },
                ]}
                onChange={(value) => updateTemporaryPanesLayoutMode(value)}
            />
            <Button size="small" onClick={reset}>{_("Back to the configured layout")}</Button>
        </div>
    );

    return (
        <>
            {showTemplate && (
                <Dropdown menu={templateMenu} trigger={["click"]}>
                    <Tooltip title={_("Change the page template for now")}>
                        <Button size="small" icon={<LayoutOutlined />} type={layout.templateName ? "primary" : "default"} aria-label={_("Page template")} />
                    </Tooltip>
                </Dropdown>
            )}
            <Popover content={moreContent} trigger="click" open={moreOpen} onOpenChange={setMoreOpen} placement="bottomRight">
                <Tooltip title={_("Design options")}>
                    <Button size="small" icon={<TableOutlined />} aria-label={_("Design options")} />
                </Tooltip>
            </Popover>
        </>
    );
};
