import React, { useContext, useMemo } from "react";
import { UNSAFE_RouteContext, useParams } from "react-router-dom";
import { useOne, useResource } from "@refinedev/core";
import { Button, Tooltip, theme } from "antd";
import { CloseOutlined, LinkOutlined, MinusSquareOutlined, PlusSquareOutlined, FullscreenOutlined, FullscreenExitOutlined } from "@ant-design/icons";
import { PANE_TOOLBAR_HEIGHT, PaneNavigationContext, type PaneNavigationValue } from "../../contexts/PaneNavigationContext";
import { findModelByName, resolveResourcePath } from "../DynamicResource/utils/model";
import { asDisplayText } from "../DynamicResource/utils/i18n";
import type { ModelDef, PrimaryShowRendererProps } from "../DynamicResource/types";
import type { PaneEntry } from "./paneUtils";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

/** A detail pane whose model resolved: its URL entry, its position in the URL pane array and its model. */
export interface ResolvedPane {
    pane: PaneEntry;
    /** Index of the pane in the URL `?pane=` array (0-based). */
    idx: number;
    model: ModelDef;
    /** Stable identity of the record shown, `resource:id`. */
    key: string;
}

// ---------------------------------------------------------------------------
// FakeRouteProvider — injects the pane's id into react-router's route context
// so hooks like useParams() inside the panel read the correct id.
// ---------------------------------------------------------------------------
export const FakeRouteProvider: React.FC<{ model: ModelDef; id: string; children: React.ReactNode }> = ({ model, id, children }) => {
    const existingRouteContext = useContext(UNSAFE_RouteContext);
    const fakeRouteContext = useMemo(() => ({
        ...existingRouteContext,
        matches: [
            ...existingRouteContext.matches,
            {
                params: { id: String(id) },
                pathname: `/${model.resource || model.name.toLowerCase()}/show/${id}`,
                pathnameBase: `/${model.resource || model.name.toLowerCase()}/show/${id}`,
                route: {} as any,
            },
        ],
    }), [existingRouteContext, id, model]);

    return (
        <UNSAFE_RouteContext.Provider value={fakeRouteContext}>
            {children}
        </UNSAFE_RouteContext.Provider>
    );
};

/**
 * Returns the display label of the record shown in a pane, using the same
 * source as the Show page title (`record._label`) and falling back to the
 * model's label while the record loads. The fetch shares Refine's query cache
 * with the pane's own Show page, so it normally costs no extra request.
 */
export const usePaneLabel = (model: ModelDef, id: string): string => {
    const { data } = useOne({ resource: model.resource || model.name, id });
    const modelLabel = asDisplayText(model.label, asDisplayText(model.name, "Record"));
    const recordLabel = (data?.data as any)?._label;
    return recordLabel ? asDisplayText(recordLabel, modelLabel) : modelLabel;
};

/**
 * Returns the label of the main (non-pane) page the layout wraps: the record
 * label when it is a Show page, otherwise the model's label for a list page.
 */
export const useMainPaneLabel = (allModels: ModelDef[]): string => {
    const { resource } = useResource();
    const { id } = useParams();
    const resourceName = resource?.name ?? "";
    const model = resourceName ? findModelByName(allModels, resourceName) : undefined;
    const { data } = useOne({
        resource: resourceName,
        id: id ?? "",
        queryOptions: { enabled: Boolean(resourceName && id) },
    });
    const modelLabel = asDisplayText(model?.label, asDisplayText(resource?.meta?.label, resourceName || _("Back to list")));
    const recordLabel = (data?.data as any)?._label;
    return id && recordLabel ? asDisplayText(recordLabel, modelLabel) : modelLabel;
};

/** Renders just the label text of a pane's record (for breadcrumb trails). */
export const PaneLabelText: React.FC<{ model: ModelDef; id: string }> = ({ model, id }) => <>{usePaneLabel(model, id)}</>;

/** Renders just the label text of the main page (for breadcrumb trails and spines). */
export const MainLabelText: React.FC<{ allModels: ModelDef[] }> = ({ allModels }) => <>{useMainPaneLabel(allModels)}</>;

// ---------------------------------------------------------------------------
// PaneSpine — narrow vertical strip standing in for a collapsed pane. It shows
// the record label rotated and restores the pane when clicked.
// ---------------------------------------------------------------------------
export const PaneSpine: React.FC<{
    /** Label text to show rotated along the strip. */
    label: React.ReactNode;
    /** Plain-text label for the accessible name; the tooltip shows `label` when omitted. */
    title?: string;
    onClick: () => void;
    /** Extra positioning styles (e.g. absolute placement for overlay drawers). */
    style?: React.CSSProperties;
}> = ({ label, title, onClick, style }) => {
    const { token } = theme.useToken();
    return (
        <Tooltip title={title ?? label} placement="left">
            <button
                type="button"
                aria-label={title}
                onClick={onClick}
                className="jm-pane-spine"
                style={{
                    width: "100%",
                    height: "100%",
                    padding: "8px 0",
                    border: 0,
                    borderLeft: `2px solid ${token.colorBorder}`,
                    background: token.colorBgLayout,
                    color: token.colorTextSecondary,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    overflow: "hidden",
                    ...style,
                }}
            >
                <span
                    style={{
                        writingMode: "vertical-rl",
                        transform: "rotate(180deg)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxHeight: "100%",
                        fontSize: 12,
                        fontWeight: 600,
                    }}
                >
                    {label}
                </span>
            </button>
            <style>{`.jm-pane-spine:hover { background: ${token.colorPrimaryBg} !important; color: ${token.colorPrimary} !important; }`}</style>
        </Tooltip>
    );
};

