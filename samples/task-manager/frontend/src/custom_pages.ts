// Custom page overrides — managed by `veloiq scaffold-page`. Safe to edit manually.
// Add a component here to replace the default Dynamic page for any resource.
import React from "react";
import type { ModelDef } from "@juicemantics/veloiq-ui";

import { CustomTaskShow } from "./pages/tasks/CustomTaskShow";
import { CustomTaskList } from "./pages/tasks/CustomTaskList";

export const customListComponents:   Record<string, React.ComponentType<{ model: ModelDef; allModels: ModelDef[] }>> = {
    "task": CustomTaskList,
};
export const customShowComponents:   Record<string, React.ComponentType> = {
    "task": CustomTaskShow,
};
export const customEditComponents:   Record<string, React.ComponentType<{ model: ModelDef; allModels: ModelDef[] }>> = {};
export const customCreateComponents: Record<string, React.ComponentType<{ model: ModelDef; allModels: ModelDef[] }>> = {};
