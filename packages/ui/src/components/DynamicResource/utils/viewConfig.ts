import { useState, useEffect } from "react";
import { useApiUrl } from "@refinedev/core";
import { authenticatedFetch } from "../../../utils/authenticatedFetch";
import { setColorSchemas } from "../../../utils/modelTone";
import type { FieldDef, ModelDef, RelationDef, ViewConfigRow, RelationViewType } from "../types";
import { resolveResourcePath } from "./model";
import { getRelationLabel } from "./i18n";
import { ddlTrace } from "./ddlTrace";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export const DETAILS_TAB_NAME = "Details";

export const getDefaultViewName = () => _("default view");

export const normalizeViewName = (name?: string | null) => {
    const trimmed = String(name ?? "").trim();
    return trimmed || getDefaultViewName();
};

export const splitRelations = (relations: RelationDef[] = []) => {
    const isReverse = (r: RelationDef) => {
        if (r.relationName && r.relationName.endsWith("_reverse")) return true;
        return !r.otherResource;
    };
    const embedded = relations.filter((r) => isReverse(r));
    const tabbed = relations.filter((r) => !isReverse(r));
    return { embedded, tabbed };
};

export const useViewConfigurations = (modelName: string | undefined, viewType: string) => {
    const apiUrl = useApiUrl();
    const [rows, setRows] = useState<ViewConfigRow[]>([]);
    const [loading, setLoading] = useState(!!modelName);

    useEffect(() => {
        if (!modelName) { setLoading(false); return; }
        let isMounted = true;
        const fetchConfig = async () => {
            setLoading(true);
            try {
                const response = await authenticatedFetch(`${apiUrl}/views/configurations/${modelName}?view_type=${viewType}`);
                if (!response.ok) {
                    if (isMounted) setRows([]);
                    return;
                }
                const data = await response.json();
                if (isMounted) setRows(Array.isArray(data) ? data : []);
            } catch (error) {
                if (isMounted) setRows([]);
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchConfig();
        return () => {
            isMounted = false;
        };
    }, [apiUrl, modelName, viewType]);

    return { rows, loading };
};

export type GeneralActionsButtonPosition = "top-right" | "left" | "right";

export type ViewSettings = {
    showViewType: string;
    editViewType: string;
    listViewType: string;
    fileListViewType: string;
    galleryImageWidth: number;
    galleryImageHeight: number;
    relationsMaxRowsToLoad: number;
    maxDistinctColumnFilterValuesToRanges: number;
    modulesColorSchema: string;
    modelsColorSchema: string;
    generalActionsButtonPosition: GeneralActionsButtonPosition;
    addTabsForNonConfiguredRelations: boolean;
};

const normalizeActionsPosition = (raw: unknown): GeneralActionsButtonPosition => {
    const v = String(raw || "").trim().toLowerCase();
    if (v === "left" || v === "right") return v;
    return "top-right";
};

export const useViewSettings = (): { settings: ViewSettings | null; loading: boolean } => {
    const apiUrl = useApiUrl();
    const [settings, setSettings] = useState<ViewSettings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        const fetchSettings = async () => {
            try {
                const response = await authenticatedFetch(`${apiUrl}/config/views`);
                if (!response.ok) { if (!cancelled) setLoading(false); return; }
                const data = await response.json();
                if (cancelled) return;

                const modulesColorSchema = String(data?.modulesColorSchema || "plain-color");
                const modelsColorSchema = String(data?.modelsColorSchema || "plain-color");
                const plainColorBaseHex = String(data?.plainColorBaseHex || "");

                setColorSchemas({ modulesColorSchema, modelsColorSchema, plainColorBaseHex });

                setSettings({
                    showViewType: String(data?.showViewType || ""),
                    editViewType: String(data?.editViewType || ""),
                    listViewType: String(data?.listViewType || ""),
                    fileListViewType: String(data?.fileListViewType || ""),
                    galleryImageWidth: Number(data?.galleryImageWidth || 180),
                    galleryImageHeight: Number(data?.galleryImageHeight || 140),
                    relationsMaxRowsToLoad: Number(data?.relationsMaxRowsToLoad || 1000),
                    maxDistinctColumnFilterValuesToRanges: Number(data?.maxDistinctColumnFilterValuesToRanges ?? 20),
                    modulesColorSchema,
                    modelsColorSchema,
                    generalActionsButtonPosition: normalizeActionsPosition(data?.generalActionsButtonPosition),
                    addTabsForNonConfiguredRelations: data?.addTabsForNonConfiguredRelations !== false,
                });
            } catch {
                if (!cancelled) setSettings(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchSettings();
        return () => {
            cancelled = true;
        };
    }, [apiUrl]);

    return { settings, loading };
};

// Builds a default layout from a model's fields and relations.
// Fields go in a single "Details" section; each relation gets its own section cell.
// Used when no explicit ViewConfigRow config exists so the grid always renders.
export const synthesizeConfigRows = (model: ModelDef, mode: "show" | "edit" = "show"): ViewConfigRow[] => {
    const formType = mode === "show" ? "show" : "edit";

    const fieldRows: ViewConfigRow[] = model.fields
        .filter((f) => !f.isPk)
        .map((field, idx) => ({
            view_type: "PrimaryView",
            subject_name: model.name,
            relation_name: "",
            object_name: field.key,
            form_type: formType,
            section: DETAILS_TAB_NAME,
            section_id: "details",
            section_grid_row: 1,
            section_grid_col: 1,
            tab_name: null,
            row: idx + 1,
            column: 1,
            show_label: true,
            attribute_or_relation_type: "attribute" as const,
            name: field.key,
        }));

    // Each relation gets its own section cell, stacked below the fields.
    // Backward (reverse) relations appear first since they were previously shown in Details;
    // forward (tabbed) relations follow since they were previously shown in their own tabs.
    const { embedded, tabbed } = splitRelations(model.relations);
    const orderedRelations = [...embedded, ...tabbed];
    const relationRows: ViewConfigRow[] = orderedRelations.map((rel, idx) => {
        const relLabel = rel.label || rel.relationName || rel.resource || "";
        const relKey = rel.relationName || rel.resource || String(idx);
        const relName = rel.relationName || rel.resource || "";
        return {
            view_type: "PrimaryView",
            subject_name: model.name,
            relation_name: relName,
            object_name: rel.resource || "",
            form_type: formType,
            section: relLabel,
            section_id: `rel::${relKey}`,
            section_grid_row: idx + 2, // 1-based; fields section occupies row 1
            section_grid_col: 1,
            tab_name: null,
            row: 1,
            column: 1,
            show_label: false, // section card title already shows the relation name
            attribute_or_relation_type: "relation" as const,
            name: relName,
        };
    });

    return [...fieldRows, ...relationRows];
};

export const filterConfigRowsForMode = (rows: ViewConfigRow[], mode: "show" | "edit") => {
    if (rows.length === 0) return rows;
    const allowedTypes = mode === "show"
        ? new Set(["attributes", "details", "show"])
        : new Set(["main", "edit", "attributes"]);
    const filtered = rows.filter((row) =>
        // Only include rows whose form_type matches the current mode.
        // Rows without form_type (legacy / manually authored) are included.
        allowedTypes.has((row.form_type || "").trim().toLowerCase())
        || (!row.tab_name && !row.form_type)
    );
    return filtered.length > 0 ? filtered : rows;
};

export const groupConfigRowsBySection = (rows: ViewConfigRow[]) => {
    const groups = new Map<string, ViewConfigRow[]>();
    rows.forEach((row) => {
        const key = row.section || DETAILS_TAB_NAME;
        const existing = groups.get(key) || [];
        existing.push(row);
        groups.set(key, existing);
    });
    return groups;
};

export const groupConfigRowsBySectionId = (rows: ViewConfigRow[]): Map<string, { name: string; rows: ViewConfigRow[] }> => {
    const groups = new Map<string, { name: string; rows: ViewConfigRow[] }>();
    rows.forEach((row) => {
        const key = row.section_id || row.section || DETAILS_TAB_NAME;
        const name = row.section || DETAILS_TAB_NAME;
        if (!groups.has(key)) groups.set(key, { name, rows: [] });
        groups.get(key)!.rows.push(row);
    });
    return groups;
};

export type NormalizedViewConfigRow = ViewConfigRow & { _order: number; row: number; column: number };

export const normalizeSectionRows = (rows: ViewConfigRow[]): NormalizedViewConfigRow[] => {
    const normalized = rows.map((row, index) => ({
        ...row,
        _order: index,
        row: row.row ?? index + 1,
        column: row.column ?? 1,
    }));
    normalized.sort((a, b) => {
        if (a.row !== b.row) return a.row - b.row;
        if (a.column !== b.column) return a.column - b.column;
        return a._order - b._order;
    });
    return normalized;
};

export const resolveFieldFromConfig = (model: ModelDef, item: ViewConfigRow): FieldDef => {
    const existing = model.fields.find((field) => field.key === item.object_name || field.key === item.name);
    if (existing) return existing;
    const key = item.object_name || item.name;
    return {
        key,
        label: _(key),
        type: "string",
    };
};

export const buildRelationNameVariants = (rawName: string) => {
    const name = rawName.toLowerCase();
    if (!name) return [];
    if (name.endsWith("_reverse")) {
        return [name, name.replace(/_reverse$/, "")];
    }
    return [name, `${name}_reverse`];
};

export const findRelationContextForModel = (model: ModelDef, allModels?: ModelDef[]) => {
    if (!allModels) return null;
    const modelResourceKey = resolveResourcePath(model.resource || model.name, allModels);
    for (const parentModel of allModels) {
        for (const rel of parentModel.relations || []) {
            const relResourceKey = resolveResourcePath(rel.resource, allModels);
            if (relResourceKey === modelResourceKey || rel.resourcePath === modelResourceKey) {
                return { rel, parentModel };
            }
        }
    }
    return null;
};

export const applyRelationFieldOverrides = (model: ModelDef, allModels?: ModelDef[]) => {
    const relationContext = findRelationContextForModel(model, allModels);
    if (!relationContext) return model.fields;
    const { rel, parentModel } = relationContext;
    return model.fields.map((field) => {
        if (field.reference) return field;
        if (rel.targetKey && field.key === rel.targetKey) {
            return {
                ...field,
                reference: parentModel.name,
                referencePath: parentModel.resource,
                optionLabel: field.optionLabel || "_label",
            };
        }
        if (rel.otherKey && field.key === rel.otherKey) {
            return {
                ...field,
                reference: rel.otherResource || field.reference,
                referencePath: rel.otherResourcePath,
                optionLabel: field.optionLabel || "_label",
            };
        }
        return field;
    });
};

export const resolveRelationFromConfig = (relations: RelationDef[] | undefined, item: ViewConfigRow) => {
    if (!relations) return undefined;
    const target = (item.relation_name || "").toLowerCase();
    const targetVariants = new Set(buildRelationNameVariants(target));
    // Exact match first so forward and reverse entries resolve to distinct RelationDefs
    const exact = relations.find((rel) =>
        (rel.relationName || "").toLowerCase() === target
        || (rel.resource || "").toLowerCase() === target
        || (rel.label || "").toLowerCase() === target
    );
    if (exact) return exact;
    const byVariant = relations.find((rel) =>
        targetVariants.has((rel.relationName || "").toLowerCase())
        || targetVariants.has((rel.resource || "").toLowerCase())
        || targetVariants.has((rel.label || "").toLowerCase())
    );
    if (byVariant) return byVariant;
    // Fallback: match the relation's resourcePath base name (the link table with
    // the trailing "_relation" stripped — the canonical forward relation
    // identifier, always present). This resolves forward link relations whose
    // generated schema has no relationName because the other model declares no
    // reverse relationship (e.g. Item.item_has_images -> File). Runs only after
    // the relationName/resource/label checks above, so existing matches are
    // unchanged.
    const relPathBase = (rel: RelationDef) =>
        String(rel.resourcePath || "").toLowerCase().replace(/_relation$/, "");
    return relations.find((rel) =>
        relPathBase(rel) === target || targetVariants.has(relPathBase(rel))
    );
};

export const buildConfiguredRelationKeys = (rows: ViewConfigRow[]) => {
    const keys = new Set<string>();
    rows
        .filter((row) => row.attribute_or_relation_type === "relation")
        .forEach((row) => {
            const raw = (row.relation_name || "").toLowerCase();
            buildRelationNameVariants(raw).forEach((name) => {
                if (name) keys.add(name);
            });
        });
    return keys;
};

export const relationMatchesConfigured = (rel: RelationDef, configuredKeys: Set<string>) => {
    const candidates = [
        rel.relationName,
    ]
        .filter(Boolean)
        .flatMap((value) => buildRelationNameVariants(String(value)));
    return candidates.some((value) => configuredKeys.has(value));
};

export const getRelationIdentityKeys = (rel: RelationDef): string[] => {
    const base = [
        String(rel.relationName || "").trim().toLowerCase(),
        String(rel.resource || "").trim().toLowerCase(),
    ].filter(Boolean);
    return Array.from(new Set(base.flatMap((value) => buildRelationNameVariants(value))));
};

export const buildConfiguredResolvedRelationKeys = (relations: RelationDef[] | undefined, rows: ViewConfigRow[]) => {
    const keys = new Set<string>();
    rows
        .filter((row) => row.attribute_or_relation_type === "relation")
        .forEach((row) => {
            const resolved = resolveRelationFromConfig(relations, row);
            if (!resolved) return;
            getRelationIdentityKeys(resolved).forEach((key) => keys.add(key));
        });
    return keys;
};

export const normalizeLooseRelationKey = (value: string) => value.toLowerCase().replace(/[\s_-]+/g, "");

export const buildConfiguredRelationDisplayKeys = (relations: RelationDef[] | undefined, rows: ViewConfigRow[]) => {
    const keys = new Set<string>();
    rows
        .filter((row) => row.attribute_or_relation_type === "relation")
        .forEach((row) => {
            const rawRelationName = String(row.relation_name || "").trim();
            if (rawRelationName) keys.add(normalizeLooseRelationKey(rawRelationName));
            const resolved = resolveRelationFromConfig(relations, row);
            if (!resolved) return;
            const label = getRelationLabel(resolved) || resolved.label || resolved.relationName || resolved.resource || "";
            if (label) keys.add(normalizeLooseRelationKey(label));
        });
    return keys;
};

export const isRelationConfiguredForDetails = (
    rel: RelationDef,
    configuredResolvedRelationKeys: Set<string>,
    configuredRelationKeys: Set<string>,
    configuredDisplayKeys: Set<string>,
) => {
    if (relationMatchesConfigured(rel, configuredResolvedRelationKeys)) return true;
    if (relationMatchesConfigured(rel, configuredRelationKeys)) return true;
    const label = getRelationLabel(rel) || rel.label || rel.relationName || rel.resource || "";
    return configuredDisplayKeys.has(normalizeLooseRelationKey(label));
};

export const getConfigVid = (item: ViewConfigRow, mode: "show" | "edit") => {
    if (mode === "show") {
        return item.show_vid ?? item.showVid ?? item.vid ?? "";
    }
    return item.edit_vid ?? item.editVid ?? item.vid ?? "";
};

export const isAttributeValueEditable = (item: ViewConfigRow | undefined, mode: "show" | "edit"): boolean => {
    if (!item) return true;
    const raw = String(getConfigVid(item, mode) || "").trim();
    const fieldToken = normalizeFieldViewType(raw);
    if (fieldToken) return fieldToken.startsWith("editable-");
    const vid = raw.toLowerCase().replace(/[\s_-]/g, "");
    if (vid === "readonly") return false;
    return true;
};

export const normalizeRelationViewType = (rawVid: string): RelationViewType | "" => {
    const normalized = String(rawVid || "")
        .trim()
        .toLowerCase()
        .replace(/[\s_-]/g, "")
        .replace(/view$/, "");
    if (normalized === "table") return "table";
    if (normalized === "editabletable" || normalized === "editable") return "editable-table";
    if (normalized === "crosstab") return "crosstab";
    if (normalized === "editablecrosstab") return "editable-crosstab";
    if (normalized === "editablelist") return "editable-list";
    if (normalized === "list") return "list";
    if (normalized === "csv") return "csv";
    if (normalized === "readandeditlist") return "read-and-edit-list";
    if (normalized === "readandeditcsv") return "read-and-edit-csv";
    if (normalized === "editablecsv") return "editable-csv";
    if (normalized === "gallery" || normalized === "image") return "gallery";
    if (normalized === "calendar" || normalized === "week" || normalized === "month") return "calendar";
    if (normalized === "primary") return "primary";
    if (normalized === "totalsdetails" || normalized === "totaldetails") return "totals-details";
    if (normalized === "tree") return "tree";
    if (normalized === "treedetails") return "tree-details";
    return "";
};

const FIELD_VIEW_TYPE_TOKENS = new Set([
    "read-only-field", "editable-field",
    "read-only-password", "editable-password",
    "read-only-textarea", "editable-textarea",
    "read-only-markdown", "editable-markdown",
    "read-only-json", "editable-json",
    "read-only-url", "editable-url",
    "read-only-email", "editable-email",
    "read-only-currency", "editable-currency",
    "read-only-percentage", "editable-percentage",
    "read-only-progress", "editable-progress",
    "read-only-rating", "editable-rating",
    "read-only-duration", "editable-duration",
    "read-only-phone", "editable-phone",
    "read-only-color", "editable-color",
    "read-only-code", "editable-code",
    "read-only-image-url", "editable-image-url",
    "read-only-qrcode",
    "read-only-relative",
    "read-only-truncated-text",
]);

export const normalizeFieldViewType = (raw: string): string => {
    const normalized = String(raw || "")
        .trim()
        .toLowerCase()
        .replace(/[\s_]/g, "-")
        .replace(/-+/g, "-");
    return FIELD_VIEW_TYPE_TOKENS.has(normalized) ? normalized : "";
};

export const applyRelationViewOverride = (rel: RelationDef, item: ViewConfigRow, mode: "show" | "edit") => {
    const rawVid = getConfigVid(item, mode);
    const trimmed = String(rawVid || "").trim();
    if (!trimmed) return rel;
    const vid = normalizeRelationViewType(trimmed);
    if (vid) {
        // If the original relation has a data-detail-level override that differs
        // from the config's view type, keep the slider-chosen value.
        const _DDL_TYPES = new Set(["csv","list","crosstab","totals-details","table",
            "editable-csv","editable-list","editable-crosstab","editable-table"]);
        const orig = mode === "show" ? (rel as any).showViewType : (rel as any).editViewType;
        const relKey = rel.relationName || rel.resource || rel.label || "?";
        if (orig && orig !== vid && _DDL_TYPES.has(orig)) {
            ddlTrace("applyRelationViewOverride KEEP-SLIDER", { relKey, mode, orig, configVid: vid, fromCsv: (rel as any).showViewTypeFromCsv });
            return rel;
        }
        ddlTrace("applyRelationViewOverride APPLY-CONFIG", { relKey, mode, orig: orig ?? null, configVid: vid });
        return mode === "show"
            ? { ...rel, showViewType: vid as RelationViewType, showViewTypeFromCsv: true }
            : { ...rel, editViewType: vid as RelationViewType, editViewTypeFromCsv: true };
    }
    ddlTrace("applyRelationViewOverride CUSTOM-PAGE", { relKey: rel.relationName || rel.resource || rel.label || "?", mode, trimmed });
    return mode === "show"
        ? { ...rel, showViewType: "primary" as RelationViewType, showViewTypeFromCsv: true, showCustomPageName: trimmed }
        : { ...rel, editViewType: "primary" as RelationViewType, editViewTypeFromCsv: true, editCustomPageName: trimmed };
};
