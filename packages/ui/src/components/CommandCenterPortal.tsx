import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useMenu, useGo } from "@refinedev/core";
import {
    Input, Card, Typography, Row, Col, Space,
    ConfigProvider, theme as antTheme, Divider, Spin,
} from "antd";
import {
    SearchOutlined, CloseOutlined, RightOutlined,
    ThunderboltOutlined, DatabaseOutlined,
    PushpinFilled, ClockCircleOutlined, AppstoreOutlined,
} from "@ant-design/icons";
import * as AntDIcons from "@ant-design/icons";
import type { NavConfig } from "../utils/navConfig";
import { getNavEntry, guessIcon, sortItemsByNavConfig } from "../utils/navConfig";
import { useJourneyMenuItems, injectJourneyMenuItems } from "../utils/journeyMenu";
import { getModelTone, getContrastingTextColor } from "../utils/modelTone";
import { useRecordSearch } from "../hooks/useRecordSearch";
import type { ModelSearchResult } from "../hooks/useRecordSearch";
import { useRecentActivity } from "../pages/dashboard/hooks/useRecentActivity";
import { authenticatedFetch } from "../utils/authenticatedFetch";
import { API_URL } from "../providers/constants";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CommandCenterPortalProps {
    open: boolean;
    onClose: () => void;
    navConfig?: NavConfig;
}

interface PinnedGroup {
    model_name: string;
    resource: string;
    records: Array<{ id: string | number; _label: string }>;
}

// ── Module-level helpers ─────────────────────────────────────────────────────

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

function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

function usePinnedGroups() {
    const [groups, setGroups] = useState<PinnedGroup[]>([]);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch(`${API_URL}/dashboard/pinned-records`);
            if (res.ok) { const d = await res.json(); setGroups(d.groups ?? []); }
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, []);

    return { groups, loading, load };
}

// ── Style constants ──────────────────────────────────────────────────────────

const SECTION_HEADER_STYLE: React.CSSProperties = {
    padding: "8px 14px",
    background: "rgba(255,255,255,0.06)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
};

const SECTION_LABEL_STYLE: React.CSSProperties = {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
};

const SECTION_CARD_STYLE: React.CSSProperties = {
    background: "rgba(18,18,32,0.95)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
    display: "flex",
    flexDirection: "column",
};

// Full-width section (commands, records)
const SECTION_WRAPPER_STYLE: React.CSSProperties = {
    ...SECTION_CARD_STYLE,
    width: "100%",
    maxWidth: 1200,
    marginBottom: 16,
};

const ITEM_BASE_STYLE: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 10px",
    borderRadius: 8,
    cursor: "pointer",
    transition: "background 0.13s, border-color 0.13s",
    border: "1px solid transparent",
    background: "transparent",
    outline: "none",
};

const ACTIVE_ITEM_STYLE: React.CSSProperties = {
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.3)",
};

// ── Component ────────────────────────────────────────────────────────────────

