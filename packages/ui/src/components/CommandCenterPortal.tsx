import React, { useState, useEffect, useRef, useMemo } from "react";
import { useMenu, useGo } from "@refinedev/core";
import {
    Input, Card, Typography, Row, Col, Space,
    ConfigProvider, theme as antTheme, Divider, Spin,
} from "antd";
import {
    SearchOutlined, CloseOutlined, RightOutlined,
    ThunderboltOutlined, DatabaseOutlined,
} from "@ant-design/icons";
import * as AntDIcons from "@ant-design/icons";
import type { NavConfig } from "../utils/navConfig";
import { getNavEntry, guessIcon, sortItemsByNavConfig } from "../utils/navConfig";
import { getModelTone, getContrastingTextColor } from "../utils/modelTone";
import { useRecordSearch } from "../hooks/useRecordSearch";
import type { ModelSearchResult } from "../hooks/useRecordSearch";

export interface CommandCenterPortalProps {
    open: boolean;
    onClose: () => void;
    navConfig?: NavConfig;
}

const COMMAND_KEYWORDS = ["list", "show", "create", "new", "add", "edit"] as const;
type CommandKeyword = (typeof COMMAND_KEYWORDS)[number];

function parseCommand(q: string): { command: CommandKeyword; modelQuery: string } | null {
    for (const cmd of COMMAND_KEYWORDS) {
        if (q.startsWith(cmd + " ")) return { command: cmd, modelQuery: q.slice(cmd.length + 1).trim() };
    }
    return null;
}

function commandRoute(command: CommandKeyword, basePath: string): string {
    return (command === "create" || command === "new" || command === "add")
        ? `${basePath}/create`
        : basePath;
}

function resolveAntIcon(iconName: string): React.ReactNode {
    const Icon = (AntDIcons as any)[iconName] as React.ComponentType | undefined;
    const Fallback = (AntDIcons as any)["TableOutlined"] as React.ComponentType;
    return Icon ? <Icon /> : <Fallback />;
}

const SECTION_HEADER_STYLE: React.CSSProperties = {
    padding: "10px 16px",
    background: "rgba(255,255,255,0.06)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    display: "flex",
    alignItems: "center",
    gap: 8,
};

const SECTION_LABEL_STYLE: React.CSSProperties = {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
};

const SECTION_WRAPPER_STYLE: React.CSSProperties = {
    width: "100%",
    maxWidth: 1200,
    marginBottom: 24,
    background: "rgba(18,18,32,0.95)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
};

const ITEM_BASE_STYLE: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "7px 10px",
    borderRadius: 8,
    cursor: "pointer",
    transition: "background 0.13s, border-color 0.13s",
    border: "1px solid transparent",
    outline: "none",
};

