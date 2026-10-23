import { createContext, useContext } from "react";

/**
 * Menu settings of the current layout (the app's own UI or an external portal),
 * provided by LayoutWrapper to every menu it draws: the vertical and horizontal
 * menus, the mobile menu, the Command Center and global search.
 */
export interface LayoutMenuSettings {
    /** Show the Dashboard entry (by default shown in the app's own UI, hidden in external portals). */
    showDashboardMenuEntry: boolean;
}

export const LayoutMenuSettingsContext = createContext<LayoutMenuSettings>({ showDashboardMenuEntry: true });

export const useLayoutMenuSettings = (): LayoutMenuSettings => useContext(LayoutMenuSettingsContext);
