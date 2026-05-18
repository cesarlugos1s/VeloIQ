import React, { useContext, useMemo } from "react";
import { useMenu, useGo } from "@refinedev/core";
import { Layout, Menu, theme, Typography } from "antd";
import {
    DatabaseOutlined,
    BarChartOutlined,
    BookOutlined,
    ShopOutlined,
    DashboardOutlined
} from "@ant-design/icons";
import { getModelTone, normalizeToneKey } from "../utils/modelTone";
import { ColorModeContext } from "../contexts/ColorModeContext";

const API_URL = "/api";
const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export const CustomSider: React.FC<{ collapsed?: boolean; logo?: React.ReactNode | string; appTitle?: string }> = ({ collapsed, logo, appTitle }) => {
    const { token } = theme.useToken();
    const { mode } = useContext(ColorModeContext);
    const { menuItems, selectedKey } = useMenu();
    const go = useGo();

    // 1. Icon Helper
    const getIcon = (item: any) => {
        const key = String(item?.key || "").toLowerCase();
        switch (key) {
            case "dashboard": return <DashboardOutlined />;
            case "module:pim": return <DatabaseOutlined />;
            case "module:alloplan": return <BarChartOutlined />;
            case "module:catim": return <BookOutlined />;
            case "module:bsim": return <ShopOutlined />;
            default: return <DatabaseOutlined />;
        }
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
                    padding: isModule ? "3px 8px" : "2px 8px",
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
        return items.map((item) => {
            const hasChildren = item.children && item.children.length > 0;
            return {
                key: item.key,
                label: renderLabel(item, depth, hasChildren),
                icon: item.icon || getIcon(item),
                onClick: hasChildren ? undefined : () => go({ to: item.route }),
                children: hasChildren ? transformItems(item.children, depth + 1) : undefined,
            };
        });
    };

    const items = useMemo(() => transformItems(menuItems), [menuItems, mode]);
    return (
        <Layout.Sider
            width={280} // Slightly wider to fit the name nicely
            trigger={null}
            collapsible
            collapsed={collapsed}
            theme={mode === "dark" ? "dark" : "light"}
            style={{
                borderRight: `1px solid ${token.colorBorderSecondary}`,
                background: token.colorBgContainer,
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