// ---------------------------------------------------------------------------
// PaneToolbar — the 4 pane management buttons (open in full page, minimize,
// maximize, close), plus an optional leading slot (used by the breadcrumb
// trail). The page inside the pane renders its own title.
// ---------------------------------------------------------------------------
export const PaneToolbar: React.FC<{
    model: ModelDef;
    pane: PaneEntry;
    allModels: ModelDef[];
    maximized: boolean;
    minimized: boolean;
    /** True when hover-to-expand exists in the current mode (changes the restore tooltip). */
    hoverToExpand: boolean;
    /** Content rendered at the left of the toolbar, e.g. the breadcrumb trail. */
    leading?: React.ReactNode;
    onClose: () => void;
    onMinimize: () => void;
    onMaximize: () => void;
}> = ({ model, pane, allModels, maximized, minimized, hoverToExpand, leading, onClose, onMinimize, onMaximize }) => {
    const { token } = theme.useToken();
    const resourcePath = resolveResourcePath(model.resource || model.name, allModels);
    const href = `/${resourcePath}/show/${pane.id}`;
    const restoreTitle = hoverToExpand ? _("Restore pane (also re-enables hover-to-expand)") : _("Restore pane");

    return (
        <div
            style={{
                position: "sticky",
                top: 0,
                zIndex: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: leading ? "space-between" : "flex-end",
                padding: "2px 6px",
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
                background: token.colorBgContainer,
                flexShrink: 0,
                gap: 2,
                minHeight: PANE_TOOLBAR_HEIGHT,
            }}
        >
            {leading && <div style={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden" }}>{leading}</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                <Tooltip title={_("Open in full page")}>
                    <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: token.colorTextTertiary, display: "flex", alignItems: "center", padding: "0 4px" }}
                    >
                        <LinkOutlined style={{ fontSize: 11 }} />
                    </a>
                </Tooltip>
                <Tooltip title={minimized ? restoreTitle : _("Minimize pane")}>
                    <Button
                        type="text"
                        size="small"
                        icon={minimized ? <PlusSquareOutlined style={{ fontSize: 11 }} /> : <MinusSquareOutlined style={{ fontSize: 11 }} />}
                        onClick={onMinimize}
                        style={{
                            color: minimized ? token.colorPrimary : token.colorTextTertiary,
                            background: minimized ? token.colorPrimaryBg : "transparent",
                            padding: "0 4px",
                            height: 22,
                            minWidth: 22,
                            borderRadius: 4,
                        }}
                    />
                </Tooltip>
                <Tooltip title={maximized ? restoreTitle : _("Maximize pane")}>
                    <Button
                        type="text"
                        size="small"
                        icon={maximized ? <FullscreenExitOutlined style={{ fontSize: 11 }} /> : <FullscreenOutlined style={{ fontSize: 11 }} />}
                        onClick={onMaximize}
                        style={{
                            color: maximized ? token.colorPrimary : token.colorTextTertiary,
                            background: maximized ? token.colorPrimaryBg : "transparent",
                            padding: "0 4px",
                            height: 22,
                            minWidth: 22,
                            borderRadius: 4,
                        }}
                    />
                </Tooltip>
                <Tooltip title={_("Close pane")}>
                    <Button
                        type="text"
                        size="small"
                        icon={<CloseOutlined style={{ fontSize: 11 }} />}
                        onClick={onClose}
                        style={{ color: token.colorTextTertiary, padding: "0 4px", height: 22, minWidth: 22 }}
                    />
                </Tooltip>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// PaneBody — toolbar + the Show page of a detail pane, wrapped in the pane's
// navigation context so links opened inside it create further panes.
// ---------------------------------------------------------------------------
export const PaneBody: React.FC<{
    resolved: ResolvedPane;
    allModels: ModelDef[];
    navContext: PaneNavigationValue;
    PrimaryShowRenderer: React.ComponentType<PrimaryShowRendererProps> | null | undefined;
    maximized: boolean;
    minimized: boolean;
    hoverToExpand: boolean;
    leading?: React.ReactNode;
    onClose: () => void;
    onMinimize: () => void;
    onMaximize: () => void;
}> = ({ resolved, allModels, navContext, PrimaryShowRenderer, maximized, minimized, hoverToExpand, leading, onClose, onMinimize, onMaximize }) => (
    <PaneNavigationContext.Provider value={navContext}>
        <PaneToolbar
            model={resolved.model}
            pane={resolved.pane}
            allModels={allModels}
            maximized={maximized}
            minimized={minimized}
            hoverToExpand={hoverToExpand}
            leading={leading}
            onClose={onClose}
            onMinimize={onMinimize}
            onMaximize={onMaximize}
        />
        {PrimaryShowRenderer && (
            <FakeRouteProvider model={resolved.model} id={resolved.pane.id}>
                <PrimaryShowRenderer model={resolved.model} id={resolved.pane.id} allModels={allModels} />
            </FakeRouteProvider>
        )}
    </PaneNavigationContext.Provider>
);
