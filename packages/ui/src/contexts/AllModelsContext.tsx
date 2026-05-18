import React, { createContext, useContext } from "react";
import type { ModelDef } from "../components/DynamicResource/types";

const AllModelsContext = createContext<ModelDef[]>([]);

export const AllModelsProvider: React.FC<{ models: ModelDef[]; children: React.ReactNode }> = ({
    models,
    children,
}) => <AllModelsContext.Provider value={models}>{children}</AllModelsContext.Provider>;

export const useAllModels = (): ModelDef[] => useContext(AllModelsContext);
