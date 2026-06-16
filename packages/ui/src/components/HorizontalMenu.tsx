import React from "react";
import { useMenu, useGo } from "@refinedev/core";
import { Menu } from "antd";
import * as AntDIcons from "@ant-design/icons";
import { getModelTone, normalizeToneKey } from "../utils/modelTone";
import type { NavConfig } from "../utils/navConfig";
import { getNavEntry, guessIcon } from "../utils/navConfig";
import { useJourneyMenuItems, injectJourneyMenuItems } from "../utils/journeyMenu";

export const HorizontalMenu: React.FC<{ navConfig?: NavConfig }> = ({ navConfig = [] }) => {
    const { menuItems, selectedKey } = useMenu();
    const go = useGo();
    const journeysByModule = useJourneyMenuItems();

    const getIcon = (item: any): React.ReactNode => {
        const key = String(item?.key || "");
        const label = String(item?.label || item?.name || "");
        const isModule = key.startsWith("module:") || key === "dashboard";
        const entry = getNavEntry(navConfig, key);
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
        const label = String(item?.label || item?.name || item?.key || "");
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
                    color: tone.text,
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
            return {
                key: item.key,
                label: renderLabel(item, depth, hasChildren),
                icon: getIcon(item),
                onClick: hasChildren ? undefined : () => go({ to: item.route }),
                children: hasChildren ? transformItems(item.children, depth + 1) : undefined,
            };
        });
    };

    const items = transformItems(injectJourneyMenuItems(menuItems, journeysByModule));

    return (
        <Menu
            mode="horizontal"
            selectedKeys={[selectedKey]}
            items={items}
            style={{
                borderBottom: "none",
                flex: 1,
                background: "transparent",
            }}
        />
    );
};
