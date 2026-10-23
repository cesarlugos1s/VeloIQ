/**
 * The one merge of generated model schemas with their hand-written overrides.
 *
 * Every `<module>Schema.ts` that `veloiq generate` writes (in the app's own UI,
 * and per external portal) is the generated models (`<module>Schema.gen.ts`)
 * with overrides applied in order: an extension's own overrides
 * (`<module>Schema.extensionOverrides.ts`), then the app's or portal's
 * `<module>Schema.manual.ts`. Keeping the merge here, instead of as code
 * written into each generated file, means a new override option (such as
 * `omit`) reaches every app and portal with a package update.
 *
 *     export const tasksModels = mergeUiModelSchemas(tasksModelsGen, tasksManualOverrides);
 */
import type { FieldDef, ModelDef, RelationDef } from "../components/DynamicResource/types";

/** Changes to one field of a model (matched by `key`), or a field the generated model doesn't have. */
export type FieldOverride = Partial<FieldDef> & Pick<FieldDef, "key"> & {
    /** Leaves the field out of the model's pages (e.g. a field a portal role may read but its pages don't show). */
    omit?: boolean;
};

/** Changes to one relation (matched by `resource`, else by `label`), or a relation to add. */
export type RelationOverride = Partial<RelationDef> & ({ resource: string } | { label: string }) & {
    /** Leaves the relation out of the model's pages (e.g. rows a portal's users may not open). */
    omit?: boolean;
};

/** Changes to one model (matched by `name`), or a model the generated schema doesn't have. */
export type ModelOverride = Partial<Omit<ModelDef, "fields" | "relations">> & {
    name: string;
    fields?: FieldOverride[];
    relations?: RelationOverride[];
};

/** A field added by an override (not in the generated model). */
const fieldFromOverride = (override: FieldOverride): FieldDef => {
    const { omit: _omitted, ...field } = override;
    return { label: field.key, type: "string", ...field } as FieldDef;
};

/** The model's fields with the overrides applied: changed, added, or left out (`omit`). */
const mergeFields = (base: FieldDef[], overrides?: FieldOverride[]): FieldDef[] => {
    if (!overrides || overrides.length === 0) return base;
    let merged = [...base];
    for (const override of overrides) {
        if (override.omit) {
            merged = merged.filter((field) => field.key !== override.key);
            continue;
        }
        const { omit: _omitted, ...changes } = override;
        const index = merged.findIndex((field) => field.key === override.key);
        if (index >= 0) merged[index] = { ...merged[index], ...changes };
        else merged.push(fieldFromOverride(override));
    }
    return merged;
};

/** The key a relation override is matched by. */
const relationKey = (relation: RelationDef | RelationOverride): string | undefined =>
    "resource" in relation && relation.resource ? relation.resource : relation.label;

/** The model's relations with the overrides applied: changed, added, or left out (`omit`). */
const mergeRelations = (base: RelationDef[] | undefined, overrides?: RelationOverride[]): RelationDef[] | undefined => {
    if (!overrides || overrides.length === 0) return base;
    let merged = base ? [...base] : [];
    for (const override of overrides) {
        const key = relationKey(override);
        if (override.omit) {
            merged = merged.filter((relation) => relationKey(relation) !== key);
            continue;
        }
        const { omit: _omitted, ...changes } = override;
        const index = key ? merged.findIndex((relation) => relationKey(relation) === key) : -1;
        if (index >= 0) merged[index] = { ...merged[index], ...changes } as RelationDef;
        else merged.push(changes as RelationDef);
    }
    return merged;
};

/** One model with one override applied. */
const mergeModel = (base: ModelDef, override?: ModelOverride): ModelDef => {
    if (!override) return base;
    return {
        ...base,
        ...override,
        fields: mergeFields(base.fields, override.fields),
        relations: mergeRelations(base.relations, override.relations),
    } as ModelDef;
};

/**
 * Return the generated models with each list of overrides applied in order
 * (later lists win), followed by the models only the overrides declare.
 *
 * @param generatedModels The models of `<module>Schema.gen.ts`.
 * @param overrideLists   Override lists, e.g. an extension's own, then the app's manual overrides.
 */
export function mergeUiModelSchemas(generatedModels: ModelDef[], ...overrideLists: ModelOverride[][]): ModelDef[] {
    const applyOverrides = (model: ModelDef): ModelDef =>
        overrideLists.reduce((merged, overrides) => mergeModel(merged, overrides.find((override) => override.name === model.name)), model);

    const generatedNames = new Set(generatedModels.map((model) => model.name));
    const declaredOnlyNames = Array.from(new Set(
        overrideLists.flat().map((override) => override.name).filter((name) => !generatedNames.has(name)),
    ));
    const declaredOnlyModels = declaredOnlyNames.map((name) => {
        const first = overrideLists.flat().find((override) => override.name === name)!;
        return applyOverrides({
            name,
            label: first.label ?? name,
            resource: first.resource ?? name.toLowerCase(),
            pkField: first.pkField ?? "id",
            fields: [],
        } as ModelDef);
    });
    return [...generatedModels.map(applyOverrides), ...declaredOnlyModels];
}
