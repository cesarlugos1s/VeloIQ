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
    {
        name: 'TeamMember',
        fields: [
            { key: 'email', showViewType: 'read-only-email', editViewType: 'editable-email' },
            { key: 'phone', showViewType: 'read-only-phone', editViewType: 'editable-phone' },
            {
                key: 'role',
                options: [
                    { label: 'Admin', value: 'admin' },
                    { label: 'Member', value: 'member' },
                    { label: 'Viewer', value: 'viewer' },
                ],
                valueColors: { admin: 'volcano', member: 'blue', viewer: 'lime' },
            },
            { key: 'created_at', showViewType: 'read-only-relative' },
            { key: 'updated_at', showViewType: 'read-only-relative' },
        ],
    },
];
