import type { RelationDef, RelationViewType } from "../types";
import { getRelationLabel, translateRelationKey } from "../utils/i18n";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

const INLINE_RELATION_VIEW_TYPES = new Set<RelationViewType>(["list", "csv", "read-and-edit-list", "read-and-edit-csv", "editable-csv"]);
const TABLE_RELATION_VIEW_TYPES = new Set<RelationViewType>(["table", "totals-details"]);

export const isInlineRelationViewType = (viewType: RelationViewType) => INLINE_RELATION_VIEW_TYPES.has(viewType);
export const usesTableRelationBehavior = (viewType: RelationViewType) => TABLE_RELATION_VIEW_TYPES.has(viewType);

export const DEFAULT_SHOW_RELATION_ROW_ACTIONS = false;
export const DEFAULT_EDIT_RELATION_ROW_ACTIONS = true;
export const DEFAULT_RELATION_CREATE_ACTIONS = true;

export const isReverseRelation = (rel: RelationDef) => {
    if (rel.relationName && rel.relationName.endsWith("_reverse")) return true;
    return !rel.otherResource;
};

export const getRelationViewType = (
    rel: RelationDef,
    mode: "show" | "edit",
    defaults?: { show: RelationViewType; edit: RelationViewType },
) => {
    const showFallback = defaults?.show || "totals-details";
    const editFallback = defaults?.edit || "editable-table";
    if (mode === "show") {
        if (rel.showViewTypeFromCsv && rel.showViewType) return rel.showViewType;
        return showFallback;
    }
    if (rel.editViewTypeFromCsv && rel.editViewType) return rel.editViewType;
    return editFallback;
};

export const getRelationTabName = (rel: RelationDef, mode: "show" | "edit", fallback: string) => {
    const explicit = mode === "show" ? rel.showTab : rel.editTab;
    if (!explicit) return fallback;
    if (isReverseRelation(rel)) {
        const relationKey = String(rel.relationName || rel.resource || "").trim().toLowerCase();
        const explicitKey = String(explicit).trim().toLowerCase();
        const labelKey = String(getRelationLabel(rel) || rel.label || "").trim().toLowerCase();
        const baseKey = relationKey
            .replace(/_reverse$/, "")
            .replace(/_object$/, "")
            .replace(/_relation$/, "");
        const humanize = (value: string) => value
            .replace(/[_-]+/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();
        const humanRelationKey = humanize(relationKey);
        const humanBaseKey = humanize(baseKey);
        if (
            explicitKey === labelKey
            || explicitKey === relationKey
            || explicitKey === baseKey
            || explicitKey === humanRelationKey
            || explicitKey === humanBaseKey
        ) {
            return fallback;
        }
    }
    const translatedExplicit = _(explicit);
    if (translatedExplicit !== explicit) return explicit;

    const relationKey = rel.relationName || rel.resource || "";
    if (relationKey) {
        const translatedRelationKey = translateRelationKey(relationKey);
        const likelyHumanizedLabel = explicit.includes(" ") || /[A-Z]/.test(explicit);
        if (likelyHumanizedLabel && translatedRelationKey !== relationKey) {
            return relationKey;
        }
    }
    return explicit;
};

export const getTabDisplayLabel = (tabName: string) => {
    const direct = _(tabName);
    if (direct !== tabName) return direct;
    return translateRelationKey(tabName);
};
