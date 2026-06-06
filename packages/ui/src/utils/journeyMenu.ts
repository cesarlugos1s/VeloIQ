import { useEffect, useState } from "react";
import { authenticatedFetch } from "./authenticatedFetch";

const API_URL = "/api";

/**
 * Journey menu items grouped by the module they belong to.
 * Shape: { [moduleName]: [{ key, label, route }] }
 *
 * Journeys are a IQVigilant-extension concept; this fetch is best-effort and
 * silently yields {} when the journey endpoints are absent (e.g. the extension
 * is not installed), so the core menu degrades gracefully.
 */
export type JourneyMenuMap = Record<string, { key: string; label: string; route: string; icon: string }[]>;

/** Ant Design icon name used for journeys everywhere (matches the Journey Runner page title). */
export const JOURNEY_ICON_NAME = "NodeIndexOutlined";

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
                        icon: JOURNEY_ICON_NAME,
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
export function injectJourneyMenuItems<T extends { key?: string; name?: string; children?: any[] }>(
    items: T[],
    byModule: JourneyMenuMap,
): T[] {
    if (!byModule || Object.keys(byModule).length === 0) return items;

    const moduleNameOf = (item: any): string | null => {
        let key = String(item?.key ?? item?.name ?? "");
        // Refine's useMenu keys items with a leading slash (e.g. "/module:identity").
        if (key.startsWith("/")) key = key.slice(1);
        if (key.startsWith("module:")) return key.slice("module:".length);
        // Some menus key module groups by the bare module name.
        if (byModule[key]) return key;
        return null;
    };

    const walk = (list: any[]): any[] => list.map((item) => {
        const childrenWalked = Array.isArray(item?.children) && item.children.length
            ? walk(item.children)
            : item?.children;
        const moduleName = moduleNameOf(item);
        const extra = moduleName ? byModule[moduleName] : undefined;
        if (extra && extra.length) {
            // Journeys appear BEFORE the module's model entries.
            return { ...item, children: [...extra, ...(childrenWalked || [])] };
        }
        if (childrenWalked !== item?.children) return { ...item, children: childrenWalked };
        return item;
    });

    return walk(items) as T[];
}
