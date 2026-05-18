import React, { useEffect, useState } from "react";
import { Card, Spin, Tree } from "antd";
import { DownOutlined } from "@ant-design/icons";
import { useApiUrl, useGo } from "@refinedev/core";
import { authenticatedFetch } from "../../../utils/authenticatedFetch";
import { getModelTone } from "../../../utils/modelTone";
import type { ModelDef, RelationDef } from "../types";
import { findModelByName, getPolymorphicReferenceInfo, resolveResourcePath } from "../utils/model";
import { filterIdsByPolymorphicType, fetchPolymorphicGroups } from "../utils/polymorphic";
import { RelatedObjectPreview } from "./RelatedObjectPreview";
import { usePaneNavigation } from "../../../contexts/PaneNavigationContext";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export const RelationsExplorer: React.FC<{ model: ModelDef; record: any; allModels: ModelDef[]; isActive?: boolean }> = ({ model, record, allModels, isActive = true }) => {
    const apiUrl = useApiUrl();
    const go = useGo();
    const paneNav = usePaneNavigation();
    const [reverseTreeData, setReverseTreeData] = useState<any[]>([]);
    const [forwardTreeData, setForwardTreeData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const isReverse = (rel: RelationDef) => {
        if (rel.relationName && rel.relationName.endsWith("_reverse")) return true;
        return !rel.otherResource;
    };

    useEffect(() => {
        if (!isActive) {
            setLoading(false);
            return;
        }
        const fetchRelations = async () => {
            if (!model.relations || !record) {
                setLoading(false);
                return;
            }
            setLoading(true);
            // Resolve current record's PK value using pkField, falling back to eid/id.
            const recordPkField = model.pkField || 'eid';
            const currentRecordId = record[recordPkField] ?? record.eid ?? record.id;
            const promises = model.relations.map(async (rel) => {
                const relationModel = findModelByName(allModels, rel.resource);
                if (!relationModel) return null;
                const relatedModel = rel.otherResource ? findModelByName(allModels, rel.otherResource) : undefined;
                const relationTone = getModelTone(relatedModel || relationModel || rel.resource);
                const relationLabelNode = (
                    <span
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "2px 8px",
                            borderRadius: 6,
                            background: "transparent",
                            color: relationTone.text,
                            fontWeight: 600,
                            lineHeight: 1.2,
                        }}
                    >
                        {rel.label}
                    </span>
                );
                const polyInfo = getPolymorphicReferenceInfo(rel, relationModel, allModels);
                const filter = { field: rel.targetKey, operator: "eq", value: currentRecordId };
                const relationResource = rel.resourcePath || resolveResourcePath(rel.resource, allModels);
                const query = `${relationResource}?${filter.field}=${filter.value}`;
                try {
                    let children: any[] = [];
                    if (polyInfo && rel.otherKey) {
                        const { groups, labelsById } = await fetchPolymorphicGroups({
                            apiUrl,
                            rel,
                            recordId: currentRecordId,
                            referenceResource: polyInfo.referenceResource,
                            allModels,
                        });
                        children = Array.from(groups.entries()).map(([resourceName, idSet]) => {
                            const targetModel = findModelByName(allModels, resourceName);
                            const groupChildren = Array.from(idSet).map((id) => {
                                const fallbackLabel = labelsById?.get(id) ?? id;
                                const title = <RelatedObjectPreview resource={resourceName} id={id as number} model={targetModel} allModels={allModels} fallbackLabel={fallbackLabel} />;
                                return { title, key: `${resourceName}-${id}`, resource: resourceName, id, isLeaf: true };
                            });
                            return {
                                title: (
                                    <span
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 6,
                                        }}
                                    >
                                        {relationLabelNode}
                                        <span style={{ fontSize: 12, color: "#64748b" }}>{targetModel?.label || resourceName}</span>
                                    </span>
                                ),
                                key: `${rel.relationName || rel.resource}-${resourceName}`,
                                selectable: false,
                                children: groupChildren,
                            };
                        });
                    } else {
                        const response = await authenticatedFetch(`${apiUrl}/${query}`);
                        let data = await response.json();
                        if (!Array.isArray(data)) {
                            return {
                                rel,
                                node: {
                                    title: (
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                            {relationLabelNode}
                                            <span style={{ color: "#b91c1c", fontSize: 12 }}>{_("Error")}</span>
                                        </span>
                                    ),
                                    key: rel.relationName || rel.resource,
                                    selectable: false,
                                    children: [],
                                },
                            };
                        }
                        if (rel.polymorphicType && rel.otherKey && data.length > 0) {
                            const otherIds = data
                                .map((item: any) => item[rel.otherKey as string])
                                .filter((v: any) => v !== undefined && v !== null);
                            if (otherIds.length > 0) {
                                const polyMatchingIds = await filterIdsByPolymorphicType(
                                    apiUrl, Array.from(new Set(otherIds)), rel.polymorphicType,
                                );
                                data = data.filter((item: any) => polyMatchingIds.has(item[rel.otherKey as string]));
                            }
                        }
                        const relPkField = relationModel?.pkField || 'eid';
                        children = data.map((item: any) => {
                            let targetId = item[relPkField] ?? item.eid ?? item.id;
                            let targetResource = resolveResourcePath(rel.resource, allModels);
                            let title: React.ReactNode = item._label || item.name || targetId;
                            if (rel.otherResource && rel.otherKey && item[rel.otherKey]) {
                                targetResource = resolveResourcePath(rel.otherResource, allModels);
                                targetId = item[rel.otherKey];
                            }
                            const targetModel = findModelByName(allModels, targetResource);
                            title = <RelatedObjectPreview resource={targetResource} id={targetId} model={targetModel} allModels={allModels} fallbackLabel={title} />;
                            return { title, key: `${targetResource}-${targetId}`, resource: targetResource, id: targetId, isLeaf: true };
                        });
                    }
                    return { rel, node: { title: relationLabelNode, key: rel.relationName || rel.resource, selectable: false, children } };
                } catch (error) {
                    console.error(`Failed to fetch relation: ${rel.label}`, error);
                    return {
                        rel,
                        node: {
                            title: (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                    {relationLabelNode}
                                    <span style={{ color: "#b91c1c", fontSize: 12 }}>{_("Error")}</span>
                                </span>
                            ),
                            key: rel.relationName || rel.resource,
                            selectable: false,
                            children: [],
                        },
                    };
                }
            });
            const results = await Promise.all(promises);
            const reverseNodes: any[] = [];
            const forwardNodes: any[] = [];
            results.filter(Boolean).forEach((entry: any) => {
                if (isReverse(entry.rel)) reverseNodes.push(entry.node);
                else forwardNodes.push(entry.node);
            });
            setReverseTreeData(reverseNodes);
            setForwardTreeData(forwardNodes);
            setLoading(false);
        };
        fetchRelations();
    }, [model, record, allModels, apiUrl, isActive]);

    const onSelect = (_selectedKeys: React.Key[], info: any) => {
        const { resource, id } = info.node;
        if (resource && id) {
            if (paneNav?.isInMultiPane) {
                paneNav.openDetail(resource, id);
            } else {
                go({ to: { resource, action: "show", id } });
            }
        }
    };

    if (loading) return <Spin />;
    return (
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, marginBottom: 8, color: "#1677ff" }}>{_("Forward Relations")}</div>
                {forwardTreeData.length > 0 ? (
                    <Card size="small" variant="outlined" style={{ border: "1px solid #1677ff" }}>
                        <Tree showLine switcherIcon={<DownOutlined />} defaultExpandAll onSelect={onSelect} treeData={forwardTreeData} />
                    </Card>
                ) : (
                    <div style={{ color: "#888", fontSize: 13, padding: "8px 0" }}>{_("None")}</div>
                )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, marginBottom: 8, color: "#1677ff" }}>{_("Reverse Relations")}</div>
                {reverseTreeData.length > 0 ? (
                    <Card size="small" variant="outlined" style={{ border: "1px solid #1677ff" }}>
                        <Tree showLine switcherIcon={<DownOutlined />} defaultExpandAll onSelect={onSelect} treeData={reverseTreeData} />
                    </Card>
                ) : (
                    <div style={{ color: "#888", fontSize: 13, padding: "8px 0" }}>{_("None")}</div>
                )}
            </div>
        </div>
    );
};
