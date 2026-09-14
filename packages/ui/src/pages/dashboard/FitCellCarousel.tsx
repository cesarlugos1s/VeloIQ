import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button, Carousel, theme } from "antd";
import { ArrowLeftOutlined, ArrowRightOutlined, ArrowUpOutlined, ArrowDownOutlined } from "@ant-design/icons";
import type { DashboardCell } from "./hooks/useDashboardConfig";
import type { GridDensity } from "./hooks/gridDensity";

// ---------------------------------------------------------------------------
// "Fit row" / "Fit cell" — one row (or one cell) at a time, navigated via
// nested antd Carousels (outer, vertical, over rows) and a hand-rolled
// horizontal slider (inner, over one row's cells — see FitCellRow's own
// comment for why that one isn't a second nested antd Carousel too).
//
// Generalized over cell CONTENT: callers (ViewsGrid, SectionsGrid) supply
// `renderCell`, so this file owns only the row/cell navigation mechanics,
// not what a cell actually renders.
// ---------------------------------------------------------------------------

type CarouselRef = React.ElementRef<typeof Carousel>;

/** Imperative handle for FitCellRow — deliberately narrow (just next/prev/
 * goTo) since that's all a hand-rolled slider needs, unlike CarouselRef's
 * antd/react-slick surface (autoPlay, innerSlider, etc). */
interface CellCarouselRef {
    next: () => void;
    prev: () => void;
    goTo: (index: number) => void;
}

/** Small "2 / 5" position readout. antd's own Carousel dots would sit at the
 * exact edge-center spot CarouselEdgeArrow already occupies (dotPosition
 * "right"/"bottom" both center on their edge) and end up hidden behind the
 * arrow button, so this renders in a corner instead — clear of every arrow,
 * which are all edge-centered, never corner-anchored. */
const CarouselPositionBadge: React.FC<{ corner: "top-right" | "bottom-right"; current: number; total: number }> = ({ corner, current, total }) => {
    const { token } = theme.useToken();
    const positionStyle: React.CSSProperties = corner === "top-right" ? { top: 6, right: 8 } : { bottom: 6, right: 8 };
    return (
        <div style={{
            position: "absolute",
            zIndex: 20,
            ...positionStyle,
            fontSize: 11,
            padding: "1px 6px",
            borderRadius: 10,
            background: token.colorBgElevated,
            color: token.colorTextSecondary,
            border: `1px solid ${token.colorBorderSecondary}`,
        }}>
            {current} / {total}
        </div>
    );
};

const CarouselEdgeArrow: React.FC<{ direction: "up" | "down" | "left" | "right"; onClick: () => void }> = ({ direction, onClick }) => {
    const icon = direction === "up" ? <ArrowUpOutlined /> : direction === "down" ? <ArrowDownOutlined /> : direction === "left" ? <ArrowLeftOutlined /> : <ArrowRightOutlined />;
    const positionStyle: React.CSSProperties =
        direction === "up" ? { top: 4, left: "50%", transform: "translateX(-50%)" }
        : direction === "down" ? { bottom: 4, left: "50%", transform: "translateX(-50%)" }
        : direction === "left" ? { left: 4, top: "50%", transform: "translateY(-50%)" }
        : { right: 4, top: "50%", transform: "translateY(-50%)" };
    return (
        <Button
            shape="circle"
            size="small"
            icon={icon}
            onClick={onClick}
            style={{ position: "absolute", zIndex: 20, ...positionStyle }}
        />
    );
};

/** One row's cells in "fit cell" mode — showing exactly one cell at a time.
 * Hand-rolled (a CSS transform + React state) rather than a second nested
 * antd/react-slick Carousel: nesting two independent react-slick instances
 * (this one horizontal, inside each slide of the outer vertical one) proved
 * genuinely fragile in practice — a slide-height measurement race between
 * the two, on top of the mount-order issues already worked around on the
 * outer carousel. A row only ever needs "show cell N, wrap at the ends",
 * which doesn't need react-slick's lazy-loading/fade/swipe machinery, so
 * owning the four lines of index math ourselves removes that whole class of
 * bug rather than working around it again. */
const FitCellRow = React.forwardRef<CellCarouselRef, {
    rowCells: DashboardCell[];
    rowHeight: number;
    gridPadding: number;
    renderCell: (cell: DashboardCell) => React.ReactNode;
}>(({ rowCells, rowHeight, gridPadding, renderCell }, ref) => {
    const count = rowCells.length;
    const hasMultipleCells = count > 1;
    const [activeIndex, setActiveIndex] = useState(0);

    useImperativeHandle(ref, () => ({
        next: () => setActiveIndex((i) => (i + 1) % count),
        prev: () => setActiveIndex((i) => (i - 1 + count) % count),
        goTo: (index: number) => setActiveIndex(((index % count) + count) % count),
    }), [count]);

    return (
        <div style={{ position: "relative", height: rowHeight, overflow: "hidden" }}>
            {hasMultipleCells && (
                <>
                    <CarouselEdgeArrow direction="left" onClick={() => setActiveIndex((i) => (i - 1 + count) % count)} />
                    <CarouselEdgeArrow direction="right" onClick={() => setActiveIndex((i) => (i + 1) % count)} />
                    <CarouselPositionBadge corner="bottom-right" current={activeIndex + 1} total={count} />
                </>
            )}
            <div style={{
                display: "flex",
                height: rowHeight,
                width: "100%",
                transform: `translateX(-${activeIndex * 100}%)`,
                transition: "transform 0.3s ease",
            }}>
                {rowCells.map((cell) => (
                    <div key={cell.id} style={{ flex: "0 0 100%", width: "100%", height: rowHeight, padding: gridPadding, boxSizing: "border-box" }}>
                        {renderCell(cell)}
                    </div>
                ))}
            </div>
        </div>
    );
});
FitCellRow.displayName = "FitCellRow";

