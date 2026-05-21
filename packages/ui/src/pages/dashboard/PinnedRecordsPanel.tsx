import React, { useState, useCallback } from "react";
import { Spin, Empty, Typography, List, Tag, theme, Tooltip, Button, Space } from "antd";
import { PushpinFilled, PushpinOutlined, ReloadOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { useAllModels } from "../../contexts/AllModelsContext";
import { findModelByName } from "../../components/DynamicResource/utils/model";
import { getModelTone } from "../../utils/modelTone";
import { unpinRecords } from "./hooks/usePinRecord";
import { authenticatedFetch } from "../../utils/authenticatedFetch";
import { API_URL } from "../../providers/constants";

const { Text: AntText, Title: AntTitle } = Typography;

interface PinnedGroup {
    model_name: string;
    resource: string;
    records: Array<{ id: string | number; _label: string; _pin_id?: number; [key: string]: any }>;
}

function usePinnedRecords() {
    const [groups, setGroups] = useState<PinnedGroup[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch(`${API_URL}/dashboard/pinned-records`);
            if (res.ok) {
                const data = await res.json();
                setGroups(data.groups ?? []);
            }
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => { load(); }, [load]);

    return { groups, loading, reload: load };
}

export const PinnedRecordsPanel: React.FC = () => {
    const { token } = theme.useToken();
    const allModels = useAllModels();
    const { groups, loading, reload } = usePinnedRecords();
    const [unpinning, setUnpinning] = useState<Set<string>>(new Set());

    // RBAC-silent: only show groups whose resource is in allModels
    const visibleGroups = groups.filter((g) => findModelByName(allModels, g.resource));

    const handleUnpin = useCallback(async (resource: string, recordId: string | number) => {
        const key = `${resource}:${recordId}`;
        setUnpinning((prev) => new Set(prev).add(key));
        try {
            await unpinRecords(resource, [recordId]);
            await reload();
        } finally {
            setUnpinning((prev) => { const next = new Set(prev); next.delete(key); return next; });
        }
    }, [reload]);

    return (
        <div style={{ padding: "16px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, paddingLeft: 4 }}>
                <PushpinFilled style={{ color: "#faad14", fontSize: 14 }} />
                <AntText type="secondary">Records you've pinned across the app</AntText>
                <Tooltip title="Refresh">
                    <ReloadOutlined
                        style={{ color: token.colorTextTertiary, cursor: "pointer", fontSize: 13 }}
                        onClick={reload}
                    />
                </Tooltip>
                {!loading && (
                    <AntText type="secondary" style={{ fontSize: 12 }}>
                        {visibleGroups.reduce((n, g) => n + g.records.length, 0)} pins across {visibleGroups.length} models
                    </AntText>
                )}
            </div>

            {loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
                    <Spin />
                </div>
            ) : visibleGroups.length === 0 ? (
                <Empty
                    description={
                        <span>
                            No pinned records yet.<br />
                            <AntText type="secondary" style={{ fontSize: 12 }}>
                                Open any record and click the <PushpinOutlined /> pin button to pin it here.
                            </AntText>
                        </span>
                    }
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    style={{ padding: 48 }}
                />
            ) : (
                <Space direction="vertical" size={24} style={{ width: "100%" }}>
                    {visibleGroups.map((group) => {
                        const model = findModelByName(allModels, group.resource);
                        const tone = getModelTone(model?.name ?? group.resource);
                        const label = model?.label ?? group.model_name;

                        return (
                            <div key={group.resource}>
                                <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    marginBottom: 6,
                                    paddingBottom: 6,
                                    borderBottom: `2px solid ${tone.solid}40`,
                                }}>
                                    <div style={{
                                        width: 10,
                                        height: 10,
                                        borderRadius: "50%",
                                        background: tone.solid,
                                        flexShrink: 0,
                                    }} />
                                    <AntTitle level={5} style={{ margin: 0, color: tone.text }}>
                                        {label}
                                    </AntTitle>
                                    <Tag color={tone.solid} style={{ marginLeft: "auto", fontSize: 11 }}>
                                        {group.records.length}
                                    </Tag>
                                </div>

                                <List
                                    size="small"
                                    dataSource={group.records}
                                    renderItem={(rec) => {
                                        const key = `${group.resource}:${rec.id}`;
                                        return (
                                            <List.Item
                                                style={{
                                                    padding: "4px 8px",
                                                    borderRadius: token.borderRadius,
                                                    transition: "background 0.15s",
                                                }}
                                                className="jm-pin-row"
                                            >
                                                <style>{`
                                                    .jm-pin-row:hover { background: ${token.colorFillAlter}; }
                                                    .jm-pin-row .jm-unpin-btn { opacity: 0; transition: opacity 0.15s; }
                                                    .jm-pin-row:hover .jm-unpin-btn { opacity: 1; }
                                                `}</style>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                                                    <PushpinFilled style={{ color: "#faad14", fontSize: 11, flexShrink: 0 }} />
                                                    <Link
                                                        to={`/${group.resource}/show/${rec.id}`}
                                                        style={{ flex: 1, color: token.colorText, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                                    >
                                                        {rec._label || `#${rec.id}`}
                                                    </Link>
                                                    <Tooltip title="Unpin">
                                                        <Button
                                                            className="jm-unpin-btn"
                                                            type="text"
                                                            size="small"
                                                            icon={<PushpinFilled style={{ color: "#faad14" }} />}
                                                            loading={unpinning.has(key)}
                                                            onClick={() => handleUnpin(group.resource, rec.id)}
                                                            style={{ color: token.colorTextTertiary, height: 20, minWidth: 20, padding: "0 4px" }}
                                                        />
                                                    </Tooltip>
                                                </div>
                                            </List.Item>
                                        );
                                    }}
                                />
                            </div>
                        );
                    })}
                </Space>
            )}
        </div>
    );
};
