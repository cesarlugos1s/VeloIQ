import React, { useContext, useMemo } from "react";
import { useGo } from "@refinedev/core";
import { ColorModeContext } from "../contexts/ColorModeContext";
import { ConfigProvider, Menu, Tooltip } from "antd";
import * as AntDIcons from "@ant-design/icons";
import { getModelTone, normalizeToneKey } from "../utils/modelTone";
import type { NavConfig } from "../utils/navConfig";
import { getNavEntry, guessIcon, resolveNavKey, sortItemsByNavConfig } from "../utils/navConfig";
import { useJourneyMenuItems, injectJourneyMenuItems } from "../utils/journeyMenu";
import { useLayoutMenuItems } from "../hooks/useLayoutMenuItems";
import { translateMenuLabel } from "../utils/translateMenuLabel";


/** AntD Menu sizes of the minimized horizontal menu: narrower entries than the defaults (20px padding each side). */
const COLLAPSED_HORIZONTAL_MENU_COMPACT_TOKENS = { itemPaddingInline: 8, horizontalItemGutter: 0 };

export const HorizontalMenu: React.FC<{
    navConfig?: NavConfig;
    /** Minimized: first-level entries show only their icon, with the translated name as a tooltip. */
    collapsed?: boolean;
}> = ({ navConfig = [], collapsed = false }) => {
    const { mode } = useContext(ColorModeContext);
    // The layout's entries: only what the user can Read (AC-E1), and the layout's menu settings.
    const { menuItems: licensedMenuItems, selectedKey } = useLayoutMenuItems();
    const go = useGo();
    const journeysByModule = useJourneyMenuItems();

    const getIcon = (item: any): React.ReactNode => {
        const key = String(item?.key || "");
        const label = String(item?.label || item?.name || "");
        const isModule = key.startsWith("module:") || key === "dashboard";
        const entry = getNavEntry(navConfig, resolveNavKey(item));
        // An explicit icon name on the item (e.g. injected journeys) wins.
        const iconName = (typeof item?.icon === "string" && item.icon)
            || entry?.icon || guessIcon(label || key, isModule);
        const Icon = (AntDIcons as any)[iconName] as React.ComponentType | undefined;
        const Fallback = (AntDIcons as any)["DatabaseOutlined"] as React.ComponentType;
        return Icon ? <Icon /> : <Fallback />;
    };

    const resolveModelSeed = (item: any) => {
        const route = String(item?.route || "");
        const routeParts = route.split("/").filter(Boolean);
        const routeCandidate = [...routeParts]
            .reverse()
            .find((part) => part && !/^\d+$/.test(part) && !["list", "show", "edit", "create", "embedded"].includes(part.toLowerCase())) || "";
        const key = String(item?.key || "");
        const keyCandidate = key.startsWith("module:") ? "" : key;
        const label = String(item?.label || item?.name || "");
        return normalizeToneKey(routeCandidate || keyCandidate || label || "default");
    };

    const renderLabel = (item: any, depth: number, hasChildren: boolean) => {
        const label = translateMenuLabel(item);
        const isModule = depth === 0 || hasChildren;
        const tone = isModule
            ? getModelTone(`module:${item?.key || label}`)
            : getModelTone(resolveModelSeed(item));
        return (
            <span
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: isModule ? "2px 5px" : "1px 5px",
                    borderRadius: 8,
                    background: "transparent",
                    color: "inherit",
                    fontWeight: 400,
                }}
            >
                {label}
            </span>
        );
    };

    const transformItems = (items: any[], depth = 0): any[] => {
        if (!Array.isArray(items)) return [];
        return items.map((item) => {
            const safeChildren: any[] = Array.isArray(item?.children) ? item.children : [];
            const hasChildren = safeChildren.length > 0;
            // Minimized: a first-level entry is its icon. A module's popup is titled with its
            // name above its entries (as in the collapsed vertical menu); a single entry, which has
            // no popup, shows its name in a tooltip.
            const iconOnly = collapsed && depth === 0;
            const children = hasChildren ? transformItems(item.children, depth + 1) : undefined;
            return {
                key: item.key,
                label: iconOnly ? null : renderLabel(item, depth, hasChildren),
                icon: iconOnly && !hasChildren
                    ? <Tooltip title={translateMenuLabel(item)} placement="bottom"><span>{getIcon(item)}</span></Tooltip>
                    : getIcon(item),
                onClick: hasChildren ? undefined : () => go({ to: item.route }),
                children: iconOnly && hasChildren
                    ? [{ type: "group" as const, key: `${item.key}:popup-title`, label: translateMenuLabel(item), children }]
                    : children,
            };
        });
    };

    const sortedMenuItems = useMemo(
        () => navConfig.length > 0 ? sortItemsByNavConfig(licensedMenuItems, navConfig) : licensedMenuItems,
        [licensedMenuItems, navConfig],
    );

    const items = transformItems(injectJourneyMenuItems(sortedMenuItems, journeysByModule));

    return (
        // Minimized (icons only), the entries sit closer together so more of them fit on one line.
        <ConfigProvider theme={collapsed ? { components: { Menu: COLLAPSED_HORIZONTAL_MENU_COMPACT_TOKENS } } : undefined}>
        <Menu
            mode="horizontal"
            theme={mode === "dark" ? "light" : "dark"}
            selectedKeys={[selectedKey]}
            items={items}
            style={{
                borderBottom: "none",
                flex: 1,
                background: "transparent",
            }}
        />
        </ConfigProvider>
    );
};
