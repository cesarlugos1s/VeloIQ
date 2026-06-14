// AUTO-GENERATED — do not edit. Run `veloiq generate` to update.
import type { ModelDef } from '@juicemantics/veloiq-ui';

export const teamModelsGen: ModelDef[] = [
  {
    name: "TeamMember",
    label: "Team Member",
    resource: "team_member",
    pkField: "id",
    listViewType: "gallery",
    fields: [
      { key: "name", label: "Name", type: "string", required: true },
      { key: "email", label: "Email", type: "string", required: true },
      { key: "role", label: "Role", type: "string", default: "member" },
      { key: "phone", label: "Phone", type: "string" },
      { key: "avatar_url", label: "Avatar Url", type: "image_url" },
      { key: "created_at", label: "Created At", type: "datetime" },
      { key: "updated_at", label: "Updated At", type: "datetime" },
    ],
    relations: [
      { resource: "project", targetKey: "owner_id", label: "Owned Projects" },
      { resource: "task", targetKey: "assignee_id", label: "Assigned Tasks" },
    ],
  },
];

export default teamModelsGen;
