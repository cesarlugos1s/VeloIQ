// AUTO-GENERATED — do not edit. Sync from VeloIQ extension schema pipeline.
import { nlpModelsGen } from './nlpSchema.gen';
import { nlpManualOverrides } from './nlpSchema.manual';
import type { ModelDef } from '@juicemantics/veloiq-ui';

type FieldDef = ModelDef['fields'][number];
type RelationDef = NonNullable<ModelDef['relations']>[number];
type FieldOverride = Partial<FieldDef> & Pick<FieldDef, 'key'>;
type RelationOverride = Partial<RelationDef> & ({ resource: string } | { label: string });
type ModelOverride = Partial<Omit<ModelDef, 'fields' | 'relations'>> & {
    name: string;
    fields?: FieldOverride[];
    relations?: RelationOverride[];
};

const defaultField = (override: FieldOverride): FieldDef => ({
    key: override.key, label: override.label ?? override.key, type: override.type ?? 'string', ...override,
});
const mergeFields = (base: FieldDef[], overrides?: FieldOverride[]): FieldDef[] => {
    if (!overrides || overrides.length === 0) return base;
    const merged = [...base];
    for (const o of overrides) {
        const idx = merged.findIndex((f) => f.key === o.key);
        if (idx >= 0) merged[idx] = { ...merged[idx], ...o };
        else merged.push(defaultField(o));
    }
    return merged;
};
const relationKey = (r: RelationDef | RelationOverride) =>
    'resource' in r && r.resource ? r.resource : r.label;
const mergeRelations = (base: RelationDef[] | undefined, overrides?: RelationOverride[]): RelationDef[] | undefined => {
    if (!overrides || overrides.length === 0) return base;
    const merged = base ? [...base] : [];
    for (const o of overrides) {
        const key = relationKey(o);
        if (!key) { merged.push(o as RelationDef); continue; }
        const idx = merged.findIndex((r) => relationKey(r) === key);
        if (idx >= 0) merged[idx] = { ...merged[idx], ...o } as RelationDef;
        else merged.push(o as RelationDef);
    }
    return merged;
};
const mergeModel = (base: ModelDef, override?: ModelOverride): ModelDef => {
    if (!override) return base;
    return { ...base, ...override, fields: mergeFields(base.fields, override.fields), relations: mergeRelations(base.relations, override.relations) };
};

const baseNames = new Set(nlpModelsGen.map((m) => m.name));
const extraModels: ModelDef[] = nlpManualOverrides
    .filter((o) => !baseNames.has(o.name))
    .map((o) => ({ name: o.name, label: o.label ?? o.name, resource: o.resource ?? o.name.toLowerCase(), pkField: o.pkField ?? 'id', fields: mergeFields([], o.fields), relations: mergeRelations(undefined, o.relations), ...o }));

export const nlpModels: ModelDef[] = [
    ...nlpModelsGen.map((m) => mergeModel(m, nlpManualOverrides.find((o) => o.name === m.name))),
    ...extraModels,
];

export default nlpModels;
