import { useCallback, useState } from "react";

/** Shared maximize/minimize toolbar state for a grid of cells: at most one
 * cell maximized (shown full-bleed) at a time, any number minimized
 * (collapsed to just their toolbar). Used by both ViewsGrid's dashboard
 * cells and SectionsGrid's section cells. */
export function useCellWindowState() {
    const [maximizedCellId, setMaximizedCellId] = useState<string | null>(null);
    const [minimizedCellIds, setMinimizedCellIds] = useState<Set<string>>(new Set());

    const handleMaximize = useCallback((cellId: string) => {
        setMaximizedCellId((prev) => (prev === cellId ? null : cellId));
    }, []);

    const handleMinimize = useCallback((cellId: string) => {
        setMinimizedCellIds((prev) => {
            const next = new Set(prev);
            if (next.has(cellId)) next.delete(cellId); else next.add(cellId);
            return next;
        });
    }, []);

    /** Clears both — e.g. when the user switches tabs, so a maximized/
     * minimized cell from the previous tab doesn't carry over. */
    const reset = useCallback(() => {
        setMaximizedCellId(null);
        setMinimizedCellIds(new Set());
    }, []);

    return { maximizedCellId, minimizedCellIds, handleMaximize, handleMinimize, reset };
}
