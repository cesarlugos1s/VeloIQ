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

export const tasksManualOverrides: ModelOverride[] = [
    {
        name: 'Task',
        fields: [
            { key: 'description', showViewType: 'read-only-markdown', editViewType: 'editable-markdown' },
            {
                key: 'status',
                options: [
                    { label: 'To Do', value: 'todo' },
                    { label: 'In Progress', value: 'in_progress' },
                    { label: 'Done', value: 'done' },
                ],
                valueColors: { todo: 'default', in_progress: 'blue', done: 'green' },
            },
            {
                key: 'priority',
                options: [
                    { label: 'Low', value: 'low' },
                    { label: 'Medium', value: 'medium' },
                    { label: 'High', value: 'high' },
                    { label: 'Critical', value: 'critical' },
                ],
                valueColors: { low: 'green', medium: 'gold', high: 'orange', critical: 'volcano' },
            },
            { key: 'planned_cost', showViewType: 'read-only-currency', editViewType: 'editable-currency' },
            { key: 'actual_cost', showViewType: 'read-only-currency', editViewType: 'editable-currency' },
            { key: 'actual_progress', showViewType: 'read-only-progress', editViewType: 'editable-progress' },
            { key: 'rating', showViewType: 'read-only-rating', editViewType: 'editable-rating' },
            { key: 'created_at', showViewType: 'read-only-relative' },
            { key: 'updated_at', showViewType: 'read-only-relative' },
        ],
    },
];
