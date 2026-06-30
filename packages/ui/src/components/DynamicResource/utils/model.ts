import type { FieldDef, ModelDef, RelationDef } from "../types";

/**
 * Return the primary-key value for a record.
 * When the model's fields are available the isPk-marked field is used;
 * otherwise falls back to record.eid → record.id for backward compatibility.
 */
export const getRecordId = (record: any, fields?: FieldDef[]): any => {
    if (!record) return undefined;
    if (fields) {
        const pkField = fields.find((f) => f.isPk);
        if (pkField) return record[pkField.key];
    }
    return record.eid ?? record.id;
};

/**
 * True when a field is the model's primary key. Detected by metadata
 * (FieldDef.isPk or ModelDef.pkField) rather than a hardcoded field name, so
 * framework consumers can name their PK field however they like (eid, id, …).
 */
export const isPkField = (field: FieldDef, model?: ModelDef): boolean => {
    if (field.isPk === true) return true;
    if (model?.pkField != null && field.key === model.pkField) return true;
    return false;
};

/**
 * True when a field is a foreign key (references another model). Detected by
 * the `reference` metadata rather than a hardcoded name (eid_to, eid_from, …).
 */
export const isReferenceField = (field: FieldDef): boolean => !!field.reference;

export const getListViewFields = (model: ModelDef, filterField?: string) => {
    const baseFields = filterField ? model.fields.filter((field) => field.key !== filterField) : model.fields;
    return baseFields.slice(0, 6);
};

export const hasReferenceModel = (reference?: string, allModels?: ModelDef[]) => {
    if (!reference || !allModels) return false;
    const target = reference.toLowerCase();
    return allModels.some((model) =>
        model.name.toLowerCase() === target ||
        (model.label && model.label.toLowerCase() === target) ||
        (model.resource && model.resource.toLowerCase() === target)
    );
};

export const normalizeModelKey = (value: string) => {
    let normalized = String(value || "").trim();
    if (!normalized) return "";
    if (normalized.includes(".")) {
        normalized = normalized.split(".").pop() || normalized;
    }
    if (normalized.includes("/")) {
        normalized = normalized.split("/").pop() || normalized;
    }
    normalized = normalized.replace(/^cw_/i, "");
    normalized = normalized.replace(/[^a-z0-9]/gi, "");
    return normalized.toLowerCase();
};

export const resolveModelByEntityType = (allModels: ModelDef[], typeValue?: string | null) => {
    if (!typeValue) return undefined;
    const target = normalizeModelKey(typeValue);
    if (!target) return undefined;
    return allModels.find((model) => {
        const nameKey = normalizeModelKey(model.name);
        const labelKey = normalizeModelKey(model.label);
        return nameKey === target || labelKey === target;
    });
};

export const matchesPolymorphicType = (rel: RelationDef, typeValue?: string | null) => {
    if (!rel.polymorphicType) return true;
    if (!typeValue) return false;
    return String(typeValue).toLowerCase() === String(rel.polymorphicType).toLowerCase();
};

export const isFileModel = (model?: ModelDef) => {
    const name = (model?.name || "").toLowerCase();
    return name === "file";
};

export const findModelByName = (models: ModelDef[] | undefined, name?: string) => {
    if (!models || !name) return undefined;
    const target = name.toLowerCase();
    const normalizedTarget = normalizeModelKey(name);
    return models.find((model) => {
        if (model.name.toLowerCase() === target) return true;
        if (model.label.toLowerCase() === target) return true;
        if (model.resource && model.resource.toLowerCase() === target) return true;
        if (normalizedTarget) {
            const nameKey = normalizeModelKey(model.name);
            const labelKey = normalizeModelKey(model.label);
            const resourceKey = normalizeModelKey(model.resource || "");
            if (nameKey === normalizedTarget || labelKey === normalizedTarget || resourceKey === normalizedTarget) return true;
        }
        return false;
    });
};

export const resolveResourcePath = (name: string | undefined, allModels?: ModelDef[]) => {
    if (!name) return "";
    const model = findModelByName(allModels, name);
    if (model?.resource) return model.resource;
    if (model?.name) return model.name.toLowerCase();
    return name.toLowerCase();
};

export const resolveModelName = (name: string | undefined, allModels?: ModelDef[]) => {
    if (!name) return "";
    const model = findModelByName(allModels, name);
    return model?.name || name;
};

