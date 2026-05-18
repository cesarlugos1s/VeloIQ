import type { ModelDef } from "../components/DynamicResource/types";

export interface ResourceDef {
    name: string;
    list: string;
    create: string;
    edit: string;
    show: string;
    meta: {
        canDelete: boolean;
        label: string;
        hide?: boolean;
        parent?: string;
        icon?: React.ReactNode;
    };
}

/**
 * Convert a module's ModelDef array into Refine resource definitions.
 * Pass the module name to group models under a shared parent resource.
 * Always prepends a parent group entry so Refine renders a clean module
 * label (not the raw "module:X" string).
 */
export function generateResources(
    models: ModelDef[],
    moduleName: string,
    options: {
        icon?: React.ReactNode;
        hideRelations?: boolean;
        moduleLabel?: string;
    } = {},
): ResourceDef[] {
    const { icon, hideRelations = true, moduleLabel } = options;
    const parentKey = `module:${moduleName}`;
    const parentLabel = moduleLabel || moduleName.charAt(0).toUpperCase() + moduleName.slice(1);

    const parentEntry: ResourceDef = {
        name: parentKey,
        list: "",
        create: "",
        edit: "",
        show: "",
        meta: {
            canDelete: false,
            label: parentLabel,
            hide: false,
            icon,
        },
    };

    const children = (models || []).map((model) => {
        const resource = model.resource || model.name;
        const isRelation =
            hideRelations &&
            (resource.toLowerCase().endsWith("_relation") ||
                resource.toLowerCase().endsWith("_rela") ||
                (Array.isArray(model.fields) &&
                    model.fields.some((f) => f?.key === "eid_from") &&
                    model.fields.some((f) => f?.key === "eid_to")));

        return {
            name: resource,
            list: `/${resource}`,
            create: `/${resource}/create`,
            edit: `/${resource}/edit/:id`,
            show: `/${resource}/show/:id`,
            meta: {
                canDelete: true,
                label: model.label || model.name,
                hide: Boolean(model.hideInMenu) || isRelation,
                parent: parentKey,
                icon,
            },
        };
    });

    return [parentEntry, ...children];
}
