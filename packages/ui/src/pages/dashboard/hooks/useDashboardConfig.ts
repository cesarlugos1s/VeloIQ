import { useState, useEffect, useCallback } from "react";
import { useApiUrl } from "@refinedev/core";
import { authenticatedFetch } from "../../../utils/authenticatedFetch";

export type CellSourceType = "model" | "named_query" | "field" | "relation" | "custom";

export interface DashboardCell {
    id: string;
    model: string;
    source_type: CellSourceType;
    row: number;
    col: number;
    view_type: string | null;
    html_style: string;
    min_width: string | null;
    max_width: string | null;
    min_height: string | null;
    max_height: string | null;
    // For source_type "field" and "relation" cells (show/edit page sections)
    section_name?: string;
    section_id?: string;
}

export interface DashboardTab {
    id: string;
    name: string;
    module?: string;
    cells: DashboardCell[];
}

export interface DashboardConfig {
    tabs: DashboardTab[];
}

export function useDashboardConfig() {
    const apiUrl = useApiUrl();
    const [config, setConfig] = useState<DashboardConfig | null>(null);
    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authenticatedFetch(`${apiUrl}/dashboard/config`);
            if (!res.ok) { setLoading(false); return; }
            const data = await res.json();
            setEnabled(Boolean(data.enabled));
            if (data.enabled && data.dashboard) {
                setConfig(data.dashboard as DashboardConfig);
            }
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, [apiUrl]);

    useEffect(() => { load(); }, [load]);

    const save = useCallback(async (next: DashboardConfig) => {
        setConfig(next);
        try {
            await authenticatedFetch(`${apiUrl}/dashboard/config`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dashboard: next }),
            });
        } catch {
            // silent — local state already updated
        }
    }, [apiUrl]);

    return { config, enabled, loading, save, reload: load };
}
