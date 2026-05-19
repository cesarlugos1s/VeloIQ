// AUTO-GENERATED — do not edit. Run `veloiq generate` to update.
import type { ModelDef } from '@veloiq/ui';

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
      { key: "owner_id", label: "Owner Id", type: "number", reference: "team_member" },
      { key: "created_at", label: "Created At", type: "datetime" },
      { key: "updated_at", label: "Updated At", type: "datetime" },
    ],
    relations: [
      { resource: "task", targetKey: "project_id", label: "Tasks" },
    ],
  },
];

export default projectsModels;
