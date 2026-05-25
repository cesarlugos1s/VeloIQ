// AUTO-GENERATED — do not edit. Run `veloiq generate` to update.
import type { ModelDef } from '@juicemantics/veloiq-ui';

export const tasksModelsGen: ModelDef[] = [
  {
    name: "Task",
    label: "Task",
    resource: "task",
    pkField: "id",
    fields: [
      { key: "title", label: "Title", type: "string", required: true },
      { key: "description", label: "Description", type: "string" },
      { key: "status", label: "Status", type: "string" },
      { key: "priority", label: "Priority", type: "string" },
      { key: "due_date", label: "Due Date", type: "date" },
      { key: "planned_work_hours", label: "Planned Work Hours", type: "number" },
      { key: "actual_work_hours", label: "Actual Work Hours", type: "number" },
      { key: "planned_cost", label: "Planned Cost", type: "number" },
      { key: "actual_cost", label: "Actual Cost", type: "number" },
      { key: "actual_progress", label: "Actual Progress", type: "number" },
      { key: "rating", label: "Rating", type: "number" },
      { key: "project_id", label: "Project Id", type: "number", reference: "project" },
      { key: "assignee_id", label: "Assignee Id", type: "number", reference: "team_member" },
      { key: "parent_task_id", label: "Parent Task Id", type: "number", reference: "task" },
      { key: "created_at", label: "Created At", type: "datetime" },
      { key: "updated_at", label: "Updated At", type: "datetime" },
    ],
    relations: [
      { resource: "task", targetKey: "parent_task_id", label: "Subtasks", isRecursive: true, otherKey: "id", otherResource: "task", resourcePath: "task", showViewType: "tree-details", showViewTypeFromCsv: true },
    ],
  },
];

export default tasksModelsGen;