export const CommandCenterPortal: React.FC<CommandCenterPortalProps> = ({
    open,
    onClose,
    navConfig = [],
}) => {
    const { menuItems: rawMenuItems } = useMenu();
    const journeysByModule = useJourneyMenuItems();
    // Inject journeys under their module so they appear in the command center
    // alongside modules and their models.
    const menuItems = useMemo(
        () => injectJourneyMenuItems(rawMenuItems, journeysByModule),
        [rawMenuItems, journeysByModule],
    );
    const go = useGo();
    const searchRef = useRef<any>(null);
    const [query, setQuery] = useState("");
    const [activeIdx, setActiveIdx] = useState(-1);
    const [colW, setColW] = useState<[number, number]>([220, 220]);
    const colWRef = useRef<[number, number]>([220, 220]);
    colWRef.current = colW;
    const dragRef = useRef<{ colIdx: number; startX: number; startW: number } | null>(null);

    const { results: backendResults, searching, search, clear } = useRecordSearch();
    const { groups: pinnedGroups, loading: pinnedLoading, load: loadPinned } = usePinnedGroups();
    const { data: recentData, reload: reloadRecent } = useRecentActivity(30);

    useEffect(() => {
        if (open) {
            setQuery("");
            setActiveIdx(-1);
            clear();
            loadPinned();
            reloadRecent();
            const t = setTimeout(() => searchRef.current?.focus(), 60);
            return () => clearTimeout(t);
        }
    }, [open, clear, loadPinned, reloadRecent]);

    // Refs so the keyboard handler never needs to re-register
    const navItemIdsRef = useRef<string[]>([]);
    const activeIdxRef = useRef(-1);

    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") { onClose(); return; }
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIdx((prev) => {
                    const len = navItemIdsRef.current.length;
                    return len === 0 ? -1 : Math.min(prev + 1, len - 1);
                });
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIdx((prev) => Math.max(prev - 1, -1));
            } else if (e.key === "Enter") {
                const idx = activeIdxRef.current;
                if (idx >= 0) {
                    e.preventDefault();
                    const id = navItemIdsRef.current[idx];
                    if (id) document.querySelector<HTMLElement>(`[data-navid="${id}"]`)?.click();
                }
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open, onClose]);

    const parsedCommand = useMemo(() => parseCommand(query.toLowerCase().trim()), [query]);

    useEffect(() => {
        if (parsedCommand) { clear(); } else { search(query.toLowerCase().trim()); }
    }, [query, parsedCommand, search, clear]);

    const allModelChildren = useMemo(
        () => menuItems.flatMap((m) =>
            (m.children || []).map((c) => ({ ...c, moduleLabel: String(m.label || m.name || "") }))
        ),
        [menuItems]
    );

    const commandSuggestions = useMemo(() => {
        if (!parsedCommand) return [];
        const mq = parsedCommand.modelQuery;
        const children = mq
            ? allModelChildren.filter((c) =>
                (c.label || "").toLowerCase().includes(mq) || (c.name || "").toLowerCase().includes(mq))
            : allModelChildren;
        return (navConfig.length > 0 ? sortItemsByNavConfig(children, navConfig) : children).slice(0, 8);
    }, [parsedCommand, allModelChildren, navConfig]);

    const searchPlaceholder = useMemo(() => {
        const labels = allModelChildren.slice(0, 2)
            .map((c) => String(c.label || c.name || "").toLowerCase()).filter(Boolean);
        if (labels.length === 0) return `Search modules, models, records…`;
        const [a, b] = labels;
        return b && b !== a
            ? `Search modules, models, records… or "list ${a}", "create ${b}"`
            : `Search modules, models, records… or "list ${a}", "create ${a}"`;
    }, [allModelChildren]);

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

    const pinnedItems = useMemo(() =>
        pinnedGroups.flatMap((g) => g.records.map((r) => ({
            resource: g.resource,
            modelName: g.model_name,
            id: r.id,
            label: r._label || `#${r.id}`,
        }))),
        [pinnedGroups]
    );

    const recentItems = useMemo(() => {
        if (!recentData?.groups) return [];
        return recentData.groups
            .flatMap((g) => g.records.map((r) => ({
                resource: g.resource,
                modelName: g.model_name,
                id: r.id,
                label: r._label || `#${r.id}`,
                timestamp: r.updated_at || r.created_at || "",
                isNew: Boolean(r.created_at && (!r.updated_at || r.updated_at === r.created_at)),
            })))
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }, [recentData]);

    const navItemIds = useMemo(() => {
        const ids: string[] = [];
        if (parsedCommand) {
            for (const child of commandSuggestions)
                ids.push(`cmd-${String(child.key || child.name || "")}`);
        } else if (!query.trim()) {
            for (const item of pinnedItems) ids.push(`pin-${item.resource}-${item.id}`);
            for (const item of recentItems) ids.push(`recent-${item.resource}-${item.id}`);
            for (const module of modules) {
                const children = navConfig.length > 0
                    ? sortItemsByNavConfig(module.children || [], navConfig)
                    : (module.children || []);
                for (const child of children)
                    ids.push(`mod-${String(child.key || child.name || "")}`);
            }
        } else {
            for (const m of backendResults)
                for (const r of m.records) ids.push(`record-${m.resource}-${r.id}`);
        }
        return ids;
    }, [parsedCommand, commandSuggestions, query, pinnedItems, recentItems, backendResults, modules, navConfig]);

    navItemIdsRef.current = navItemIds;
    activeIdxRef.current = activeIdx;

    useEffect(() => { setActiveIdx(-1); }, [navItemIds]);

    useEffect(() => {
        if (activeIdx < 0) return;
        const id = navItemIds[activeIdx];
        if (id) document.querySelector(`[data-navid="${id}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, [activeIdx, navItemIds]);

    const onDividerMouseDown = (colIdx: number) => (e: React.MouseEvent) => {
        e.preventDefault();
        const startW = colWRef.current[colIdx];
        dragRef.current = { colIdx, startX: e.clientX, startW };
        const MIN = 140;
        const onMove = (ev: MouseEvent) => {
            if (!dragRef.current) return;
            const dx = ev.clientX - dragRef.current.startX;
            setColW((prev) => {
                const next = [...prev] as [number, number];
                next[dragRef.current!.colIdx] = Math.max(MIN, dragRef.current!.startW + dx);
                return next;
            });
        };
        const onUp = () => {
            dragRef.current = null;
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
    };

    if (!open) return null;

    // ── Render helpers ──────────────────────────────────────────────────────

    const getItemIcon = (key: string, label: string, isModule: boolean, explicitIcon?: string) => {
        // An explicit icon name on the item (e.g. injected journeys) wins.
        if (explicitIcon) return resolveAntIcon(explicitIcon);
        const entry = getNavEntry(navConfig, key);
        return resolveAntIcon(entry?.icon ?? guessIcon(label || key, isModule));
    };

    const makeHoverHandlers = (toneColor: string) => ({
        onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
            const el = e.currentTarget as HTMLElement;
            if (el.dataset.active === "true") return;
            el.style.background = `${toneColor}1a`;
            el.style.borderColor = `${toneColor}40`;
        },
        onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
            const el = e.currentTarget as HTMLElement;
            if (el.dataset.active === "true") return;
            el.style.background = "transparent";
            el.style.borderColor = "transparent";
        },
    });

    const isActive = (navId: string) => navItemIds[activeIdx] === navId;

    const ColDivider = ({ colIdx }: { colIdx: number }) => (
        <div
            onMouseDown={onDividerMouseDown(colIdx)}
            style={{
                width: 10, flexShrink: 0, alignSelf: "stretch",
                cursor: "col-resize", display: "flex",
                alignItems: "center", justifyContent: "center",
                zIndex: 1,
            }}
        >
            <div style={{
                width: 2, height: 40, borderRadius: 2,
                background: "rgba(255,255,255,0.12)",
                transition: "background 0.15s",
            }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.3)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.12)"; }}
            />
        </div>
    );

    const hasNoResults =
        !parsedCommand && modules.length === 0 && backendResults.length === 0 &&
        !searching && query.trim().length > 0;

    // ── Shared item row renderer ────────────────────────────────────────────

    const renderRow = (
        navId: string,
        toneColor: string,
        onClick: () => void,
        left: React.ReactNode,
        right?: React.ReactNode,
    ) => {
        const active = isActive(navId);
        return (
            <div
                key={navId}
                data-navid={navId}
                data-active={active ? "true" : undefined}
                role="button"
                tabIndex={0}
                onClick={onClick}
                onKeyDown={(e) => { if (e.key === "Enter") onClick(); }}
                style={{ ...ITEM_BASE_STYLE, justifyContent: "space-between", ...(active ? ACTIVE_ITEM_STYLE : {}) }}
                {...makeHoverHandlers(toneColor)}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                    {left}
                </div>
                {right && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                        {right}
                    </div>
                )}
            </div>
        );
    };

    // ── JSX ─────────────────────────────────────────────────────────────────

    const showNoQuery = !parsedCommand && !query.trim();

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
                    paddingTop: 32,
                    paddingBottom: 24,
                    paddingLeft: 16,
                    paddingRight: 16,
                    overflowY: "auto",
                }}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    style={{
                        position: "fixed", top: 14, right: 18,
                        background: "rgba(255,255,255,0.08)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        borderRadius: "50%", cursor: "pointer",
                        color: "rgba(255,255,255,0.65)",
                        width: 34, height: 34, display: "flex",
                        alignItems: "center", justifyContent: "center",
                        fontSize: 14, zIndex: 2001, outline: "none", padding: 0,
                    }}
                    title="Close (Esc)"
                >
                    <CloseOutlined />
                </button>

                {/* Title */}
                <Typography.Title level={3} style={{
                    color: "#ffffff", marginTop: 0, marginBottom: 16,
                    letterSpacing: "0.06em", fontWeight: 200,
                    textTransform: "uppercase", fontSize: 17,
                }}>
                    Command Center
                </Typography.Title>

                {/* Search */}
                <div style={{ width: "100%", maxWidth: 720, marginBottom: 20 }}>
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
                        style={{ fontSize: 15, height: 50, borderRadius: 10 }}
                    />
                    {navItemIds.length > 0 && (
                        <Typography.Text style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, marginTop: 5, display: "block", textAlign: "center" }}>
                            ↑↓ navigate · Enter to open
                        </Typography.Text>
                    )}
                </div>

                {/* ── No-query state: Pinned + Recent + Modules side by side ── */}
                {showNoQuery && (
                    <div style={{ display: "flex", width: "100%", marginBottom: 16, alignItems: "flex-start" }}>

                        {/* Pinned */}
                        {(pinnedItems.length > 0 || pinnedLoading) && (
                            <div style={{ ...SECTION_CARD_STYLE, width: colW[0], flexShrink: 0 }}>
                                <div style={SECTION_HEADER_STYLE}>
                                    <PushpinFilled style={{ color: "#faad14", fontSize: 12 }} />
                                    <Typography.Text style={SECTION_LABEL_STYLE}>Pinned</Typography.Text>
                                    {pinnedLoading && <Spin size="small" style={{ marginLeft: "auto" }} />}
                                </div>
                                {pinnedItems.length > 0 && (
                                    <div style={{ padding: "6px 10px", overflowY: "auto", maxHeight: 400 }}>
                                        {pinnedItems.map((item, idx) => (
                                            <React.Fragment key={`pin-${item.resource}-${item.id}`}>
                                                {idx > 0 && <Divider style={{ margin: "2px 0", borderColor: "rgba(255,255,255,0.04)" }} />}
                                                {renderRow(
                                                    `pin-${item.resource}-${item.id}`,
                                                    getModelTone(item.resource).solid,
                                                    () => { go({ to: `/${item.resource}/show/${item.id}` }); onClose(); },
                                                    <>
                                                        <PushpinFilled style={{ color: "#faad14", fontSize: 11, flexShrink: 0 }} />
                                                        <Typography.Text style={{ color: "rgba(220,220,240,0.88)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                            {item.label}
                                                        </Typography.Text>
                                                    </>,
                                                    <Typography.Text style={{ color: "rgba(255,255,255,0.28)", fontSize: 11 }}>
                                                        {item.modelName}
                                                    </Typography.Text>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Divider: Pinned → next column */}
                        {(pinnedItems.length > 0 || pinnedLoading) && (recentItems.length > 0 || modules.length > 0) && (
                            <ColDivider colIdx={0} />
                        )}

                        {/* Recent */}
                        {recentItems.length > 0 && (
                            <div style={{ ...SECTION_CARD_STYLE, width: colW[1], flexShrink: 0 }}>
                                <div style={SECTION_HEADER_STYLE}>
                                    <ClockCircleOutlined style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }} />
                                    <Typography.Text style={SECTION_LABEL_STYLE}>Recent</Typography.Text>
                                </div>
                                <div style={{ padding: "6px 10px", overflowY: "auto", maxHeight: 400 }}>
                                    {recentItems.map((item, idx) => (
                                        <React.Fragment key={`recent-${item.resource}-${item.id}`}>
                                            {idx > 0 && <Divider style={{ margin: "2px 0", borderColor: "rgba(255,255,255,0.04)" }} />}
                                            {renderRow(
                                                `recent-${item.resource}-${item.id}`,
                                                getModelTone(item.resource).solid,
                                                () => { go({ to: `/${item.resource}/show/${item.id}` }); onClose(); },
                                                <Typography.Text style={{ color: "rgba(220,220,240,0.88)", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {item.label}
                                                </Typography.Text>,
                                                <>
                                                    {item.isNew && (
                                                        <span style={{ fontSize: 9, background: "rgba(82,196,26,0.2)", color: "#52c41a", padding: "1px 5px", borderRadius: 4, fontWeight: 600, letterSpacing: "0.04em" }}>
                                                            new
                                                        </span>
                                                    )}
                                                    <Typography.Text style={{ color: "rgba(255,255,255,0.28)", fontSize: 11 }}>{item.modelName}</Typography.Text>
                                                    {item.timestamp && (
                                                        <Typography.Text style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>{relativeTime(item.timestamp)}</Typography.Text>
                                                    )}
                                                </>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Divider: Recent → Modules */}
                        {recentItems.length > 0 && modules.length > 0 && (
                            <ColDivider colIdx={1} />
                        )}

                        {/* Modules & Models */}
                        {modules.length > 0 && (
                            <div style={{ ...SECTION_CARD_STYLE, flex: 1, minWidth: 200 }}>
                                <div style={SECTION_HEADER_STYLE}>
                                    <AppstoreOutlined style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }} />
                                    <Typography.Text style={SECTION_LABEL_STYLE}>Modules</Typography.Text>
                                </div>
                                <div style={{ padding: "6px 10px", overflowY: "auto", maxHeight: 400 }}>
                                    {modules.map((module, modIdx) => {
                                        const moduleKey = String(module.key || module.name || "");
                                        const moduleLabel = String(module.label || module.name || "");
                                        const tone = getModelTone(moduleKey);
                                        const children = navConfig.length > 0
                                            ? sortItemsByNavConfig(module.children || [], navConfig)
                                            : (module.children || []);
                                        return (
                                            <React.Fragment key={moduleKey}>
                                                {modIdx > 0 && <Divider style={{ margin: "5px 0", borderColor: "rgba(255,255,255,0.06)" }} />}
                                                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px 2px" }}>
                                                    <span style={{ color: tone.solid, fontSize: 12, display: "flex", alignItems: "center" }}>
                                                        {getItemIcon(moduleKey, moduleLabel, true)}
                                                    </span>
                                                    <Typography.Text style={{ color: tone.solid, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                                                        {moduleLabel}
                                                    </Typography.Text>
                                                </div>
                                                {children.map((child, idx) => {
                                                    const childKey = String(child.key || child.name || "");
                                                    const childLabel = String(child.label || child.name || "");
                                                    const childTone = getModelTone(childKey);
                                                    const childIcon = getItemIcon(childKey, childLabel, false, (child as any).icon);
                                                    return (
                                                        <React.Fragment key={childKey}>
                                                            {idx > 0 && <Divider style={{ margin: "2px 0", borderColor: "rgba(255,255,255,0.04)" }} />}
                                                            <div
                                                                data-navid={`mod-${childKey}`}
                                                                data-active={isActive(`mod-${childKey}`) ? "true" : undefined}
                                                                role="button" tabIndex={0}
                                                                onClick={() => { go({ to: child.route || `/${childKey}` }); onClose(); }}
                                                                onKeyDown={(e) => { if (e.key === "Enter") { go({ to: child.route || `/${childKey}` }); onClose(); } }}
                                                                style={{ ...ITEM_BASE_STYLE, paddingLeft: 18, ...(isActive(`mod-${childKey}`) ? ACTIVE_ITEM_STYLE : {}) }}
                                                                {...makeHoverHandlers(childTone.solid)}
                                                            >
                                                                <span style={{ color: childTone.text, fontSize: 13, flexShrink: 0, display: "flex", alignItems: "center", opacity: 0.85 }}>
                                                                    {childIcon}
                                                                </span>
                                                                <Typography.Text style={{ color: "rgba(220,220,240,0.88)", fontSize: 13, fontWeight: 400 }}>
                                                                    {childLabel}
                                                                </Typography.Text>
                                                            </div>
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Command suggestions ────────────────────────────────── */}
                {parsedCommand && (
                    <div style={SECTION_WRAPPER_STYLE}>
                        <div style={SECTION_HEADER_STYLE}>
                            <ThunderboltOutlined style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }} />
                            <Typography.Text style={SECTION_LABEL_STYLE}>Commands</Typography.Text>
                        </div>
                        <div style={{ padding: "6px 10px" }}>
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
                                    const childIcon = getItemIcon(childKey, childLabel, false, (child as any).icon);
                                    const cmdVerb = parsedCommand.command.charAt(0).toUpperCase() + parsedCommand.command.slice(1);
                                    const route = commandRoute(parsedCommand.command, child.route || `/${childKey}`);
                                    const moduleLabel = (child as any).moduleLabel || "";
                                    const navId = `cmd-${childKey}`;
                                    const active = isActive(navId);
                                    return (
                                        <React.Fragment key={childKey}>
                                            {idx > 0 && <Divider style={{ margin: "2px 0", borderColor: "rgba(255,255,255,0.05)" }} />}
                                            <div
                                                data-navid={navId}
                                                data-active={active ? "true" : undefined}
                                                role="button" tabIndex={0}
                                                onClick={() => { go({ to: route }); onClose(); }}
                                                onKeyDown={(e) => { if (e.key === "Enter") { go({ to: route }); onClose(); } }}
                                                style={{ ...ITEM_BASE_STYLE, ...(active ? ACTIVE_ITEM_STYLE : {}) }}
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

                {/* ── Record results ─────────────────────────────────────── */}
                {!parsedCommand && (backendResults.length > 0 || searching) && query.trim() && (
                    <div style={SECTION_WRAPPER_STYLE}>
                        <div style={SECTION_HEADER_STYLE}>
                            <DatabaseOutlined style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }} />
                            <Typography.Text style={SECTION_LABEL_STYLE}>Records</Typography.Text>
                            {searching && <Spin size="small" style={{ marginLeft: "auto" }} />}
                        </div>
                        {backendResults.length > 0 && (
                            <div style={{ padding: "6px 10px" }}>
                                {backendResults.map((modelResult: ModelSearchResult, modelIdx) => {
                                    const tone = getModelTone(modelResult.resource);
                                    return (
                                        <React.Fragment key={modelResult.modelName}>
                                            {modelIdx > 0 && <Divider style={{ margin: "4px 0", borderColor: "rgba(255,255,255,0.05)" }} />}
                                            <Typography.Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", padding: "4px 10px 2px" }}>
                                                {modelResult.modelLabel}
                                            </Typography.Text>
                                            {modelResult.records.map((record, recIdx) => {
                                                const navId = `record-${modelResult.resource}-${record.id}`;
                                                const active = isActive(navId);
                                                return (
                                                    <React.Fragment key={record.id}>
                                                        {recIdx > 0 && <Divider style={{ margin: "2px 0", borderColor: "rgba(255,255,255,0.04)" }} />}
                                                        <div
                                                            data-navid={navId}
                                                            data-active={active ? "true" : undefined}
                                                            role="button" tabIndex={0}
                                                            onClick={() => { go({ to: `/${modelResult.resource}/show/${record.id}` }); onClose(); }}
                                                            onKeyDown={(e) => { if (e.key === "Enter") { go({ to: `/${modelResult.resource}/show/${record.id}` }); onClose(); } }}
                                                            style={{ ...ITEM_BASE_STYLE, justifyContent: "space-between", ...(active ? ACTIVE_ITEM_STYLE : {}) }}
                                                            {...makeHoverHandlers(tone.solid)}
                                                        >
                                                            <Typography.Text style={{ color: "rgba(220,220,240,0.88)", fontSize: 13 }}>
                                                                {record.label}
                                                            </Typography.Text>
                                                            <RightOutlined style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, flexShrink: 0 }} />
                                                        </div>
                                                    </React.Fragment>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Module grid (search / filter mode) ───────────────── */}
                {!parsedCommand && query.trim() && (
                    <div style={{ width: "100%", maxWidth: 1200 }}>
                        {hasNoResults ? (
                            <div style={{ textAlign: "center", paddingTop: 56 }}>
                                <Typography.Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 16 }}>
                                    No results for &ldquo;{query}&rdquo;
                                </Typography.Text>
                            </div>
                        ) : (
                            <Row gutter={[16, 16]}>
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
                                                    borderRadius: 14, height: "100%",
                                                    boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)`,
                                                }}
                                                styles={{
                                                    header: {
                                                        background: tone.solid,
                                                        borderBottom: "1px solid rgba(0,0,0,0.15)",
                                                        borderRadius: "12px 12px 0 0",
                                                        padding: "8px 14px", minHeight: 48,
                                                    },
                                                    body: { padding: "10px 14px 12px", background: "rgba(18,18,32,0.95)" },
                                                }}
                                                title={
                                                    <Space size={8}>
                                                        <div style={{
                                                            background: `${headerTextColor}33`,
                                                            border: `1px solid ${headerTextColor}55`,
                                                            borderRadius: 8, width: 30, height: 30,
                                                            display: "flex", alignItems: "center",
                                                            justifyContent: "center", flexShrink: 0,
                                                        }}>
                                                            <span style={{ color: headerTextColor, fontSize: 14, display: "flex" }}>
                                                                {moduleIcon}
                                                            </span>
                                                        </div>
                                                        <Typography.Text style={{ color: headerTextColor, fontWeight: 600, fontSize: 13, letterSpacing: "0.01em" }}>
                                                            {moduleLabel}
                                                        </Typography.Text>
                                                    </Space>
                                                }
                                            >
                                                {children.length > 0 ? (
                                                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                                        {children.map((child, idx) => {
                                                            const childKey = String(child.key || child.name || "");
                                                            const childLabel = String(child.label || child.name || "");
                                                            const childTone = getModelTone(childKey);
                                                            const childIcon = getItemIcon(childKey, childLabel, false, (child as any).icon);
                                                            return (
                                                                <React.Fragment key={childKey}>
                                                                    {idx > 0 && <Divider style={{ margin: "2px 0", borderColor: "rgba(255,255,255,0.05)" }} />}
                                                                    <div
                                                                        role="button" tabIndex={0}
                                                                        onClick={() => { go({ to: child.route || `/${childKey}` }); onClose(); }}
                                                                        onKeyDown={(e) => { if (e.key === "Enter") { go({ to: child.route || `/${childKey}` }); onClose(); } }}
                                                                        style={ITEM_BASE_STYLE}
                                                                        {...makeHoverHandlers(childTone.solid)}
                                                                    >
                                                                        <span style={{ color: childTone.text, fontSize: 13, flexShrink: 0, display: "flex", alignItems: "center", opacity: 0.85 }}>
                                                                            {childIcon}
                                                                        </span>
                                                                        <Typography.Text style={{ color: "rgba(220, 220, 240, 0.88)", fontSize: 13, fontWeight: 400 }}>
                                                                            {childLabel}
                                                                        </Typography.Text>
                                                                    </div>
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
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
