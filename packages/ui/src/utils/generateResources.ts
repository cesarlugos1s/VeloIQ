import type { ModelDef } from "../components/DynamicResource/types";
import { translateText } from "../components/DynamicResource/utils/i18n";

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

// Title-case each word of a slug-style module name so the result matches the
// humanized msgids used in the PO catalogs (e.g. "exception_alert" →
// "Exception Alert", "vigilant_process" → "Vigilant Process"). Hosts can still
// override the displayed label via the `moduleLabel` option.
const humanizeModuleName = (moduleName: string): string => {
    const words = String(moduleName || "").replace(/[_-]+/g, " ").trim().split(/\s+/).filter(Boolean);
    return words
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
};

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
    // Humanize the default module label (e.g. "exception_alert" → "Exception
    // Alert") so it matches the humanized msgids used in the PO catalogs, then
    // translate it via the active locale. An explicit `moduleLabel` (provided
    // by the host App.tsx, already translated) is used as-is.
    const humanized = humanizeModuleName(moduleName);
    const parentLabel = moduleLabel
        ? moduleLabel
        : translateText(humanized, humanized);

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
                    model.fields.some((f) => f?.key === "eid_to") ||
                    (model.fields.length > 0 &&
                     model.fields.every((f) => !!f?.reference))));

        return {
            name: resource,
            list: `/${resource}`,
            create: `/${resource}/create`,
            edit: `/${resource}/edit/:id`,
            show: `/${resource}/show/:id`,
            meta: {
                canDelete: true,
                // Translate the model's display label via the active locale's
                // catalog (call-time), falling back to the raw label.
                label: translateText(model.label || model.name, model.label || model.name),
                hide: Boolean(model.hideInMenu) || isRelation,
                parent: parentKey,
                icon,
            },
        };
    });

    return [parentEntry, ...children];
}
