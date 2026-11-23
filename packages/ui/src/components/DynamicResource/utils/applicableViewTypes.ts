/**
 * Which view types suit a model or named query, judged from its fields. The
 * temporary view type selectors (list pages and the relation blocks of show and
 * edit pages) offer only the view types this returns.
 */
import type { ModelDef } from "../types";
import { getCalendarDateFieldOptions } from "./calendar";
import { modelHasImageSource } from "./gallery";
import { getKanbanSplitFieldOptions } from "./kanban";
import { modelHasMapLocation } from "./mapView";
import { isPkField } from "./model";
import { VIEW_TYPE_CATALOG, getViewTypeCatalogEntries, type ViewTypeFieldRequirement, type ViewTypeSelectorContext } from "./viewTypeCatalog";

/** Number fields a crosstab can total (the key and references are not measures). */
const hasNumericField = (model: ModelDef): boolean =>
    model.fields.some((field) => field.type === "number" && !field.reference && !isPkField(field, model));

/** Whether the model's fields provide what a requirement asks for. */
function modelMeetsRequirement(requirement: ViewTypeFieldRequirement | undefined, model: ModelDef): boolean {
    switch (requirement) {
        case "image-source": return modelHasImageSource(model);
        case "date-field": return getCalendarDateFieldOptions(model.fields).length > 0;
        case "number-field": return hasNumericField(model);
        case "split-field": return getKanbanSplitFieldOptions(model.fields).length > 0;
        case "map-location": return modelHasMapLocation(model);
        default: return true;
    }
}

/** Whether one view type token can show the model's records. Tokens outside the catalog always apply. */
export function isViewTypeApplicable(token: string, model: ModelDef): boolean {
    const entry = VIEW_TYPE_CATALOG.find((candidate) => candidate.token === token);
    return modelMeetsRequirement(entry?.requires, model);
}

/** The view types a selector in the given place offers for the model: the place's catalog entries that suit the model's fields. */
export function getSelectableViewTypes(context: ViewTypeSelectorContext, model: ModelDef): string[] {
    return getViewTypeCatalogEntries(context)
        .filter((entry) => modelMeetsRequirement(entry.requires, model))
        .map((entry) => entry.token);
}

/** The tokens applicable to the model, in their given order. */
export function filterApplicableViewTypes<T extends string>(tokens: readonly T[], model: ModelDef): T[] {
    return tokens.filter((token) => isViewTypeApplicable(token, model));
}
