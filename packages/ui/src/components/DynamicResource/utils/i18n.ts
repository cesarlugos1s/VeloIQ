import type { FieldDef, RelationDef, ModelDef } from "../types";

// i18n helper — resolved at CALL time so window._ is always current.
// window._ is injected by the host app's main.tsx (loadLocale) at page load;
// capturing it at module-load time (the old form) froze the identity fallback
// in place before translations were available, so no UI text translated.
const _ = (text: string): string => {
    const t = (window as any)._;
    return typeof t === "function" ? (t(text) as string) : text;
};

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

// Module name → English source label. Translated lazily at call time inside
// getModuleLabel so the active locale's catalog is used. (The old form
// pre-translated these at module load with the identity fallback, freezing
// them to English before window._ was populated.)
const MODULE_LABEL_OVERRIDES: Record<string, string> = {
    pim: "Items",
    bsim: "Business",
    cusim: "Cusim",
    venim: "Venim",
    vendeals: "Vendeals",
    dismdm: "Master Data",
    prices: "Prices",
    pricing: "Pricing",
    inventory: "Inventory",
    supply: "Supply",
    supplychain: "Supply Chain",
    catman: "Category Management",
    conflictresolution: "Resolution",
    planscope: "Plan Scope",
    alloplan: "Allocations",
    pricingstrategy: "Pricing Strategy",
    catim: "Catalog",
    nlp: "Natural Language",
    dbquery: "DB Query",
};

export const getModuleLabel = (moduleName?: string) => {
    if (!moduleName) return "";
    const key = moduleName.toLowerCase();
    const override = MODULE_LABEL_OVERRIDES[key];
    if (override) return translateText(override, override);
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

    // Prefer an explicit label (e.g. from a named query's ModelDef) over the raw
    // resource/relation key, which may be a technical slug like "projects_with_tasks_and_members".
    return asDisplayText(rel.label, asDisplayText(relationKey, "")) || relationKey;
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
