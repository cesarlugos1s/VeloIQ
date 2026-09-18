import React, { useEffect, useRef, useState } from "react";
import { Breadcrumb, theme } from "antd";
import { HomeOutlined } from "@ant-design/icons";
import { PaneNavigationContext } from "../../contexts/PaneNavigationContext";
import { OVERLAY_OFFSET_PX, SPINE_WIDTH_PX } from "./paneUtils";
import { MainLabelText, PaneBody, PaneLabelText, PaneSpine, useMainPaneLabel } from "./PaneParts";
import type { PaneLayoutProps } from "./types";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

/** Layout modes rendered by `FlexPaneLayout`. */
export type FlexPaneMode = "breadcrumb" | "overlay" | "scroll";

/** Maximize/minimize state, tagged with the pane signature it was set for. */
interface CollapseState {
    /** Pane signature (`resource:id` of every pane) the state applies to. */
    signature: string;
    /** Key of the maximized pane, if any. */
    maximized: string | null;
    /** Keys of the minimized panes. */
    minimized: string[];
}

/**
 * Renders the detail panes in one of the non-resizable layout modes:
 *
 * In every mode `fixedWidth` (the `panes_fixed_width` setting) is a minimum
 * page width; pages use any extra room.
 *
 * - `breadcrumb`: the main page plus a single side panel that share the width
 *   equally (shrinking together only if the window cannot fit both minimums); the
 *   panes opened before it are kept as a breadcrumb trail in its toolbar.
 * - `overlay`: the main page and every panel are the same width, as wide as the
 *   window allows, cascaded over each other so the edge of each earlier one stays
 *   visible. Clicking an edge strip raises that card to the front without closing
 *   anything.
 * - `scroll`: every page shares the window equally in a row, never narrower than
 *   the minimum; beyond that the row scrolls and snaps to the newest pane.
 *
 * Hover-to-activate does not apply to these modes. Maximize/minimize stay
 * available and reset whenever the set of panes changes (the visible panel
 * changed), like in the split layout.
 */
