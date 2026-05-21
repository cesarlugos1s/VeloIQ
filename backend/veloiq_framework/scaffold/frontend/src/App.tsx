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

// Stable reference prevents PrimaryShowContext churn on re-renders.
const PrimaryShowRenderer = ({ model, id, allModels }: PrimaryShowRendererProps) => (
    <DynamicShow model={model} allModels={allModels} idOverride={String(id)} />
);

const queryClient = new QueryClient();

export default function App() {
    const allModels = [...allSystemModels, ...authSystemModels];

    const resources = [
        { name: "dashboard", list: "/dashboard", meta: { label: "Dashboard", canDelete: false } },
        ...allModuleRegistrations.flatMap(({ moduleName, models }) =>
            generateResources(models, moduleName)
        ),
        ...generateResources(authSystemModels, "access_control", { moduleLabel: "Access Control" }),
    ];

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
                                    <Route path="/" element={<Navigate to={`/${allSystemModels[0]?.resource || allSystemModels[0]?.name || "login"}`} replace />} />
                                    <Route path="/login" element={<LoginPage />} />
                                    <Route
                                        element={
                                            <Authenticated key="auth" redirectOnFail="/login">
                                                <LayoutWrapper>
                                                    <Outlet />
                                                </LayoutWrapper>
                                            </Authenticated>
                                        }
                                    >
                                        <Route path="/dashboard" element={<DashboardPage />} />
                                        {allSystemModels.map((model) => (
                                            <Route key={model.name} path={`/${(model as any).resource || model.name}`}>
                                                <Route index element={
                                                    <MultiPaneLayout>
                                                        <DynamicList model={model} allModels={allModels} />
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
                                        {authSystemModels.map((model) => (
                                            <Route key={model.name} path={`/${model.resource || model.name}`}>
                                                <Route index element={
                                                    <MultiPaneLayout>
                                                        <DynamicList model={model} allModels={allModels} />
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
