/**
 * VigilantIQ License Management page.
 *
 * Displays the installation ID, lists registered license keys, and lets an
 * admin paste a new license JWT to unlock module groups.
 *
 * Talks exclusively to the VigilantIQ license API (root-mounted at
 * /vigilantiq/license/*; the frontend calls them via ${API_URL} = "/api"
 * which the dev proxy / production gateway maps to the backend root).
 *
 * This is the canonical source for the license-manager UI. It can be consumed
 * directly as a source page (import into the host App.tsx) or built into a
 * UMD bundle (static/license-manager.umd.js) for drop-in extension delivery.
 */
import React, { useEffect, useState } from "react";
import {
    Typography, Card, Input, Button, Table, Tag, Space, Alert, message, Spin,
} from "antd";
import { KeyOutlined, CopyOutlined } from "@ant-design/icons";
import { API_URL, authenticatedFetch } from "@juicemantics/veloiq-ui";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const LICENSE_BASE = `${API_URL}/vigilantiq/license`;

interface LicenseKey {
    id: number;
    module_group: string;
    start_date: string;
    end_date: string;
    status: string;
    kid: string | null;
    added_at: string;
    max_page_configurations: number | null;
    max_journey_definitions: number | null;
    max_nlp_users: number | null;
}

interface LicensePool {
    installation_id: string;
    licensed_modules: string[];
    write_allowed_modules: string[];
    group_statuses: Record<string, string>;
    module_groups: Record<string, string[]>;
    warnings: Array<{ type: string; group: string; days_remaining: number }>;
}

const STATUS_COLOR: Record<string, string> = {
    Active: "green",
    "Grace Period": "gold",
    Expired: "red",
    Superseded: "default",
    Deactivated: "default",
    active: "green",
    grace_period: "gold",
    blocked: "red",
};

export default function LicenseManagement() {
    const [pool, setPool] = useState<LicensePool | null>(null);
    const [keys, setKeys] = useState<LicenseKey[]>([]);
    const [token, setToken] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const [poolRes, keysRes] = await Promise.all([
                authenticatedFetch(`${LICENSE_BASE}/pool`),
                authenticatedFetch(`${LICENSE_BASE}/keys`),
            ]);
            if (poolRes.ok) setPool(await poolRes.json());
            if (keysRes.ok) setKeys(await keysRes.json());
        } catch {
            message.error("Failed to load license data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const handleAdd = async () => {
        if (!token.trim()) {
            message.warning("Paste a license key first");
            return;
        }
        setSubmitting(true);
        try {
            const res = await authenticatedFetch(`${LICENSE_BASE}/keys`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: token.trim() }),
            });
            const data = await res.json();
            if (res.ok) {
                message.success(data.message ?? "License key added");
                setToken("");
                loadData();
            } else {
                message.error(data.detail ?? "Failed to add license key");
            }
        } catch {
            message.error("Network error adding license key");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeactivate = async (id: number) => {
        try {
            const res = await authenticatedFetch(`${LICENSE_BASE}/keys/${id}/deactivate`, {
                method: "PATCH",
            });
            if (res.ok) {
                message.success("License key deactivated");
                loadData();
            } else {
                message.error("Failed to deactivate key");
            }
        } catch {
            message.error("Network error");
        }
    };

    const copyInstallationId = () => {
        if (pool?.installation_id) {
            navigator.clipboard.writeText(pool.installation_id);
            message.success("Installation ID copied");
        }
    };

    const columns = [
        { title: "Module Group", dataIndex: "module_group", key: "module_group" },
        { title: "Start", dataIndex: "start_date", key: "start_date" },
        { title: "End", dataIndex: "end_date", key: "end_date" },
        {
            title: "Status", dataIndex: "status", key: "status",
            render: (s: string) => <Tag color={STATUS_COLOR[s] ?? "default"}>{s}</Tag>,
        },
        {
            title: "Limits", key: "limits",
            render: (_: unknown, k: LicenseKey) => {
                const parts: string[] = [];
                if (k.max_page_configurations != null) parts.push(`Pages: ${k.max_page_configurations}`);
                if (k.max_journey_definitions != null) parts.push(`Journeys: ${k.max_journey_definitions}`);
                if (k.max_nlp_users != null) parts.push(`NLP users: ${k.max_nlp_users}`);
                return parts.length ? <Text type="secondary">{parts.join(" · ")}</Text> : "—";
            },
        },
        {
            title: "Actions", key: "actions",
            render: (_: unknown, k: LicenseKey) =>
                k.status !== "Deactivated" ? (
                    <Button danger size="small" type="link" onClick={() => handleDeactivate(k.id)}>
                        Deactivate
                    </Button>
                ) : null,
        },
    ];

    if (loading) {
        return <div style={{ padding: 48, textAlign: "center" }}><Spin size="large" /></div>;
    }

    return (
        <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
            <Title level={3}><KeyOutlined /> VigilantIQ Licensing</Title>

            <Card size="small" style={{ marginBottom: 16, background: "#fafafa" }}>
                <Text strong>Installation ID</Text>
                <Paragraph style={{ marginBottom: 0, marginTop: 4 }}>
                    <Text code copyable={false} style={{ fontSize: 13 }}>
                        {pool?.installation_id ?? "—"}
                    </Text>
                    <Button type="link" size="small" icon={<CopyOutlined />} onClick={copyInstallationId}>
                        Copy
                    </Button>
                </Paragraph>
                <Text type="secondary" style={{ fontSize: 12 }}>
                    Provide this ID to JuiceMantics when requesting a VigilantIQ license key.
                </Text>
            </Card>

            {pool?.warnings?.map((w, i) => (
                <Alert
                    key={i}
                    type="warning"
                    showIcon
                    style={{ marginBottom: 8 }}
                    message={
                        w.type === "grace_period"
                            ? `${w.group}: grace period — read-only. Expires in ${w.days_remaining} day(s).`
                            : `${w.group}: license expires in ${w.days_remaining} day(s).`
                    }
                />
            ))}

            <Card title="Module Group Status" size="small" style={{ marginBottom: 16 }}>
                <Space wrap>
                    {pool && Object.entries(pool.group_statuses).map(([group, status]) => (
                        <Tag key={group} color={STATUS_COLOR[status] ?? "default"}>
                            {group}: {status}
                        </Tag>
                    ))}
                </Space>
            </Card>

            <Card title="Register a License Key" size="small" style={{ marginBottom: 16 }}>
                <TextArea
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    rows={4}
                    placeholder="Paste your VigilantIQ license JWT here…"
                    style={{ fontFamily: "monospace", fontSize: 12 }}
                />
                <Button
                    type="primary"
                    style={{ marginTop: 8 }}
                    loading={submitting}
                    onClick={handleAdd}
                >
                    Add License Key
                </Button>
            </Card>

            <Card title="Registered Keys" size="small">
                <Table
                    rowKey="id"
                    dataSource={keys}
                    columns={columns}
                    pagination={false}
                    locale={{ emptyText: "No license keys registered" }}
                    size="small"
                />
            </Card>
        </div>
    );
}
