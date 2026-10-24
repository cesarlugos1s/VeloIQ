/**
 * VeloIQPortalApp — the shell of an external portal (a site for candidates,
 * employers, shoppers... rather than administrators).
 *
 * A portal is a small Refine app built from the same standard pieces as the
 * admin app, limited to its own site:
 *
 * - its own models (the page schemas ``veloiq generate`` writes for the
 *   portal's roles) and its own menu (``navigation.<site>.config.json``), which
 *   is exactly what the menus, the Command Center and Global Search list;
 * - the standard list / show / create / edit pages (DynamicList...), with the
 *   site's feature profile (``[portals.<site>.features]``) applied by the
 *   server and by the pages;
 * - the standard layout: vertical or horizontal menu (both can be minimized),
 *   light and dark color modes, Help, banners (``show_on.sites``);
 * - its own sign-in session (the site's ``token_storage_key``), separate from
 *   the admin app's even when both are served from the same origin;
 * - the site's own pages (swipe deck, chat, signup...) as lazily loaded routes,
 *   inside the layout or, for pages used before signing in, outside it.
 *
 * The site's title, token storage key, default layout and Dashboard entry come
 * from ``GET /api/veloiq/portals/{site}`` (``[portals.<site>]`` in veloiq.toml),
 * so they are read before the session is touched.
 */
import React, { Suspense, createElement, useMemo, useState } from "react";
import { Refine, Authenticated } from "@refinedev/core";
import type { DataProvider } from "@refinedev/core";
import { notificationProvider } from "@refinedev/antd";
import routerProvider from "@refinedev/react-router-v6";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Result, Spin } from "antd";

import { authProvider } from "../providers/authProvider";
import { accessControlProvider } from "../providers/accessControlProvider";
import { LayoutWrapper } from "../components/LayoutWrapper";
import { MultiPaneLayout } from "../components/MultiPane";
import {
    DynamicCreate, DynamicEdit, DynamicList, DynamicShow, PrimaryShowContext,
} from "../components/DynamicResource";
import type { ModelDef, PrimaryShowRendererProps } from "../components/DynamicResource";
import { AllModelsProvider } from "../contexts/AllModelsContext";
import { ColorModeContextProvider } from "../contexts/color-mode";
import { LoginPage } from "../pages/auth/LoginPage";
import { DashboardPage } from "../pages/dashboard/DashboardPage";
import { generateResources } from "../utils/generateResources";
import { resolveFallbackLandingPath } from "../utils/navConfig";
import type { NavConfig } from "../utils/navConfig";
import { setSignInStorageNamespace } from "../utils/signInStorageKeys";
import { setPortalRequestContext } from "../utils/portalRequestContext";
import { useRefineResourcesIncludingNavigationPages } from "../hooks/useRefineResourcesIncludingNavigationPages";
import { useRefineResourcesIncludingNonModelData } from "../hooks/useRefineResourcesIncludingNonModelData";
import { NonModelDataResourcePages } from "../components/DynamicResource/pages/NonModelDataResourcePages";
import type { ShowHeaderButtonsForResource } from "../components/DynamicResource/pages/NonModelDataResourcePages";
import { usePortalPublicSettings } from "./usePortalPublicSettings";
import { limitPortalResourcesToNavigationConfig } from "./limitPortalResourcesToNavigationConfig";
import type { PortalPublicSettings, PortalRuntimeConfiguration } from "./usePortalPublicSettings";
import { mergeUiModelSchemas } from "../models/mergeUiModelSchemas";

// i18n helper — resolved at CALL time so window._ is always current.
const _ = (text: string): string => {
    const t = (window as any)._;
    return typeof t === "function" ? (t(text) as string) : text;
};

/** A module of the portal: its name (menu group) and the models it shows. */
export interface PortalModuleRegistration {
    moduleName: string;
    models: ModelDef[];
    /** Menu label of the module (default: the humanized module name). */
    moduleLabel?: string;
}

