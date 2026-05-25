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

export const projectsManualOverrides: ModelOverride[] = [
    {
        name: 'Project',
        fields: [
            { key: 'description', showViewType: 'read-only-markdown', editViewType: 'editable-markdown' },
        ],
    },
];
