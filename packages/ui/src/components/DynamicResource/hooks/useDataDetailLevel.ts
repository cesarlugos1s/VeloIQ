import { useState, useCallback, useMemo, useRef } from "react";
import type { RelationDef, RelationViewType } from "../types";
import { getRelationViewType } from "../relations/helpers";
import { ddlTrace } from "../utils/ddlTrace";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

// Only these basic types participate in scaling. Special views (primary, gallery,
// calendar, tree, tree-details) are left alone.
const SCALABLE_SHOW = new Set<RelationViewType>([
    "csv", "read-and-edit-csv", "list", "read-and-edit-list",
    "crosstab", "totals-details", "table",
]);
const SCALABLE_EDIT = new Set<RelationViewType>([
    "editable-csv", "editable-list", "editable-crosstab", "editable-table",
]);

function isScalable(vt: RelationViewType, mode: "show" | "edit"): boolean {
    return (mode === "show" ? SCALABLE_SHOW : SCALABLE_EDIT).has(vt);
}

const SHOW_VIEW_LEVELS: Record<string, number> = {
    "csv": 0, "read-and-edit-csv": 0,
    "list": 1, "read-and-edit-list": 1,
    "crosstab": 2, "totals-details": 3, "table": 4,
};
const EDIT_VIEW_LEVELS: Record<string, number> = {
    "editable-csv": 0, "editable-list": 1,
    "editable-crosstab": 2, "editable-table": 3,
};

const LEVEL_TO_SHOW: Record<number, RelationViewType> = {
    0: "csv", 1: "list", 2: "crosstab", 3: "totals-details", 4: "table",
};
const LEVEL_TO_EDIT: Record<number, RelationViewType> = {
    0: "editable-csv", 1: "editable-list", 2: "editable-crosstab",
    3: "editable-table", 4: "editable-table",
};

export const DATA_DETAIL_LEVEL_LABELS = [
    _("Minimal"), _("Compact"), _("Summary"), _("Expandable"), _("Expanded"),
];

export const DATA_DETAIL_LEVEL_TOOLTIPS = [
    _("Sets all relations to CSV view. Great for summary quick reading."),
    _("Sets all relations to List view. Great for quick reading."),
    _("Sets relations to Crosstab. Great for analyzing trends."),
    _("Sets relations to Totals-Details. Great for going from summaries to details."),
    _("Sets relations to Full Tables. Great for heavy editing and deep-dives."),
];

function getViewTypeLevel(viewType: RelationViewType, mode: "show" | "edit"): number {
    const map = mode === "show" ? SHOW_VIEW_LEVELS : EDIT_VIEW_LEVELS;
    return map[viewType] ?? (mode === "show" ? 3 : 3);
}

function levelToViewType(level: number, mode: "show" | "edit"): RelationViewType {
    const safe = Math.max(0, Math.min(4, Math.round(level)));
    const map = mode === "show" ? LEVEL_TO_SHOW : LEVEL_TO_EDIT;
    return map[safe] ?? (mode === "show" ? "totals-details" : "editable-table");
}

export interface DataDetailLevelState {
    dataDetailLevel: number;
    setDataDetailLevel: (level: number) => void;
    levelLabels: string[];
    levelTooltips: string[];
    applyToRelations: (relations: RelationDef[]) => RelationDef[];
    getEffectiveViewType: (
        rel: RelationDef, mode: "show" | "edit",
        defaults: { show: RelationViewType; edit: RelationViewType },
    ) => RelationViewType;
    isActive: boolean;
}

