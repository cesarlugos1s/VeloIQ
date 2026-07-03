// AUTO-GENERATED — do not edit. Run `veloiq generate` to update.
// Extension-contributed routes and user-menu items.
// This stub is replaced by `veloiq generate` once extension packages are installed.

import type React from "react";

export interface ExtensionRoute { path: string; element: React.ReactNode; }
export const extensionRoutes: ExtensionRoute[] = [];

export interface ExtensionUserMenuItem { key: string; label: string; icon?: React.ReactNode; onClick: () => void; }
export const extensionUserMenuItems: ExtensionUserMenuItem[] = [];

export interface ExtensionShowComponent { resource: string; Component: React.ComponentType<{ idOverride?: string }>; }
export const extensionShowComponents: Record<string, React.ComponentType<{ idOverride?: string }>> = {};

// Exception-alert extension hooks (populated by veloiq generate when an exception-alert extension is enabled)
export const exceptionAlertBannerComponent: React.ComponentType<{ resource: string }> | null = null;
export const exceptionAlertListWrapperComponent: React.ComponentType<{ resource: string; children: React.ReactNode }> | null = null;
export const exceptionAlertAwareResources: Set<string> = new Set();
