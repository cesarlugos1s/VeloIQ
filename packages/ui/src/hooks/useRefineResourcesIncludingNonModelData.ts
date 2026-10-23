/**
 * Refine resources for the non-model data resources, added to the app's own.
 *
 * Refine builds navigation (`go({ resource, action })`, Create/Edit/Show
 * buttons, breadcrumbs) from the resources given to <Refine>. A host app's
 * resources are generated for its models; this hook adds one entry per
 * non-model data resource, with the routes NonModelDataResourcePages serves.
 * They are hidden from the menu (their place in the menus is configured
 * separately).
 */
import { useMemo } from "react";
import type { ResourceProps } from "@refinedev/core";
import { useNonModelDataResourceModels } from "./useNonModelDataResourceModels";

/** Return `resources` plus a Refine resource for each non-model data resource not already in it. */
export function useRefineResourcesIncludingNonModelData(resources: ResourceProps[]): ResourceProps[] {
    const nonModelDataModels = useNonModelDataResourceModels();
    return useMemo(() => {
        if (nonModelDataModels.length === 0) return resources;
        const knownNames = new Set(resources.map((resource) => resource.name));
        const added: ResourceProps[] = nonModelDataModels
            .filter((model) => !knownNames.has(model.resource || model.name))
            .map((model) => {
                const name = model.resource || model.name;
                return {
                    name,
                    list: `/${name}`,
                    create: `/${name}/create`,
                    show: `/${name}/show/:id`,
                    edit: `/${name}/edit/:id`,
                    meta: { label: model.label, hide: true, canDelete: model.capabilities?.delete !== false },
                };
            });
        return [...resources, ...added];
    }, [resources, nonModelDataModels]);
}
