import React from "react";
import { Button, Dropdown, Grid, Tooltip, theme } from "antd";
import { MenuOutlined } from "@ant-design/icons";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export const extractButtonLabel = (node: React.ReactNode): string | null => {
    if (node === null || node === undefined || typeof node === "boolean") return null;
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) {
        for (const child of node) {
            const label = extractButtonLabel(child);
            if (label) return label;
        }
        return null;
    }
    if (React.isValidElement(node)) {
        return extractButtonLabel((node as any).props?.children);
    }
    return null;
};

export const renderIconOnlyButtons = (nodes: React.ReactNode) => {
    const fallbackLabels: Record<string, string> = {
        EditButton: _("Edit"),
        DeleteButton: _("Delete"),
        ListButton: _("List"),
        CreateButton: _("Create"),
        ShowButton: _("Show"),
        SaveButton: _("Save"),
    };

    const enhanceNode = (node: React.ReactNode, index?: number): React.ReactNode => {
        if (node === null || node === undefined || typeof node === "boolean") return node;
        if (Array.isArray(node)) return node.map((child, childIndex) => enhanceNode(child, childIndex));
        if (!React.isValidElement(node)) return node;

        const componentName = (node.type as any)?.displayName || (node.type as any)?.name;
        if (componentName === "RefreshButton") return null;
        const fallbackLabel = componentName ? fallbackLabels[componentName] : null;

        const nodeProps: any = (node as any).props;

        if (fallbackLabel) {
            const label = extractButtonLabel(nodeProps?.children) || fallbackLabel;
            const element = React.cloneElement(node, {
                ...nodeProps,
                hideText: true,
                children: null,
            });
            if (!label) return element;
            return (
                <Tooltip key={node.key ?? index} title={label}>
                    <span>{element}</span>
                </Tooltip>
            );
        }

        if (nodeProps?.icon) {
            const label = extractButtonLabel(nodeProps?.children);
            if (label) {
                const element = React.cloneElement(node, {
                    ...nodeProps,
                    children: null,
                });
                return (
                    <Tooltip key={node.key ?? index} title={label}>
                        <span>{element}</span>
                    </Tooltip>
                );
            }
        }

        if (nodeProps?.children) {
            const mappedChildren = React.Children.map(nodeProps.children, (child, childIndex) => enhanceNode(child, childIndex));
            return React.cloneElement(node, {
                ...nodeProps,
                children: mappedChildren,
            });
        }

        return node;
    };

    return React.Children.map(nodes, (child, index) => enhanceNode(child, index));
};

export const ResponsiveHeaderButtons: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const screens = Grid.useBreakpoint();
    const { token } = theme.useToken();

    // screens.md is undefined before breakpoints resolve — treat as wide to avoid flash
    if (screens.md !== false) {
        return <>{children}</>;
    }

    return (
        <Dropdown
            trigger={["click"]}
            dropdownRender={() => (
                <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "stretch",
                    gap: 4,
                    padding: 8,
                    background: token.colorBgElevated,
                    borderRadius: token.borderRadiusLG,
                    boxShadow: token.boxShadowSecondary,
                }}>
                    {children}
                </div>
            )}
        >
            <Button size="small" icon={<MenuOutlined />} />
        </Dropdown>
    );
};
