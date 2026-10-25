import React from "react";
import {
    useLink,
    useNavigation,
    useRefineContext,
    useResource,
    useTranslate,
    useUserFriendlyName,
    matchResourceFromRoute,
    pickNotDeprecated,
} from "@refinedev/core";
import type { IResourceItem } from "@refinedev/core";
import { Breadcrumb } from "@refinedev/antd";
import { Breadcrumb as AntdBreadcrumb } from "antd";
import { HomeOutlined } from "@ant-design/icons";
import { usePaneResource } from "../contexts/PaneNavigationContext";

type PageAction = "list" | "show" | "edit" | "create";

interface PageBreadcrumbProps {
    /** The action of the page the breadcrumb heads. */
    action: PageAction;
    /** The page's own resource, when it names one. */
    resource?: string;
}

/**
 * The breadcrumb of a page given its resource and action, built the same way as
 * Refine's `<Breadcrumb />` (parents, resource, then the action), which instead
 * reads both from the URL.
 */
const ResourceBreadcrumb: React.FC<{ resourceName: string; action: PageAction }> = ({ resourceName, action }) => {
    const { resources, select } = useResource();
    const { listUrl } = useNavigation();
    const translate = useTranslate();
    const getFriendlyName = useUserFriendlyName();
    const { hasDashboard } = useRefineContext();
    const Link = useLink();

    const trail: { label: string; href?: string; icon?: React.ReactNode }[] = [];
    const addTrailItem = (resourceItem: IResourceItem) => {
        const parentName = pickNotDeprecated(resourceItem.meta?.parent, resourceItem.parentName);
        if (parentName) addTrailItem(select(parentName).resource);
        trail.push({
            label:
                pickNotDeprecated(resourceItem.meta?.label, resourceItem.options?.label) ??
                translate(`${resourceItem.name}.${resourceItem.name}`, getFriendlyName(resourceItem.name, "singular")),
            href: resourceItem.list ? listUrl(resourceItem) : undefined,
            icon: pickNotDeprecated(resourceItem.meta?.icon, resourceItem.options?.icon, resourceItem.icon),
        });
    };
    addTrailItem(select(resourceName).resource);
    if (action !== "list") {
        trail.push({ label: translate(`actions.${action}`, translate(`buttons.${action}`, getFriendlyName(action, "singular"))) });
    }

    // Same minimum as Refine's <Breadcrumb minItems={2}>.
    if (trail.length < 2) return null;

    const items = trail.map(({ label, href, icon }) => ({
        key: `breadcrumb-item-${label}`,
        title: (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                {icon}
                {href ? <Link to={href}>{label}</Link> : <span>{label}</span>}
            </div>
        ),
    }));
    const rootRouteResource = matchResourceFromRoute("/", resources);
    if (hasDashboard || rootRouteResource.found) {
        items.unshift({
            key: "breadcrumb-item-home",
            title: <Link to="/">{rootRouteResource?.resource?.meta?.icon ?? <HomeOutlined />}</Link>,
        });
    }
    return <AntdBreadcrumb items={items} />;
};

/**
 * The breadcrumb heading a page. Inside a detail pane of the multi-panel layout
 * it names the pane's record, not the main page the URL points to.
 */
export const PageBreadcrumb: React.FC<PageBreadcrumbProps> = ({ action, resource }) => {
    const paneResource = usePaneResource();
    const resourceName = resource ?? paneResource;
    return paneResource && resourceName ? <ResourceBreadcrumb resourceName={resourceName} action={action} /> : <Breadcrumb />;
};
