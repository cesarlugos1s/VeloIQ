import React, { useContext, useMemo } from "react";
import { useMenu, useGo } from "@refinedev/core";
import { Layout, Menu, theme, Typography } from "antd";
import * as AntDIcons from "@ant-design/icons";
import { getModelTone, normalizeToneKey } from "../utils/modelTone";
import { ColorModeContext } from "../contexts/ColorModeContext";
import type { NavConfig } from "../utils/navConfig";
import { getNavEntry, guessIcon, sortItemsByNavConfig } from "../utils/navConfig";
import { useJourneyMenuItems, injectJourneyMenuItems } from "../utils/journeyMenu";

const API_URL = "/api";
// i18n helper — resolved at CALL time so window._ is always current.
const _ = (text: string): string => {
    const t = (window as any)._;
    return typeof t === "function" ? (t(text) as string) : text;
};

export const CustomSider: React.FC<{
    collapsed?: boolean;
    logo?: React.ReactNode | string;
    appTitle?: string;
    navConfig?: NavConfig;
}> = ({ collapsed, logo, appTitle, navConfig = [] }) => {
    const { token } = theme.useToken();
    const { mode } = useContext(ColorModeContext);
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

    // 2. Transform Items
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
        const rawLabel = String(item?.label || item?.name || item?.key || "");
        // Translate at call time. If no exact translation exists and the label
        // looks like a raw slug (contains _ or -), retry with a humanized
        // version so "exception_alert" → "Exception Alert" can match the PO
        // catalog. Already-translated labels (no _/-) are never re-humanized,
        // so accented output like "Alerta de Excepción" is preserved verbatim.
        let label = _(rawLabel);
        if (label === rawLabel && (rawLabel.includes("_") || rawLabel.includes("-"))) {
            const humanized = rawLabel.replace(/[_-]+/g, " ").trim()
                .split(/\s+/).filter(Boolean)
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ");
            if (humanized && humanized !== rawLabel) {
                const humanizedLabel = _(humanized);
                if (humanizedLabel !== humanized) label = humanizedLabel;
            }
        }
        const isModule = depth === 0 || hasChildren;
        const tone = isModule
            ? getModelTone(`module:${item?.key || label}`)
            : getModelTone(resolveModelSeed(item));
        return (
            <span
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: isModule ? "3px 8px" : "2px 8px",
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
            return {
                key: item.key,
                label: renderLabel(item, depth, hasChildren),
                icon: getIcon(item),
                onClick: hasChildren ? undefined : () => go({ to: item.route }),
                children: hasChildren ? transformItems(item.children, depth + 1) : undefined,
            };
        });
    };

    const sortedMenuItems = useMemo(
        () => navConfig.length > 0 ? sortItemsByNavConfig(menuItems, navConfig) : menuItems,
        [menuItems, navConfig],
    );
    // Inject journey entries under their module before transforming.
    const withJourneys = useMemo(
        () => injectJourneyMenuItems(sortedMenuItems, journeysByModule),
        [sortedMenuItems, journeysByModule],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const items = useMemo(() => transformItems(withJourneys), [withJourneys, mode, navConfig]);
    return (
        <Layout.Sider
            width={280} // Slightly wider to fit the name nicely
            trigger={null}
            collapsible
            collapsed={collapsed}
            theme={mode === "dark" ? "dark" : "light"}
            style={{
                borderRight: `1px solid ${token.colorBorderSecondary}`,
                background: mode === "dark" ? token.colorBgContainer : token.colorBgLayout,
                height: "100vh",
                position: "sticky",
                top: 0,
                left: 0,
                zIndex: 999,
                display: "flex",
                flexDirection: "column",
            }}
        >
            <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                {/* --- 3. RESTORED LOGO SECTION --- */}
                <div
                    style={{
                        height: "64px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: collapsed ? "center" : "flex-start",
                        padding: collapsed ? "0" : "0 24px",
                        borderBottom: `1px solid ${token.colorBorderSecondary}`
                    }}
                >
                    {typeof logo === "string"
                        ? <img src={logo} alt={appTitle || "App"} style={{ height: "40px", width: "auto" }} />
                        : logo
                        ? <span style={{ display: "flex", alignItems: "center" }}>{logo}</span>
                        : null}
                    {!collapsed && appTitle && (
                        <Typography.Title
                            level={4}
                            style={{
                                margin: "0 0 0 12px",
                                whiteSpace: "nowrap",
                                fontWeight: 350,
                                fontSize: "18px",
                                color: token.colorText
                            }}
                        >
                            {appTitle}
                        </Typography.Title>
                    )}
                </div>
                {/* -------------------------------- */}

                <div
                    style={{
                        flex: 1,
                        minHeight: 0,
                        overflowY: "auto",
                        overflowX: "hidden",
                        paddingBottom: 12,
                    }}
                >
                    <Menu
                        mode="inline"
                        inlineCollapsed={collapsed}
                        selectedKeys={[selectedKey]}
                        items={items}
                        style={{ borderRight: "none", marginTop: "8px" }}
                    />
                </div>
            </div>
        </Layout.Sider>
    );
};
