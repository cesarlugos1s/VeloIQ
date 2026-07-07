import React, { useState, useContext, useEffect } from "react";
import { ThemedLayoutV2 } from "@refinedev/antd";
import { useGetIdentity, useLogout, useGo, useMenu } from "@refinedev/core";
import {
    Layout, Button, Typography, Space, Avatar, Dropdown, Switch, Tooltip, Modal,
    Form, Input, message, theme, Grid, Drawer, Menu,
} from "antd";
import {
    LogoutOutlined, UserOutlined, DownOutlined, LockOutlined,
    MenuOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
    LayoutOutlined, AppstoreOutlined, BorderInnerOutlined,
} from "@ant-design/icons";
import { HorizontalMenu } from "./HorizontalMenu";
import { CustomSider } from "./CustomSider";
import { GlobalSearch } from "./GlobalSearch";
import { CommandCenterPortal } from "./CommandCenterPortal";
import { ColorModeContext } from "../contexts/ColorModeContext";
import { NavConfigContext } from "../contexts/NavConfigContext";
import { authenticatedFetch } from "../utils/authenticatedFetch";
import type { NavConfig } from "../utils/navConfig";
import { useLicensePool } from "../hooks/useLicensePool";

const API_URL = "/api";

export interface LayoutWrapperProps {
    children?: React.ReactNode;
    /** Logo element or image URL shown in header and sider. */
    logo?: React.ReactNode | string;
    /** App name shown next to the logo when the sider is expanded. */
    appTitle?: string;
    /** Optional extra items added to the user dropdown (before logout). */
    extraUserMenuItems?: Array<{
        key: string;
        label: React.ReactNode;
        icon?: React.ReactNode;
        onClick?: () => void;
    }>;
    /** Navigation config loaded from navigation.config.json — drives icons and sort order. */
    navConfig?: NavConfig;
}

const DefaultLogo: React.FC<{
    logo?: React.ReactNode | string;
    appTitle?: string;
    collapsed?: boolean;
    isHeader?: boolean;
    hideTitle?: boolean;
}> = ({ logo, appTitle, collapsed, isHeader = false, hideTitle = false }) => {
    const logoEl = typeof logo === "string"
        ? <img src={logo} alt={appTitle || "App"} style={{ height: isHeader ? "32px" : "40px", width: "auto", marginRight: (collapsed || hideTitle) ? 0 : 10 }} />
        : logo
        ? <span style={{ marginRight: (collapsed || hideTitle) ? 0 : 10, display: "flex", alignItems: "center" }}>{logo}</span>
        : null;

    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", padding: isHeader ? 0 : "10px 0" }}>
            {logoEl}
            {!collapsed && !hideTitle && appTitle && (
                <Typography.Title level={4} style={{ margin: 0, whiteSpace: "nowrap", fontWeight: 350, fontSize: "18px" }}>
                    {appTitle}
                </Typography.Title>
            )}
        </div>
    );
};

const MobileMenuContent: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { menuItems, selectedKey } = useMenu();
    const go = useGo();
    const { isModuleLicensed } = useLicensePool();

    const extractModuleName = (item: any): string | null => {
        let key = String(item?.key ?? item?.name ?? "");
        if (key.startsWith("/")) key = key.slice(1);
        if (key.startsWith("module:")) return key.slice("module:".length);
        return null;
    };

    const licensedMenuItems = React.useMemo(
        () => {
            if (!Array.isArray(menuItems)) return [];
            return menuItems.filter((item) => {
                const moduleName = extractModuleName(item);
                if (moduleName === null) return true;
                if (moduleName === "access_control") return true;
                return isModuleLicensed(moduleName);
            });
        },
        [menuItems, isModuleLicensed],
    );

    const transformItems = (items: any[]): any[] => {
        if (!Array.isArray(items)) return [];
        return items.map((item) => ({
            key: item.key,
            label: item.label || item.name || item.key,
            icon: item.icon,
            onClick: item.children?.length ? undefined : () => { go({ to: item.route }); onClose(); },
            children: item.children?.length ? transformItems(item.children) : undefined,
        }));
    };

    return (
        <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={transformItems(licensedMenuItems)}
            style={{ borderRight: "none" }}
        />
    );
};

