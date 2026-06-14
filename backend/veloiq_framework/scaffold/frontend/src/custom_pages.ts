// Custom page overrides — managed by `veloiq scaffold-page`. Safe to edit manually.
// Add a component here to replace the default Dynamic page for any resource.
//
// Usage:
//   1. Run `veloiq scaffold-page <resource> <list|show|edit|create>` to generate
//      the component file and register it here automatically.
//   2. Or add entries manually — import your component and add it to the right map.
//
// To revert a page to its Dynamic default, remove the resource entry from the map below.
import React from "react";
import type { ModelDef } from "@juicemantics/veloiq-ui";

export const customListComponents:   Record<string, React.ComponentType<{ model: ModelDef; allModels: ModelDef[] }>> = {};
export const customShowComponents:   Record<string, React.ComponentType> = {};
export const customEditComponents:   Record<string, React.ComponentType<{ model: ModelDef; allModels: ModelDef[] }>> = {};
export const customCreateComponents: Record<string, React.ComponentType<{ model: ModelDef; allModels: ModelDef[] }>> = {};
