import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import type { GroupImperativeHandle } from "react-resizable-panels";
import { theme } from "antd";
import { PaneNavigationContext } from "../../contexts/PaneNavigationContext";
import {
    LIST_PANEL_ID,
    SPINE_WIDTH_PX,
    computeInitialStackLayout,
    computeStackLayout,
    detailPanelId,
    splitVisibleAndSpines,
    type StackLayout,
} from "./paneUtils";
import { MainLabelText, PaneBody, PaneLabelText, PaneSpine, useMainPaneLabel } from "./PaneParts";
import type { PaneLayoutProps } from "./types";

/** Percent of the group a minimized / non-active pane keeps when another is maximized or hover-expanded. */
const COLLAPSED_SIZE = 10;

// Hover-to-expand tuning: delay before expanding avoids reacting to a pointer
// just passing through; delay before reverting avoids collapsing on a brief
// mouse move within the pane (e.g. reaching for a button). Duration is the
// tween length for both expand and revert.
const HOVER_EXPAND_DELAY = 180;
const HOVER_COLLAPSE_DELAY = 150;
const HOVER_ANIM_DURATION = 180;

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

/** True when two id arrays hold the same ids in the same order. */
const sameIds = (a: string[], b: string[]): boolean => a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * "stack" layout: the resizable right-side panel split, extended with a cap on
 * how many panels stay fully visible.
 *
 * The main page and every detail pane are panels of one resizable group. Only
 * the last `cap` of them are shown in full; older ones collapse into 40px
 * spines (rotated record label) that stay mounted so their state is preserved.
 * Clicking a spine restores that pane and drops the ones after it.
 *
 * When a new pane opens it takes 80% of the rightmost visible pane's width.
 * Each pane's maximize/minimize buttons stay, and hovering a visible pane
 * expands it temporarily (hover-to-expand).
 */
export const SplitPaneLayout: React.FC<
    PaneLayoutProps & { registerBeforeNavigate: (fn: (() => void) | null) => void }
