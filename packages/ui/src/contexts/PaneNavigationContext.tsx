import { createContext, useContext } from "react";

export const PANE_TOOLBAR_HEIGHT = 28;

export interface PaneNavigationValue {
    isInMultiPane: boolean;
    paneIndex: number; // 0 = master list, 1+ = detail panes
    openDetail: (resource: string, id: string | number) => void;
}

export const PaneNavigationContext = createContext<PaneNavigationValue | null>(null);

export const usePaneNavigation = () => useContext(PaneNavigationContext);

/**
 * The resource of the record a detail pane shows. Pages inside the pane build
 * their breadcrumb from it, since the URL still names the main page.
 */
export const PaneResourceContext = createContext<string | undefined>(undefined);

export const usePaneResource = () => useContext(PaneResourceContext);
