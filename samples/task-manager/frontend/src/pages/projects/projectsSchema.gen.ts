// AUTO-GENERATED — do not edit. Run `veloiq generate` to update.
import type { ModelDef } from '@juicemantics/veloiq-ui';

export const projectsModelsGen: ModelDef[] = [
  {
    name: "Project",
    label: "Project",
    resource: "project",
    pkField: "id",
    fields: [
      { key: "name", label: "Name", type: "string", required: true },
      { key: "description", label: "Description", type: "string" },
      { key: "status", label: "Status", type: "string", default: "active" },
      { key: "owner_id", label: "Owner Id", type: "number", reference: "team_member" },
      { key: "created_at", label: "Created At", type: "datetime" },
      { key: "updated_at", label: "Updated At", type: "datetime" },
    ],
    relations: [
      { resource: "task", targetKey: "project_id", label: "Tasks" },
    ],
  },
  {
    name: "ProjectsWithTasksAndMembers",
    label: "Projects with Tasks and Members",
    resource: "projects_with_tasks_and_members",
    pkField: "id",
    isNamedQuery: true,
    primaryResource: "project",
    listViewType: "table",
    defaultSort: { field: "due_date", order: "asc" },
    fields: [
      { key: "project_name", label: "Project", type: "string" },
      { key: "project_status", label: "Project Status", type: "string" },
      { key: "task_title", label: "Task", type: "string", readOnly: true },
      { key: "task_status", label: "Task Status", type: "string", readOnly: true },
      { key: "due_date", label: "Due Date", type: "date", readOnly: true },
      { key: "planned_work_hours", label: "Planned Hours", type: "number", readOnly: true },
      { key: "actual_work_hours", label: "Actual Hours", type: "number", readOnly: true },
      { key: "assignee_name", label: "Assignee", type: "string", readOnly: true },
    ],
    relations: [],
  },
];

export default projectsModelsGen;
