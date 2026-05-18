import type { FieldDef, RelationDef, ModelDef } from "../types";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export const asDisplayText = (value: any, fallback = ""): string => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed || fallback;
    }
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return fallback;
};

export const translateText = (key: string, fallback?: string): string => {
    const safeKey = asDisplayText(key, "");
    if (!safeKey) return fallback ?? "";
    const translated = _(safeKey) as any;
    return asDisplayText(translated, fallback ?? safeKey);
};

const MODULE_LABEL_OVERRIDES: Record<string, string> = {
    pim: _("Items"),
    bsim: _("Business"),
    cusim: "Cusim",
    venim: "Venim",
    vendeals: "Vendeals",
    dismdm: _("Master Data"),
    prices: _("Prices"),
    pricing: _("Pricing"),
    inventory: _("Inventory"),
    supply: _("Supply"),
    supplychain: _("Supply Chain"),
    catman: _("Category Management"),
    conflictresolution: _("Resolution"),
    planscope: _("Plan Scope"),
    alloplan: _("Allocations"),
    pricingstrategy: _("Pricing Strategy"),
    catim: _("Catalog"),
    nlp: _("Natural Language"),
    dbquery: _("DB Query"),
};

export const getModuleLabel = (moduleName?: string) => {
    if (!moduleName) return "";
    const key = moduleName.toLowerCase();
    if (MODULE_LABEL_OVERRIDES[key]) return MODULE_LABEL_OVERRIDES[key];
    return translateText(moduleName, moduleName);
};

export const getFieldLabel = (field: FieldDef) => {
    const keySource = asDisplayText(field.key, "");
    if (keySource) {
        const keyTranslated = translateText(keySource, keySource);
        if (keyTranslated !== keySource) return keyTranslated;
    }
    const labelSource = asDisplayText(field.label, "");
    if (labelSource) {
        const labelTranslated = translateText(labelSource, labelSource);
        if (labelTranslated !== labelSource) return labelTranslated;
    }
    return labelSource || keySource;
};

// Returns a translation only from the primary (non-fallback) catalog.
// Avoids false positives where an English fallback entry causes translateRelationKey
// to skip the _reverse → base-key chain for keys that exist only in English.
const primaryTranslate = (key: string): string | null => {
    const fn = (window as any).__jmPrimaryTranslate;
    return typeof fn === "function" ? (fn(key) ?? null) : null;
};

export const translateRelationKey = (rawKey?: string) => {
    const key = String(rawKey || "").trim();
    if (!key) return "";

    if (key.endsWith("_reverse")) {
        const base = key.replace(/_reverse$/, "");

        // Prefer a primary-catalog match (Spanish) on the direct key.
        const primaryDirect = primaryTranslate(key);
        if (primaryDirect) return primaryDirect;

        // Try primary-catalog match on base keys before falling back to English.
        const primaryObject = primaryTranslate(`${base}_object`);
        if (primaryObject) return primaryObject;

        const primaryBase = primaryTranslate(base);
        if (primaryBase) return primaryBase;

        // No primary translation — use full lookup (may be English fallback).
        const direct = translateText(key, key);
        if (direct !== key) return direct;

        const objectTranslated = translateText(`${base}_object`, `${base}_object`);
        if (objectTranslated !== `${base}_object`) return objectTranslated;

        const baseTranslated = translateText(base, base);
        if (baseTranslated !== base) return baseTranslated;

        return key;
    }

    return translateText(key, key);
};

export const getRelationLabel = (rel: RelationDef) => {
    const relationKey = String(rel.relationName || rel.resource || "").trim();
    if (!relationKey) return _(rel.label || "");

    const translatedByKey = translateRelationKey(relationKey);
    if (translatedByKey && translatedByKey !== relationKey) return translatedByKey;

    const withoutRelationSuffix = relationKey.replace(/_relation$/, "");
    if (withoutRelationSuffix && withoutRelationSuffix !== relationKey) {
        const translatedWithoutSuffix = translateRelationKey(withoutRelationSuffix);
        if (translatedWithoutSuffix && translatedWithoutSuffix !== withoutRelationSuffix) {
            return translatedWithoutSuffix;
        }
    }

    if (relationKey.endsWith("_object")) {
        const baseKey = relationKey.replace(/_object$/, "");
        const translatedBaseKey = translateRelationKey(baseKey);
        if (translatedBaseKey && translatedBaseKey !== baseKey) return translatedBaseKey;
    }

    return asDisplayText(relationKey, asDisplayText(rel.label, relationKey));
};

export const getModelLabel = (model: Pick<ModelDef, "name" | "label">) => {
    const primary = asDisplayText(model.label, "");
    const fallback = asDisplayText(model.name, "");
    const key = primary || fallback;
    return translateText(key, key || "Record");
};

export const applyI18nLabelsToModel = (model?: ModelDef) => {
    if (!model) return;
    model.label = getModelLabel(model);
    (model.fields || []).forEach((field) => {
        field.label = getFieldLabel(field);
    });
    (model.relations || []).forEach((rel) => {
        rel.label = getRelationLabel(rel);
    });
};

export const applyI18nLabelsToModels = (models?: ModelDef[]) => {
    (models || []).forEach((model) => applyI18nLabelsToModel(model));
};
