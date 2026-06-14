/*
 * Custom Show page for Task
 *
 * Model  : Task  (resource: "task", module: "tasks")
 * pkField: id
 *
 * Fields:
 *   - Title (title): string  [required]
 *   - Description (description): string
 *   - Status (status): string
 *   - Priority (priority): string
 *   - Due Date (due_date): date
 *   - Planned Work Hours (planned_work_hours): number
 *   - Actual Work Hours (actual_work_hours): number
 *   - Planned Cost (planned_cost): number
 *   - Actual Cost (actual_cost): number
 *   - Actual Progress (actual_progress): number
 *   - Rating (rating): number
 *   - Project Id (project_id): number  → project
 *   - Assignee Id (assignee_id): number  → team_member
 *   - Parent Task Id (parent_task_id): number  → task
 *   - Created At (created_at): datetime  [auto]
 *   - Updated At (updated_at): datetime  [auto]
 *
 * Forward relations (FK in this model → other models):
 *   - Project Id (project_id) → project
 *   - Assignee Id (assignee_id) → team_member
 *   - Parent Task Id (parent_task_id) → task
 *
 * Backward relations (other models that reference Task):
 *   - Subtasks: task via parent_task_id
 *
 * How this page is the default Show page:
 *   This component is registered in `frontend/src/custom_pages.ts`
 *   under the key "task". App.tsx reads that registry and routes
 *   /task/show/{id} to this component
 *   instead of DynamicShow.
 *
 * Navigating to this page from another custom page:
 *   import { useGo } from "@refinedev/core";
 *   const go = useGo();
 *   go({ to: { resource: "task", action: "show", id }, type: "push" });
 *   // or: navigate(`/task/show/${id}`);
 *
 * Undo this override:
 *   Remove the "task" entry from custom_pages.ts — no App.tsx edit needed.
 */

import React from "react";
import { DynamicShow } from "@juicemantics/veloiq-ui";
import { allSystemModels } from "../../allModels.gen";
import { authSystemModels } from "@juicemantics/veloiq-ui";
import type { ModelDef } from "@juicemantics/veloiq-ui";

// All models needed for cross-model lookups (FK labels, relation tabs, etc.)
const allModels: ModelDef[] = [...allSystemModels, ...authSystemModels];

// The Task model definition from the generated schema
const model = allModels.find(m => (m as any).resource === "task")!;

export const CustomTaskShow: React.FC = () => {
    return (
        <>
            {/* ── Scaffold indicator — delete this <div> once you no longer need it. ──────────
                 This badge marks the page as a registered custom scaffold. It appears in the
                 bottom-right corner so you know this component (not the Dynamic default) is
                 active. To remove it: delete from here... */}
            <div style={{
                position: "fixed", bottom: 10, right: 10,
                background: "rgba(99,102,241,0.08)",
                border: "1px dashed rgba(99,102,241,0.45)",
                borderRadius: 5,
                padding: "2px 10px",
                fontSize: 11,
                fontFamily: "monospace",
                color: "rgba(99,102,241,0.7)",
                zIndex: 9999,
                pointerEvents: "none",
                userSelect: "none",
            }}>⚙ Custom Task Show</div>
            {/* ...to here. */}
            <DynamicShow
                model={model}
                allModels={allModels}
                // Customize: add idOverride, embedded={true}, etc.
            />
        </>
    );
};
