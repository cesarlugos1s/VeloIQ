import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, UNSAFE_RouteContext } from "react-router-dom";
import { PANE_TOOLBAR_HEIGHT } from "../../contexts/PaneNavigationContext";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import type { GroupImperativeHandle } from "react-resizable-panels";
import { Button, Tooltip, theme } from "antd";
import { CloseOutlined, LinkOutlined, MinusSquareOutlined, FullscreenOutlined } from "@ant-design/icons";
import { PaneNavigationContext } from "../../contexts/PaneNavigationContext";
import { PrimaryShowContext } from "../DynamicResource";
import { useAllModels } from "../../contexts/AllModelsContext";
import { parsePanes, applyPanesToSearchParams, type PaneEntry } from "./paneUtils";
import { findModelByName, resolveResourcePath } from "../DynamicResource/utils/model";
import type { ModelDef } from "../DynamicResource/types";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

const LIST_PANEL_ID = "list-panel";
const detailPanelId = (idx: number) => `detail-panel-${idx}`;

const COLLAPSED_SIZE = 10;

// ---------------------------------------------------------------------------
// FakeRouteProvider — injects the pane's id into react-router's route context
// so hooks like useParams() inside the panel read the correct id.
// ---------------------------------------------------------------------------
const FakeRouteProvider: React.FC<{ model: ModelDef; id: string; children: React.ReactNode }> = ({ model, id, children }) => {
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

// ---------------------------------------------------------------------------
// PaneToolbar — only the 4 pane management buttons; no title rendering.
// The page inside the pane renders its own title via its normal heading.
// ---------------------------------------------------------------------------
const PaneToolbar: React.FC<{
    model: ModelDef;
    pane: PaneEntry;
    allModels: ModelDef[];
    onClose: () => void;
    onMinimize: () => void;
    onMaximize: () => void;
}> = ({ model, pane, allModels, onClose, onMinimize, onMaximize }) => {
    const { token } = theme.useToken();
    const resourcePath = resolveResourcePath(model.resource || model.name, allModels);
    const href = `/${resourcePath}/show/${pane.id}`;

    return (
        <div
            style={{
                position: "sticky",
                top: 0,
                zIndex: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                padding: "2px 6px",
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
                background: token.colorBgContainer,
                flexShrink: 0,
                gap: 2,
                minHeight: PANE_TOOLBAR_HEIGHT,
            }}
        >
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
            <Tooltip title={_("Minimize pane")}>
                <Button
                    type="text"
                    size="small"
                    icon={<MinusSquareOutlined style={{ fontSize: 11 }} />}
                    onClick={onMinimize}
                    style={{ color: token.colorTextTertiary, padding: "0 4px", height: 22, minWidth: 22 }}
                />
            </Tooltip>
            <Tooltip title={_("Maximize pane")}>
                <Button
                    type="text"
                    size="small"
                    icon={<FullscreenOutlined style={{ fontSize: 11 }} />}
                    onClick={onMaximize}
                    style={{ color: token.colorTextTertiary, padding: "0 4px", height: 22, minWidth: 22 }}
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
    );
};

// ---------------------------------------------------------------------------
// Styled resize handle
// ---------------------------------------------------------------------------
const ResizeHandle: React.FC = () => {
    const { token } = theme.useToken();
    return (
        <PanelResizeHandle
            style={{
                width: 6,
                background: "transparent",
                cursor: "col-resize",
                flexShrink: 0,
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <div
                style={{
                    width: 2,
                    height: "100%",
                    background: token.colorBorder,
                    transition: "background 0.15s, width 0.15s",
                }}
                className="jm-resize-handle-bar"
            />
            <style>{`
                [data-separator][data-active] .jm-resize-handle-bar,
                [data-separator]:hover .jm-resize-handle-bar {
                    background: ${token.colorPrimary} !important;
                    width: 3px !important;
                }
            `}</style>
        </PanelResizeHandle>
    );
};

// ---------------------------------------------------------------------------
// MultiPaneLayout
// URL scheme: ?pane=resourcePath:id  (repeatable)
//
// Sizing rule: when a new panel opens, it gets 80% of the rightmost current
// panel's width; that rightmost panel shrinks to its remaining 20%.
// ---------------------------------------------------------------------------
export const MultiPaneLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [panelHeight, setPanelHeight] = useState<string>("100vh");

    useLayoutEffect(() => {
        const measure = () => {
            if (!containerRef.current) return;
            const top = containerRef.current.getBoundingClientRect().top;
            setPanelHeight(`${window.innerHeight - top}px`);
        };
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, []);

    const [searchParams, setSearchParams] = useSearchParams();
    const allModels = useAllModels();
    const PrimaryShowRenderer = useContext(PrimaryShowContext);
    const { token } = theme.useToken();

    const panes = useMemo(() => parsePanes(searchParams), [searchParams]);

    // --- Imperative ref for the PanelGroup so we can call getLayout/setLayout ---
    const groupRef = useRef<GroupImperativeHandle | null>(null);

    // Snapshot of the layout taken just before openDetail mutates the URL.
    // Used by the layout-redistribution effect below.
    const pendingLayoutRef = useRef<{ [panelId: string]: number } | null>(null);
    // Track the panel count we already handled so we only act on increments.
    const prevPaneCountRef = useRef(0);

    // -----------------------------------------------------------------------
    // After a new panel is added, apply the 80/20 split imperatively.
    // requestAnimationFrame ensures the new Panel has registered itself with
    // the Group (panel registration happens in a child useEffect, which runs
    // before rAF fires).
    // -----------------------------------------------------------------------
    useEffect(() => {
        const newCount = panes.length;
        const prevCount = prevPaneCountRef.current;

        // On page refresh the groupRef isn't available yet on first run,
        // and pendingLayoutRef is null (not a new panel being added interactively).
        // Don't advance prevPaneCountRef in that case so the next render can
        // fall through to the 80/20 split logic.
        if (!pendingLayoutRef.current || !groupRef.current) {
            pendingLayoutRef.current = null;
            return;
        }

        if (newCount <= prevCount) {
            pendingLayoutRef.current = null;
            return;
        }

        prevPaneCountRef.current = newCount;

        const prevLayout = pendingLayoutRef.current;
        pendingLayoutRef.current = null;

        // The rightmost panel before this addition is the one that "donates" space.
        const donorId = prevCount === 0 ? LIST_PANEL_ID : detailPanelId(prevCount - 1);
        const donorSize = prevLayout[donorId] ?? 100;

        const newId = detailPanelId(newCount - 1);
        const newLayout: { [panelId: string]: number } = {
            ...prevLayout,
            [donorId]: donorSize * 0.2,
            [newId]: donorSize * 0.8,
        };

        const frameId = requestAnimationFrame(() => {
            groupRef.current?.setLayout(newLayout);
        });

        return () => cancelAnimationFrame(frameId);
    }, [panes.length]); // eslint-disable-line react-hooks/exhaustive-deps

    // -----------------------------------------------------------------------
    // Navigation
    // -----------------------------------------------------------------------
    const openDetail = useCallback(
        (fromPaneIndex: number, resource: string, id: string | number) => {
            // Snapshot the current layout BEFORE the URL change triggers a re-render.
            if (groupRef.current) {
                pendingLayoutRef.current = { ...groupRef.current.getLayout() };
            }

            setSearchParams(
                (prev) => {
                    const current = parsePanes(prev);
                    const resolved = resolveResourcePath(resource, allModels);
                    const next: PaneEntry[] = [
                        ...current.slice(0, fromPaneIndex),
                        { resource: resolved || resource.toLowerCase(), id: String(id) },
                    ];
                    return applyPanesToSearchParams(prev, next);
                },
                { replace: false },
            );
        },
        [allModels, setSearchParams],
    );

    const closePane = useCallback(
        (fromArrayIndex: number) => {
            setSearchParams(
                (prev) => {
                    const current = parsePanes(prev);
                    return applyPanesToSearchParams(prev, current.slice(0, fromArrayIndex));
                },
                { replace: false },
            );
        },
        [setSearchParams],
    );

    // -----------------------------------------------------------------------
    // Minimize / Maximize individual panes
    // -----------------------------------------------------------------------
    const minimizePane = useCallback((panelId: string) => {
        if (!groupRef.current) return;
        const layout = groupRef.current.getLayout();
        const currentSize = layout[panelId] ?? COLLAPSED_SIZE;
        if (currentSize <= COLLAPSED_SIZE + 1) return;
        const freed = currentSize - COLLAPSED_SIZE;
        const otherIds = Object.keys(layout).filter((id) => id !== panelId);
        const otherTotal = otherIds.reduce((sum, id) => sum + (layout[id] ?? 0), 0);
        const newLayout: { [id: string]: number } = { ...layout, [panelId]: COLLAPSED_SIZE };
        otherIds.forEach((id) => {
            const frac = otherTotal > 0 ? (layout[id] ?? 0) / otherTotal : 1 / otherIds.length;
            newLayout[id] = (layout[id] ?? 0) + freed * frac;
        });
        groupRef.current.setLayout(newLayout);
    }, []);

    const maximizePane = useCallback((panelId: string) => {
        if (!groupRef.current) return;
        const layout = groupRef.current.getLayout();
        const panelIds = Object.keys(layout);
        const n = panelIds.length;
        const maxSize = 100 - COLLAPSED_SIZE * (n - 1);
        const newLayout: { [id: string]: number } = {};
        panelIds.forEach((id) => {
            newLayout[id] = id === panelId ? maxSize : COLLAPSED_SIZE;
        });
        groupRef.current.setLayout(newLayout);
    }, []);

    // -----------------------------------------------------------------------
    // Stable context values (memoised to avoid unnecessary re-renders)
    // -----------------------------------------------------------------------
    const listPaneContext = useMemo(
        () => ({
            isInMultiPane: true,
            paneIndex: 0,
            openDetail: (resource: string, id: string | number) => openDetail(0, resource, id),
        }),
        [openDetail],
    );

    const detailPaneContexts = useMemo(
        () =>
            panes.map((_, idx) => ({
                isInMultiPane: true,
                paneIndex: idx + 1,
                openDetail: (resource: string, id: string | number) =>
                    openDetail(idx + 1, resource, id),
            })),
        [panes, openDetail],
    );

    // -----------------------------------------------------------------------
    // Build flat panel children (Fragments break react-resizable-panels v4)
    // -----------------------------------------------------------------------
    const panelChildren = useMemo(() => {
        const result: React.ReactNode[] = [
            <Panel key="master-list" id={LIST_PANEL_ID} minSize={10} style={{ overflow: "auto" }}>
                <PaneNavigationContext.Provider value={listPaneContext}>
                    {children}
                </PaneNavigationContext.Provider>
            </Panel>,
        ];

        panes.forEach((pane, idx) => {
            const paneModel = findModelByName(allModels, pane.resource);
            if (!paneModel) return;

            result.push(<ResizeHandle key={`handle-${idx}`} />);
            result.push(
                <Panel
                    key={`panel-${pane.resource}:${pane.id}`}
                    id={detailPanelId(idx)}
                    minSize={10}
                    style={{ overflow: "auto", borderLeft: `2px solid ${token.colorBorder}` }}
                >
                    <PaneNavigationContext.Provider value={detailPaneContexts[idx]}>
                        <PaneToolbar
                            model={paneModel}
                            pane={pane}
                            allModels={allModels}
                            onClose={() => closePane(idx)}
                            onMinimize={() => minimizePane(detailPanelId(idx))}
                            onMaximize={() => maximizePane(detailPanelId(idx))}
                        />
                        {PrimaryShowRenderer && (
                            <FakeRouteProvider model={paneModel} id={pane.id}>
                                <PrimaryShowRenderer
                                    model={paneModel}
                                    id={pane.id}
                                    allModels={allModels}
                                />
                            </FakeRouteProvider>
                        )}
                    </PaneNavigationContext.Provider>
                </Panel>,
            );
        });

        return result;
    }, [panes, allModels, listPaneContext, detailPaneContexts, children, closePane, minimizePane, maximizePane, PrimaryShowRenderer, token.colorBorder]);

    return (
        <div ref={containerRef} className="jm-full-width-page" style={{ overflow: "hidden", height: panelHeight }}>
            <PanelGroup
                orientation="horizontal"
                groupRef={groupRef}
                style={{ flex: 1, height: "100%" }}
            >
                {panelChildren}
            </PanelGroup>
        </div>
    );
};