export const CommandCenterPortal: React.FC<CommandCenterPortalProps> = ({
    open,
    onClose,
    navConfig = [],
}) => {
    const { menuItems } = useMenu();
    const go = useGo();
    const searchRef = useRef<any>(null);
    const [query, setQuery] = useState("");
    const { results: backendResults, searching, search, clear } = useRecordSearch();

    useEffect(() => {
        if (open) {
            setQuery("");
            clear();
            const t = setTimeout(() => searchRef.current?.focus(), 60);
            return () => clearTimeout(t);
        }
    }, [open, clear]);

    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, onClose]);

    const parsedCommand = useMemo(
        () => parseCommand(query.toLowerCase().trim()),
        [query]
    );

    // When query changes: search records (or clear when in command mode)
    useEffect(() => {
        if (parsedCommand) {
            clear();
        } else {
            search(query.toLowerCase().trim());
        }
    }, [query, parsedCommand, search, clear]);

    const allModelChildren = useMemo(
        () => menuItems.flatMap((m) =>
            (m.children || []).map((c) => ({
                ...c,
                moduleLabel: String(m.label || m.name || ""),
            }))
        ),
        [menuItems]
    );

    const searchPlaceholder = useMemo(() => {
        const labels = allModelChildren
            .slice(0, 2)
            .map((c) => String(c.label || c.name || "").toLowerCase())
            .filter(Boolean);
        if (labels.length === 0) return `Search modules, models, records…`;
        const [a, b] = labels;
        return b && b !== a
            ? `Search modules, models, records… or "list ${a}", "create ${b}"`
            : `Search modules, models, records… or "list ${a}", "create ${a}"`;
    }, [allModelChildren]);

    const commandSuggestions = useMemo(() => {
        if (!parsedCommand) return [];
        const mq = parsedCommand.modelQuery;
        const children = mq
            ? allModelChildren.filter(
                (c) =>
                    (c.label || "").toLowerCase().includes(mq) ||
                    (c.name || "").toLowerCase().includes(mq)
            )
            : allModelChildren;
        const sorted = navConfig.length > 0 ? sortItemsByNavConfig(children, navConfig) : children;
        return sorted.slice(0, 8);
    }, [parsedCommand, allModelChildren, navConfig]);

    // Module grid uses the model-query part when in command mode, full query otherwise
    const modules = useMemo(() => {
        const q = parsedCommand ? parsedCommand.modelQuery : query.toLowerCase().trim();
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
    }, [menuItems, query, parsedCommand, navConfig]);

    if (!open) return null;

    const getItemIcon = (key: string, label: string, isModule: boolean) => {
        const entry = getNavEntry(navConfig, key);
        return resolveAntIcon(entry?.icon ?? guessIcon(label || key, isModule));
    };

    const makeHoverHandlers = (toneColor: string) => ({
        onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = `${toneColor}1a`;
            el.style.borderColor = `${toneColor}40`;
        },
        onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
            const el = e.currentTarget as HTMLElement;
            el.style.background = "transparent";
            el.style.borderColor = "transparent";
        },
    });

    const hasNoResults =
        !parsedCommand &&
        modules.length === 0 &&
        backendResults.length === 0 &&
        !searching &&
        query.trim().length > 0;

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
                        placeholder={searchPlaceholder}
                        prefix={
                            searching && !parsedCommand
                                ? <Spin size="small" style={{ color: "rgba(255,255,255,0.4)" }} />
                                : <SearchOutlined style={{ color: "rgba(255,255,255,0.4)", fontSize: 16 }} />
                        }
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        allowClear
                        style={{ fontSize: 15, height: 52, borderRadius: 10 }}
                    />
                </div>

                {/* Command suggestions — shown when query starts with a command keyword */}
                {parsedCommand && (
                    <div style={SECTION_WRAPPER_STYLE}>
                        <div style={SECTION_HEADER_STYLE}>
                            <ThunderboltOutlined style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }} />
                            <Typography.Text style={SECTION_LABEL_STYLE}>Commands</Typography.Text>
                        </div>
                        <div style={{ padding: "8px 12px" }}>
                            {commandSuggestions.length === 0 && parsedCommand.modelQuery ? (
                                <div style={{ padding: "12px 10px", textAlign: "center" }}>
                                    <Typography.Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
                                        No model matching &ldquo;{parsedCommand.modelQuery}&rdquo;
                                    </Typography.Text>
                                </div>
                            ) : (
                                commandSuggestions.map((child, idx) => {
                                    const childKey = String(child.key || child.name || "");
                                    const childLabel = String(child.label || child.name || "");
                                    const childTone = getModelTone(childKey);
                                    const childIcon = getItemIcon(childKey, childLabel, false);
                                    const cmdVerb = parsedCommand.command.charAt(0).toUpperCase() + parsedCommand.command.slice(1);
                                    const route = commandRoute(parsedCommand.command, child.route || `/${childKey}`);
                                    const moduleLabel = (child as any).moduleLabel || "";
                                    return (
                                        <React.Fragment key={childKey}>
                                            {idx > 0 && <Divider style={{ margin: "2px 0", borderColor: "rgba(255,255,255,0.05)" }} />}
                                            <div
                                                role="button"
                                                tabIndex={0}
                                                onClick={() => { go({ to: route }); onClose(); }}
                                                onKeyDown={(e) => { if (e.key === "Enter") { go({ to: route }); onClose(); } }}
                                                style={ITEM_BASE_STYLE}
                                                {...makeHoverHandlers(childTone.solid)}
                                            >
                                                <span style={{ color: childTone.text, fontSize: 13, flexShrink: 0, display: "flex", alignItems: "center", opacity: 0.85 }}>
                                                    {childIcon}
                                                </span>
                                                <Typography.Text style={{ color: "rgba(220,220,240,0.88)", fontSize: 13, flex: 1 }}>
                                                    <span style={{ color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>{cmdVerb}</span>
                                                    {" "}{childLabel}
                                                </Typography.Text>
                                                {moduleLabel && (
                                                    <Typography.Text style={{ color: "rgba(255,255,255,0.28)", fontSize: 11, flexShrink: 0 }}>
                                                        {moduleLabel}
                                                    </Typography.Text>
                                                )}
                                                <RightOutlined style={{ color: "rgba(255,255,255,0.2)", fontSize: 10, flexShrink: 0 }} />
                                            </div>
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}

                {/* Record results — shown in regular search mode when backend returns matches */}
                {!parsedCommand && (backendResults.length > 0 || searching) && (
                    <div style={SECTION_WRAPPER_STYLE}>
                        <div style={SECTION_HEADER_STYLE}>
                            <DatabaseOutlined style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }} />
                            <Typography.Text style={SECTION_LABEL_STYLE}>Records</Typography.Text>
                            {searching && <Spin size="small" style={{ marginLeft: "auto" }} />}
                        </div>
                        {backendResults.length > 0 && (
                            <div style={{ padding: "8px 12px" }}>
                                {backendResults.map((modelResult: ModelSearchResult, modelIdx) => {
                                    const tone = getModelTone(modelResult.resource);
                                    return (
                                        <React.Fragment key={modelResult.modelName}>
                                            {modelIdx > 0 && <Divider style={{ margin: "4px 0", borderColor: "rgba(255,255,255,0.05)" }} />}
                                            <Typography.Text style={{
                                                color: "rgba(255,255,255,0.35)",
                                                fontSize: 10,
                                                textTransform: "uppercase",
                                                letterSpacing: "0.07em",
                                                display: "block",
                                                padding: "4px 10px 2px",
                                            }}>
                                                {modelResult.modelLabel}
                                            </Typography.Text>
                                            {modelResult.records.map((record, recIdx) => (
                                                <React.Fragment key={record.id}>
                                                    {recIdx > 0 && <Divider style={{ margin: "2px 0", borderColor: "rgba(255,255,255,0.04)" }} />}
                                                    <div
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={() => { go({ to: `/${modelResult.resource}/show/${record.id}` }); onClose(); }}
                                                        onKeyDown={(e) => { if (e.key === "Enter") { go({ to: `/${modelResult.resource}/show/${record.id}` }); onClose(); } }}
                                                        style={{ ...ITEM_BASE_STYLE, justifyContent: "space-between" }}
                                                        {...makeHoverHandlers(tone.solid)}
                                                    >
                                                        <Typography.Text style={{ color: "rgba(220,220,240,0.88)", fontSize: 13 }}>
                                                            {record.label}
                                                        </Typography.Text>
                                                        <RightOutlined style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, flexShrink: 0 }} />
                                                    </div>
                                                </React.Fragment>
                                            ))}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Module cards grid — hidden in command mode */}
                {!parsedCommand && (
                    <div style={{ width: "100%", maxWidth: 1200 }}>
                        {hasNoResults ? (
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
                                                                        style={ITEM_BASE_STYLE}
                                                                        {...makeHoverHandlers(childTone.solid)}
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
                )}
            </div>
        </ConfigProvider>
    );
};
