// AUTO-GENERATED — do not edit. Run `veloiq generate` to update.
import type { ModelDef } from '@juicemantics/veloiq-ui';

export const tasksModelsGen: ModelDef[] = [
  {
    name: "Task",
    label: "Task",
    resource: "task",
    pkField: "id",
    description: "A unit of work that belongs to a project and can be assigned to a team member.",
    fields: [
      { key: "title", label: "Title", type: "string", required: true, description: "Short summary of the work to be done" },
      { key: "description", label: "Description", type: "string", description: "Full details and acceptance criteria" },
      { key: "status", label: "Status", type: "string", default: "todo", options: ["todo", "in_progress", "done", "cancelled"], description: "Current workflow state" },
      { key: "priority", label: "Priority", type: "string", default: "medium", options: ["low", "medium", "high", "critical"], description: "Urgency level" },
      { key: "due_date", label: "Due Date", type: "date", description: "Target completion date" },
      { key: "planned_work_hours", label: "Planned Work Hours", type: "number", description: "Estimated effort in hours" },
      { key: "actual_work_hours", label: "Actual Work Hours", type: "number", description: "Actual hours spent" },
      { key: "planned_cost", label: "Planned Cost", type: "number", description: "Budgeted cost for this task" },
      { key: "actual_cost", label: "Actual Cost", type: "number", description: "Cost incurred so far" },
      { key: "actual_progress", label: "Actual Progress", type: "number", description: "Completion percentage (0\u2013100)" },
      { key: "rating", label: "Rating", type: "number", description: "Quality rating on completion (1\u20135)" },
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
