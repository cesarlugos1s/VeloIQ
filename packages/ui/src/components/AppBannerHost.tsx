import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { BannerHost } from "../banner/BannerHost";
import type { BannerHostProps } from "../banner/BannerHost";
import type { BannerPageContext } from "../banner/types";
import type { ModelDef } from "./DynamicResource/types";
import { API_URL } from "../providers/constants";
import { authenticatedFetch } from "../utils/authenticatedFetch";

export interface AppBannerHostProps extends Partial<Omit<BannerHostProps, "context">> {
    /** The app's models, to tell which model (and module) the current page belongs to. */
    allModels?: ReadonlyArray<ModelDef>;
}

/**
 * Page context of a host app route: ``/<resource>``, ``/<resource>/show/<id>``...
 * belong to that resource's model or named query; other routes (dashboard,
 * custom pages) only show the banners configured for all pages.
 */
export const pageContextFromPath = (pathname: string, allModels: ReadonlyArray<ModelDef> = []): BannerPageContext => {
    const segment = decodeURIComponent(pathname.split("/").filter(Boolean)[0] || "");
    if (!segment) return {};
    const model = allModels.find((m) => (m.resource || m.name) === segment || m.name === segment);
    if (!model) return { resource: segment };
    return { resource: model.resource || model.name, module: model.module };
};

/**
 * AppBannerHost — the host app's ``BannerHost``: reads the current route to
 * pick the page's banners (fetched again on every navigation, so counts stay
 * current), authenticates with the signed-in user's token, and opens a row's
 * Show page or the list from the banner. Rendered once by the host App.tsx.
 */
export const AppBannerHost: React.FC<AppBannerHostProps> = ({ allModels, ...props }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const context = useMemo(() => pageContextFromPath(location.pathname, allModels), [location.pathname, allModels]);

    if (location.pathname.startsWith("/login")) return null;

    return (
        <BannerHost
            context={context}
            apiUrl={API_URL}
            fetcher={authenticatedFetch}
            refreshKey={location.pathname}
            onOpenRow={(resource, eid) => navigate(`/${resource}/show/${eid}`)}
            onViewAll={(resource) => navigate(`/${resource}`)}
            {...props}
        />
    );
};

export default AppBannerHost;
