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
            {
                key: 'status',
                options: [
                    { label: 'Active', value: 'active' },
                    { label: 'Completed', value: 'completed' },
                    { label: 'Archived', value: 'archived' },
                ],
                valueColors: { active: 'green', completed: 'blue', archived: 'default' },
            },
            { key: 'created_at', showViewType: 'read-only-relative' },
            { key: 'updated_at', showViewType: 'read-only-relative' },
        ],
    },
    {
        name: 'ProjectsWithTasksAndMembers',
        fields: [
            {
                key: 'project_status',
                options: [
                    { label: 'Active', value: 'active' },
                    { label: 'Completed', value: 'completed' },
                    { label: 'Archived', value: 'archived' },
                ],
                valueColors: { active: 'green', completed: 'blue', archived: 'default' },
            },
            {
                key: 'task_status',
                options: [
                    { label: 'To Do', value: 'todo' },
                    { label: 'In Progress', value: 'in_progress' },
                    { label: 'Done', value: 'done' },
                ],
                valueColors: { todo: 'default', in_progress: 'blue', done: 'green' },
            },
        ],
    },
];
