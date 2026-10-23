/**
 * The entries every menu of a layout shows: Refine's menu items (the app's or
 * portal's resources), limited to what the user can read (licensing, role,
 * access policy) and to the layout's menu settings (the Dashboard entry).
 * The vertical and horizontal menus, the mobile menu, the Command Center and
 * global search all take their entries from here, so they always agree.
 */
import { useMemo } from "react";
import { useMenu } from "@refinedev/core";
import { useLayoutMenuSettings } from "../contexts/LayoutMenuSettingsContext";
import { resolveNavKey } from "../utils/navConfig";
import { filterMenuItemsByAccess, useAccess } from "./useAccess";

/** Refine resource name of the Dashboard entry. */
export const DASHBOARD_MENU_RESOURCE_NAME = "dashboard";

/** Refine's menu, as `useMenu()` returns it. */
type RefineMenu = ReturnType<typeof useMenu>;

export function useLayoutMenuItems(): { menuItems: RefineMenu["menuItems"]; selectedKey: RefineMenu["selectedKey"] } {
    const { menuItems, selectedKey } = useMenu();
    const access = useAccess();
    const { showDashboardMenuEntry } = useLayoutMenuSettings();
    const layoutMenuItems = useMemo(() => {
        const readable = filterMenuItemsByAccess(menuItems, access);
        return showDashboardMenuEntry
            ? readable
            : readable.filter((item) => resolveNavKey(item as any) !== DASHBOARD_MENU_RESOURCE_NAME);
    }, [menuItems, access, showDashboardMenuEntry]);
    return { menuItems: layoutMenuItems, selectedKey };
}
