import { createElement } from "react";
import { Refine, Authenticated } from "@refinedev/core";
import { notificationProvider } from "@refinedev/antd";
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import routerProvider from "@refinedev/react-router-v6";
import dataProvider from "@refinedev/simple-rest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@refinedev/antd/dist/reset.css";

import {
    authProvider,
    accessControlProvider,
    httpClient,
    LayoutWrapper,
    LoginPage,
    AllModelsProvider,
    DynamicList,
    DynamicShow,
    DynamicCreate,
    DynamicEdit,
    generateResources,
    API_URL,
    MultiPaneLayout,
    PrimaryShowContext,
    ColorModeContextProvider,
    authSystemModels,
    DashboardPage,
} from "@juicemantics/veloiq-ui";
import type { PrimaryShowRendererProps } from "@juicemantics/veloiq-ui";
import { allModuleRegistrations, allSystemModels } from "./allModels.gen";
import type { NavConfig } from "@juicemantics/veloiq-ui";
import navConfigData from "./navigation.config.json";
import { extensionRoutes, extensionUserMenuItems, extensionShowComponents, exceptionAlertBannerComponent, exceptionAlertListWrapperComponent, exceptionAlertAwareResources } from "./extensions.gen";
import { customListComponents, customShowComponents, customEditComponents, customCreateComponents } from "./custom_pages";

// Render helpers — check for app-level custom page overrides first, then
// extension alert-aware wrapper, then fall back to the Dynamic component.
const _renderList   = (resource: string, model: any, allModels: any[]) => {
    const C = customListComponents[resource];
    if (C) return <C model={model} allModels={allModels} />;
    if (exceptionAlertAwareResources && exceptionAlertAwareResources.has(resource) && exceptionAlertListWrapperComponent) {
        return createElement(exceptionAlertListWrapperComponent, { resource, model, allModels });
    }
    return <DynamicList key={resource} model={model} allModels={allModels} />;
};
const _renderShow   = (resource: string, model: any, allModels: any[]) => { const C = customShowComponents[resource];   return C ? <C /> : <DynamicShow model={model} allModels={allModels} />; };
const _renderCreate = (resource: string, model: any, allModels: any[]) => { const C = customCreateComponents[resource]; return C ? <C model={model} allModels={allModels} /> : <DynamicCreate model={model} allModels={allModels} />; };
const _renderEdit   = (resource: string, model: any, allModels: any[]) => { const C = customEditComponents[resource];   return C ? <C model={model} allModels={allModels} /> : <DynamicEdit model={model} allModels={allModels} />; };

// Stable reference prevents PrimaryShowContext churn on re-renders.
const PrimaryShowRenderer = ({ model, id, allModels }: PrimaryShowRendererProps) => {
    const resource = (model as any).resource || model.name;
    const AppOverride = customShowComponents[resource];
    if (AppOverride) return <AppOverride />;
    const ExtOverride = extensionShowComponents[resource];
    return ExtOverride
        ? createElement(ExtOverride, { idOverride: String(id) })
        : <DynamicShow model={model} allModels={allModels} idOverride={String(id)} />;
};

const queryClient = new QueryClient();

// Stable references — these are derived from static imports so they never
// need to change at runtime. Defined outside the component to guarantee they
// are created exactly once and share a single identity across all renders.
const allModels = [...allSystemModels, ...authSystemModels];
const resources = [
    { name: "dashboard", list: "/dashboard", meta: { label: "Dashboard", canDelete: false } },
    ...allModuleRegistrations.flatMap(({ moduleName, models }) =>
        generateResources(models, moduleName)
    ),
    ...generateResources(authSystemModels, "access_control", { moduleLabel: "Access Control" }),
];

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <AllModelsProvider models={allModels}>
                <BrowserRouter>
                    <Refine
                        dataProvider={dataProvider(API_URL, httpClient)}
                        authProvider={authProvider}
                        accessControlProvider={accessControlProvider}
                        routerProvider={routerProvider}
                        notificationProvider={notificationProvider}
                        resources={resources}
                        options={{ syncWithLocation: true, warnWhenUnsavedChanges: true }}
                    >
                        <ColorModeContextProvider>
                            <PrimaryShowContext.Provider value={PrimaryShowRenderer}>
                                <Routes>
                                    <Route path="/" element={<Navigate to={`/${allSystemModels[0]?.resource || allSystemModels[0]?.name || "dashboard"}`} replace />} />
                                    <Route path="/login" element={<LoginPage />} />
                                    <Route
                                        element={
                                            <Authenticated key="auth" redirectOnFail="/login">
                                                <LayoutWrapper navConfig={navConfigData as NavConfig} extraUserMenuItems={extensionUserMenuItems}>
                                                    <Outlet />
                                                </LayoutWrapper>
                                                {exceptionAlertBannerComponent && createElement(exceptionAlertBannerComponent)}
                                            </Authenticated>
                                        }
                                    >
                                        <Route path="/dashboard" element={<DashboardPage />} />
                                        {extensionRoutes.map((r) => (
                                            <Route key={r.path} path={r.path} element={r.element} />
                                        ))}
                                        {allSystemModels.map((model) => {
                                            const resource = (model as any).resource || model.name;
                                            return (
                                                <Route key={model.name} path={`/${resource}`}>
                                                    <Route index element={
                                                        <MultiPaneLayout>
                                                            {_renderList(resource, model, allModels)}
                                                        </MultiPaneLayout>
                                                    } />
                                                    <Route path="create" element={_renderCreate(resource, model, allModels)} />
                                                    <Route path="edit/:id" element={_renderEdit(resource, model, allModels)} />
                                                    <Route path="show/:id" element={
                                                        <MultiPaneLayout>
                                                            {_renderShow(resource, model, allModels)}
                                                        </MultiPaneLayout>
                                                    } />
                                                </Route>
                                            );
                                        })}
                                        {authSystemModels.map((model) => (
                                            <Route key={model.name} path={`/${model.resource || model.name}`}>
                                                <Route index element={
                                                    <MultiPaneLayout>
                                                        <DynamicList key={model.resource || model.name} model={model} allModels={allModels} />
                                                    </MultiPaneLayout>
                                                } />
                                                <Route path="create" element={<DynamicCreate model={model} allModels={allModels} />} />
                                                <Route path="edit/:id" element={<DynamicEdit model={model} allModels={allModels} />} />
                                                <Route path="show/:id" element={
                                                    <MultiPaneLayout>
                                                        <DynamicShow model={model} allModels={allModels} />
                                                    </MultiPaneLayout>
                                                } />
                                            </Route>
                                        ))}
                                    </Route>
                                </Routes>
                            </PrimaryShowContext.Provider>
                        </ColorModeContextProvider>
                    </Refine>
                </BrowserRouter>
            </AllModelsProvider>
        </QueryClientProvider>
    );
}
