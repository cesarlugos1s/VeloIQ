/**
 * System Configuration Console — manage application-wide system settings.
 *
 * Accessible as a submenu in the host app's Configurations dropdown.
 * Organized into three cards:
 *   - Logging: verbosity and output behavior
 *   - Appearance: color schemas and base colors
 *   - Views & Layout: default view types, gallery dimensions, relation limits
 */
import React, { useState, useEffect, useCallback } from "react";
import {
    Button, Switch, Input, InputNumber, Select, Card, Row, Col,
    Typography, Space, Tag, Tooltip, message, Spin, Flex,
} from "antd";
import {
    SettingOutlined, InfoCircleOutlined, SaveOutlined,
    ReloadOutlined, BgColorsOutlined, LayoutOutlined,
    FileTextOutlined,
} from "@ant-design/icons";
import { authenticatedFetch, API_URL } from "@juicemantics/veloiq-ui";

const _ = (text: string): string => {
    const t = (window as any)._;
    return typeof t === "function" ? t(text) : text;
};
const API = API_URL;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConfigItem {
    section?: string;
    key: string;
    type: string;   // "bool", "int", "string", "color", "select"
    source: string;  // "ini" or "toml"
    card: string;    // "logging", "appearance", "views"
    label: string;
    tooltip: string;
    value: string;
    options?: string[];
}

interface ConfigResponse {
    items: ConfigItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
    const res = await authenticatedFetch(url, {
        headers: { "Content-Type": "application/json", ...(options.headers ?? {}) },
        ...options,
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `HTTP ${res.status}`);
    }
    return res.json();
}

// ---------------------------------------------------------------------------
// Card Metadata
// ---------------------------------------------------------------------------

const CARD_META: Record<string, { icon: React.ReactNode; color: string; title: string; desc: string }> = {
    logging: {
        icon: <FileTextOutlined />,
        color: "#722ed1",
        title: "Logging",
        desc: "Configure application logging verbosity and output behavior.",
    },
    appearance: {
        icon: <BgColorsOutlined />,
        color: "#1e708a",
        title: "Appearance",
        desc: "Color schemas and base colors for the UI navigation and model entries.",
    },
    views: {
        icon: <LayoutOutlined />,
        color: "#1677ff",
        title: "Views & Layout",
        desc: "Default view types, gallery dimensions, relation limits, and action button placement.",
    },
};

// ---------------------------------------------------------------------------
// Color Presets
// ---------------------------------------------------------------------------

const COLOR_PRESETS = [
    "#1e708a", "#1677ff", "#52c41a", "#722ed1",
    "#fa8c16", "#eb2f96", "#13c2c2", "#f5222d",
    "#000000", "#ffffff",
];

// ===========================================================================
// Main Component
// ===========================================================================

