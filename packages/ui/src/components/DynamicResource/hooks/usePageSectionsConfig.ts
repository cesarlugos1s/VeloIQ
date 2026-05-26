import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApiUrl } from "@refinedev/core";
import type { ViewConfigRow } from "../types";
import type { DashboardCell, DashboardConfig, DashboardTab } from "../../../pages/dashboard/hooks/useDashboardConfig";
import { groupConfigRowsBySectionId, DETAILS_TAB_NAME } from "../utils/viewConfig";
import { authenticatedFetch } from "../../../utils/authenticatedFetch";

// Stored in views/preferences as preferenceType "ShowLayoutGrid" or "EditLayoutGrid".
// Shape: { cells: Array<{ id, row, col, min_width, max_width, min_height, max_height, html_style }> }
type CellOverride = Pick<DashboardCell, "id" | "row" | "col" | "min_width" | "max_width" | "min_height" | "max_height" | "html_style">;

function buildCells(
    configRows: ViewConfigRow[],
    tabName: string | null,
    overrides: Record<string, CellOverride>,
): DashboardCell[] {
    const modeRows = configRows.filter((r) => (tabName === null ? !r.tab_name : r.tab_name === tabName));
    const sections = groupConfigRowsBySectionId(modeRows);
    const cells: DashboardCell[] = [];
    for (const [sectionId, { name: sectionName, rows }] of sections.entries()) {
        const firstRow = rows[0];
        const baseRow = Math.max(0, (firstRow?.section_grid_row ?? 1) - 1);
        const baseCol = Math.max(0, (firstRow?.section_grid_col ?? 1) - 1);
        const ov = overrides[sectionId];
        cells.push({
            id: sectionId,
            model: "",
            source_type: "field",
            row: ov?.row ?? baseRow,
            col: ov?.col ?? baseCol,
            view_type: null,
            html_style: ov?.html_style ?? "",
            min_width: ov?.min_width ?? null,
            max_width: ov?.max_width ?? null,
            min_height: ov?.min_height ?? null,
            max_height: ov?.max_height ?? null,
            section_name: sectionName,
            section_id: sectionId,
        });
    }
    return cells;
}

function buildConfig(
    configRows: ViewConfigRow[],
    overrides: Record<string, CellOverride>,
): DashboardConfig {
    // Details tab (tab_name === null)
    const detailsCells = buildCells(configRows, null, overrides);

    // Custom config tabs (unique non-null tab_names)
    const customTabNames = Array.from(new Set(
        configRows.filter((r) => !!r.tab_name).map((r) => r.tab_name as string)
    ));

    const tabs: DashboardTab[] = [];
    if (detailsCells.length > 0) {
        tabs.push({ id: "details", name: "Details", cells: detailsCells });
    }
    for (const tabName of customTabNames) {
        const tabCells = buildCells(configRows, tabName, overrides);
        if (tabCells.length > 0) {
            tabs.push({ id: `tab::${tabName}`, name: tabName, cells: tabCells });
        }
    }
    return { tabs };
}

export interface UsePageSectionsConfigResult {
    config: DashboardConfig;
    loading: boolean;
    save: (nextConfig: DashboardConfig) => void;
    getSectionRows: (sectionId: string) => ViewConfigRow[];
    // Configure-mode controls
    isConfiguring: boolean;
    enterConfigMode: () => void;
    saveLayout: () => void;
    cancelLayout: () => void;
    onLayoutChange: (next: DashboardConfig) => void;
}

export function usePageSectionsConfig(
    configRows: ViewConfigRow[],
    resourceKey: string,
    mode: "show" | "edit",
): UsePageSectionsConfigResult {
    const apiUrl = useApiUrl();
    const preferenceType = mode === "show" ? "ShowLayoutGrid" : "EditLayoutGrid";

    const [overrides, setOverrides] = useState<Record<string, CellOverride>>({});
    const [loading, setLoading] = useState(true);
    const loadedKeyRef = useRef<string | null>(null);

    useEffect(() => {
        if (!resourceKey) { setLoading(false); return; }
        const cacheKey = `${resourceKey}:${preferenceType}`;
        if (loadedKeyRef.current === cacheKey) return;
        loadedKeyRef.current = cacheKey;
        setLoading(true);
        authenticatedFetch(
            `${apiUrl}/views/preferences?resource=${encodeURIComponent(resourceKey)}&preference_type=${preferenceType}`
        )
            .then((res) => res.ok ? res.json() : null)
            .then((data) => {
                const cells: CellOverride[] = data?.preferences?.cells ?? [];
                const map: Record<string, CellOverride> = {};
                for (const c of cells) map[c.id] = c;
                setOverrides(map);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [apiUrl, resourceKey, preferenceType]);

    const savedConfig = useMemo(
        () => buildConfig(configRows, overrides),
        [configRows, overrides],
    );

    const [isConfiguring, setIsConfiguring] = useState(false);
    const [pendingConfig, setPendingConfig] = useState<DashboardConfig | null>(null);

    const config = useMemo(
        () => (isConfiguring && pendingConfig) ? pendingConfig : savedConfig,
        [isConfiguring, pendingConfig, savedConfig],
    );

    const save = useCallback((nextConfig: DashboardConfig) => {
        const allCells = nextConfig.tabs.flatMap((t) => t.cells);
        const nextOverrides: Record<string, CellOverride> = {};
        const cells: CellOverride[] = allCells.map((c) => {
            const ov: CellOverride = {
                id: c.id,
                row: c.row,
                col: c.col,
                min_width: c.min_width,
                max_width: c.max_width,
                min_height: c.min_height,
                max_height: c.max_height,
                html_style: c.html_style,
            };
            nextOverrides[c.id] = ov;
            return ov;
        });
        setOverrides(nextOverrides);
        authenticatedFetch(`${apiUrl}/views/preferences`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resource: resourceKey, preferenceType, preferences: { cells } }),
        }).catch(() => {});
    }, [apiUrl, resourceKey, preferenceType]);

    const getSectionRows = useCallback((sectionId: string): ViewConfigRow[] => {
        return configRows.filter((r) => (r.section_id || r.section || DETAILS_TAB_NAME) === sectionId);
    }, [configRows]);

    const enterConfigMode = useCallback(() => {
        setPendingConfig(savedConfig);
        setIsConfiguring(true);
    }, [savedConfig]);

    const cancelLayout = useCallback(() => {
        setPendingConfig(null);
        setIsConfiguring(false);
    }, []);

    const saveLayout = useCallback(() => {
        const toSave = pendingConfig ?? savedConfig;
        save(toSave);
        setPendingConfig(null);
        setIsConfiguring(false);
    }, [pendingConfig, savedConfig, save]);

    const onLayoutChange = useCallback((next: DashboardConfig) => {
        if (isConfiguring) setPendingConfig(next);
    }, [isConfiguring]);

    return { config, loading, save, getSectionRows, isConfiguring, enterConfigMode, saveLayout, cancelLayout, onLayoutChange };
}
