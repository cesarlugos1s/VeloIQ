import React, { useCallback, useEffect, useState } from "react";
import { Alert, Button, Modal, Skeleton, Table, Tabs, Tag, Typography, message } from "antd";
import { CheckCircleOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { useApiUrl } from "@refinedev/core";
import { useNavigate } from "react-router-dom";
import { authenticatedFetch } from "../../utils/authenticatedFetch";
import { getModelTone, useModelTone } from "../../utils/modelTone";
import { ExecutableHtml } from "../ExecutableHtml";
import type { FieldDef, ModelDef, RelationDef } from "./types";
import { getFieldLabel, getModelLabel, getModuleLabel, getRelationLabel } from "./utils/i18n";
import { isReverseRelation } from "./relations/helpers";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));
const DARK_GRAY = "#444";
const { Title } = Typography;

export const MetadataModal: React.FC<{ model: ModelDef; allModels?: ModelDef[]; open: boolean; onClose: () => void }> = ({ model, allModels, open, onClose }) => {
    const apiUrl = useApiUrl();
    const tone = useModelTone(model);
    const modelLabel = getModelLabel(model);
    const [nestedModel, setNestedModel] = useState<ModelDef | null>(null);
    const [activeTab, setActiveTab] = useState("fields");
    const [graphHtml, setGraphHtml] = useState<string | null>(null);
    const [graphLoading, setGraphLoading] = useState(false);
    const [graphError, setGraphError] = useState<string | null>(null);

    useEffect(() => {
        setGraphHtml(null);
        setGraphError(null);
    }, [model.name]);

    const findRelatedModel = useCallback((name?: string): ModelDef | undefined => {
        if (!name || !allModels) return undefined;
        const lower = name.toLowerCase();
        return allModels.find(m =>
            (m.name || "").toLowerCase() === lower ||
            (m.resource || "").toLowerCase() === lower
        );
    }, [allModels]);

    const loadGraph = useCallback(async () => {
        if (graphHtml !== null || graphLoading) return;
        setGraphLoading(true);
        setGraphError(null);
        try {
            const relations = (model.relations || [])
                .map(r => {
                    const targetName = r.otherResource || r.resource;
                    const relModel = findRelatedModel(targetName);
                    const other_label = relModel
                        ? _(getModelLabel(relModel))
                        : _(targetName || "");
                    return {
                        relation_name: r.relationName || r.resource,
                        relation_label: getRelationLabel(r),
                        other_resource: targetName,
                        other_label,
                        is_reverse: isReverseRelation(r),
                        nav_url: `/${targetName}`,
                    };
                });
            const res = await authenticatedFetch(`${apiUrl}/views/model_graph`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model_name: model.name,
                    model_label: modelLabel,
                    relations,
                }),
            });
            if (!res.ok) throw new Error(`${res.status}`);
            const data = await res.json();
            setGraphHtml(data.html || "");
        } catch (e) {
            setGraphError(e instanceof Error ? e.message : String(e));
        } finally {
            setGraphLoading(false);
        }
    }, [apiUrl, model, modelLabel, graphHtml, graphLoading, findRelatedModel]);

    useEffect(() => {
        if (activeTab === "knowledge_graph") {
            loadGraph();
        }
    }, [activeTab, loadGraph]);

    const navigate = useNavigate();
    useEffect(() => {
        const handler = (e: MessageEvent) => {
            if (e.data?.action === "metadata_graph_navigate" && e.data?.url) {
                onClose();
                navigate(e.data.url);
            }
        };
        window.addEventListener("message", handler);
        return () => window.removeEventListener("message", handler);
    }, [navigate, onClose]);

    const fieldColumns = [
        {
            title: _("Field"),
            dataIndex: "label",
            key: "label",
            width: 160,
            render: (_val: string, row: FieldDef) => (
                <span style={{ color: tone.solid }}>{getFieldLabel(row)}</span>
            ),
        },
        {
            title: _("Type"),
            dataIndex: "type",
            key: "type",
            width: 90,
            render: (v: string) => <Tag style={{ color: DARK_GRAY }}>{_(v)}</Tag>,
        },
        {
            title: _("Required"),
            dataIndex: "required",
            key: "required",
            width: 80,
            render: (v?: boolean) => v ? <CheckCircleOutlined style={{ color: "#52c41a" }} /> : null,
        },
        {
            title: _("Description"),
            dataIndex: "description",
            key: "description",
            render: (v?: string) => v
                ? <span style={{ color: DARK_GRAY }}>{_(v)}</span>
                : <span style={{ color: "#bbb" }}>—</span>,
        },
        {
            title: _("Constraints"),
            dataIndex: "constraints",
            key: "constraints",
            width: 180,
            render: (v?: string[]) => v?.length
                ? v.map((c, i) => <Tag key={i} style={{ fontSize: 11, color: DARK_GRAY }}>{c}</Tag>)
                : <span style={{ color: "#bbb" }}>—</span>,
        },
        {
            title: _("Valid Values"),
            dataIndex: "options",
            key: "options",
            width: 200,
            render: (_v: unknown, row: FieldDef) => {
                const opts = row.options;
                if (!opts?.length) return <span style={{ color: "#bbb" }}>—</span>;
                return (
                    <span style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                        {opts.map((o, i) => {
                            const color = row.valueColors?.[String(o.value)];
                            return (
                                <Tag key={i} color={color} style={{ fontSize: 11, color: color ? undefined : DARK_GRAY, margin: 0 }}>
                                    {String(o.label)}
                                </Tag>
                            );
                        })}
                    </span>
                );
            },
        },
        {
            title: _("Default"),
            key: "default",
            width: 120,
            render: (_v: unknown, row: FieldDef) => {
                const val = row.default ?? row.defaultValue ?? row.default_value;
                if (val === undefined || val === null) return <span style={{ color: "#bbb" }}>—</span>;
                return <code style={{ fontSize: 12, color: DARK_GRAY }}>{String(val)}</code>;
            },
        },
        {
            title: _("Formula"),
            dataIndex: "formula",
            key: "formula",
            render: (v?: string) => v
                ? <code style={{ fontSize: 12, color: DARK_GRAY }}>{v}</code>
                : <span style={{ color: "#bbb" }}>—</span>,
        },
    ];
    const relationColumns = [
        {
            title: _("Relation"),
            dataIndex: "label",
            key: "label",
            width: 200,
            render: (_val: string, row: RelationDef) => (
                <span style={{ color: DARK_GRAY }}>{getRelationLabel(row)}</span>
            ),
        },
        {
            title: _("Related Model"),
            dataIndex: "otherResource",
            key: "otherResource",
            width: 160,
            render: (v?: string) => {
                if (!v) return <span style={{ color: "#bbb" }}>—</span>;
                const related = findRelatedModel(v);
                if (related) {
                    const relTone = getModelTone(related);
                    return (
                        <Button
                            type="link"
                            size="small"
                            style={{ padding: 0, color: relTone.solid, fontWeight: 500 }}
                            onClick={() => setNestedModel(related)}
                        >
                            {_(v)}
                        </Button>
                    );
                }
                return <span style={{ color: DARK_GRAY }}>{_(v)}</span>;
            },
        },
        {
            title: _("Keys"),
            key: "keys",
            width: 170,
            render: (_val: unknown, row: RelationDef) => (
                <span style={{ fontSize: 12, fontFamily: "monospace", color: DARK_GRAY }}>
                    {row.targetKey}
                    {row.otherKey ? <span style={{ color: "#888" }}>{" → "}{row.otherKey}</span> : null}
                    {row.isRecursive ? <Tag style={{ marginLeft: 4, fontSize: 10 }}>{_("recursive")}</Tag> : null}
                </span>
            ),
        },
        {
            title: _("Description"),
            dataIndex: "description",
            key: "description",
            render: (v?: string) => v
                ? <span style={{ color: DARK_GRAY }}>{_(v)}</span>
                : <span style={{ color: "#bbb" }}>—</span>,
        },
    ];

    const knowledgeGraphChildren = (
        <>
            {graphLoading && <Skeleton active paragraph={{ rows: 6 }} />}
            {graphError && (
                <Alert type="error" message={_("Error loading knowledge graph")} description={graphError} />
            )}
            {graphHtml && !graphLoading && (
                <ExecutableHtml html={graphHtml} style={{ minHeight: 400 }} />
            )}
        </>
    );

    const tabItems = [
        {
            key: "fields",
            label: _("Fields"),
            children: (
                <Table<FieldDef>
                    columns={fieldColumns}
                    dataSource={(model.fields || []).filter(f => f.key !== "cwuri")}
                    rowKey="key"
                    size="small"
                    pagination={false}
                    scroll={{ x: true }}
                />
            ),
        },
        ...(model.relations?.length ? [{
            key: "relations",
            label: _("Relations"),
            children: (() => {
                const sortByName = (a: RelationDef, b: RelationDef) =>
                    getRelationLabel(a).localeCompare(getRelationLabel(b));
                const reverseRels = (model.relations || []).filter(r => isReverseRelation(r)).sort(sortByName);
                const forwardRels = (model.relations || []).filter(r => !isReverseRelation(r)).sort(sortByName);
                return (
                    <>
                        {reverseRels.length > 0 && (
                            <>
                                <Title level={5} style={{ marginTop: 0, marginBottom: 8, fontWeight: 500 }}>
                                    {_("Reverse Relations")}
                                </Title>
                                <Table<RelationDef>
                                    columns={relationColumns}
                                    dataSource={reverseRels}
                                    rowKey={(r) => r.resource + r.targetKey}
                                    size="small"
                                    pagination={false}
                                    scroll={{ x: true }}
                                    style={{ marginBottom: 20 }}
                                />
                            </>
                        )}
                        {forwardRels.length > 0 && (
                            <>
                                <Title level={5} style={{ marginTop: 0, marginBottom: 8, fontWeight: 500 }}>
                                    {_("Forward Relations")}
                                </Title>
                                <Table<RelationDef>
                                    columns={relationColumns}
                                    dataSource={forwardRels}
                                    rowKey={(r) => r.resource + r.targetKey}
                                    size="small"
                                    pagination={false}
                                    scroll={{ x: true }}
                                />
                            </>
                        )}
                    </>
                );
            })(),
        }] : []),
        {
            key: "knowledge_graph",
            label: _("Knowledge Graph"),
            children: knowledgeGraphChildren,
        },
    ];
    const moduleLabel = model.module ? getModuleLabel(model.module) : undefined;
    return (
        <>
            <Modal
                title={(
                    <span style={{ color: tone.solid }}>
                        <InfoCircleOutlined style={{ marginRight: 8 }} />
                        {_("Metadata")}
                        {" — "}
                        {moduleLabel ? `${moduleLabel} › ` : ""}
                        {modelLabel}
                    </span>
                )}
                open={open}
                onCancel={onClose}
                footer={null}
                width={1290}
                styles={{ body: { minHeight: 520, maxHeight: "75vh", overflowY: "auto" } }}
                destroyOnHidden
            >
                {model.description && (
                    <div style={{
                        background: tone.soft,
                        color: tone.text,
                        padding: "10px 14px",
                        borderRadius: 6,
                        marginBottom: 16,
                        fontStyle: "italic",
                        border: "none",
                    }}>
                        {_(model.description)}
                    </div>
                )}
                <Tabs items={tabItems} size="small" activeKey={activeTab} onChange={setActiveTab} />
            </Modal>
            {nestedModel && (
                <MetadataModal
                    model={nestedModel}
                    allModels={allModels}
                    open
                    onClose={() => setNestedModel(null)}
                />
            )}
        </>
    );
};

