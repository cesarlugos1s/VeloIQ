// AUTO-GENERATED — do not edit. Run `veloiq generate` to update.
import type { ModelDef } from '@juicemantics/veloiq-ui';

import { projectsModels } from "./pages/projects/projectsSchema";
import { tasksModels } from "./pages/tasks/tasksSchema";
import { teamModels } from "./pages/team/teamSchema";

export const allModuleRegistrations: Array<{ moduleName: string; models: ModelDef[] }> = [
  { moduleName: "projects", models: projectsModels ?? [] },
  { moduleName: "tasks", models: tasksModels ?? [] },
  { moduleName: "team", models: teamModels ?? [] },
];

export const allSystemModels: ModelDef[] = allModuleRegistrations.flatMap((r) => r.models);
