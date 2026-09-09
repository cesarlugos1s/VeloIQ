import type { DashboardCell, DashboardConfig } from "./useDashboardConfig";

export type MoveDirection = "left" | "right" | "up" | "down";

/** Grid dimensions implied by a set of (row, col)-positioned cells — shared
 * by ViewsGrid and SectionsGrid, whose cells both occupy exactly one grid
 * slot each (no spanning), so the dimensions are just the max row/col seen. */
export function computeGridDims(cells: DashboardCell[]): { numCols: number; numRows: number } {
    if (!cells.length) return { numCols: 1, numRows: 1 };
    return {
        numCols: Math.max(...cells.map((c) => c.col)) + 1,
        numRows: Math.max(...cells.map((c) => c.row)) + 1,
    };
}

/** Moves one cell one step in `direction` within its tab, swapping position
 * with whatever cell (if any) already occupies the destination slot.
 * Backs the "move" toolbar buttons on both ViewsGrid's dashboard cells and
 * SectionsGrid's section cells. */
export function moveCellInConfig(config: DashboardConfig, tabId: string, cellId: string, direction: MoveDirection): DashboardConfig {
    const nextTabs = config.tabs.map((tab) => {
        if (tab.id !== tabId) return tab;
        const cell = tab.cells.find((c) => c.id === cellId);
        if (!cell) return tab;
        let newRow = cell.row;
        let newCol = cell.col;
        if (direction === "left") newCol = Math.max(0, cell.col - 1);
        if (direction === "right") newCol = cell.col + 1;
        if (direction === "up") newRow = Math.max(0, cell.row - 1);
        if (direction === "down") newRow = cell.row + 1;
        const neighbor = tab.cells.find((c) => c.id !== cellId && c.row === newRow && c.col === newCol);
        return {
            ...tab,
            cells: tab.cells.map((c) => {
                if (c.id === cellId) return { ...c, row: newRow, col: newCol };
                if (neighbor && c.id === neighbor.id) return { ...c, row: cell.row, col: cell.col };
                return c;
            }),
        };
    });
    return { ...config, tabs: nextTabs };
}

/** Groups cells by `row` (preserving row order, sorting each row by `col`).
 * Rows with no cells simply don't appear — row numbers need not be
 * contiguous. Used by the "fit row"/"fit cell" carousel (FitCellCarousel.tsx)
 * to turn a flat cell list into "one array of cells per visible row". */
export function groupCellsByRow(cells: DashboardCell[]): DashboardCell[][] {
    const byRow = new Map<number, DashboardCell[]>();
    cells.forEach((c) => {
        if (!byRow.has(c.row)) byRow.set(c.row, []);
        byRow.get(c.row)!.push(c);
    });
    return Array.from(byRow.entries())
        .sort(([a], [b]) => a - b)
        .map(([, rowCells]) => [...rowCells].sort((a, b) => a.col - b.col));
}

/** Patches a cell's persisted min_width/min_height. Backs the drag-to-resize
 * handles on both ViewsGrid's dashboard cells and SectionsGrid's section
 * cells (each cell chooses its own resize floor/behavior — this only
 * commits the resulting size into the config). */
export function resizeCellInConfig(config: DashboardConfig, tabId: string, cellId: string, minWidth: string | null, minHeight: string | null): DashboardConfig {
    const nextTabs = config.tabs.map((tab) => {
        if (tab.id !== tabId) return tab;
        return {
            ...tab,
            cells: tab.cells.map((c) => {
                if (c.id !== cellId) return c;
                return {
                    ...c,
                    ...(minWidth !== null ? { min_width: minWidth } : {}),
                    ...(minHeight !== null ? { min_height: minHeight } : {}),
                };
            }),
        };
    });
    return { ...config, tabs: nextTabs };
}
