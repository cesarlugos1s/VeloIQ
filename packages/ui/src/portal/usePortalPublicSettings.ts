/**
 * The public settings of an external portal, from ``GET /api/veloiq/portals/{site}``,
 * and its configuration files, from ``GET /api/veloiq/portals/{site}/configuration``
 * (backend: veloiq_framework/portals/portal_settings_api_router.py).
 *
 * They are read before anyone signs in: the portal's title, where it keeps its
 * sign-in token, its default menu layout, whether it shows a Dashboard entry,
 * and the menu and page overrides administrators keep on the Portals pages
 * (read at start, so a change shows without rebuilding the portal).
 */
import { useEffect, useState } from "react";
import { API_URL } from "../providers/constants";
import type { NavConfig } from "../utils/navConfig";
import type { ModelOverride } from "../models/mergeUiModelSchemas";

export interface PortalPublicSettings {
    site: string;
    title: string;
    token_storage_key: string;
    default_layout: "vertical" | "horizontal";
    show_dashboard_menu_entry: boolean;
    /** Signed-out visitors may browse (the portal declares an anonymous user). */
    allows_signed_out_visitors?: boolean;
}

/** The portal's configuration files as served by the backend. */
export interface PortalRuntimeConfiguration {
    /** The menu (navigation.<site>.config.json); null when the portal has none yet. */
    navigation: NavConfig | null;
    /** Per-field page overrides (portalPageOverrides.json), applied after the built-in schemas. */
    page_overrides: ModelOverride[];
}

export interface PortalPublicSettingsState {
    settings: PortalPublicSettings | null;
    /** Null until read (or when it could not be read: the portal then uses what it was built with). */
    configuration: PortalRuntimeConfiguration | null;
    /** Both requests have finished. */
    loaded: boolean;
    /** HTTP status or network error text when the settings could not be read. */
    error: string | null;
}

/** Read the public settings of the portal *site* once. */
export function usePortalPublicSettings(site: string): PortalPublicSettingsState {
    const [state, setState] = useState<PortalPublicSettingsState>({ settings: null, configuration: null, loaded: false, error: null });
    useEffect(() => {
        let cancelled = false;
        const portalUrl = `${API_URL}/veloiq/portals/${encodeURIComponent(site)}`;
        const settingsRequest = fetch(portalUrl).then(async (response) => {
            if (!response.ok) throw new Error(String(response.status));
            return (await response.json()) as PortalPublicSettings;
        });
        // The configuration files are optional: without them the portal keeps its built-in menu and schemas.
        const configurationRequest = fetch(`${portalUrl}/configuration`)
            .then(async (response) => (response.ok ? (await response.json()) as PortalRuntimeConfiguration : null))
            .catch(() => null);
        Promise.all([settingsRequest, configurationRequest])
            .then(([settings, configuration]) => {
                if (!cancelled) setState({ settings, configuration, loaded: true, error: null });
            })
            .catch((error) => {
                if (!cancelled) setState({ settings: null, configuration: null, loaded: true, error: String(error?.message || error) });
            });
        return () => { cancelled = true; };
    }, [site]);
    return state;
}
