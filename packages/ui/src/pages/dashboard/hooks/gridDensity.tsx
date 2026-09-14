import React, { useCallback, useLayoutEffect, useState, type RefObject } from "react";

// ---------------------------------------------------------------------------
// Shared "cell size" density concept — used by both ViewsGrid (dashboard
// cells) and SectionsGrid (Show/Edit page sections). A view-only preference
// (persisted to localStorage, never written into the grid's own config) that
// scales every cell uniformly by changing the CSS grid's row track height,
// or, for "fit row"/"fit cell", switches to showing one row/cell at a time
// via FitRowCellCarousel (see ../FitCellCarousel.tsx).
// ---------------------------------------------------------------------------

/** Ordered slider steps; the index is the value the antd <Slider> tracks.
 * "fit-row"/"fit-cell" sit next to "fit" (page) since all three share the
 * same "compute a height that fills the available viewport" mechanism —
 * see useFitRowHeight below — they only differ in how much of the grid's
 * content is shown at once (all rows / one row / one cell). */
export const GRID_DENSITY_STEPS = ["original", "small", "fit", "fit-row", "fit-cell", "medium", "large"] as const;
export type GridDensity = (typeof GRID_DENSITY_STEPS)[number];

/** Fixed row height (px) for each non-"original"/non-"fit"-family step. */
export const GRID_DENSITY_ROW_HEIGHT: Record<Exclude<GridDensity, "original" | "fit" | "fit-row" | "fit-cell">, number> = {
    small: 180,
    medium: 320,
    large: 480,
};

/** Minimum row height "fit"/"fit row"/"fit cell" will ever compute down to,
 * so a grid with many rows degrades to scrolling instead of squashing cells
 * unreadably. */
export const FIT_PAGE_MIN_ROW_HEIGHT = 120;

export function loadStoredGridDensity(storageKey: string, defaultValue: GridDensity): GridDensity {
    try {
        const stored = localStorage.getItem(storageKey);
        if (stored && (GRID_DENSITY_STEPS as readonly string[]).includes(stored)) {
            return stored as GridDensity;
        }
    } catch {
        // localStorage unavailable (private mode, etc.) — fall back silently.
    }
    return defaultValue;
}

/** Owns one grid's cell-size preference: which step is selected, and
 * persisting it under `storageKey` (callers use distinct keys — e.g.
 * ViewsGrid's dashboard-wide preference vs. Show/Edit pages' — so the two
 * surfaces don't share, or fight over, one stored value). */
export function useGridDensity(storageKey: string, defaultValue: GridDensity) {
    const [gridDensity, setGridDensityState] = useState<GridDensity>(() => loadStoredGridDensity(storageKey, defaultValue));

    const setGridDensityByStep = useCallback((stepIndex: number) => {
        const next = GRID_DENSITY_STEPS[stepIndex] ?? defaultValue;
        setGridDensityState(next);
        try {
            localStorage.setItem(storageKey, next);
        } catch {
            // localStorage unavailable — the preference just won't persist across reloads.
        }
    }, [storageKey, defaultValue]);

    return { gridDensity, setGridDensityByStep };
}

/** Slider marks (JSX, sized down to fit seven of them on one track) for the
 * `<CellSizeSelector>` popover. `_` is each caller's own translate function. */
export function buildGridDensityMarks(_: (text: string) => string): Record<number, React.ReactNode> {
    const label = (text: string) => <span style={{ fontSize: 11 }}>{_(text)}</span>;
    return {
        0: label("Original"),
        1: label("Small"),
        2: label("Page"),
        3: label("Row"),
        4: label("Cell"),
        5: label("Medium"),
        6: label("Large"),
    };
}

/** Plain-text form of the same labels — used for the trigger button's own
 * text, which shows the currently selected option instead of a fixed
 * caption (matching DataDetailSlider's "Data Detail Level" pattern). */
export function buildGridDensityLabelText(_: (text: string) => string): Record<GridDensity, string> {
    return {
        original: _("Original"),
        small: _("Small"),
        fit: _("Page"),
        "fit-row": _("Row"),
        "fit-cell": _("Cell"),
        medium: _("Medium"),
        large: _("Large"),
    };
}

/** The CSS grid row-track height for the given density — used by the plain
 * CSS-grid rendering path (every density except "fit-row"/"fit-cell", which
 * switch to FitRowCellCarousel instead of a multi-row grid). `originalMinPx`
 * lets each grid keep its own pre-existing "Original" floor (ViewsGrid's
 * dashboard cells want more headroom than SectionsGrid's section cards).
 *
 * `growPastFixedHeight` (default false, preserving ViewsGrid's existing
 * dashboard-tile behavior -- tiles deliberately snap to one uniform height
 * per density so multiple tiles align) switches "small"/"medium"/"large"
 * from a hard `minmax(H,H)` cap to `minmax(H,auto)`. SectionsGrid passes
 * true for its own "large" step: unlike a dashboard tile, an NL Chat
 * sentence's answer content (tables, charts) routinely exceeds the fixed
 * 480px "large" height, and a hard cap there just clips it behind an
 * internal scrollbar -- while "original"'s own `minmax(floor, auto)` never
 * clips, so a tall answer's "Large" cell could end up visibly SHORTER than
 * its "Original" cell. `minmax(H, auto)` guarantees "large" is never
 * shorter than "original" for any content height (large's floor, 480, is
 * already what "original"'s own H=320 in the ViewsGrid convention scales up
 * by 1.5x), while still growing past 480 for content that needs more. */
