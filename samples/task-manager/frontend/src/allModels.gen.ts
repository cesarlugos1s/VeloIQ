// AUTO-GENERATED — do not edit. Run `safem generate` to update.
import type { ModelDef } from '@safemantiq/ui';

import { teamModels } from "./pages/team/teamSchema.gen";
import { projectsModels } from "./pages/projects/projectsSchema.gen";
import { tasksModels } from "./pages/tasks/tasksSchema.gen";

export const allModuleRegistrations: Array<{ moduleName: string; models: ModelDef[] }> = [
  { moduleName: "Team", models: teamModels ?? [] },
  { moduleName: "Projects", models: projectsModels ?? [] },
  { moduleName: "Tasks", models: tasksModels ?? [] },
];

export const allSystemModels: ModelDef[] = allModuleRegistrations.flatMap((r) => r.models);