export const FlexPaneLayout: React.FC<PaneLayoutProps & { mode: FlexPaneMode }> = ({
    mode, entries, allModels, listContent, listContext, detailContexts, PrimaryShowRenderer,
    closeFrom, containerWidth, fixedWidth,
}) => {
    const { token } = theme.useToken();
    const mainLabel = useMainPaneLabel(allModels);

    // Maximize/minimize state is only valid for the pane signature it was set on;
    // a stale signature reads as "nothing maximized or minimized".
    const signature = entries.map((e) => e.key).join("|");
    const [rawState, setRawState] = useState<CollapseState>({ signature, maximized: null, minimized: [] });
    const state: CollapseState = rawState.signature === signature ? rawState : { signature, maximized: null, minimized: [] };
    const maximizedKey = state.maximized;
    const minimizedKeys = state.minimized;

    /** Toggles maximize for a pane; maximizing clears every minimized pane. */
    const toggleMaximize = (key: string) => {
        setRawState({ signature, maximized: maximizedKey === key ? null : key, minimized: [] });
    };
    /** Toggles minimize for a pane; minimizing a maximized pane un-maximizes it. */
    const toggleMinimize = (key: string) => {
        const next = minimizedKeys.includes(key) ? minimizedKeys.filter((k) => k !== key) : [...minimizedKeys, key];
        setRawState({ signature, maximized: maximizedKey === key ? null : maximizedKey, minimized: next });
    };
    /** Clears the maximized state (used to restore the main page's spine). */
    const clearMaximize = () => setRawState({ signature, maximized: null, minimized: minimizedKeys });

    const count = entries.length;

    // Overlay mode: which card is raised to the front. Set by clicking a card's
    // edge strip; only valid for the pane signature it was set on, so opening or
    // closing a panel puts the newest card in front again.
    const MAIN_KEY = "__main__";
    const [rawFront, setRawFront] = useState<{ signature: string; key: string | null }>({ signature, key: null });
    const requestedFront = rawFront.signature === signature ? rawFront.key : null;

    // The main page gets the same pane context the stack layout gives it, so its
    // links open panels (instead of navigating away) and its sticky bars use the
    // in-panel offset.
    const listNode = <PaneNavigationContext.Provider value={listContext}>{listContent}</PaneNavigationContext.Provider>;

    // Scroll mode: keep the newest pane in view when panes change, and bring a
    // freshly maximized pane into view.
    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (mode !== "scroll" || !scrollRef.current) return;
        const el = scrollRef.current;
        el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
    }, [mode, signature]);
    useEffect(() => {
        if (mode !== "scroll" || !maximizedKey || !scrollRef.current) return;
        scrollRef.current
            .querySelector<HTMLElement>(`[data-pane-key="${CSS.escape(maximizedKey)}"]`)
            ?.scrollIntoView({ inline: "end", block: "nearest", behavior: "smooth" });
    }, [mode, maximizedKey]);

    /** Renders the body (toolbar + page) of a detail pane. */
    const renderBody = (i: number, leading?: React.ReactNode) => {
        const resolved = entries[i];
        return (
            <PaneBody
                resolved={resolved}
                allModels={allModels}
                navContext={detailContexts[resolved.idx]}
                PrimaryShowRenderer={PrimaryShowRenderer}
                maximized={maximizedKey === resolved.key}
                minimized={minimizedKeys.includes(resolved.key)}
                hoverToExpand={false}
                leading={leading}
                onClose={() => closeFrom(resolved.idx)}
                onMinimize={() => toggleMinimize(resolved.key)}
                onMaximize={() => toggleMaximize(resolved.key)}
            />
        );
    };

    /** Common container of every pane: scrolls its own content vertically. */
    const paneBox: React.CSSProperties = {
        overflow: "auto",
        minWidth: 0,
        height: "100%",
        position: "relative",
        borderLeft: `2px solid ${token.colorBorder}`,
        background: token.colorBgContainer,
    };

    // -----------------------------------------------------------------------
    // Breadcrumb: main page + a single fixed-width panel with a trail
    // -----------------------------------------------------------------------
    if (mode === "breadcrumb") {
        const activeIdx = count - 1;
        const active = entries[activeIdx];
        const listCollapsed = active ? maximizedKey === active.key : false;
        const activeMinimized = active ? minimizedKeys.includes(active.key) : false;

        // Trail: back-to-list icon, then one crumb per pane; the last is the current one.
        const trail = active && (
            <Breadcrumb
                aria-label={_("Panel trail")}
                style={{ fontSize: 12, whiteSpace: "nowrap" }}
                items={[
                    {
                        title: (
                            <a onClick={() => closeFrom(0)} title={_("Back to list")}>
                                <HomeOutlined />
                            </a>
                        ),
                    },
                    ...entries.map((e, i) => ({
                        title: i === activeIdx
                            ? <span style={{ fontWeight: 600 }}><PaneLabelText model={e.model} id={e.pane.id} /></span>
                            : <a onClick={() => closeFrom(e.idx + 1)}><PaneLabelText model={e.model} id={e.pane.id} /></a>,
                    })),
                ]}
            />
        );

        return (
            <div style={{ display: "flex", height: "100%", width: "100%" }}>
                <div
                    style={{
                        ...paneBox,
                        borderLeft: 0,
                        // Shares the width equally with the panel while both are shown (both
                        // shrink together if the window cannot fit two minimums); fills the
                        // container when alone or when the panel is minimized.
                        flex: listCollapsed
                            ? `0 0 ${SPINE_WIDTH_PX}px`
                            : !active || activeMinimized ? "1 1 0" : `1 1 ${fixedWidth}px`,
                        overflow: listCollapsed ? "hidden" : "auto",
                    }}
                >
                    <div style={{ display: listCollapsed ? "none" : "contents" }}>{listNode}</div>
                    {listCollapsed && (
                        <PaneSpine
                            label={<MainLabelText allModels={allModels} />}
                            title={mainLabel}
                            onClick={clearMaximize}
                            style={{ position: "absolute", inset: 0, borderLeft: 0 }}
                        />
                    )}
                </div>
                {active && (
                    <div
                        style={{
                            ...paneBox,
                            flex: activeMinimized ? `0 0 ${SPINE_WIDTH_PX}px` : listCollapsed ? "1 1 0" : `1 1 ${fixedWidth}px`,
                            maxWidth: activeMinimized ? SPINE_WIDTH_PX : "100%",
                            overflow: activeMinimized ? "hidden" : "auto",
                        }}
                    >
                        <div style={{ display: activeMinimized ? "none" : "contents" }}>{renderBody(activeIdx, trail)}</div>
                        {activeMinimized && (
                            <PaneSpine
                                label={<PaneLabelText model={active.model} id={active.pane.id} />}
                                                                onClick={() => toggleMinimize(active.key)}
                                style={{ position: "absolute", inset: 0 }}
                            />
                        )}
                    </div>
                )}
            </div>
        );
    }

    // -----------------------------------------------------------------------
    // Overlay: same-width cards cascaded over each other
    // -----------------------------------------------------------------------
    if (mode === "overlay") {
        // Cards: the main page first, then one per panel. Every card has the same
        // width and sits `step` px to the right of the previous one, so the edge of
        // each earlier card stays visible. Cards are as wide as the container allows
        // (never below the minimum); only when the window is too narrow for the
        // minimum plus the full offsets is the offset reduced.
        const cardKeys = [MAIN_KEY, ...entries.map((e) => e.key)];
        const cardCount = cardKeys.length;
        const cardWidth = containerWidth > 0
            ? Math.max(Math.min(fixedWidth, containerWidth), containerWidth - (cardCount - 1) * OVERLAY_OFFSET_PX)
            : fixedWidth;
        const step = containerWidth > 0 && cardCount > 1
            ? Math.max(0, Math.min(OVERLAY_OFFSET_PX, (containerWidth - cardWidth) / (cardCount - 1)))
            : OVERLAY_OFFSET_PX;
        // The raised card: the requested one if it still exists, else the newest.
        const frontKey = requestedFront && cardKeys.includes(requestedFront) ? requestedFront : cardKeys[cardCount - 1];
        const frontIdx = cardKeys.indexOf(frontKey);
        // Raise a card by clicking its strip; nothing is closed.
        const raise = (key: string) => setRawFront({ signature, key });

        /**
         * Stacking order: cards older than the front rise with their index (their
         * left strips show), the front card is on top, and cards newer than the front
         * sit below it in reverse order so each shows a strip on its right edge.
         */
        const zFor = (j: number) => (j === frontIdx ? cardCount + 2 : j < frontIdx ? j + 1 : cardCount - j);

        /** Clickable edge strip of a card that is not in front: left edge for older cards, right edge for newer ones. */
        const edgeStrip = (j: number, label: React.ReactNode) => (
            <PaneSpine
                label={label}
                onClick={() => raise(cardKeys[j])}
                style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    ...(j < frontIdx ? { left: 0 } : { right: 0 }),
                    width: step,
                    height: "auto",
                    padding: "8px 0",
                    zIndex: 30,
                }}
            />
        );

        // With no panels the main page simply fills the container.
        const mainWidth = count === 0 ? "100%" : cardWidth;
        return (
            <div style={{ position: "relative", height: "100%", width: "100%", overflow: "hidden", isolation: "isolate" }}>
                {/* Main page: own stacking context so its sticky headers (z-index) never draw over the cards. */}
                <div
                    style={{
                        ...paneBox,
                        borderLeft: 0,
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: 0,
                        width: mainWidth,
                        zIndex: count === 0 ? 0 : zFor(0),
                        boxShadow: count === 0 ? undefined : `4px 0 12px ${token.colorFillSecondary}`,
                    }}
                >
                    {listNode}
                    {count > 0 && frontIdx !== 0 && step >= 8 && edgeStrip(0, <MainLabelText allModels={allModels} />)}
                </div>
                {entries.map((e, i) => {
                    const j = i + 1;
                    const isMaximized = maximizedKey === e.key;
                    const isMinimized = minimizedKeys.includes(e.key);
                    const isFront = j === frontIdx;
                    return (
                        <div
                            key={e.key}
                            data-pane-key={e.key}
                            style={{
                                ...paneBox,
                                position: "absolute",
                                top: 0,
                                bottom: 0,
                                left: isMaximized ? 0 : j * step,
                                width: isMaximized ? "100%" : isMinimized ? SPINE_WIDTH_PX : cardWidth,
                                zIndex: isMaximized ? cardCount + 3 : zFor(j),
                                overflow: isMinimized ? "hidden" : "auto",
                                boxShadow: `-4px 0 12px ${token.colorFillSecondary}`,
                                transition: "width 0.18s ease, left 0.18s ease",
                            }}
                        >
                            <div style={{ display: isMinimized ? "none" : "contents" }}>{renderBody(i)}</div>
                            {isMinimized && (
                                <PaneSpine
                                    label={<PaneLabelText model={e.model} id={e.pane.id} />}
                                    onClick={() => toggleMinimize(e.key)}
                                    style={{ position: "absolute", inset: 0, zIndex: 30 }}
                                />
                            )}
                            {!isFront && !isMinimized && !isMaximized && step >= 8 && edgeStrip(j, <PaneLabelText model={e.model} id={e.pane.id} />)}
                        </div>
                    );
                })}
            </div>
        );
    }

    // -----------------------------------------------------------------------
    // Scroll: fixed-width panes in a snapping, horizontally scrolling row
    // -----------------------------------------------------------------------
    return (
        <div
            ref={scrollRef}
            style={{
                display: "flex",
                height: "100%",
                width: "100%",
                overflowX: "auto",
                overflowY: "hidden",
                scrollSnapType: "x proximity",
            }}
        >
            <div
                style={{
                    ...paneBox,
                    borderLeft: 0,
                    // With panes open the main page shares the row equally with every
                    // pane (never below the minimum); alone it fills the container.
                    flex: count === 0 ? "1 1 100%" : `1 0 ${fixedWidth}px`,
                    maxWidth: count === 0 ? undefined : "100%",
                    scrollSnapAlign: "end",
                }}
            >
                {listNode}
            </div>
            {entries.map((e, i) => {
                const isMaximized = maximizedKey === e.key;
                const isMinimized = minimizedKeys.includes(e.key);
                return (
                    <div
                        key={e.key}
                        data-pane-key={e.key}
                        style={{
                            ...paneBox,
                            flex: isMaximized ? "0 0 100%" : isMinimized ? `0 0 ${SPINE_WIDTH_PX}px` : `1 0 ${fixedWidth}px`,
                            maxWidth: isMaximized ? undefined : "100%",
                            overflow: isMinimized ? "hidden" : "auto",
                            scrollSnapAlign: "end",
                        }}
                    >
                        <div style={{ display: isMinimized ? "none" : "contents" }}>{renderBody(i)}</div>
                        {isMinimized && (
                            <PaneSpine
                                label={<PaneLabelText model={e.model} id={e.pane.id} />}
                                                                onClick={() => toggleMinimize(e.key)}
                                style={{ position: "absolute", inset: 0 }}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
};
