import React, { useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PaneNavigationContext } from "../../contexts/PaneNavigationContext";
import { PrimaryShowContext } from "../DynamicResource";
import { useAllModels } from "../../contexts/AllModelsContext";
import { applyPanesToSearchParams, parsePanes, splitVisibleAndSpines, SPINE_WIDTH_PX, LIST_PANEL_ID, detailPanelId, type PaneEntry } from "./paneUtils";
import { findModelByName, resolveResourcePath } from "../DynamicResource/utils/model";
import {
    DEFAULT_PANES_FIXED_WIDTH,
    DEFAULT_PANES_LAYOUT_MODE,
    DEFAULT_PANES_MAX_VISIBLE,
    useViewSettings,
    type PanesLayoutMode,
} from "../DynamicResource/utils/viewConfig";
import { FlexPaneLayout } from "./FlexPaneLayout";
import { SplitPaneLayout } from "./SplitPaneLayout";
import type { ResolvedPane } from "./PaneParts";

/** Pane settings resolved from `[views]` in veloiq.toml. */
interface PaneSettings {
    mode: PanesLayoutMode;
    maxVisible: number;
    fixedWidth: number;
}

/** Settings from the last successful load, so later pages render without waiting for the fetch. */
let cachedPaneSettings: PaneSettings | null = null;

