import React, { useState } from "react";
import { createPortal } from "react-dom";
import {
    Show,
    Edit,
    Create,
    List,
    Breadcrumb,
    ListButton,
    EditButton,
    DeleteButton,
    RefreshButton,
} from "@refinedev/antd";
import type { ShowProps, EditProps, CreateProps, ListProps } from "@refinedev/antd";
import { Tooltip, theme } from "antd";
import { ActionsButtonStack, VerticalActionsLayout } from "./DynamicResource/utils/verticalActionsBar";
import { useViewSettings } from "./DynamicResource/utils/viewConfig";
import { ResponsiveHeaderButtons } from "./DynamicResource/utils/buttons";
import { usePaneNavigation, PANE_TOOLBAR_HEIGHT } from "../contexts/PaneNavigationContext";

const wrappedPageTitleStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    margin: 0,
    whiteSpace: "normal",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    lineHeight: 1.2,
};

const wrapPageTitle = (title: ShowProps["title"]) => {
    if (title === null || title === undefined || title === false) return title;
    return <div style={wrappedPageTitleStyle}>{title}</div>;
};

const wrapTooltipButton = (label: string, node: React.ReactNode) => (
    <Tooltip title={label}>
        <span>{node}</span>
    </Tooltip>
);

const extractButtonLabel = (node: React.ReactNode): string | null => {
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
        return extractButtonLabel(node.props?.children);
    }
    return null;
};