export function useDataDetailLevel(
    relations: RelationDef[],
    mode: "show" | "edit",
    relationViewTypeDefaults: { show: RelationViewType; edit: RelationViewType },
): DataDetailLevelState {
    const initialLevel = useMemo(() => {
        if (!relations || relations.length === 0) {
            ddlTrace("initialLevel: no relations -> 4");
            return 4;
        }
        let minLevel = 4;
        const traceRows: { rel: string; vt: string; scalable: boolean; lvl: number }[] = [];
        for (const rel of relations) {
            const vt = getRelationViewType(rel, mode, relationViewTypeDefaults);
            const scalable = isScalable(vt, mode);
            const lvl = getViewTypeLevel(vt, mode);
            const relKey = rel.relationName || rel.resource || rel.label || "?";
            traceRows.push({ rel: relKey, vt, scalable, lvl });
            if (!scalable) continue;
            if (lvl < minLevel) minLevel = lvl;
        }
        ddlTrace("initialLevel computed", { mode, minLevel, defaults: relationViewTypeDefaults, rows: traceRows });
        return minLevel;
    }, []);

    const [dataDetailLevel, setDataDetailLevelState] = useState(initialLevel);
    const prevLevelRef = useRef(dataDetailLevel);
    const showOverridesRef = useRef<Record<string, RelationViewType>>({});
    const editOverridesRef = useRef<Record<string, RelationViewType>>({});
    const [, forceRender] = useState(0);
    const hasScalableRels = relations.some((r) => {
        const vt = getRelationViewType(r, mode, relationViewTypeDefaults);
        return isScalable(vt, mode);
    });
    const isActive = hasScalableRels;

    const setDataDetailLevel = useCallback(
        (newLevel: number) => {
            const clamped = Math.max(0, Math.min(4, Math.round(newLevel)));
            const prevLevel = prevLevelRef.current;
            if (clamped === prevLevel) {
                    ddlTrace("setDataDetailLevel noop (clamped===prev)", { clamped });
                return;
            }
            const isReducing = clamped < prevLevel;
            ddlTrace("setDataDetailLevel", { from: prevLevel, to: clamped, isReducing });
            const nextShow: Record<string, RelationViewType> = {};
            const nextEdit: Record<string, RelationViewType> = {};
            const traceShow: { rel: string; showVT: string; lvl: number; decision: string; applied: string | null }[] = [];

            for (const rel of relations) {
                const relKey = rel.relationName || rel.resource || rel.label;
                if (!relKey) continue;

                // Show side
                const showVT: RelationViewType =
                    showOverridesRef.current[relKey] ??
                    rel.showViewType ??
                    getRelationViewType(rel, "show", relationViewTypeDefaults);
                if (isScalable(showVT, "show")) {
                    const lvl = getViewTypeLevel(showVT, "show");
                    let decision = "noop";
                    let applied: RelationViewType | null = null;
                    if (isReducing && lvl > clamped) {
                        nextShow[relKey] = levelToViewType(clamped, "show");
                        decision = "reduce"; applied = nextShow[relKey];
                    } else if (!isReducing && lvl < clamped) {
                        nextShow[relKey] = levelToViewType(clamped, "show");
                        decision = "increase"; applied = nextShow[relKey];
                    } else if (showOverridesRef.current[relKey]) {
                        nextShow[relKey] = showOverridesRef.current[relKey];
                        decision = "keep-override"; applied = nextShow[relKey];
                    } else {
                        decision = "keep-original";
                    }
                    traceShow.push({ rel: relKey, showVT, lvl, decision, applied });
                }

                // Edit side
                const editVT: RelationViewType =
                    editOverridesRef.current[relKey] ??
                    rel.editViewType ??
                    getRelationViewType(rel, "edit", relationViewTypeDefaults);
                if (isScalable(editVT, "edit")) {
                    const lvl = getViewTypeLevel(editVT, "edit");
                    if (isReducing && lvl > clamped)
                        nextEdit[relKey] = levelToViewType(clamped, "edit");
                    else if (!isReducing && lvl < clamped)
                        nextEdit[relKey] = levelToViewType(clamped, "edit");
                    else if (editOverridesRef.current[relKey])
                        nextEdit[relKey] = editOverridesRef.current[relKey];
                }
            }

            ddlTrace("setDataDetailLevel show decisions", traceShow);
            ddlTrace("setDataDetailLevel resulting overrides", { showOverrides: { ...nextShow }, editOverrides: { ...nextEdit } });

            showOverridesRef.current = nextShow;
            editOverridesRef.current = nextEdit;
            prevLevelRef.current = clamped;
            setDataDetailLevelState(clamped);
            forceRender((n) => n + 1);
        },
        [relations, relationViewTypeDefaults],
    );

    const applyToRelations = useCallback(
        (rels: RelationDef[]): RelationDef[] => {
            for (const rel of rels) {
                const relKey = rel.relationName || rel.resource || rel.label;
                if (!relKey) continue;
                const showOverride = showOverridesRef.current[relKey];
                const editOverride = editOverridesRef.current[relKey];
                if (showOverride) (rel as any).showViewType = showOverride;
                if (editOverride) (rel as any).editViewType = editOverride;
            }
            return rels;
        },
        [dataDetailLevel],
    );

    const getEffectiveViewType = useCallback(
        (rel: RelationDef, m: "show" | "edit",
         d: { show: RelationViewType; edit: RelationViewType }): RelationViewType => {
            const relKey = rel.relationName || rel.resource || rel.label;
            if (relKey) {
                const o = m === "show"
                    ? showOverridesRef.current[relKey]
                    : editOverridesRef.current[relKey];
                    ddlTrace("getEffectiveViewType", { relKey, mode: m, override: o ?? null, relShowVT: (rel as any).showViewType ?? null, relEditVT: (rel as any).editViewType ?? null, defaults: d });
                if (o) return o;
            }
            return getRelationViewType(rel, m, d);
        },
        [dataDetailLevel],
    );

    return {
        dataDetailLevel, setDataDetailLevel,
        levelLabels: DATA_DETAIL_LEVEL_LABELS,
        levelTooltips: DATA_DETAIL_LEVEL_TOOLTIPS,
        applyToRelations, getEffectiveViewType, isActive,
    };
}