/** A page of the site's own (not a standard model page), loaded when first opened. */
export interface PortalPageRoute {
    /** Route path inside the portal, e.g. "/deck" or "/chat/:matchId". */
    path: string;
    /** Load the page's module, e.g. ``() => import("./pages/SwipeDeck")``. */
    loadPage: () => Promise<{ default: React.ComponentType<any> }>;
    /** Open without signing in and outside the layout (e.g. a signup page). Default false. */
    availableSignedOut?: boolean;
    /**
     * Lay the page out as the main page of the multi-panel layout, like the
     * standard lists: records it opens with ``usePaneNavigation().openDetail``
     * open in panels beside it (as the ``[views]`` panes settings say). Default false.
     */
    multiPane?: boolean;
    /** The page's name where the multi-panel layout shows it (spines, trails); translated when shown. */
    label?: string;
}

/** The site's replacements for standard pages, by resource (same shape as the admin app's page overrides). */
export interface PortalPageOverrides {
    list?: Record<string, React.ComponentType<any>>;
    show?: Record<string, React.ComponentType<any>>;
    create?: Record<string, React.ComponentType<any>>;
    edit?: Record<string, React.ComponentType<any>>;
}

export interface VeloIQPortalAppProps {
    /** The portal's site key, as declared in ``[portals.<site>]``. */
    site: string;
    /** The portal's modules and their models (from the site's generated page schemas). */
    moduleRegistrations: PortalModuleRegistration[];
    /** The portal's menu (``navigation.<site>.config.json``). */
    navConfig: NavConfig;
    /** Refine data provider, e.g. ``dataProvider(API_URL, httpClient)`` from ``@refinedev/simple-rest``. */
    dataProvider: DataProvider;
    /** The site's own pages. */
    pageRoutes?: PortalPageRoute[];
    /** The site's replacements for standard pages. */
    pageOverrides?: PortalPageOverrides;
    /** Logo element or image URL in the header, the sider and the sign-in page. */
    logo?: React.ReactNode | string;
    /** Replaces the standard sign-in page (e.g. a sign-in with a second factor). */
    loginPage?: React.ReactNode;
    /** Shown under the standard sign-in page's button (e.g. a link to the signup page). */
    loginPageFooter?: React.ReactNode;
    /** Route opened at "/" (default: the first model page of the menu, or the Dashboard when the site shows it). */
    landingPath?: string;
    /** Router base path (default ``/portals/<site>``, where ``veloiq run`` serves the portal). */
    routerBasename?: string;
    /** Header icon buttons shown next to Global Search on every page. */
    globalHeaderComponents?: React.ComponentType<{}>[];
    /** The site's buttons in the header of standard record pages (e.g. "Add to cart" on a product), per resource. */
    showHeaderButtons?: ShowHeaderButtonsForResource;
}

const portalQueryClient = new QueryClient();

/** A site page loaded on first use, with a spinner meanwhile. */
const LazyPortalPage: React.FC<{ pageRoute: PortalPageRoute }> = ({ pageRoute }) => {
    const LoadedPage = useMemo(() => React.lazy(pageRoute.loadPage), [pageRoute]);
    return (
        <Suspense fallback={<Spin style={{ display: "block", margin: "120px auto" }} />}>
            <LoadedPage />
        </Suspense>
    );
};

