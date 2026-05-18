import React from "react";
import { useCustom, useGo } from "@refinedev/core";
import { Tree, Spin, Alert, Breadcrumb, Typography } from "antd";
import { DownOutlined } from "@ant-design/icons";

const { Title } = Typography;
const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

interface HierarchyNode {
    cw_eid: number;
    _label: string;
    parent_eid: number | null;
    level: number;
    key: number;
    title: string;
    children?: HierarchyNode[];
}

interface HierarchyViewProps {
    resource: string;
    recordId: number;
    fallback?: React.ReactNode;
}

export const HierarchyView: React.FC<HierarchyViewProps> = ({ resource, recordId, fallback }) => {
    const go = useGo();

    const { data: ancestorsData, isLoading: ancestorsLoading, error: ancestorsError } = useCustom<HierarchyNode[]>({
        url: `/${resource}/${recordId}/ancestors`,
        method: "get",
        queryOptions: { enabled: !!recordId },
    });

    const { data: descendantsData, isLoading: descendantsLoading, error: descendantsError } = useCustom<HierarchyNode[]>({
        url: `/${resource}/${recordId}/descendants`,
        method: "get",
        queryOptions: { enabled: !!recordId },
    });

    const buildTree = (nodes: HierarchyNode[]): HierarchyNode[] => {
        const nodeMap = new Map<number, HierarchyNode>();
        const roots: HierarchyNode[] = [];

        nodes.forEach(node => {
            const treeNode: HierarchyNode = {
                ...node,
                key: node.cw_eid,
                title: node._label,
                children: [],
            };
            nodeMap.set(node.cw_eid, treeNode);
        });

        nodes.forEach(node => {
            if (node.parent_eid && nodeMap.has(node.parent_eid)) {
                const parent = nodeMap.get(node.parent_eid);
                parent?.children?.push(nodeMap.get(node.cw_eid)!);
            } else {
                if (node.level === 0) {
                    roots.push(nodeMap.get(node.cw_eid)!);
                }
            }
        });

        return roots;
    };

    const rawDescendants = descendantsData?.data;
    const descendantsList = Array.isArray(rawDescendants) ? rawDescendants : [];
    const treeData = descendantsList.length > 0 ? buildTree(descendantsList) : [];
    const rawAncestors = ancestorsData?.data;
    const ancestorsList = Array.isArray(rawAncestors) ? rawAncestors : [];

    const handleSelect = (selectedKeys: React.Key[]) => {
        if (selectedKeys.length > 0) {
            const id = selectedKeys[0];
            go({ to: { resource, action: "show", id } });
        }
    };

    if (ancestorsLoading || descendantsLoading) {
        return <Spin />;
    }

    if (ancestorsError || descendantsError) {
        if (fallback) return <>{fallback}</>;
        return <Alert message={_("Error loading hierarchy data")} type="error" />;
    }

    return (
        <div>
            {ancestorsList.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                    <Title level={5}>{_("Parent Hierarchy")}</Title>
                    <Breadcrumb>
                        {ancestorsList.slice().reverse().map(node => (
                            <Breadcrumb.Item key={node.cw_eid}>
                                <a onClick={() => go({ to: { resource, action: "show", id: node.cw_eid } })}>
                                    {node._label}
                                </a>
                            </Breadcrumb.Item>
                        ))}
                    </Breadcrumb>
                </div>
            )}

            {treeData.length > 0 && (
                <div>
                    <Title level={5}>{_("Sub-hierarchy")}</Title>
                    <Tree
                        showLine
                        switcherIcon={<DownOutlined />}
                        defaultExpandAll
                        onSelect={handleSelect}
                        treeData={treeData}
                    />
                </div>
            )}
        </div>
    );
};
