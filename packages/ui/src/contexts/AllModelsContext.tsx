import React, { createContext, useContext, useMemo } from "react";
import type { ModelDef } from "../components/DynamicResource/types";
import { useNonModelDataResourceModels } from "../hooks/useNonModelDataResourceModels";

const AllModelsContext = createContext<ModelDef[]>([]);

/**
 * Provide the app's ModelDefs: the generated `models` plus the non-model data
 * resources' ModelDefs loaded from the backend at runtime (non-model data
 * such as configuration files). A generated model wins over a non-model data
 * resource with the same resource name.
 */
export const AllModelsProvider: React.FC<{ models: ModelDef[]; children: React.ReactNode }> = ({
    models,
    children,
}) => {
    const nonModelDataModels = useNonModelDataResourceModels();
    const merged = useMemo(() => {
        if (nonModelDataModels.length === 0) return models;
        const known = new Set(models.map((model) => model.resource || model.name));
        return [...models, ...nonModelDataModels.filter((model) => !known.has(model.resource || model.name))];
    }, [models, nonModelDataModels]);
    return <AllModelsContext.Provider value={merged}>{children}</AllModelsContext.Provider>;
};

export const useAllModels = (): ModelDef[] => useContext(AllModelsContext);

/**
 * Return `allModelsProp` (the ModelDefs a page was given, generated at build
 * time) plus the context's models it lacks, such as the non-model data resources
 * loaded at runtime. Pages call it so a relation, a section cell or a reference
 * to non-model data resolves wherever the page is rendered from.
 */
export const useAllModelsIncludingNonModelData = (allModelsProp?: ModelDef[]): ModelDef[] => {
    const contextModels = useAllModels();
    return useMemo(() => {
        if (!allModelsProp) return contextModels;
        const known = new Set(allModelsProp.map((model) => model.resource || model.name));
        const missing = contextModels.filter((model) => !known.has(model.resource || model.name));
        return missing.length === 0 ? allModelsProp : [...allModelsProp, ...missing];
    }, [allModelsProp, contextModels]);
};
