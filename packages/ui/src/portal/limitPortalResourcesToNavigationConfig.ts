/**
 * A portal's menu is exactly its menu file (navigation.<site>.config.json).
 *
 * The portal registers a Refine resource for every model its roles can read
 * (so relation links and record pages open), but its menus list only the
 * entries of the menu file, with the file's labels: a resource the file
 * doesn't list is hidden from the menus (its pages still open), and a model
 * listed without its module is a first-level entry. The Dashboard entry keeps
 * following the portal's own setting. Page entries are added afterwards by
 * ``useRefineResourcesIncludingNavigationPages``.
 */
import type { NavConfig } from "../utils/navConfig";
import { DASHBOARD_MENU_RESOURCE_NAME } from "../hooks/useLayoutMenuItems";

// i18n helper — resolved at CALL time so window._ is always current.
const _ = (text: string): string => {
    const t = (window as any)._;
    return typeof t === "function" ? (t(text) as string) : text;
};

/** The parts of a Refine resource the menus read. */
interface MenuResource {
    name: string;
    meta?: { hide?: boolean; parent?: string; label?: string };
}

/** Return *resources* with only the entries of *navConfig* shown in the menus. */
export function limitPortalResourcesToNavigationConfig<T extends MenuResource>(resources: T[], navConfig: NavConfig): T[] {
    const navEntryByKey = new Map(navConfig.map((entry) => [entry.key, entry]));
    return resources.map((resource) => {
        if (resource.name === DASHBOARD_MENU_RESOURCE_NAME) return resource;
        const navEntry = navEntryByKey.get(resource.name);
        if (!navEntry) return { ...resource, meta: { ...resource.meta, hide: true } };
        const parent = resource.meta?.parent;
        return {
            ...resource,
            meta: {
                ...resource.meta,
                // Listed in the menu file: shown, even a resource hidden by default (e.g. a non-model data resource).
                hide: false,
                label: navEntry.label ? _(navEntry.label) : resource.meta?.label,
                parent: parent && navEntryByKey.has(parent) ? parent : undefined,
            },
        };
    });
}