> = ({
    entries, allModels, listContent, listContext, detailContexts, PrimaryShowRenderer,
    closeFrom, containerWidth, cap, registerBeforeNavigate,
}) => {
    const { token } = theme.useToken();
    const mainLabel = useMainPaneLabel(allModels);

    // --- Imperative ref for the PanelGroup so we can call getLayout/setLayout ---
    const groupRef = useRef<GroupImperativeHandle | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Ordered ids of every pane, and the split into full panes and spines.
    const entryIds = useMemo(
        () => [LIST_PANEL_ID, ...entries.map((e) => detailPanelId(e.idx))],
        [entries],
    );
    const { visible, spines } = useMemo(() => splitVisibleAndSpines(entryIds, cap), [entryIds, cap]);
    const spinePct = (SPINE_WIDTH_PX / (containerWidth || window.innerWidth)) * 100;

    // Refs mirroring the latest values for use inside timers and listeners.
    const visibleRef = useRef<string[]>(visible);
    visibleRef.current = visible;
    const spinePctRef = useRef(spinePct);
    spinePctRef.current = spinePct;

    // -----------------------------------------------------------------------
    // Hover-to-expand: hovering a pane temporarily expands it to the same
    // width the "maximize" button would give it, then reverts on hover-out.
    // This never touches committed state — it only drives groupRef.setLayout()
    // as a transient overlay, so a stray hover can never leave the layout in
    // an inconsistent spot after a re-render.
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
    const hoverRestoreLayoutRef = useRef<StackLayout | null>(null);
    // Layout captured right before a maximize, so "restore" can put it back
    // exactly (rather than resetting to an arbitrary even split).
    const preMaximizeLayoutRef = useRef<StackLayout | null>(null);
    // Same idea per-pane for minimize, since more than one pane can be minimized.
    const preMinimizeLayoutsRef = useRef<Map<string, StackLayout>>(new Map());
    const hoverTimersRef = useRef<{ in: ReturnType<typeof setTimeout> | null; out: ReturnType<typeof setTimeout> | null }>({ in: null, out: null });
    const hoverAnimFrameRef = useRef<number | null>(null);

    const clearHoverTimers = useCallback(() => {
        if (hoverTimersRef.current.in) clearTimeout(hoverTimersRef.current.in);
        if (hoverTimersRef.current.out) clearTimeout(hoverTimersRef.current.out);
        hoverTimersRef.current.in = null;
        hoverTimersRef.current.out = null;
    }, []);

    /** Tweens the group layout to `targetLayout` over `duration` ms (ease-out cubic). */
    const animateLayoutTo = useCallback((targetLayout: StackLayout, duration: number) => {
        if (!groupRef.current) return;
        if (hoverAnimFrameRef.current) cancelAnimationFrame(hoverAnimFrameRef.current);
        const startLayout = groupRef.current.getLayout();
        const startTime = performance.now();
        const ids = new Set([...Object.keys(startLayout), ...Object.keys(targetLayout)]);
        const step = (now: number) => {
            const t = Math.min(1, (now - startTime) / duration);
            const eased = 1 - Math.pow(1 - t, 3);
            const frame: StackLayout = {};
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

    /**
     * Builds the layout that gives `panelId` the most room: every other visible
     * pane keeps `COLLAPSED_SIZE` percent and the spines keep their width.
     */
    const expandedLayoutFor = useCallback((layout: StackLayout, panelId: string): StackLayout => {
        const visibleIds = visibleRef.current;
        const spineTotal = Object.keys(layout).filter((id) => !visibleIds.includes(id)).reduce((sum, id) => sum + (layout[id] ?? 0), 0);
        const maxSize = 100 - spineTotal - COLLAPSED_SIZE * (visibleIds.length - 1);
        const target: StackLayout = { ...layout };
        visibleIds.forEach((id) => {
            target[id] = id === panelId ? maxSize : COLLAPSED_SIZE;
        });
        return target;
    }, []);

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
            animateLayoutTo(expandedLayoutFor(layout, panelId), HOVER_ANIM_DURATION);
        }, HOVER_EXPAND_DELAY);
    }, [hoverSupported, animateLayoutTo, expandedLayoutFor]);

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
        const wrapper = wrapperRef.current;
        if (!wrapper || !hoverSupported) return;
        const onPointerDown = (e: PointerEvent) => {
            if ((e.target as HTMLElement)?.closest?.("[data-separator]")) {
                isDraggingRef.current = true;
                cancelHoverExpand();
            }
        };
        const onPointerUp = () => {
            isDraggingRef.current = false;
        };
        wrapper.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("pointerup", onPointerUp);
        return () => {
            wrapper.removeEventListener("pointerdown", onPointerDown);
            window.removeEventListener("pointerup", onPointerUp);
        };
    }, [hoverSupported, cancelHoverExpand]);

    useEffect(() => () => {
        clearHoverTimers();
        if (hoverAnimFrameRef.current) cancelAnimationFrame(hoverAnimFrameRef.current);
    }, [clearHoverTimers]);

    // -----------------------------------------------------------------------
    // Layout bookkeeping across pane changes
    // -----------------------------------------------------------------------
    // Snapshot of the layout taken just before navigation mutates the URL, and
    // the last layout the group reported (fallback for e.g. the browser Back button).
    const snapshotRef = useRef<StackLayout | null>(null);
    const lastLayoutRef = useRef<StackLayout | null>(null);
    const prevIdsRef = useRef<string[] | null>(null);
    const prevVisibleRef = useRef<string[]>(visible);

    // Before any URL change (open, close, spine click): a new pane always
    // starts from a clean slate — drop hover-expand, forget maximize/minimize —
    // and remember the real, pre-change layout for the redistribution below.
    useEffect(() => {
        registerBeforeNavigate(() => {
            setMaximizedPaneId(null);
            preMaximizeLayoutRef.current = null;
            setMinimizedPaneIds(() => new Set());
            preMinimizeLayoutsRef.current.clear();
            cancelHoverExpand();
            if (groupRef.current) snapshotRef.current = { ...groupRef.current.getLayout() };
        });
        return () => registerBeforeNavigate(null);
    }, [registerBeforeNavigate, cancelHoverExpand, setMaximizedPaneId, setMinimizedPaneIds]);

    // Initial layout on mount (page refresh / load from URL): replay the same
    // sequential 80/20 splits interactive navigation would have produced.
    const [defaultLayout] = useState<StackLayout | undefined>(() =>
        entries.length === 0
            ? undefined
            : computeInitialStackLayout(entries.map((e) => detailPanelId(e.idx)), cap, spinePct),
    );

    // When the set of panes (or the cap) changes, redistribute the layout: a
    // single appended pane splits the rightmost visible pane 80/20, older panes
    // that no longer fit become spines, and restored spines get an equal share.
    // requestAnimationFrame ensures new Panels registered with the group first.
    const idsKey = entryIds.join("|");
    useEffect(() => {
        const prevIds = prevIdsRef.current;
        const prevVisible = prevVisibleRef.current;
        prevIdsRef.current = entryIds;
        prevVisibleRef.current = visible;
        if (!prevIds) return;
        if (sameIds(prevIds, entryIds) && sameIds(prevVisible, visible)) return;

        const snapshot = snapshotRef.current ?? lastLayoutRef.current ?? groupRef.current?.getLayout() ?? null;
        snapshotRef.current = null;
        if (!snapshot) return;

        const appended = entryIds.length === prevIds.length + 1 && prevIds.every((id, i) => entryIds[i] === id);
        const next = computeStackLayout(snapshot, prevVisible, entryIds, cap, spinePctRef.current, appended);
        const frameId = requestAnimationFrame(() => groupRef.current?.setLayout(next));
        return () => cancelAnimationFrame(frameId);
    }, [idsKey, cap]); // eslint-disable-line react-hooks/exhaustive-deps

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

        // The freed room goes to the other visible panes (never to spines).
        const freed = currentSize - COLLAPSED_SIZE;
        const otherIds = visibleRef.current.filter((id) => id !== panelId);
        const otherTotal = otherIds.reduce((sum, id) => sum + (layout[id] ?? 0), 0);
        const newLayout: StackLayout = { ...layout, [panelId]: COLLAPSED_SIZE };
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
        groupRef.current.setLayout(expandedLayoutFor(groupRef.current.getLayout(), panelId));
    }, [cancelHoverExpand, setMaximizedPaneId, setMinimizedPaneIds, expandedLayoutFor]);

    // -----------------------------------------------------------------------
    // Build flat panel children (Fragments break react-resizable-panels v4).
    // Spines are ordinary panels pinned to 40px so their content stays mounted.
    // -----------------------------------------------------------------------
    const panelChildren = useMemo(() => {
        const spineSize = `${SPINE_WIDTH_PX}px`;
        const isSpine = (id: string) => spines.includes(id);
        const result: React.ReactNode[] = [];

        const listIsSpine = isSpine(LIST_PANEL_ID);
        result.push(
            <Panel
                key="master-list"
                id={LIST_PANEL_ID}
                minSize={listIsSpine ? spineSize : 10}
                maxSize={listIsSpine ? spineSize : undefined}
                groupResizeBehavior={listIsSpine ? "preserve-pixel-size" : "preserve-relative-size"}
                style={{ overflow: listIsSpine ? "hidden" : "auto", position: "relative" }}
                onMouseEnter={listIsSpine ? undefined : () => handlePaneHoverStart(LIST_PANEL_ID)}
                onMouseLeave={listIsSpine ? undefined : handlePaneHoverEnd}
            >
                <PaneNavigationContext.Provider value={listContext}>
                    <div style={{ display: listIsSpine ? "none" : "contents" }}>{listContent}</div>
                </PaneNavigationContext.Provider>
                {listIsSpine && (
                    <PaneSpine
                        label={<MainLabelText allModels={allModels} />}
                        title={mainLabel}
                        onClick={() => closeFrom(0)}
                        style={{ position: "absolute", inset: 0, borderLeft: 0 }}
                    />
                )}
            </Panel>,
        );

        entries.forEach((e, i) => {
            const panelId = detailPanelId(e.idx);
            const spine = isSpine(panelId);
            // A resize handle only sits between two fully visible panels.
            if (!spine && !isSpine(entryIds[i])) {
                result.push(<ResizeHandle key={`handle-${e.idx}`} />);
            }
            result.push(
                <Panel
                    key={`panel-${e.key}`}
                    id={panelId}
                    minSize={spine ? spineSize : 10}
                    maxSize={spine ? spineSize : undefined}
                    groupResizeBehavior={spine ? "preserve-pixel-size" : "preserve-relative-size"}
                    style={{ overflow: spine ? "hidden" : "auto", position: "relative", borderLeft: `2px solid ${token.colorBorder}` }}
                    onMouseEnter={spine ? undefined : () => handlePaneHoverStart(panelId)}
                    onMouseLeave={spine ? undefined : handlePaneHoverEnd}
                >
                    <div style={{ display: spine ? "none" : "contents" }}>
                        <PaneBody
                            resolved={e}
                            allModels={allModels}
                            navContext={detailContexts[e.idx]}
                            PrimaryShowRenderer={PrimaryShowRenderer}
                            maximized={maximizedPaneId === panelId}
                            minimized={minimizedPaneIds.has(panelId)}
                            hoverToExpand={hoverSupported}
                            onClose={() => closeFrom(e.idx)}
                            onMinimize={() => minimizePane(panelId)}
                            onMaximize={() => maximizePane(panelId)}
                        />
                    </div>
                    {spine && (
                        <PaneSpine
                            label={<PaneLabelText model={e.model} id={e.pane.id} />}
                                                        onClick={() => closeFrom(e.idx + 1)}
                            style={{ position: "absolute", inset: 0, borderLeft: 0 }}
                        />
                    )}
                </Panel>,
            );
        });

        return result;
    }, [entries, entryIds, spines, allModels, listContext, listContent, detailContexts, PrimaryShowRenderer, closeFrom, minimizePane, maximizePane, token.colorBorder, handlePaneHoverStart, handlePaneHoverEnd, maximizedPaneId, minimizedPaneIds, hoverSupported, mainLabel]);

    return (
        <div ref={wrapperRef} style={{ height: "100%", width: "100%" }}>
            <PanelGroup
                orientation="horizontal"
                defaultLayout={defaultLayout}
                groupRef={groupRef}
                onLayoutChange={(layout) => { lastLayoutRef.current = layout; }}
                style={{ flex: 1, height: "100%" }}
            >
                {panelChildren}
            </PanelGroup>
        </div>
    );
};