export function computeRowTrackHeight(gridDensity: GridDensity, fitRowHeight: number | null, originalMinPx = 320, growPastFixedHeight = false): string {
    switch (gridDensity) {
        case "small":
        case "medium":
        case "large": {
            const h = GRID_DENSITY_ROW_HEIGHT[gridDensity];
            return growPastFixedHeight ? `minmax(${h}px, auto)` : `minmax(${h}px, ${h}px)`;
        }
        case "fit": {
            const height = fitRowHeight ?? FIT_PAGE_MIN_ROW_HEIGHT;
            return `minmax(${height}px, ${height}px)`;
        }
        case "original":
        default:
            return `minmax(${originalMinPx}px, auto)`;
    }
}

/** Measures the available height for "fit"/"fit row"/"fit cell" — divides
 * it across every row for "fit" (the whole tab's content must show at
 * once), or gives one row the whole thing for "fit row"/"fit cell" (only
 * one row is ever visible at a time in those modes).
 *
 * Returns null until the first real measurement lands — deliberately not a
 * default-then-correct value: the "fit row"/"fit cell" carousel (see
 * FitCellCarousel.tsx) must never mount before this is final, since
 * react-slick would otherwise measure a wrong initial slide height and
 * cache it (see FitRowCellCarousel's own comment for the full story).
 *
 * Deliberately measures via getBoundingClientRect() on the nearest
 * scrollable ancestor rather than the grid container's own clientHeight:
 * this container's height:100% doesn't resolve against a definite ancestor
 * height (the surrounding Tabs pane doesn't force one), so the div's
 * rendered height ends up driven by its own row-track content — i.e. by
 * fitRowHeight itself. A ResizeObserver on that same element would then see
 * its own output as new input on every tick (grow row height → div grows →
 * observer fires → grow row height again), running away to the top of the
 * screen. Observing the ancestor instead is safe: that ancestor's own
 * height is CSS/state-driven, never sized by this grid's own row heights. */
export function useFitRowHeight(
    containerRef: RefObject<HTMLElement | null>,
    gridDensity: GridDensity,
    numRows: number,
    gridGap: number,
    gridPadding: number,
): number | null {
    const [fitRowHeight, setFitRowHeight] = useState<number | null>(null);

    useLayoutEffect(() => {
        if (gridDensity !== "fit" && gridDensity !== "fit-row" && gridDensity !== "fit-cell") return;
        const el = containerRef.current;
        if (!el) return;

        // "Fit page" divides the available height across every row in the
        // grid; "fit row"/"fit cell" only ever show one row at a time, so
        // that one row should claim the whole available height instead.
        const effectiveRows = gridDensity === "fit" ? numRows : 1;

        const findScrollableAncestor = (node: HTMLElement): HTMLElement | null => {
            let current = node.parentElement;
            while (current && current !== document.body) {
                const overflowY = window.getComputedStyle(current).overflowY;
                if (overflowY === "auto" || overflowY === "scroll") return current;
                current = current.parentElement;
            }
            return null;
        };

        const recompute = () => {
            const top = el.getBoundingClientRect().top;
            const ancestor = findScrollableAncestor(el);
            const bottomBoundary = ancestor ? ancestor.getBoundingClientRect().bottom : window.innerHeight;
            const availableHeight = bottomBoundary - top;
            const usableHeight = availableHeight - gridGap * Math.max(0, effectiveRows - 1) - gridPadding * 2;
            const rowHeight = Math.max(FIT_PAGE_MIN_ROW_HEIGHT, Math.floor(usableHeight / effectiveRows));
            setFitRowHeight(rowHeight);
        };

        recompute();
        window.addEventListener("resize", recompute);

        // React runs child effects before parent effects, so on first mount
        // this can fire before an ancestor (e.g. a page's own content
        // wrapper, which measures its real available height asynchronously
        // in its own effect) has settled on its final size — a plain
        // `window resize` listener never sees that later, ancestor-only
        // resize. Watching the ancestor's own box directly catches it.
        //
        // Debounced (unlike the initial `recompute()` above, which must
        // stay synchronous so "fit row"/"fit cell" has a real rowHeight
        // before FitRowCellCarousel's first mount): an ancestor nested in
        // something with its own async settle (an antd Tabs pane measuring
        // its ink bar, a sticky toolbar's height changing, etc.) can fire
        // this observer several times within the same ~1s window a
        // card/chart's own delayed resize script (e.g. the NLP engine's
        // 0/200/700ms optimizeCardSizeInViewPort retries) is also running.
        // Each undebounced recompute() here re-triggers react-slick's own
        // remeasure (see FitCellCarousel's rowHeight effect), and landing
        // that close to the card's own resize can catch it mid-layout —
        // confirmed live as a blank cell ~1s after first paint alongside a
        // flood of "<rect> attribute height: Expected length, NaN" (same
        // failure class already fixed once for a different trigger, see
        // useSentenceHtmlInteractivity's comment in the IQVigilant
        // extension). Coalescing this observer's bursts into one trailing
        // recompute keeps the same eventual result without the extra
        // mid-window remeasures.
        let debounceTimer: number | null = null;
        const debouncedRecompute = () => {
            if (debounceTimer !== null) window.clearTimeout(debounceTimer);
            debounceTimer = window.setTimeout(recompute, 150);
        };

        const ancestor = findScrollableAncestor(el);
        const observer = ancestor ? new ResizeObserver(debouncedRecompute) : null;
        if (ancestor && observer) observer.observe(ancestor);

        return () => {
            window.removeEventListener("resize", recompute);
            if (debounceTimer !== null) window.clearTimeout(debounceTimer);
            observer?.disconnect();
        };
    }, [gridDensity, numRows]);

    return fitRowHeight;
}
