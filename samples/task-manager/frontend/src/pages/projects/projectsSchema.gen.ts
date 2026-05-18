// AUTO-GENERATED — do not edit. Run `safem generate` to update.
import type { ModelDef } from '@safemantiq/ui';

export const projectsModels: ModelDef[] = [
  {
    name: "Project",
    label: "Project",
    resource: "project",
    pkField: "id",
    fields: [
      { key: "name", label: "Name", type: "string" },
      { key: "description", label: "Description", type: "string" },
      { key: "status", label: "Status", type: "string" },
      { key: "owner_id", label: "Owner", type: "number", reference: "team_member" },
      { key: "created_at", label: "Created At", type: "datetime" },
      { key: "updated_at", label: "Updated At", type: "datetime" },
    ],
    relations: [
      { resource: "task", targetKey: "project_id", label: "Tasks" },
    ],
  },
];

export default projectsModels;
