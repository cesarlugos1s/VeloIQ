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

export const teamManualOverrides: ModelOverride[] = [
    // Add field/relation/model overrides here. This file is never overwritten by veloiq generate.
    // Examples:
    // {
    //     name: 'MyModel',
    //     fields: [
    //         // Override an existing field's view type:
    //         { key: 'description', showViewType: 'read-only-markdown', editViewType: 'editable-markdown' },
    //         // Add a new virtual field:
    //         { key: 'custom_field', label: 'Custom', type: 'string' },
    //     ],
    //     relations: [
    //         // Override a relation's label:
    //         { resource: 'task', label: 'Project Tasks' },
    //     ],
    // },
];
