import { useEffect, useState } from "react";
import { authenticatedFetch } from "./authenticatedFetch";

const API_URL = "/api";

/**
 * Journey menu items grouped by the module they belong to.
 * Shape: { [moduleName]: [{ key, label, route }] }
 *
 * Journeys are a VigilantIQ-extension concept; this fetch is best-effort and
 * silently yields {} when the journey endpoints are absent (e.g. the extension
 * is not installed), so the core menu degrades gracefully.
 */
export type JourneyMenuMap = Record<string, { key: string; label: string; route: string }[]>;

export function useJourneyMenuItems(): JourneyMenuMap {
    const [byModule, setByModule] = useState<JourneyMenuMap>({});

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await authenticatedFetch(`${API_URL}/journeys?_start=0&_end=200`);
                if (!res.ok) return;
                const data = await res.json();
                const list: any[] = Array.isArray(data) ? data : (data?.data ?? []);
                const map: JourneyMenuMap = {};
                for (const j of list) {
                    if (!j?.module || !j?.journey_id) continue;
                    (map[j.module] ??= []).push({
                        key: `journey:${j.journey_id}`,
                        label: j.name || j.journey_id,
                        route: `/journey-run/${j.journey_id}`,
                    });
                }
                if (!cancelled) setByModule(map);
            } catch {
                /* journey endpoints unavailable — no dynamic journey menu items */
            }
        })();
        return () => { cancelled = true; };
    }, []);

    return byModule;
}

/**
 * Inject journey menu items as children of their module's menu entry.
 * Modules are matched by the `module:{moduleName}` key convention.
 */
export function injectJourneyMenuItems(items: any[], byModule: JourneyMenuMap): any[] {
    if (!byModule || Object.keys(byModule).length === 0) return items;
    return items.map((item) => {
        const key = String(item?.key || "");
        if (!key.startsWith("module:")) return item;
        const moduleName = key.slice("module:".length);
        const extra = byModule[moduleName];
        if (!extra || extra.length === 0) return item;
        // Journeys appear BEFORE the module's model entries.
        return { ...item, children: [...extra, ...(item.children || [])] };
    });
}