export const LayoutWrapper: React.FC<LayoutWrapperProps> = ({
    children, logo, appTitle, extraUserMenuItems = [], navConfig = [],
}) => {
    const [layoutMode, setLayoutMode] = useState<"vertical" | "horizontal">(() =>
        (localStorage.getItem("layoutMode") as "vertical" | "horizontal") || "vertical"
    );
    const screens = Grid.useBreakpoint();
    const isMobile = !screens.md;

    const { mode, setMode } = useContext(ColorModeContext);
    const { token } = theme.useToken();
    const { data: identity } = useGetIdentity<{ first_name?: string; last_name?: string; username?: string }>();
    const { mutate: logout } = useLogout();
    const go = useGo();

    const displayName = identity
        ? [identity.first_name, identity.last_name].filter(Boolean).join(" ") || (identity as any).username || "User"
        : "User";

    const [siderCollapsed, setSiderCollapsed] = useState(() => localStorage.getItem("siderCollapsed") === "true");
    const [pwdModalOpen, setPwdModalOpen] = useState(false);
    const [pwdLoading, setPwdLoading] = useState(false);
    const [pwdForm] = Form.useForm();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [portalOpen, setPortalOpen] = useState(false);
    const { isModuleLicensed } = useLicensePool();

    // ── License-aware filtering of extension user-menu items ──────────────
    // Recursively walks the menu tree and removes items whose ``module``
    // field references an unlicensed module.  Items without a ``module``
    // field (including all built-in items and pre-existing extension items)
    // are kept unconditionally — fully backwards compatible.
    const filterMenuItemsByLicense = React.useCallback(
        (items: any[]): any[] => {
            if (!Array.isArray(items)) return [];
            return items
                .filter((item) => {
                    if (typeof item !== "object" || item === null) return true;
                    // Only filter leaf items with an explicit ``module`` field.
                    if (!item.module) return true;
                    return isModuleLicensed(item.module);
                })
                .map((item) => {
                    if (Array.isArray(item.children)) {
                        return { ...item, children: filterMenuItemsByLicense(item.children) };
                    }
                    return item;
                });
        },
        [isModuleLicensed],
    );

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "g") {
                e.preventDefault();
                setPortalOpen((prev) => !prev);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, []);

    const toggleSider = () => {
        const next = !siderCollapsed;
        setSiderCollapsed(next);
        localStorage.setItem("siderCollapsed", String(next));
    };

    const handleChangePassword = async (values: { current_password: string; new_password: string }) => {
        setPwdLoading(true);
        try {
            const res = await authenticatedFetch(`/auth/change-password`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(values),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) { message.error(body?.detail || "Failed to change password"); return; }
            message.success(body?.message || "Password changed successfully");
            setPwdModalOpen(false);
            pwdForm.resetFields();
        } catch {
            message.error("Network error");
        } finally {
            setPwdLoading(false);
        }
    };

    const userItems = [
        { key: "change-password", label: "Change Password", icon: <LockOutlined />, onClick: () => setPwdModalOpen(true) },
        ...filterMenuItemsByLicense(extraUserMenuItems),
        { type: "divider" as const },
        { key: "logout", label: "Logout", icon: <LogoutOutlined />, danger: true, onClick: () => logout() },
    ];

    const CustomHeader = () => (
        <Layout.Header style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "2px 10px", height: "auto", lineHeight: "normal",
            background: token.colorBgContainer, borderBottom: `1px solid ${token.colorBorderSecondary}`,
            position: "sticky", top: 0, zIndex: 999,
        }}>
            <div style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
                {layoutMode === "vertical" && (
                    <Tooltip title={isMobile ? "Open menu" : (siderCollapsed ? "Expand sidebar" : "Collapse sidebar")}>
                        <Button type="text"
                            icon={isMobile ? <MenuOutlined /> : (siderCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />)}
                            onClick={isMobile ? () => setDrawerOpen(true) : toggleSider}
                            style={{ marginRight: 6, flexShrink: 0 }}
                        />
                    </Tooltip>
                )}
                {layoutMode === "horizontal" && (
                    <>
                        {isMobile && (
                            <Tooltip title="Open menu">
                                <Button type="text" icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} style={{ marginRight: 6, flexShrink: 0 }} />
                            </Tooltip>
                        )}
                        <div style={{ marginRight: isMobile ? 4 : 10, flexShrink: 0 }}>
                            <DefaultLogo logo={logo} appTitle={appTitle} isHeader hideTitle={isMobile} />
                        </div>
                        {!isMobile && <div style={{ flex: 1, minWidth: 0 }}><HorizontalMenu navConfig={navConfig} /></div>}
                    </>
                )}
            </div>

            <div style={{ flexShrink: 0, marginLeft: 4, marginRight: 4 }}>
                <GlobalSearch />
            </div>

            <Space size={isMobile ? "small" : "middle"} style={{ flexShrink: 0, marginLeft: 6 }}>
                <Space.Compact>
                    <Tooltip title={layoutMode === "vertical" ? "Top Menu" : "Sidebar"}>
                        <Button icon={layoutMode === "vertical" ? <LayoutOutlined /> : <AppstoreOutlined />}
                            onClick={() => {
                                const next = layoutMode === "vertical" ? "horizontal" : "vertical";
                                setLayoutMode(next);
                                localStorage.setItem("layoutMode", next);
                            }}
                            type="text" />
                    </Tooltip>
                    <Tooltip title="Command Center (Ctrl+G)">
                        <Button
                            icon={<BorderInnerOutlined />}
                            onClick={() => setPortalOpen(true)}
                            type="text"
                        />
                    </Tooltip>
                </Space.Compact>
                <Tooltip title={mode === "dark" ? "Light mode" : "Dark mode"}>
                    <Switch checkedChildren="🌜" unCheckedChildren="🌞" checked={mode === "dark"}
                        onChange={() => setMode(mode === "light" ? "dark" : "light")} />
                </Tooltip>
                <Dropdown menu={{ items: userItems }} trigger={["click"]}>
                    <Space style={{ cursor: "pointer" }}>
                        <Avatar size={24} style={{ backgroundColor: "#1677ff" }} icon={<UserOutlined />} />
                        {!isMobile && <Typography.Text strong>{displayName}</Typography.Text>}
                        <DownOutlined style={{ fontSize: 10 }} />
                    </Space>
                </Dropdown>
            </Space>
        </Layout.Header>
    );

    const SiderToRender = (layoutMode === "vertical" && !isMobile)
        ? () => <CustomSider collapsed={siderCollapsed} logo={logo} appTitle={appTitle} navConfig={navConfig} />
        : () => null;

    return (
        <NavConfigContext.Provider value={navConfig}>
            <ThemedLayoutV2
                key={layoutMode}
                Title={({ collapsed }) => <DefaultLogo logo={logo} appTitle={appTitle} collapsed={collapsed} />}
                Sider={SiderToRender}
                Header={CustomHeader}
            >
                {children}
            </ThemedLayoutV2>

            <CommandCenterPortal
                open={portalOpen}
                onClose={() => setPortalOpen(false)}
                navConfig={navConfig}
            />

            <Drawer title={<DefaultLogo logo={logo} appTitle={appTitle} isHeader />}
                placement="left" open={drawerOpen} onClose={() => setDrawerOpen(false)} width={280}
                styles={{ body: { padding: 0 } }}>
                <MobileMenuContent onClose={() => setDrawerOpen(false)} />
            </Drawer>

            <Modal title="Change Password" open={pwdModalOpen}
                onCancel={() => { setPwdModalOpen(false); pwdForm.resetFields(); }}
                footer={null} destroyOnHidden>
                <Form form={pwdForm} layout="vertical" onFinish={handleChangePassword}>
                    <Form.Item name="current_password" label="Current Password" rules={[{ required: true }]}>
                        <Input.Password prefix={<LockOutlined />} />
                    </Form.Item>
                    <Form.Item name="new_password" label="New Password" rules={[{ required: true }, { min: 4 }]}>
                        <Input.Password prefix={<LockOutlined />} />
                    </Form.Item>
                    <Form.Item name="confirm_password" label="Confirm Password" dependencies={["new_password"]}
                        rules={[{ required: true }, ({ getFieldValue }) => ({
                            validator(_, value) {
                                if (!value || getFieldValue("new_password") === value) return Promise.resolve();
                                return Promise.reject(new Error("Passwords do not match"));
                            },
                        })]}>
                        <Input.Password prefix={<LockOutlined />} />
                    </Form.Item>
                    <Form.Item style={{ marginBottom: 0, textAlign: "right" }}>
                        <Space>
                            <Button onClick={() => { setPwdModalOpen(false); pwdForm.resetFields(); }}>Cancel</Button>
                            <Button type="primary" htmlType="submit" loading={pwdLoading}>Change Password</Button>
                        </Space>
                    </Form.Item>
                </Form>
            </Modal>
        </NavConfigContext.Provider>
    );
};
