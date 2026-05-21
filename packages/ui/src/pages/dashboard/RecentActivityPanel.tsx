import React, { useState } from "react";
import { Spin, Empty, Typography, InputNumber, Space, List, Tag, theme, Tooltip } from "antd";
import { ClockCircleOutlined, ReloadOutlined } from "@ant-design/icons";
import { Link } from "react-router-dom";
import { useRecentActivity } from "./hooks/useRecentActivity";
import { useAllModels } from "../../contexts/AllModelsContext";
import { findModelByName } from "../../components/DynamicResource/utils/model";
import { getModelTone } from "../../utils/modelTone";

const { Text, Title } = Typography;

function relativeTime(iso?: string): string {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
}

export const RecentActivityPanel: React.FC = () => {
    const { token } = theme.useToken();
    const allModels = useAllModels();
    const [days, setDays] = useState(30);
    const { data, loading, reload } = useRecentActivity(days);

    const groups = data?.groups ?? [];

    return (
        <div style={{ padding: "16px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, paddingLeft: 4 }}>
                <Text type="secondary">Show activity from the last</Text>
                <InputNumber
                    min={1}
                    max={365}
                    value={days}
                    onChange={(v) => v && setDays(v)}
                    style={{ width: 72 }}
                    size="small"
                />
                <Text type="secondary">days</Text>
                <Tooltip title="Refresh">
                    <ReloadOutlined
                        style={{ color: token.colorTextTertiary, cursor: "pointer", fontSize: 13 }}
                        onClick={reload}
                    />
                </Tooltip>
                {data && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {groups.reduce((n, g) => n + g.records.length, 0)} records across {groups.length} models
                    </Text>
                )}
            </div>

            {loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
                    <Spin />
                </div>
            ) : groups.length === 0 ? (
                <Empty
                    description={`No activity in the last ${days} days`}
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    style={{ padding: 48 }}
                />
            ) : (
                <Space direction="vertical" size={24} style={{ width: "100%" }}>
                    {groups.map((group) => {
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
                                    <Title level={5} style={{ margin: 0, color: tone.text }}>
                                        {label}
                                    </Title>
                                    <Tag color={tone.solid} style={{ marginLeft: "auto", fontSize: 11 }}>
                                        {group.records.length}
                                    </Tag>
                                </div>

                                <List
                                    size="small"
                                    dataSource={group.records}
                                    renderItem={(rec) => {
                                        const timestamp = rec.updated_at || rec.created_at;
                                        const isNew = rec.created_at === rec.updated_at;
                                        return (
                                            <List.Item
                                                style={{
                                                    padding: "4px 8px",
                                                    borderRadius: token.borderRadius,
                                                    transition: "background 0.15s",
                                                }}
                                                className="jm-activity-row"
                                            >
                                                <style>{`
                                                    .jm-activity-row:hover { background: ${token.colorFillAlter}; }
                                                `}</style>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                                                    <ClockCircleOutlined style={{ color: token.colorTextTertiary, fontSize: 11, flexShrink: 0 }} />
                                                    <Link
                                                        to={`/${group.resource}/show/${rec.id}`}
                                                        style={{ flex: 1, color: token.colorText, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                                                    >
                                                        {rec._label || `#${rec.id}`}
                                                    </Link>
                                                    {isNew && (
                                                        <Tag color="green" style={{ fontSize: 10, padding: "0 4px", lineHeight: "16px" }}>new</Tag>
                                                    )}
                                                    <Text type="secondary" style={{ fontSize: 11, flexShrink: 0 }}>
                                                        {relativeTime(timestamp)}
                                                    </Text>
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
