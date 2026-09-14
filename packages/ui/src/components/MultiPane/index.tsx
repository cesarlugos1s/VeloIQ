import React, { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, UNSAFE_RouteContext } from "react-router-dom";
import { PANE_TOOLBAR_HEIGHT } from "../../contexts/PaneNavigationContext";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import type { GroupImperativeHandle } from "react-resizable-panels";
import { Button, Tooltip, theme } from "antd";
import { CloseOutlined, LinkOutlined, MinusSquareOutlined, PlusSquareOutlined, FullscreenOutlined, FullscreenExitOutlined } from "@ant-design/icons";
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

// Hover-to-expand tuning: delay before expanding avoids reacting to a pointer
// just passing through; delay before reverting avoids collapsing on a brief
// mouse move within the pane (e.g. reaching for a button). Duration is the
// tween length for both expand and revert.
const HOVER_EXPAND_DELAY = 180;
const HOVER_COLLAPSE_DELAY = 150;
const HOVER_ANIM_DURATION = 180;

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
    maximized: boolean;
    minimized: boolean;
    onClose: () => void;
    onMinimize: () => void;
    onMaximize: () => void;
}> = ({ model, pane, allModels, maximized, minimized, onClose, onMinimize, onMaximize }) => {
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
            <Tooltip title={minimized ? _("Restore pane (also re-enables hover-to-expand)") : _("Minimize pane")}>
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
            <Tooltip title={maximized ? _("Restore pane (also re-enables hover-to-expand)") : _("Maximize pane")}>
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
            // Subtract parent's padding-bottom so the panel fits within the
            // viewport precisely — otherwise the parent's bottom padding pushes
            // content past the visible area, forcing an unnecessary scrollbar.
            const parent = containerRef.current.parentElement;
            let padBottom = 0;
            if (parent) {
                const style = window.getComputedStyle(parent);
                padBottom = parseFloat(style.paddingBottom) || 0;
            }
            setPanelHeight(`${window.innerHeight - top - padBottom}px`);
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
    // Hover-to-expand: hovering a pane temporarily expands it to the same
    // width the "maximize" button would give it, then reverts on hover-out.
    // This never touches committed state (URL / pendingLayoutRef) — it only
    // drives groupRef.setLayout() as a transient overlay, so a stray hover
    // can never leave the layout in an inconsistent spot after a re-render.
    // -----------------------------------------------------------------------
    const hoverSupported = useMemo(
        () => typeof window !== "undefined" && !!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches,
        [],
    );
    const isDraggingRef = useRef(false);
    // Reactive copy (drives the toolbar's maximize-button highlight) plus a
    // ref for synchronous reads inside timeouts/event listeners.
    const [maximizedPaneId, setMaximizedPaneIdState] = useState<string | null>(null);
    const maximizedPaneIdRef = useRef<string | null>(null);
    const setMaximizedPaneId = useCallback((id: string | null) => {
        maximizedPaneIdRef.current = id;
        setMaximizedPaneIdState(id);
    }, []);
    // Same pattern for minimize — multiple panes can be minimized at once, so
    // this is a set rather than a single id.
    const [minimizedPaneIds, setMinimizedPaneIdsState] = useState<Set<string>>(() => new Set());
    const minimizedPaneIdsRef = useRef<Set<string>>(new Set());
    const setMinimizedPaneIds = useCallback((updater: (prev: Set<string>) => Set<string>) => {
        setMinimizedPaneIdsState((prev) => {
            const next = updater(prev);
            minimizedPaneIdsRef.current = next;
            return next;
        });
    }, []);
    // Layout to restore to on hover-out; null when no hover-expand is active.
    const hoverRestoreLayoutRef = useRef<{ [panelId: string]: number } | null>(null);
    // Layout captured right before a maximize, so "restore" can put it back
    // exactly (rather than resetting to an arbitrary even split).
    const preMaximizeLayoutRef = useRef<{ [panelId: string]: number } | null>(null);
    // Same idea per-pane for minimize, since more than one pane can be minimized.
    const preMinimizeLayoutsRef = useRef<Map<string, { [panelId: string]: number }>>(new Map());
    const hoverTimersRef = useRef<{ in: ReturnType<typeof setTimeout> | null; out: ReturnType<typeof setTimeout> | null }>({ in: null, out: null });
    const hoverAnimFrameRef = useRef<number | null>(null);

    const clearHoverTimers = useCallback(() => {
        if (hoverTimersRef.current.in) clearTimeout(hoverTimersRef.current.in);
        if (hoverTimersRef.current.out) clearTimeout(hoverTimersRef.current.out);
        hoverTimersRef.current.in = null;
        hoverTimersRef.current.out = null;
    }, []);

    const animateLayoutTo = useCallback((targetLayout: { [panelId: string]: number }, duration: number) => {
        if (!groupRef.current) return;
        if (hoverAnimFrameRef.current) cancelAnimationFrame(hoverAnimFrameRef.current);
        const startLayout = groupRef.current.getLayout();
        const startTime = performance.now();
        const ids = new Set([...Object.keys(startLayout), ...Object.keys(targetLayout)]);
        const step = (now: number) => {
            const t = Math.min(1, (now - startTime) / duration);
            const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
            const frame: { [panelId: string]: number } = {};
            ids.forEach((id) => {
                const from = startLayout[id] ?? targetLayout[id] ?? 0;
                const to = targetLayout[id] ?? startLayout[id] ?? 0;
                frame[id] = from + (to - from) * eased;
            });
            groupRef.current?.setLayout(frame);
            hoverAnimFrameRef.current = t < 1 ? requestAnimationFrame(step) : null;
        };
        hoverAnimFrameRef.current = requestAnimationFrame(step);
    }, []);

    // Cancel any pending/active hover-expand and snap back to the pre-hover
    // layout immediately (no tween) — used when something else must win
    // outright, e.g. a drag starting or a new pane opening.
    const cancelHoverExpand = useCallback(() => {
        clearHoverTimers();
        if (hoverAnimFrameRef.current) {
            cancelAnimationFrame(hoverAnimFrameRef.current);
            hoverAnimFrameRef.current = null;
        }
        if (hoverRestoreLayoutRef.current && groupRef.current) {
            groupRef.current.setLayout(hoverRestoreLayoutRef.current);
        }
        hoverRestoreLayoutRef.current = null;
    }, [clearHoverTimers]);

    const handlePaneHoverStart = useCallback((panelId: string) => {
        if (!hoverSupported || isDraggingRef.current || maximizedPaneIdRef.current || minimizedPaneIdsRef.current.size > 0) return;
        if (hoverTimersRef.current.out) {
            clearTimeout(hoverTimersRef.current.out);
            hoverTimersRef.current.out = null;
        }
        if (hoverTimersRef.current.in) clearTimeout(hoverTimersRef.current.in);
        hoverTimersRef.current.in = setTimeout(() => {
            hoverTimersRef.current.in = null;
            if (!groupRef.current || isDraggingRef.current || maximizedPaneIdRef.current || minimizedPaneIdsRef.current.size > 0) return;
            const layout = groupRef.current.getLayout();
            if (!hoverRestoreLayoutRef.current) {
                hoverRestoreLayoutRef.current = { ...layout };
            }
            const panelIds = Object.keys(layout);
            const n = panelIds.length;
            const maxSize = 100 - COLLAPSED_SIZE * (n - 1);
            const target: { [id: string]: number } = {};
            panelIds.forEach((id) => {
                target[id] = id === panelId ? maxSize : COLLAPSED_SIZE;
            });
            animateLayoutTo(target, HOVER_ANIM_DURATION);
        }, HOVER_EXPAND_DELAY);
    }, [hoverSupported, animateLayoutTo]);

    const handlePaneHoverEnd = useCallback(() => {
        if (!hoverSupported) return;
        if (hoverTimersRef.current.in) {
            clearTimeout(hoverTimersRef.current.in);
            hoverTimersRef.current.in = null;
        }
        if (hoverTimersRef.current.out) clearTimeout(hoverTimersRef.current.out);
        hoverTimersRef.current.out = setTimeout(() => {
            hoverTimersRef.current.out = null;
            if (hoverRestoreLayoutRef.current) {
                animateLayoutTo(hoverRestoreLayoutRef.current, HOVER_ANIM_DURATION);
                hoverRestoreLayoutRef.current = null;
            }
        }, HOVER_COLLAPSE_DELAY);
    }, [hoverSupported, animateLayoutTo]);

    // Manual drag always wins: cancel any hover-expand the instant a resize
    // handle is grabbed, and block hover-expand until the drag ends.
    useEffect(() => {
        const container = containerRef.current;
        if (!container || !hoverSupported) return;
        const onPointerDown = (e: PointerEvent) => {
            if ((e.target as HTMLElement)?.closest?.("[data-separator]")) {
                isDraggingRef.current = true;
                cancelHoverExpand();
            }
        };
        const onPointerUp = () => {
            isDraggingRef.current = false;
        };
        container.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("pointerup", onPointerUp);
        return () => {
            container.removeEventListener("pointerdown", onPointerDown);
            window.removeEventListener("pointerup", onPointerUp);
        };
    }, [hoverSupported, cancelHoverExpand]);

    useEffect(() => () => {
        clearHoverTimers();
        if (hoverAnimFrameRef.current) cancelAnimationFrame(hoverAnimFrameRef.current);
    }, [clearHoverTimers]);

    // -----------------------------------------------------------------------
    // defaultLayout: the initial layout when the PanelGroup mounts (page
    // refresh / initial load from URL).  We simulate the same sequential
    // 80/20 cascading splits that interactive navigation would produce.
    // -----------------------------------------------------------------------
    const defaultLayout = useMemo(() => {
        if (panes.length === 0) return undefined;
        let layout: { [id: string]: number } = { [LIST_PANEL_ID]: 100 };
        for (let i = 0; i < panes.length; i++) {
            const donorId = i === 0 ? LIST_PANEL_ID : detailPanelId(i - 1);
            const donorSize = layout[donorId] ?? 100;
            layout = {
                ...layout,
                [donorId]: donorSize * 0.2,
                [detailPanelId(i)]: donorSize * 0.8,
            };
        }
        return layout;
    }, [panes.length]);

    // -----------------------------------------------------------------------
    // When a new panel is added interactively (via openDetail), apply the
    // 80/20 split imperatively.  requestAnimationFrame ensures the new Panel
    // has registered itself with the Group before we call setLayout.
    // -----------------------------------------------------------------------
    useEffect(() => {
        const newCount = panes.length;
        const prevCount = prevPaneCountRef.current;

        // Only handle interactive navigation (pendingLayoutRef was set by
        // openDetail just before the URL changed).  Page-refresh layouts are
        // handled declaratively via defaultLayout.
        if (!pendingLayoutRef.current) {
            return;
        }

        if (!groupRef.current || newCount <= prevCount) {
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
            // A new pane opening always starts from a clean slate: drop any
            // hover-expand override and forget maximize/minimize state so the
            // 80/20 cascade below applies to the real, pre-hover layout.
            setMaximizedPaneId(null);
            preMaximizeLayoutRef.current = null;
            setMinimizedPaneIds(() => new Set());
            preMinimizeLayoutsRef.current.clear();
            cancelHoverExpand();

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
        [allModels, setSearchParams, cancelHoverExpand, setMaximizedPaneId, setMinimizedPaneIds],
    );

    const closePane = useCallback(
        (fromArrayIndex: number) => {
            setMaximizedPaneId(null);
            preMaximizeLayoutRef.current = null;
            setMinimizedPaneIds(() => new Set());
            preMinimizeLayoutsRef.current.clear();
            cancelHoverExpand();
            setSearchParams(
                (prev) => {
                    const current = parsePanes(prev);
                    return applyPanesToSearchParams(prev, current.slice(0, fromArrayIndex));
                },
                { replace: false },
            );
        },
        [setSearchParams, cancelHoverExpand, setMaximizedPaneId, setMinimizedPaneIds],
    );

    // -----------------------------------------------------------------------
    // Minimize / Maximize individual panes
    // -----------------------------------------------------------------------
    // Minimize toggles too, mirroring maximize: clicking it again (or the
    // button, which relabels itself "Restore") puts the layout back to what
    // it was right before minimizing, and — since hover-expand is suppressed
    // globally while any pane is minimized — removing the last minimized pane
    // re-enables hover-to-expand.
    const minimizePane = useCallback((panelId: string) => {
        if (!groupRef.current) return;

        if (minimizedPaneIdsRef.current.has(panelId)) {
            const restoreLayout = preMinimizeLayoutsRef.current.get(panelId) ?? null;
            preMinimizeLayoutsRef.current.delete(panelId);
            setMinimizedPaneIds((prev) => {
                const next = new Set(prev);
                next.delete(panelId);
                return next;
            });
            if (restoreLayout) groupRef.current.setLayout(restoreLayout);
            return;
        }

        // Minimize is its own explicit action — it discards any pending
        // "restore to pre-maximize layout" since that layout no longer applies.
        if (maximizedPaneIdRef.current === panelId) setMaximizedPaneId(null);
        preMaximizeLayoutRef.current = null;
        cancelHoverExpand();

        const layout = groupRef.current.getLayout();
        const currentSize = layout[panelId] ?? COLLAPSED_SIZE;
        if (currentSize <= COLLAPSED_SIZE + 1) return;

        preMinimizeLayoutsRef.current.set(panelId, { ...layout });
        setMinimizedPaneIds((prev) => new Set(prev).add(panelId));

        const freed = currentSize - COLLAPSED_SIZE;
        const otherIds = Object.keys(layout).filter((id) => id !== panelId);
        const otherTotal = otherIds.reduce((sum, id) => sum + (layout[id] ?? 0), 0);
        const newLayout: { [id: string]: number } = { ...layout, [panelId]: COLLAPSED_SIZE };
        otherIds.forEach((id) => {
            const frac = otherTotal > 0 ? (layout[id] ?? 0) / otherTotal : 1 / otherIds.length;
            newLayout[id] = (layout[id] ?? 0) + freed * frac;
        });
        groupRef.current.setLayout(newLayout);
    }, [cancelHoverExpand, setMaximizedPaneId, setMinimizedPaneIds]);

    // Maximize toggles: clicking it again (or the button, which relabels
    // itself "Restore") puts the layout back to what it was right before
    // maximizing, and clears maximizedPaneId — which also re-enables
    // hover-to-expand, since that's suppressed only while a pane is maximized.
    const maximizePane = useCallback((panelId: string) => {
        if (!groupRef.current) return;

        if (maximizedPaneIdRef.current === panelId) {
            const restoreLayout = preMaximizeLayoutRef.current;
            preMaximizeLayoutRef.current = null;
            setMaximizedPaneId(null);
            if (restoreLayout) groupRef.current.setLayout(restoreLayout);
            return;
        }

        // Maximize is an explicit, sticky choice — it wins over hover-expand,
        // which is suppressed entirely while a pane is maximized. It also
        // overrides any per-pane minimize state, whose saved restore layouts
        // would no longer match the post-maximize layout anyway.
        preMaximizeLayoutRef.current = { ...groupRef.current.getLayout() };
        setMaximizedPaneId(panelId);
        setMinimizedPaneIds(() => new Set());
        preMinimizeLayoutsRef.current.clear();
        cancelHoverExpand();
        const layout = groupRef.current.getLayout();
        const panelIds = Object.keys(layout);
        const n = panelIds.length;
        const maxSize = 100 - COLLAPSED_SIZE * (n - 1);
        const newLayout: { [id: string]: number } = {};
        panelIds.forEach((id) => {
            newLayout[id] = id === panelId ? maxSize : COLLAPSED_SIZE;
        });
        groupRef.current.setLayout(newLayout);
    }, [cancelHoverExpand, setMaximizedPaneId, setMinimizedPaneIds]);

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
            <Panel
                key="master-list"
                id={LIST_PANEL_ID}
                minSize={10}
                style={{ overflow: "auto" }}
                onMouseEnter={() => handlePaneHoverStart(LIST_PANEL_ID)}
                onMouseLeave={handlePaneHoverEnd}
            >
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
                    onMouseEnter={() => handlePaneHoverStart(detailPanelId(idx))}
                    onMouseLeave={handlePaneHoverEnd}
                >
                    <PaneNavigationContext.Provider value={detailPaneContexts[idx]}>
                        <PaneToolbar
                            model={paneModel}
                            pane={pane}
                            allModels={allModels}
                            maximized={maximizedPaneId === detailPanelId(idx)}
                            minimized={minimizedPaneIds.has(detailPanelId(idx))}
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
    }, [panes, allModels, listPaneContext, detailPaneContexts, children, closePane, minimizePane, maximizePane, PrimaryShowRenderer, token.colorBorder, handlePaneHoverStart, handlePaneHoverEnd, maximizedPaneId, minimizedPaneIds]);

    return (
        <div ref={containerRef} className="jm-full-width-page" style={{ overflow: "hidden", height: panelHeight }}>
            <PanelGroup
                orientation="horizontal"
                defaultLayout={defaultLayout}
                groupRef={groupRef}
                style={{ flex: 1, height: "100%" }}
            >
                {panelChildren}
            </PanelGroup>
        </div>
    );
};