export const FitRowCellCarousel: React.FC<{
    cellsByRow: DashboardCell[][];
    gridDensity: Extract<GridDensity, "fit-row" | "fit-cell">;
    rowHeight: number;
    gridGap: number;
    gridPadding: number;
    renderCell: (cell: DashboardCell) => React.ReactNode;
}> = ({ cellsByRow, gridDensity, rowHeight, gridGap, gridPadding, renderCell }) => {
    const outerRef = useRef<CarouselRef>(null);
    const activeRowRef = useRef(0);
    const [activeRow, setActiveRow] = useState(0);
    const innerRefsByRow = useRef<Map<number, CellCarouselRef | null>>(new Map());
    const hasMultipleRows = cellsByRow.length > 1;

    const goToRow = useCallback((dir: "prev" | "next") => {
        if (dir === "prev") outerRef.current?.prev(); else outerRef.current?.next();
    }, []);

    const goToCell = useCallback((dir: "prev" | "next") => {
        const ref = innerRefsByRow.current.get(activeRowRef.current);
        if (dir === "prev") ref?.prev(); else ref?.next();
    }, []);

    // Remeasure (not remount) once rowHeight settles on its real value.
    // `innerSlider.onWindowResized()` is the same remeasure react-slick runs
    // on a real window resize, reachable without unmounting anything — a
    // `key={rowHeight}` remount would tear down and recreate every rendered
    // cell, which for content with its own "settle" side effects (e.g. a
    // one-shot initial-scroll nudge) would visibly re-fire after the user
    // already sees the row rendered.
    useEffect(() => {
        outerRef.current?.innerSlider?.onWindowResized?.();
    }, [rowHeight]);

    // Whenever the outer (row) carousel lands on a new row, jump that row's
    // own inner carousel back to its first cell — a row that was previously
    // visited and left mid-way through shouldn't reappear scrolled in.
    const handleRowChange = useCallback((next: number) => {
        activeRowRef.current = next;
        setActiveRow(next);
        if (gridDensity === "fit-cell") {
            innerRefsByRow.current.get(next)?.goTo(0);
        }
    }, [gridDensity]);

    // Keyboard nav is scoped to this component (via tabIndex + onKeyDown)
    // rather than a window-level listener, so PageUp/PageDown/ArrowLeft/
    // ArrowRight only drive the carousel while it (or a descendant) has
    // focus — otherwise they'd hijack native page scrolling everywhere else
    // this component's host app is used.
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === "PageUp") { e.preventDefault(); goToRow("prev"); }
        else if (e.key === "PageDown") { e.preventDefault(); goToRow("next"); }
        else if (gridDensity === "fit-cell" && e.key === "ArrowLeft") { e.preventDefault(); goToCell("prev"); }
        else if (gridDensity === "fit-cell" && e.key === "ArrowRight") { e.preventDefault(); goToCell("next"); }
    }, [gridDensity, goToRow, goToCell]);

    return (
        <div
            tabIndex={0}
            autoFocus
            onKeyDown={handleKeyDown}
            // A definite pixel height (not "100%") all the way from here down
            // to the <Carousel> below — its ancestor Tabs pane never resolves
            // a definite height, so a "100%" here would collapse to
            // auto/indeterminate and leave react-slick to measure the wrong
            // slide height at mount (manifesting as stale/blank slides and
            // adjacent rows bleeding through with a scrollbar).
            style={{ position: "relative", height: rowHeight, outline: "none" }}
        >
            {hasMultipleRows && (
                <>
                    <CarouselEdgeArrow direction="up" onClick={() => goToRow("prev")} />
                    <CarouselEdgeArrow direction="down" onClick={() => goToRow("next")} />
                    <CarouselPositionBadge corner="top-right" current={activeRow + 1} total={cellsByRow.length} />
                </>
            )}
            <Carousel
                ref={outerRef}
                vertical
                dots={false}
                // antd's default (react-slick "infinite" wraparound) clones
                // slides via cloneNode — including every id in a row's
                // rendered markup (e.g. the NLP engine's cardContainer{id}
                // elements). A clone's <script> tags never re-execute, so its
                // chart is never live, but it still shares the SAME id as the
                // real one; a later document.getElementById lookup (the
                // engine's own delayed resize/optimize retries) can resolve
                // to the dead clone instead, leaving the real chart to go
                // blank. Confirmed live: switching into "Fit Row"/"Fit Cell"
                // shows content correctly for ~1s, then blanks out.
                infinite={false}
                afterChange={handleRowChange}
                style={{ height: rowHeight }}
            >
                {cellsByRow.map((rowCells, rowIndex) => (
                    <div key={rowIndex} style={{ height: rowHeight }}>
                        {gridDensity === "fit-row" ? (
                            <div style={{
                                display: "grid",
                                gridTemplateColumns: `repeat(${rowCells.length}, 1fr)`,
                                gap: gridGap,
                                padding: gridPadding,
                                height: rowHeight,
                                boxSizing: "border-box",
                            }}>
                                {rowCells.map((cell) => (
                                    <div key={cell.id} style={{ minWidth: 0, overflow: "hidden" }}>
                                        {renderCell(cell)}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <FitCellRow
                                rowCells={rowCells}
                                rowHeight={rowHeight}
                                gridPadding={gridPadding}
                                renderCell={renderCell}
                                ref={(r) => innerRefsByRow.current.set(rowIndex, r)}
                            />
                        )}
                    </div>
                ))}
            </Carousel>
        </div>
    );
};