const SystemConfigConsole: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<ConfigItem[]>([]);
    const [dirty, setDirty] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    // -----------------------------------------------------------------------
    // Data fetching
    // -----------------------------------------------------------------------

    const fetchConfig = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiFetch<ConfigResponse>(`${API}/system-config`);
            setItems(data.items ?? []);
            setDirty({});
        } catch (e: any) {
            message.error(e?.message ?? _("Failed to load system configuration"));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    // -----------------------------------------------------------------------
    // Change tracking
    // -----------------------------------------------------------------------

    const handleChange = (key: string, value: string) => {
        setDirty(prev => {
            const item = items.find(i => i.key === key);
            const original = item?.value ?? "";
            if (value === original) {
                const next = { ...prev };
                delete next[key];
                return next;
            }
            return { ...prev, [key]: value };
        });
    };

    const getValue = (item: ConfigItem): string => {
        return item.key in dirty ? dirty[item.key] : item.value;
    };

    // -----------------------------------------------------------------------
    // Save
    // -----------------------------------------------------------------------

    const handleSave = async () => {
        if (Object.keys(dirty).length === 0) {
            message.info(_("No changes to save"));
            return;
        }
        setSaving(true);
        try {
            await apiFetch(`${API}/system-config`, {
                method: "PUT",
                body: JSON.stringify({ updates: dirty }),
            });
            message.success(_("Configuration saved"));
            fetchConfig();
        } catch (e: any) {
            message.error(e?.message ?? _("Failed to save"));
        } finally {
            setSaving(false);
        }
    };

    // -----------------------------------------------------------------------
    // Grouping
    // -----------------------------------------------------------------------

    const grouped = (card: string): ConfigItem[] => {
        return items.filter(i => i.card === card);
    };


    // -----------------------------------------------------------------------
    // Widget renderer
    // -----------------------------------------------------------------------

    const renderConfigItem = (item: ConfigItem) => {
        const val = getValue(item);

        switch (item.type) {
            case "bool":
                return (
                    <Tooltip key={item.key} title={_(item.tooltip)}>
                        <Space style={{ marginBottom: 8 }}>
                            <Switch
                                checked={val === "true" || val === "True"}
                                onChange={(checked) =>
                                    handleChange(item.key, checked ? "true" : "false")
                                }
                                size="small"
                            />
                            <Typography.Text style={{ fontSize: 13 }}>
                                {_(item.label)}
                            </Typography.Text>
                            <Tooltip title={_(item.tooltip)}>
                                <InfoCircleOutlined
                                    style={{ color: "#bfbfbf", fontSize: 12 }}
                                />
                            </Tooltip>
                        </Space>
                    </Tooltip>
                );

            case "int":
                return (
                    <div key={item.key} style={{ marginBottom: 8 }}>
                        <Typography.Text
                            style={{ fontSize: 13, display: "block", marginBottom: 4 }}
                        >
                            {_(item.label)}
                            <Tooltip title={_(item.tooltip)}>
                                <InfoCircleOutlined
                                    style={{ color: "#bfbfbf", fontSize: 12, marginLeft: 4 }}
                                />
                            </Tooltip>
                        </Typography.Text>
                        <InputNumber
                            value={
                                val === "" || val === undefined
                                    ? null
                                    : Number(val)
                            }
                            onChange={(v) =>
                                handleChange(
                                    item.key,
                                    v === null || v === undefined ? "" : String(v)
                                )
                            }
                            style={{ width: 160 }}
                            size="small"
                        />
                    </div>
                );

            case "color":
                return (
                    <div key={item.key} style={{ marginBottom: 8 }}>
                        <Typography.Text
                            style={{ fontSize: 13, display: "block", marginBottom: 4 }}
                        >
                            {_(item.label)}
                            <Tooltip title={_(item.tooltip)}>
                                <InfoCircleOutlined
                                    style={{ color: "#bfbfbf", fontSize: 12, marginLeft: 4 }}
                                />
                            </Tooltip>
                        </Typography.Text>
                        <Space>
                            <div
                                style={{
                                    width: 22,
                                    height: 22,
                                    backgroundColor: val || "#cccccc",
                                    border: "1px solid #d9d9d9",
                                    borderRadius: 3,
                                    display: "inline-block",
                                }}
                            />
                            <Select
                                value={val || undefined}
                                onChange={(v) => handleChange(item.key, v)}
                                style={{ width: 130 }}
                                size="small"
                                options={(item.options || COLOR_PRESETS).map((c) => ({
                                    label: (
                                        <Space>
                                            <div
                                                style={{
                                                    width: 14,
                                                    height: 14,
                                                    backgroundColor: c,
                                                    border: "1px solid #d9d9d9",
                                                    borderRadius: 2,
                                                    display: "inline-block",
                                                }}
                                            />
                                            {c}
                                        </Space>
                                    ),
                                    value: c,
                                }))}
                            />
                            <Input
                                value={val}
                                onChange={(e) => handleChange(item.key, e.target.value)}
                                style={{ width: 100 }}
                                size="small"
                                placeholder="#1e708a"
                            />
                        </Space>
                    </div>
                );

            case "select":
                return (
                    <div key={item.key} style={{ marginBottom: 8 }}>
                        <Typography.Text
                            style={{ fontSize: 13, display: "block", marginBottom: 4 }}
                        >
                            {_(item.label)}
                            <Tooltip title={_(item.tooltip)}>
                                <InfoCircleOutlined
                                    style={{ color: "#bfbfbf", fontSize: 12, marginLeft: 4 }}
                                />
                            </Tooltip>
                        </Typography.Text>
                        <Select
                            value={val || undefined}
                            onChange={(v) => handleChange(item.key, v)}
                            style={{ width: 200 }}
                            size="small"
                            options={(item.options || []).map((o) => ({
                                label: o,
                                value: o,
                            }))}
                        />
                    </div>
                );

            case "string":
            default:
                if (item.options && item.options.length > 0) {
                    return (
                        <div key={item.key} style={{ marginBottom: 8 }}>
                            <Typography.Text
                                style={{
                                    fontSize: 13,
                                    display: "block",
                                    marginBottom: 4,
                                }}
                            >
                                {_(item.label)}
                                <Tooltip title={_(item.tooltip)}>
                                    <InfoCircleOutlined
                                        style={{
                                            color: "#bfbfbf",
                                            fontSize: 12,
                                            marginLeft: 4,
                                        }}
                                    />
                                </Tooltip>
                            </Typography.Text>
                            <Select
                                value={val || undefined}
                                onChange={(v) => handleChange(item.key, v)}
                                style={{ width: 200 }}
                                size="small"
                                options={(item.options || []).map((o) => ({
                                    label: o,
                                    value: o,
                                }))}
                            />
                        </div>
                    );
                }

                return (
                    <div key={item.key} style={{ marginBottom: 8 }}>
                        <Typography.Text
                            style={{ fontSize: 13, display: "block", marginBottom: 4 }}
                        >
                            {_(item.label)}
                            <Tooltip title={_(item.tooltip)}>
                                <InfoCircleOutlined
                                    style={{ color: "#bfbfbf", fontSize: 12, marginLeft: 4 }}
                                />
                            </Tooltip>
                        </Typography.Text>
                        <Input
                            value={val}
                            onChange={(e) => handleChange(item.key, e.target.value)}
                            style={{ width: 240 }}
                            size="small"
                        />
                    </div>
                );
        }
    };

    // -----------------------------------------------------------------------
    // Views card: render field groups with light borders
    // -----------------------------------------------------------------------

    /** Groups of related keys in the Views & Layout card, each rendered inside
     * a light bordered box with a subtle group label. */
    const VIEWS_FIELD_GROUPS: { label: string; keys: string[] }[] = [
        {
            label: "View types",
            keys: ["show_view_type", "edit_view_type", "list_view_type", "file_list_view_type"],
        },
        {
            label: "Gallery images",
            keys: ["gallery_image_width", "gallery_image_height"],
        },
        {
            label: "Table limits",
            keys: ["relations_max_rows_to_load", "max_distinct_column_filter_values_to_ranges"],
        },
        {
            label: "Actions & tabs",
            keys: ["general_actions_button_position", "add_tabs_for_non_configured_relations"],
        },
        {
            label: "Side panels",
            keys: ["panes_layout_mode", "panes_max_visible", "panes_fixed_width"],
        },
    ];

    const renderViewsCardGroups = (cardItems: ConfigItem[]) => {
        // Build a quick lookup: key → item
        const byKey: Record<string, ConfigItem> = {};
        for (const it of cardItems) {
            byKey[it.key] = it;
        }

        return VIEWS_FIELD_GROUPS.map((group) => {
            const groupItems = group.keys
                .map((k) => byKey[k])
                .filter(Boolean);
            if (groupItems.length === 0) return null;

            return (
                <Col span={24} key={group.label}>
                    <div
                        style={{
                            border: "1px dashed #d9d9d9",
                            borderRadius: 6,
                            padding: "4px 8px 2px 8px",
                            marginBottom: 6,
                        }}
                    >
                        <Typography.Text
                            type="secondary"
                            style={{
                                fontSize: 11,
                                display: "block",
                                marginBottom: 2,
                            }}
                        >
                            {_(group.label)}
                        </Typography.Text>
                        <Row gutter={[8, 2]}>
                            {groupItems.map((item) => (
                                <Col
                                    key={item.key}
                                    span={
                                        item.type === "bool" ? 24 : 12
                                    }
                                >
                                    {renderConfigItem(item)}
                                </Col>
                            ))}
                        </Row>
                    </div>
                </Col>
            );
        });
    };


    // -----------------------------------------------------------------------
    // Loading state
    // -----------------------------------------------------------------------

    if (loading) {
        return <Spin style={{ display: "block", margin: "40px auto" }} />;
    }

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    return (
        <div style={{ padding: "20px 24px" }}>
            {/* Title */}
            <Space style={{ marginBottom: 16 }}>
                <SettingOutlined style={{ fontSize: 22, color: "#1677ff" }} />
                <Typography.Title level={4} style={{ margin: 0 }}>
                    {_("System Configuration")}
                </Typography.Title>
            </Space>
            <Typography.Text
                type="secondary"
                style={{ display: "block", marginBottom: 20 }}
            >
                {_(
                    "Manage application-wide system settings — logging, UI appearance, and view defaults."
                )}
            </Typography.Text>

            {/* Save bar */}
            <Flex gap={8} align="center" style={{ marginBottom: 16 }}>
                <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={handleSave}
                    loading={saving}
                    disabled={Object.keys(dirty).length === 0}
                >
                    {_("Save Configuration")}
                </Button>
                {Object.keys(dirty).length > 0 && (
                    <Tag color="orange">
                        {Object.keys(dirty).length} {_("unsaved changes")}
                    </Tag>
                )}
                <Button icon={<ReloadOutlined />} onClick={fetchConfig}>
                    {_("Reload")}
                </Button>
            </Flex>

            {/* Cards row */}
            <Row gutter={[16, 16]}>
                {["logging", "appearance", "views"].map((card) => {
                    const cardItems = grouped(card);
                    const meta = CARD_META[card];
                    // Give the Views card more width since it has the most fields.
                    const colSpan = card === "views" ? 14 : 5;
                    return (
                        <Col xs={24} lg={colSpan} key={card}>
                            <Card
                                size="small"
                                style={{
                                    borderTop: `3px solid ${meta.color}`,
                                    height: "100%",
                                }}
                                title={
                                    <Space>
                                        <span style={{ color: meta.color }}>
                                            {meta.icon}
                                        </span>
                                        <Typography.Text strong style={{ fontSize: 14 }}>
                                            {_(meta.title)}
                                        </Typography.Text>
                                    </Space>
                                }
                            >
                                <Typography.Text
                                    type="secondary"
                                    style={{
                                        fontSize: 12,
                                        marginBottom: 12,
                                        display: "block",
                                    }}
                                >
                                    {_(meta.desc)}
                                </Typography.Text>
                                {/* Render items in a 2-column grid for cards with
                                    many fields to reduce vertical space.
                                    Related field groups get a light border +
                                    label to visually indicate grouping. */}
                                <Row gutter={[12, 4]} style={{ marginTop: 8 }}>
                                    {card === "views"
                                        ? renderViewsCardGroups(cardItems)
                                        : cardItems.map((item) => {
                                            // Appearance card: stack dropdowns vertically
                                            // Logging card: single field, full width
                                            const span =
                                                card === "appearance"
                                                    ? 24
                                                    : item.type === "bool"
                                                        ? 24
                                                        : 12;
                                            return (
                                                <Col key={item.key} span={span}>
                                                    {renderConfigItem(item)}
                                                </Col>
                                            );
                                        })}
                                </Row>
                            </Card>
                        </Col>
                    );
                })}
            </Row>
        </div>
    );
};

export default SystemConfigConsole;

