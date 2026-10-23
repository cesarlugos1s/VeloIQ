/**
 * Refine resources for the "page" entries of a navigation config, so non-model
 * pages and custom pages are listed in the menus like models are.
 *
 * Every menu (vertical, horizontal, mobile, Command Center, global search) is
 * built from Refine's resources. A "page" entry of `navigation.config.json`
 * (or a portal's `navigation.<site>.config.json`):
 *
 * - for a non-model data resource (already a hidden Refine resource): shows it
 *   in the menus, under its `parent` module when given;
 * - for any other page (an extension's or the app's custom page): adds a
 *   menu-only resource whose list route is the entry's `route`.
 *
 * Its position comes from the entry's `sequence`, like module and model entries.
 *
 *     { "key": "iqvigilant_api_tools", "label": "API Tools", "icon": "ApiOutlined",
 *       "sequence": 40, "type": "page", "parent": "module:nlp" }
 */
import { useMemo } from "react";
import type { ResourceProps } from "@refinedev/core";
import type { NavConfig } from "../utils/navConfig";

/** Return `resources` with the navigation config's "page" entries listed in the menus. */
export function listNavigationPagesInRefineResources(resources: ResourceProps[], navConfig?: NavConfig): ResourceProps[] {
    const pageEntries = (navConfig || []).filter((entry) => entry.type === "page" && entry.key);
    if (pageEntries.length === 0) return resources;
    const pageEntryByKey = new Map(pageEntries.map((entry) => [entry.key, entry]));
    // A resource that already exists (e.g. a non-model data resource) is shown at the entry's place.
    const shown = resources.map((resource) => {
        const entry = pageEntryByKey.get(resource.name);
        if (!entry) return resource;
        return {
            ...resource,
            meta: { ...resource.meta, hide: false, label: entry.label || resource.meta?.label, parent: entry.parent ?? resource.meta?.parent },
        };
    });
    const knownNames = new Set(resources.map((resource) => resource.name));
    // Any other page gets a menu-only resource on its route.
    const added: ResourceProps[] = pageEntries
        .filter((entry) => !knownNames.has(entry.key))
        .map((entry) => ({
            name: entry.key,
            list: entry.route || `/${entry.key}`,
            meta: { label: entry.label || entry.key, parent: entry.parent, canDelete: false },
        }));
    return [...shown, ...added];
}

/** The app's (or portal's) Refine resources with its navigation config's "page" entries listed in the menus. */
export function useRefineResourcesIncludingNavigationPages(resources: ResourceProps[], navConfig?: NavConfig): ResourceProps[] {
    return useMemo(() => listNavigationPagesInRefineResources(resources, navConfig), [resources, navConfig]);
}