// ---------------------------------------------------------------------------
// MultiPaneLayout
// URL scheme: ?pane=resourcePath:id  (repeatable)
//
// The `[views]` settings `panes_layout_mode`, `panes_max_visible` and
// `panes_fixed_width` choose how the panes are laid out:
//   stack       (default) resizable split; only the last `panes_max_visible`
//               panels stay full, older ones collapse to 40px spines
//   breadcrumb  one side panel at a time, earlier records kept as a trail
//   overlay     same-width cards cascaded over each other, raised by their strips
//   scroll      pages sharing the width in a horizontally scrolling, snapping row
// `panes_fixed_width` is the minimum page width in these three modes.
// "stack" falls back to "breadcrumb" when the active pane cannot get
// `panes_fixed_width` after the spines are subtracted.
// ---------------------------------------------------------------------------
export const MultiPaneLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [panelHeight, setPanelHeight] = useState<string>("100vh");
    const [containerWidth, setContainerWidth] = useState(0);

    useLayoutEffect(() => {
        const measure = () => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            // Subtract parent's padding-bottom so the panel fits within the
            // viewport precisely — otherwise the parent's bottom padding pushes
            // content past the visible area, forcing an unnecessary scrollbar.
            const parent = containerRef.current.parentElement;
            let padBottom = 0;
            if (parent) {
                const style = window.getComputedStyle(parent);
                padBottom = parseFloat(style.paddingBottom) || 0;
            }
            setPanelHeight(`${window.innerHeight - rect.top - padBottom}px`);
            setContainerWidth(rect.width);
        };
        measure();
        window.addEventListener("resize", measure);
        // The container also resizes without the window (e.g. the sidebar toggles).
        const observer = typeof ResizeObserver !== "undefined" && containerRef.current
            ? new ResizeObserver(measure)
            : null;
        if (observer && containerRef.current) observer.observe(containerRef.current);
        return () => {
            window.removeEventListener("resize", measure);
            observer?.disconnect();
        };
    }, []);

    const [searchParams, setSearchParams] = useSearchParams();
    const allModels = useAllModels();
    const PrimaryShowRenderer = useContext(PrimaryShowContext);
    const { settings, loading: settingsLoading } = useViewSettings();

    // Resolve pane settings; keep the last loaded values so navigating between
    // pages does not flash the layout while the settings are fetched again.
    if (settings) {
        cachedPaneSettings = {
            mode: settings.panesLayoutMode,
            maxVisible: settings.panesMaxVisible,
            fixedWidth: settings.panesFixedWidth,
        };
    }
    const paneSettings: PaneSettings = cachedPaneSettings ?? {
        mode: DEFAULT_PANES_LAYOUT_MODE,
        maxVisible: DEFAULT_PANES_MAX_VISIBLE,
        fixedWidth: DEFAULT_PANES_FIXED_WIDTH,
    };
    // Hold the page until the mode is known (unless a cached value exists), so
    // the main page is never mounted in one layout and then remounted in another.
    const settingsReady = cachedPaneSettings !== null || !settingsLoading;

    const panes = useMemo(() => parsePanes(searchParams), [searchParams]);

    // Detail panes whose model resolved; index in the URL array is kept for navigation.
    const entries: ResolvedPane[] = useMemo(() => {
        const resolved: ResolvedPane[] = [];
        panes.forEach((pane: PaneEntry, idx: number) => {
            const model = findModelByName(allModels, pane.resource);
            if (model) resolved.push({ pane, idx, model, key: `${pane.resource}:${pane.id}` });
        });
        return resolved;
    }, [panes, allModels]);

    // Effective mode: "stack" falls back to "breadcrumb" when the viewport
    // cannot fit one fixed-width pane once the spines take their share.
    const effectiveMode: PanesLayoutMode = useMemo(() => {
        if (paneSettings.mode !== "stack" || entries.length === 0 || containerWidth === 0) return paneSettings.mode;
        const ids = [LIST_PANEL_ID, ...entries.map((e) => detailPanelId(e.idx))];
        const { spines } = splitVisibleAndSpines(ids, paneSettings.maxVisible);
        return containerWidth - spines.length * SPINE_WIDTH_PX < paneSettings.fixedWidth ? "breadcrumb" : "stack";
    }, [paneSettings.mode, paneSettings.maxVisible, paneSettings.fixedWidth, entries, containerWidth]);

    // The split layout registers a callback that runs right before any URL
    // change, to snapshot its layout and clear maximize/minimize state.
    const beforeNavigateRef = useRef<(() => void) | null>(null);
    const registerBeforeNavigate = useCallback((fn: (() => void) | null) => {
        beforeNavigateRef.current = fn;
    }, []);

    // -----------------------------------------------------------------------
    // Navigation (URL only; layouts react to the URL change)
    // -----------------------------------------------------------------------
    /** Opens a record in a new pane after the pane at `fromPaneIndex`, dropping any panes beyond it. */
    const openDetail = useCallback(
        (fromPaneIndex: number, resource: string, id: string | number) => {
            beforeNavigateRef.current?.();
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

    /** Drops the URL panes from `fromArrayIndex` onward (0 closes every pane). */
    const closeFrom = useCallback(
        (fromArrayIndex: number) => {
            beforeNavigateRef.current?.();
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
    // Stable context values (memoised to avoid unnecessary re-renders)
    // -----------------------------------------------------------------------
    const listContext = useMemo(
        () => ({
            isInMultiPane: true,
            paneIndex: 0,
            openDetail: (resource: string, id: string | number) => openDetail(0, resource, id),
        }),
        [openDetail],
    );

    const detailContexts = useMemo(
        () =>
            panes.map((_, idx) => ({
                isInMultiPane: true,
                paneIndex: idx + 1,
                openDetail: (resource: string, id: string | number) => openDetail(idx + 1, resource, id),
            })),
        [panes, openDetail],
    );

    const layoutProps = {
        entries,
        allModels,
        listContent: children,
        listContext,
        detailContexts,
        PrimaryShowRenderer,
        closeFrom,
        containerWidth,
        cap: paneSettings.maxVisible,
        fixedWidth: paneSettings.fixedWidth,
    };

    return (
        <div ref={containerRef} className="jm-full-width-page" style={{ overflow: "hidden", height: panelHeight }}>
            {settingsReady && (effectiveMode === "stack" ? (
                <SplitPaneLayout {...layoutProps} registerBeforeNavigate={registerBeforeNavigate} />
            ) : (
                // Breadcrumb / overlay / scroll: no split state to snapshot.
                <FlexPaneLayout {...layoutProps} mode={effectiveMode} />
            ))}
        </div>
    );
};
