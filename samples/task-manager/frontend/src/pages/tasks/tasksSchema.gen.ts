// AUTO-GENERATED — do not edit. Run `safem generate` to update.
import type { ModelDef } from '@safemantiq/ui';

export const tasksModels: ModelDef[] = [
  {
    name: "Task",
    label: "Task",
    resource: "task",
    pkField: "id",
    fields: [
          { key: "title", label: "Title", type: "string" },
          { key: "description", label: "Description", type: "string" },
          { key: "status", label: "Status", type: "string" },
          { key: "priority", label: "Priority", type: "string" },
          { key: "due_date", label: "Due Date", type: "date" },
          { key: "project_id", label: "Project Id", type: "number", reference: "project" },
          { key: "assignee_id", label: "Assignee Id", type: "number", reference: "team_member" },
          { key: "parent_task_id", label: "Parent Task Id", type: "number", reference: "task" },
          { key: "planned_work_hours", label: "Planned Work Hours", type: "number" },
          { key: "actual_work_hours", label: "Actual Work Hours", type: "number" },
          { key: "created_at", label: "Created At", type: "datetime" },
          { key: "updated_at", label: "Updated At", type: "datetime" },
    ],
    relations: [
          { resource: "task", targetKey: "parent_task_id", label: "Subtasks", isRecursive: true, otherKey: "id", otherResource: "task", resourcePath: "task", showViewType: "tree-details", showViewTypeFromCsv: true },
    ],
  },
];

export default tasksModels;