export const getPolymorphicReferenceInfo = (rel: RelationDef, relationModel: ModelDef, allModels?: ModelDef[]) => {
    if (!rel.otherKey || rel.otherResource || !allModels) return null;
    const field = relationModel.fields.find((f: FieldDef) => f.key === rel.otherKey);
    if (!field?.reference) return null;
    const referenceModel = findModelByName(allModels, field.reference);
    if (!referenceModel) return null;
    const hasTypeField = referenceModel.fields.some((f: FieldDef) => f.key === "type");
    if (!hasTypeField) return null;
    return { referenceResource: resolveResourcePath(field.referencePath || field.reference, allModels), referenceModel };
};

export const getRecordDisplayLabel = (record: any) => {
    if (!record) return "-";
    if (record._label !== undefined && record._label !== null) return String(record._label);
    if (record.label !== undefined && record.label !== null) return String(record.label);
    if (record.name !== undefined && record.name !== null) return String(record.name);
    if (record.title !== undefined && record.title !== null) return String(record.title);
    const id = record.eid ?? record.id;
    return id !== undefined && id !== null ? String(id) : "-";
};



/** A relation that can be navigated to from a list page via the
 *  "Navigate to related" bulk action.  Aggregated from both
 *  RelationDef entries (forward ONETOMANY/MANYTOMANY) and FK
 *  reference fields (reverse navigation to parent models). */
export interface NavigableRelation {
    /** Target model resource name for the list page URL. */
    targetResource: string;
    /** Column on the TARGET model to filter by (PK for reverse, FK for forward). */
    filterKey: string;
    /** For reverse FK relations: the FK column on the SOURCE model to extract values from. */
    sourceValueKey?: string;
    /** Whether the FK is on the target model (forward) or source model (reverse). */
    isForward: boolean;
    /** i18n-translated label for the relation. */
    label: string;
    /** i18n-translated label for the target model. */
    modelLabel: string;
}


/**
 * Collect all navigable relations from a model.
 * Includes both forward ONETOMANY/MANYTOMANY relations (from model.relations)
 * and reverse FK references (from model.fields with reference attribute).
 */
export const getNavigableRelations = (
    model: ModelDef,
    allModels: ModelDef[],
): NavigableRelation[] => {
    const relations: NavigableRelation[] = [];
    const addedKeys = new Set<string>();

    // 1. Forward relations from model.relations (ONETOMANY, MANYTOMANY)
    if (model.relations) {
        for (const rel of model.relations) {
            // Only include non-recursive relations (recursive self-ref handled separately)
            if (rel.isRecursive && rel.resource === (model.resource || model.name)) {
                continue;
            }

            const targetResource = rel.otherResourcePath ||
                rel.otherResource ||
                rel.resourcePath ||
                rel.resource;
            if (!targetResource) continue;

            const targetModel = findModelByName(allModels, targetResource);
            if (!targetModel) continue;

            // For forward ONETOMANY: filterKey is the FK on the child =
            // target model (e.g. project_id on Task)
            const filterKey = rel.targetKey || rel.otherKey;
            if (!filterKey) continue;

            const uniqueKey = targetResource + '|' + filterKey;
            if (addedKeys.has(uniqueKey)) continue;
            addedKeys.add(uniqueKey);

            relations.push({
                targetResource,
                filterKey,
                isForward: true,
                label: rel.label || rel.relationName || targetResource,
                modelLabel: targetModel.label || targetModel.name,
            });
        }
    }

    // 2. Reverse FK references from model.fields (navigate to parent model)
    if (model.fields) {
        for (const field of model.fields) {
            if (!field.reference) continue;
            // Skip self-referential FKs (already handled or not useful for reverse)
            if (field.reference === (model.resource || model.name)) continue;
            // Skip if the reference is the same as a forward relation target
            const targetResource = field.referencePath || field.reference;
            if (!targetResource) continue;

            const targetModel = findModelByName(allModels, targetResource);
            if (!targetModel) continue;

            // For reverse FK: filterKey is the PK on the target (parent) model
            const filterKey = targetModel.pkField || 'id';
            const uniqueKey = targetResource + '|' + filterKey + '|reverse';
            if (addedKeys.has(uniqueKey)) continue;
            addedKeys.add(uniqueKey);

            relations.push({
                targetResource,
                filterKey,
                sourceValueKey: field.key,
                isForward: false,
                label: targetModel.label || targetModel.name,
                modelLabel: targetModel.label || targetModel.name,
            });
        }
    }

    return relations;
};
