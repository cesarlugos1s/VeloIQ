/**
 * Which view types suit a model or named query, judged from its fields. The
 * temporary view type selectors (list pages and the relation blocks of show and
 * edit pages) offer only the view types this returns.
 */
import type { ModelDef } from "../types";
import { getCalendarDateFieldOptions } from "./calendar";
import { modelHasImageSource } from "./gallery";
import { KANBAN_COLUMN_VIEW_TYPES, getKanbanSplitFieldOptions } from "./kanban";
import { isPkField } from "./model";

/** Number fields a crosstab can total (the key and references are not measures). */
const hasNumericField = (model: ModelDef): boolean =>
    model.fields.some((field) => field.type === "number" && !field.reference && !isPkField(field, model));

/** Whether one view type token can show the model's records. Tokens this does not know always apply. */
export function isViewTypeApplicable(token: string, model: ModelDef): boolean {
    switch (token) {
        case "gallery":
        case "image":
            return modelHasImageSource(model);
        case "calendar":
            return getCalendarDateFieldOptions(model.fields).length > 0;
        case "crosstab":
        case "editable-crosstab":
            return hasNumericField(model);
        case "kanban":
            return getKanbanSplitFieldOptions(model.fields).length > 0;
        default:
            return true;
    }
}

/** Where a view type selector is offered; each place has its own candidate view types. */
export type ViewTypeSelectorContext = "list-page" | "relation-show" | "relation-edit" | "kanban-column";

/** Every list view type the temporary selector of a list page can offer. */
const LIST_PAGE_VIEW_TYPES = [
    "table", "editable-table", "list", "editable-list", "gallery", "image", "calendar", "kanban",
    "totals-details", "crosstab", "editable-crosstab", "primary", "primary-carousel",
];
/** View types a user may pick for a relation block for now; the editable ones only on edit pages. */
const RELATION_VIEW_TYPES_SHOWN = ["table", "totals-details", "crosstab", "list", "csv", "kanban", "gallery", "image", "calendar", "primary", "primary-carousel"];
const RELATION_VIEW_TYPES_EDIT_ONLY = ["editable-table", "editable-crosstab", "editable-list", "editable-csv"];

const CANDIDATE_VIEW_TYPES: Record<ViewTypeSelectorContext, readonly string[]> = {
    "list-page": LIST_PAGE_VIEW_TYPES,
    "relation-show": RELATION_VIEW_TYPES_SHOWN,
    "relation-edit": [...RELATION_VIEW_TYPES_SHOWN, ...RELATION_VIEW_TYPES_EDIT_ONLY],
    "kanban-column": KANBAN_COLUMN_VIEW_TYPES,
};

/** The view types a selector in the given place offers for the model: its candidates that suit the model's fields. */
export function getSelectableViewTypes(context: ViewTypeSelectorContext, model: ModelDef): string[] {
    return filterApplicableViewTypes(CANDIDATE_VIEW_TYPES[context], model);
}

/** The tokens applicable to the model, in their given order. */
export function filterApplicableViewTypes<T extends string>(tokens: readonly T[], model: ModelDef): T[] {
    return tokens.filter((token) => isViewTypeApplicable(token, model));
}
