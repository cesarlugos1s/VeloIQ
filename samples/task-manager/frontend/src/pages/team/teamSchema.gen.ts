// AUTO-GENERATED — do not edit. Run `veloiq generate` to update.
import type { ModelDef } from '@juicemantics/veloiq-ui';

export const teamModels: ModelDef[] = [
  {
    name: "TeamMember",
    label: "Team Member",
    resource: "team_member",
    pkField: "id",
    listViewType: "gallery",
    fields: [
      { key: "name", label: "Name", type: "string" },
      { key: "email", label: "Email", type: "string", showViewType: "read-only-email", editViewType: "editable-email" },
      { key: "role", label: "Role", type: "string" },
      { key: "phone", label: "Phone", type: "string", showViewType: "read-only-phone", editViewType: "editable-phone" },
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

export default teamModels;