const renderIconOnlyButtons = (nodes: React.ReactNode) => {
    const fallbackLabels: Record<string, string> = {
        EditButton: "Edit",
        DeleteButton: "Delete",
        RefreshButton: "Refresh",
        ListButton: "List",
        CreateButton: "Create",
        ShowButton: "Show",
        SaveButton: "Save",
    };

    const enhanceNode = (node: React.ReactNode, index?: number): React.ReactNode => {
        if (node === null || node === undefined || typeof node === "boolean") return node;
        if (Array.isArray(node)) return node.map((child, childIndex) => enhanceNode(child, childIndex));
        if (!React.isValidElement(node)) return node;

        const componentName = (node.type as any)?.displayName || (node.type as any)?.name;
        const fallbackLabel = componentName ? fallbackLabels[componentName] : null;

        if (fallbackLabel) {
            const label = extractButtonLabel(node.props?.children) || fallbackLabel;
            const element = React.cloneElement(node, {
                ...node.props,
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

        if (node.props?.icon) {
            const label = extractButtonLabel(node.props?.children);
            if (label) {
                const element = React.cloneElement(node, {
                    ...node.props,
                    children: null,
                });
                return (
                    <Tooltip key={node.key ?? index} title={label}>
                        <span>{element}</span>
                    </Tooltip>
                );
            }
        }

        if (node.props?.children) {
            const mappedChildren = React.Children.map(node.props.children, (child, childIndex) => enhanceNode(child, childIndex));
            return React.cloneElement(node, {
                ...node.props,
                children: mappedChildren,
            });
        }

        return node;
    };

    return React.Children.map(nodes, (child, index) => enhanceNode(child, index));
};

export const renderStandardShowHeaderButtons = ({
    listButtonProps,
    editButtonProps,
    deleteButtonProps,
    refreshButtonProps,
}: {
    listButtonProps?: React.ComponentProps<typeof ListButton>;
    editButtonProps?: React.ComponentProps<typeof EditButton>;
    deleteButtonProps?: React.ComponentProps<typeof DeleteButton>;
    refreshButtonProps?: React.ComponentProps<typeof RefreshButton>;
}) => (
    <>
        {listButtonProps && wrapTooltipButton("List", <ListButton {...listButtonProps} hideText />)}
        {editButtonProps && wrapTooltipButton("Edit", <EditButton {...editButtonProps} hideText />)}
        {deleteButtonProps && wrapTooltipButton("Delete", <DeleteButton {...deleteButtonProps} hideText />)}
        {refreshButtonProps && wrapTooltipButton("Refresh", <RefreshButton {...refreshButtonProps} hideText />)}
    </>
);

const STICKY_APP_HEADER_HEIGHT = 36;

const useActionsWrapping = (headerButtons: any) => {
    const { settings: viewSettings } = useViewSettings();
    const { token } = theme.useToken();
    const paneNav = usePaneNavigation();
    const isInMultiPane = Boolean(paneNav);
    const isDetailPane = Boolean(paneNav && paneNav.paneIndex > 0);
    const actionsPosition = viewSettings?.generalActionsButtonPosition || "top-right";
    const [verticalBarEl, setVerticalBarEl] = useState<HTMLDivElement | null>(null);
    const [topRightEl, setTopRightEl] = useState<HTMLDivElement | null>(null);

    const wrappedHeaderButtons = (ctx: any) => {
        const raw = typeof headerButtons === "function" ? headerButtons(ctx) : headerButtons;
        if (actionsPosition === "top-right") {
            const content = <ActionsButtonStack direction="row"><ResponsiveHeaderButtons>{raw}</ResponsiveHeaderButtons></ActionsButtonStack>;
            return topRightEl ? createPortal(content, topRightEl) : null;
        }
        const content = <ActionsButtonStack direction="column">{raw}</ActionsButtonStack>;
        return verticalBarEl ? createPortal(content, verticalBarEl) : null;
    };

    // Detail panes: stick below PaneToolbar (panel is scroll container).
    // List pane in multi-pane: stick at top of panel (app header is outside panel).
    // Standalone page: stick below app header (viewport is scroll container).
    const stickyTop = isDetailPane ? PANE_TOOLBAR_HEIGHT : (isInMultiPane ? 0 : STICKY_APP_HEADER_HEIGHT);

    const stickyBarNode = actionsPosition === "top-right" ? (
        <div
            style={{
                position: "sticky",
                top: stickyTop,
                zIndex: 10,
                background: token.colorBgContainer,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                width: "100%",
                paddingTop: 2,
                paddingBottom: 2,
                borderBottom: `1px solid ${token.colorBorderSecondary}`,
                marginBottom: 2,
            }}
        >
            <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                <Breadcrumb />
            </div>
            <div
                ref={setTopRightEl}
                style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}
            />
        </div>
    ) : null;

    const suppressDefaultBreadcrumb = actionsPosition === "top-right";

    return { actionsPosition, setVerticalBarEl, wrappedHeaderButtons, stickyBarNode, suppressDefaultBreadcrumb };
};

export const StandardShow: React.FC<ShowProps> = ({ headerButtons, ...props }) => {
    const effectiveHeaderButtons = headerButtons ?? renderStandardShowHeaderButtons;
    const { actionsPosition, setVerticalBarEl, wrappedHeaderButtons, stickyBarNode, suppressDefaultBreadcrumb } =
        useActionsWrapping(effectiveHeaderButtons);
    return (
        <VerticalActionsLayout position={actionsPosition} onBarMount={setVerticalBarEl}>
            {stickyBarNode}
            <Show
                {...props}
                title={wrapPageTitle(props.title)}
                breadcrumb={suppressDefaultBreadcrumb ? false : props.breadcrumb}
                headerButtons={wrappedHeaderButtons}
            />
        </VerticalActionsLayout>
    );
};

export const StandardEdit: React.FC<EditProps> = ({ headerButtons, ...props }) => {
    const effectiveHeaderButtons =
        headerButtons ?? (({ defaultButtons }: { defaultButtons: React.ReactNode }) => renderIconOnlyButtons(defaultButtons));
    const { actionsPosition, setVerticalBarEl, wrappedHeaderButtons, stickyBarNode, suppressDefaultBreadcrumb } =
        useActionsWrapping(effectiveHeaderButtons);
    return (
        <VerticalActionsLayout position={actionsPosition} onBarMount={setVerticalBarEl}>
            {stickyBarNode}
            <Edit
                {...props}
                breadcrumb={suppressDefaultBreadcrumb ? false : props.breadcrumb}
                headerButtons={wrappedHeaderButtons}
            />
        </VerticalActionsLayout>
    );
};

export const StandardList: React.FC<ListProps> = ({ headerButtons, ...props }) => {
    const effectiveHeaderButtons = headerButtons;
    const { actionsPosition, setVerticalBarEl, wrappedHeaderButtons, stickyBarNode, suppressDefaultBreadcrumb } =
        useActionsWrapping(effectiveHeaderButtons);
    return (
        <VerticalActionsLayout position={actionsPosition} onBarMount={setVerticalBarEl}>
            {stickyBarNode}
            <List
                {...props}
                breadcrumb={suppressDefaultBreadcrumb ? false : props.breadcrumb}
                headerButtons={effectiveHeaderButtons ? wrappedHeaderButtons : undefined}
            />
        </VerticalActionsLayout>
    );
};

export const StandardCreate: React.FC<CreateProps> = ({ headerButtons, ...props }) => {
    const effectiveHeaderButtons =
        headerButtons ?? (({ defaultButtons }: { defaultButtons: React.ReactNode }) => renderIconOnlyButtons(defaultButtons));
    const { actionsPosition, setVerticalBarEl, wrappedHeaderButtons, stickyBarNode, suppressDefaultBreadcrumb } =
        useActionsWrapping(effectiveHeaderButtons);
    return (
        <VerticalActionsLayout position={actionsPosition} onBarMount={setVerticalBarEl}>
            {stickyBarNode}
            <Create
                {...props}
                breadcrumb={suppressDefaultBreadcrumb ? false : props.breadcrumb}
                headerButtons={wrappedHeaderButtons}
            />
        </VerticalActionsLayout>
    );
};

export { renderIconOnlyButtons };
