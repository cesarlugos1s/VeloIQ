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
