import { createContext } from "react";

export interface ResourceContextValue {
    allResources: any[];
    allSystemModels: any[];
}

export const ResourceContext = createContext<ResourceContextValue>({
    allResources: [],
    allSystemModels: [],
});
