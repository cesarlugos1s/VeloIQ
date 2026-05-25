import React, { useState, useEffect, useRef, useMemo } from "react";
import { useMenu, useGo } from "@refinedev/core";
import {
    Input, Card, Typography, Row, Col, Space,
    ConfigProvider, theme as antTheme, Divider,
} from "antd";
import { SearchOutlined, CloseOutlined } from "@ant-design/icons";
import * as AntDIcons from "@ant-design/icons";
import type { NavConfig } from "../utils/navConfig";
import { getNavEntry, guessIcon, sortItemsByNavConfig } from "../utils/navConfig";
import { getModelTone, getContrastingTextColor } from "../utils/modelTone";

export interface CommandCenterPortalProps {
    open: boolean;
    onClose: () => void;
    navConfig?: NavConfig;
}

function resolveAntIcon(iconName: string): React.ReactNode {
    const Icon = (AntDIcons as any)[iconName] as React.ComponentType | undefined;
    const Fallback = (AntDIcons as any)["TableOutlined"] as React.ComponentType;
    return Icon ? <Icon /> : <Fallback />;
}

export const CommandCenterPortal: React.FC<CommandCenterPortalProps> = ({
    open,
    onClose,
    navConfig = [],
}) => {
    const { menuItems } = useMenu();
    const go = useGo();
    const searchRef = useRef<any>(null);
    const [query, setQuery] = useState("");

    useEffect(() => {
        if (open) {
            setQuery("");
            const t = setTimeout(() => searchRef.current?.focus(), 60);
            return () => clearTimeout(t);
        }
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, onClose]);

    const modules = useMemo(() => {
        const q = query.toLowerCase().trim();
        const moduleItems = menuItems.filter((item) => item.children && item.children.length > 0);
        const sorted = navConfig.length > 0 ? sortItemsByNavConfig(moduleItems, navConfig) : moduleItems;
        if (!q) return sorted;
        return sorted
            .map((module) => {
                const moduleMatch = (module.label || "").toLowerCase().includes(q);
                const filteredChildren = (module.children || []).filter((child) =>
                    (child.label || "").toLowerCase().includes(q)
                );
                if (!moduleMatch && filteredChildren.length === 0) return null;
                return moduleMatch ? module : { ...module, children: filteredChildren };
            })
            .filter((m): m is NonNullable<typeof m> => m !== null);
    }, [menuItems, query, navConfig]);

    if (!open) return null;

    const getItemIcon = (key: string, label: string, isModule: boolean) => {
        const entry = getNavEntry(navConfig, key);
        return resolveAntIcon(entry?.icon ?? guessIcon(label || key, isModule));
    };

    return (
        <ConfigProvider theme={{ algorithm: antTheme.darkAlgorithm }}>
            <div
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 2000,
                    backdropFilter: "blur(14px)",
                    WebkitBackdropFilter: "blur(14px)",
                    backgroundColor: "rgba(5, 5, 18, 0.78)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    paddingTop: 52,
                    paddingBottom: 48,
                    paddingLeft: 24,
                    paddingRight: 24,
                    overflowY: "auto",
                }}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    style={{
                        position: "fixed",
                        top: 14,
                        right: 18,
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: "50%",
                        cursor: "pointer",
                        color: "rgba(255,255,255,0.65)",
                        width: 34,
                        height: 34,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        zIndex: 2001,
                        outline: "none",
                        padding: 0,
                    }}
                    title="Close (Esc)"
                >
                    <CloseOutlined />
                </button>

                {/* Title */}
                <Typography.Title
                    level={3}
                    style={{
                        color: "#ffffff",
                        marginTop: 0,
                        marginBottom: 28,
                        letterSpacing: "0.06em",
                        fontWeight: 200,
                        textTransform: "uppercase",
                        fontSize: 18,
                    }}
                >
                    Command Center
                </Typography.Title>

                {/* Search */}
                <div style={{ width: "100%", maxWidth: 600, marginBottom: 36 }}>
                    <Input
                        ref={searchRef}
                        size="large"
                        placeholder="Search modules and models…"
                        prefix={<SearchOutlined style={{ color: "rgba(255,255,255,0.4)", fontSize: 16 }} />}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        allowClear
                        style={{ fontSize: 15, height: 52, borderRadius: 10 }}
                    />
                </div>

                {/* Module cards grid */}
                <div style={{ width: "100%", maxWidth: 1200 }}>
                    {modules.length === 0 && query ? (
                        <div style={{ textAlign: "center", paddingTop: 56 }}>
                            <Typography.Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 16 }}>
                                No results for &ldquo;{query}&rdquo;
                            </Typography.Text>
                        </div>
                    ) : (
                        <Row gutter={[20, 20]}>
                            {modules.map((module) => {
                                const moduleKey = String(module.key || module.name || "");
                                const moduleLabel = String(module.label || module.name || "");
                                const tone = getModelTone(moduleKey);
                                const headerTextColor = getContrastingTextColor(tone.solid);
                                const moduleIcon = getItemIcon(moduleKey, moduleLabel, true);
                                const children = navConfig.length > 0
                                    ? sortItemsByNavConfig(module.children || [], navConfig)
                                    : (module.children || []);

                                return (
                                    <Col key={moduleKey} xs={24} sm={12} md={8} lg={6}>
                                        <Card
                                            style={{
                                                background: "rgba(18, 18, 32, 0.95)",
                                                border: "1px solid rgba(255,255,255,0.08)",
                                                borderRadius: 14,
                                                height: "100%",
                                                boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)`,
                                            }}
                                            styles={{
                                                header: {
                                                    background: tone.solid,
                                                    borderBottom: "1px solid rgba(0,0,0,0.15)",
                                                    borderRadius: "12px 12px 0 0",
                                                    padding: "10px 16px",
                                                    minHeight: 52,
                                                },
                                                body: { padding: "12px 16px 14px", background: "rgba(18,18,32,0.95)" },
                                            }}
                                            title={
                                                <Space size={10}>
                                                    <div style={{
                                                        background: `${headerTextColor}33`,
                                                        border: `1px solid ${headerTextColor}55`,
                                                        borderRadius: 8,
                                                        width: 32,
                                                        height: 32,
                                                        display: "flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        flexShrink: 0,
                                                    }}>
                                                        <span style={{ color: headerTextColor, fontSize: 15, display: "flex" }}>
                                                            {moduleIcon}
                                                        </span>
                                                    </div>
                                                    <Typography.Text
                                                        style={{ color: headerTextColor, fontWeight: 600, fontSize: 14, letterSpacing: "0.01em" }}
                                                    >
                                                        {moduleLabel}
                                                    </Typography.Text>
                                                </Space>
                                            }
                                        >
                                            {children.length > 0 && (
                                                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                                    {children.map((child, idx) => {
                                                        const childKey = String(child.key || child.name || "");
                                                        const childLabel = String(child.label || child.name || "");
                                                        const childTone = getModelTone(childKey);
                                                        const childIcon = getItemIcon(childKey, childLabel, false);
                                                        return (
                                                            <React.Fragment key={childKey}>
                                                                {idx > 0 && (
                                                                    <Divider style={{ margin: "2px 0", borderColor: "rgba(255,255,255,0.05)" }} />
                                                                )}
                                                                <div
                                                                    role="button"
                                                                    tabIndex={0}
                                                                    onClick={() => { go({ to: child.route || `/${childKey}` }); onClose(); }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === "Enter") { go({ to: child.route || `/${childKey}` }); onClose(); }
                                                                    }}
                                                                    style={{
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                        gap: 10,
                                                                        padding: "7px 10px",
                                                                        borderRadius: 8,
                                                                        cursor: "pointer",
                                                                        transition: "background 0.13s, border-color 0.13s",
                                                                        border: "1px solid transparent",
                                                                        outline: "none",
                                                                    }}
                                                                    onMouseEnter={(e) => {
                                                                        const el = e.currentTarget as HTMLElement;
                                                                        el.style.background = `${childTone.solid}1a`;
                                                                        el.style.borderColor = `${childTone.solid}40`;
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        const el = e.currentTarget as HTMLElement;
                                                                        el.style.background = "transparent";
                                                                        el.style.borderColor = "transparent";
                                                                    }}
                                                                >
                                                                    <span style={{
                                                                        color: childTone.text,
                                                                        fontSize: 13,
                                                                        flexShrink: 0,
                                                                        display: "flex",
                                                                        alignItems: "center",
                                                                        opacity: 0.85,
                                                                    }}>
                                                                        {childIcon}
                                                                    </span>
                                                                    <Typography.Text style={{
                                                                        color: "rgba(220, 220, 240, 0.88)",
                                                                        fontSize: 13,
                                                                        fontWeight: 400,
                                                                    }}>
                                                                        {childLabel}
                                                                    </Typography.Text>
                                                                </div>
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {children.length === 0 && (
                                                <Typography.Text style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>
                                                    No models
                                                </Typography.Text>
                                            )}
                                        </Card>
                                    </Col>
                                );
                            })}
                        </Row>
                    )}
                </div>
            </div>
        </ConfigProvider>
    );
};
