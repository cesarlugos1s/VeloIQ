// AUTO-GENERATED — do not edit. Run `safem generate` to update.
import type { ModelDef } from '@safemantiq/ui';

export const teamModels: ModelDef[] = [
  {
    name: "TeamMember",
    label: "Team Member",
    resource: "team_member",
    pkField: "id",
    fields: [
      { key: "name", label: "Name", type: "string" },
      { key: "email", label: "Email", type: "string" },
      { key: "role", label: "Role", type: "string" },
      { key: "created_at", label: "Created At", type: "datetime" },
      { key: "updated_at", label: "Updated At", type: "datetime" },
    ],
    relations: [
      { resource: "project", targetKey: "owner_id", label: "Owned Projects" },
      { resource: "task", targetKey: "assignee_id", label: "Assigned Tasks" },
    ],
  },
];

export default teamModels;