/** The portal once its public settings are known (the session namespace is set by then). */
const PortalAppWithSettings: React.FC<VeloIQPortalAppProps & {
    portalSettings: PortalPublicSettings;
    portalConfiguration: PortalRuntimeConfiguration | null;
}> = ({
    site, moduleRegistrations: builtModuleRegistrations, navConfig: builtNavConfig, dataProvider,
    pageRoutes = [], pageOverrides = {}, logo, loginPage, loginPageFooter, landingPath, routerBasename,
    globalHeaderComponents, showHeaderButtons, portalSettings, portalConfiguration,
}) => {
    // The menu and page overrides kept on the Portals pages win over what the portal was built with.
    const navConfig = portalConfiguration?.navigation ?? builtNavConfig;
    const moduleRegistrations = useMemo(() => {
        const pageOverridesFile = portalConfiguration?.page_overrides ?? [];
        if (!pageOverridesFile.length) return builtModuleRegistrations;
        return builtModuleRegistrations.map((registration) => {
            const modelNames = new Set(registration.models.map((model) => model.name));
            const moduleOverrides = pageOverridesFile.filter((override) => modelNames.has(override.name));
            return moduleOverrides.length
                ? { ...registration, models: mergeUiModelSchemas(registration.models, moduleOverrides) }
                : registration;
        });
    }, [builtModuleRegistrations, portalConfiguration]);
    const portalModels = useMemo(
        () => moduleRegistrations.flatMap((registration) => registration.models),
        [moduleRegistrations],
    );
    const modelResources = useMemo(() => [
        ...(portalSettings.show_dashboard_menu_entry
            ? [{ name: "dashboard", list: "/dashboard", meta: { label: _("Dashboard"), canDelete: false } }]
            : []),
        ...moduleRegistrations.flatMap(({ moduleName, models, moduleLabel }) =>
            generateResources(models, moduleName, moduleLabel ? { moduleLabel } : {})),
    ], [moduleRegistrations, portalSettings.show_dashboard_menu_entry]);
    // The menu's "page" entries (the site's own pages) are listed like model pages.
    // Non-model data resources the portal's users can read get Refine resources too (as in the admin app).
    const modelAndNonModelDataResources = useRefineResourcesIncludingNonModelData(modelResources);
    const portalMenuResources = useMemo(
        () => limitPortalResourcesToNavigationConfig(modelAndNonModelDataResources, navConfig),
        [modelAndNonModelDataResources, navConfig],
    );
    const portalResources = useRefineResourcesIncludingNavigationPages(portalMenuResources, navConfig);

    const resolvedLandingPath = landingPath
        || (portalSettings.show_dashboard_menu_entry ? "/dashboard" : resolveFallbackLandingPath(navConfig, portalModels));

    const renderPage = (
        kind: keyof PortalPageOverrides, resource: string, model: ModelDef,
        StandardPage: React.ComponentType<any>,
    ) => {
        const OverridePage = pageOverrides[kind]?.[resource];
        if (OverridePage) return <OverridePage model={model} allModels={portalModels} />;
        if (kind === "show") {
            return <StandardPage key={resource} model={model} allModels={portalModels}
                extraHeaderButtons={showHeaderButtons?.(resource, model, portalModels)} />;
        }
        return <StandardPage key={resource} model={model} allModels={portalModels} />;
    };

    // Rows opened in a side pane use the site's Show override like the full page does.
    const PrimaryShowRenderer = useMemo(() => ({ model, id, allModels }: PrimaryShowRendererProps) => {
        const resource = (model as any).resource || model.name;
        const OverrideShow = pageOverrides.show?.[resource];
        return OverrideShow
            ? createElement(OverrideShow, { idOverride: String(id), model, allModels })
            : <DynamicShow model={model} allModels={allModels} idOverride={String(id)}
                extraHeaderButtons={showHeaderButtons?.(resource, model, allModels)} />;
    }, [pageOverrides, showHeaderButtons]);

    const signedOutPageRoutes = pageRoutes.filter((pageRoute) => pageRoute.availableSignedOut);
    const signedInPageRoutes = pageRoutes.filter((pageRoute) => !pageRoute.availableSignedOut);

    return (
        <QueryClientProvider client={portalQueryClient}>
            <AllModelsProvider models={portalModels}>
                <BrowserRouter basename={routerBasename ?? `/portals/${site}`}>
                    <Refine
                        dataProvider={dataProvider}
                        authProvider={authProvider}
                        accessControlProvider={accessControlProvider}
                        routerProvider={routerProvider}
                        notificationProvider={notificationProvider}
                        resources={portalResources}
                        options={{ syncWithLocation: true, warnWhenUnsavedChanges: true, disableTelemetry: true }}
                    >
                        <ColorModeContextProvider>
                            <PrimaryShowContext.Provider value={PrimaryShowRenderer}>
                                <Routes>
                                    <Route path="/login" element={loginPage ?? (
                                        <LoginPage appTitle={portalSettings.title} logo={logo} footer={loginPageFooter} />
                                    )} />
                                    {signedOutPageRoutes.map((pageRoute) => (
                                        <Route key={pageRoute.path} path={pageRoute.path} element={<LazyPortalPage pageRoute={pageRoute} />} />
                                    ))}
                                    <Route element={
                                        <Authenticated key="portal-auth" redirectOnFail="/login">
                                            <LayoutWrapper
                                                logo={logo}
                                                appTitle={portalSettings.title}
                                                navConfig={navConfig}
                                                showDashboardMenuEntry={portalSettings.show_dashboard_menu_entry}
                                                defaultLayoutMode={portalSettings.default_layout}
                                                bannerModels={portalModels}
                                                bannerSite={site}
                                                globalHeaderComponents={globalHeaderComponents}
                                                signInPath={portalSettings.allows_signed_out_visitors ? "/login" : undefined}
                                            >
                                                <Outlet />
                                            </LayoutWrapper>
                                        </Authenticated>
                                    }>
                                        <Route path="/" element={<Navigate to={resolvedLandingPath} replace />} />
                                        {portalSettings.show_dashboard_menu_entry && (
                                            <Route path="/dashboard" element={<DashboardPage />} />
                                        )}
                                        {signedInPageRoutes.map((pageRoute) => (
                                            <Route key={pageRoute.path} path={pageRoute.path} element={pageRoute.multiPane ? (
                                                <MultiPaneLayout mainLabel={pageRoute.label ? _(pageRoute.label) : undefined}>
                                                    <LazyPortalPage pageRoute={pageRoute} />
                                                </MultiPaneLayout>
                                            ) : <LazyPortalPage pageRoute={pageRoute} />} />
                                        ))}
                                        {portalModels.map((model) => {
                                            const resource = model.resource || model.name;
                                            return (
                                                <Route key={model.name} path={`/${resource}`}>
                                                    <Route index element={
                                                        <MultiPaneLayout>{renderPage("list", resource, model, DynamicList)}</MultiPaneLayout>
                                                    } />
                                                    <Route path="create" element={renderPage("create", resource, model, DynamicCreate)} />
                                                    <Route path="edit/:id" element={renderPage("edit", resource, model, DynamicEdit)} />
                                                    <Route path="show/:id" element={
                                                        <MultiPaneLayout>{renderPage("show", resource, model, DynamicShow)}</MultiPaneLayout>
                                                    } />
                                                </Route>
                                            );
                                        })}
                                        {/* List/create/show/edit of the non-model data resources the portal's users can read. */}
                                        <Route path="/:nonModelDataResource/*" element={<NonModelDataResourcePages pageOverrides={pageOverrides} showHeaderButtons={showHeaderButtons} />} />
                                        <Route path="*" element={<Navigate to={resolvedLandingPath} replace />} />
                                    </Route>
                                </Routes>
                            </PrimaryShowContext.Provider>
                        </ColorModeContextProvider>
                    </Refine>
                </BrowserRouter>
            </AllModelsProvider>
        </QueryClientProvider>
    );
};

/**
 * Render the external portal *site*: reads its public settings, keeps its
 * sign-in session under the site's own storage key, then renders the site.
 */
export const VeloIQPortalApp: React.FC<VeloIQPortalAppProps> = (props) => {
    const { settings, configuration, loaded, error } = usePortalPublicSettings(props.site);
    // The session namespace must be set before anything reads the session, i.e. before the first render of the site.
    const [sessionNamespaceSetFor, setSessionNamespaceSetFor] = useState<string | null>(null);
    if (settings && sessionNamespaceSetFor !== settings.token_storage_key) {
        setSignInStorageNamespace(settings.token_storage_key);
        setPortalRequestContext(settings.site, Boolean(settings.allows_signed_out_visitors));
        setSessionNamespaceSetFor(settings.token_storage_key);
    }

    if (error) {
        return <Result status="warning" title={_("This site is not available")} subTitle={error} />;
    }
    if (!loaded || !settings || sessionNamespaceSetFor !== settings.token_storage_key) {
        return <Spin size="large" style={{ display: "block", margin: "120px auto" }} />;
    }
    return <PortalAppWithSettings {...props} portalSettings={settings} portalConfiguration={configuration} />;
};

export default VeloIQPortalApp;
