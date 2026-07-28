// AUTO-GENERATED — do not edit. Run `veloiq generate` to update.
// Extension-contributed routes and user-menu items.
// This stub is replaced by `veloiq generate` once extension packages are installed.

import type React from "react";

export interface ExtensionRoute { path: string; element: React.ReactNode; module?: string; }
export const extensionRoutes: ExtensionRoute[] = [];

export interface ExtensionUserMenuItem { key: string; label: string; icon?: React.ReactNode; onClick: () => void; module?: string; }
export const extensionUserMenuItems: ExtensionUserMenuItem[] = [];

export interface ExtensionShowComponent { resource: string; Component: React.ComponentType<{ idOverride?: string }>; }
export const extensionShowComponents: Record<string, React.ComponentType<{ idOverride?: string }>> = {};
export const extensionEditComponents: Record<string, React.ComponentType<any>> = {};
export const extensionCreateComponents: Record<string, React.ComponentType<any>> = {};
export const extensionListComponents: Record<string, React.ComponentType<any>> = {};

// Exception-alert extension hooks (populated by veloiq generate when an exception-alert extension is enabled)
export const exceptionAlertBannerComponent: React.ComponentType<{ resource: string }> | null = null;
export const exceptionAlertListWrapperComponent: React.ComponentType<{ resource: string; children: React.ReactNode }> | null = null;
export const exceptionAlertAwareResources: Set<string> = new Set();

// Components rendered as extra header buttons on every resource's default
// DynamicList page (see list_header_button_components in extension manifests).
export const globalListHeaderButtonComponents: React.ComponentType<{ resource: string; model: any; allModels: any[] }>[] = [];
// Components rendered as extra header buttons on every resource's default
// DynamicShow page (see show_header_button_components in extension manifests).
export const globalShowHeaderButtonComponents: React.ComponentType<{ resource: string; model: any; record: any; allModels: any[] }>[] = [];
// Component rendered once per Dashboard tab, in that tab's label area
// (see dashboard_tab_header_components in extension manifests).
export const globalDashboardTabHeaderComponents: React.ComponentType<{ tab: any; allModels: any[] }>[] = [];
