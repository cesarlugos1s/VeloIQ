/**
 * Module-level store that carries the DataDetailLevelState from
 * useStandardShowTabs (which creates it internally) to StandardShow /
 * StandardEdit (which render the DataDetailSlider).
 *
 * This avoids per-page changes — useStandardShowTabs writes here on every
 * render, and StandardShow/StandardEdit read from here. Since hooks always
 * run before the JSX they return, the state is always fresh when the wrapper
 * components render.
 */
import type { DataDetailLevelState } from "./useDataDetailLevel";

let _current: DataDetailLevelState | undefined;

export function getCurrentDataDetailLevelState(): DataDetailLevelState | undefined {
    return _current;
}

export function setCurrentDataDetailLevelState(state: DataDetailLevelState | undefined): void {
    _current = state;
    // Also expose on window so components inside cached tab panes can read it
    (window as any).__veloiq_dataDetailLevel = state?.dataDetailLevel ?? undefined;
}
