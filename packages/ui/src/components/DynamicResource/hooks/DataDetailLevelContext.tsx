import React, { createContext, useContext } from "react";
import type { DataDetailLevelState } from "./useDataDetailLevel";

/**
 * Context that carries the data-detail slider state from useStandardShowTabs
 * (which creates it internally) down to StandardShow/StandardEdit (which render
 * the DataDetailSlider). This lets custom pages automatically inherit the
 * slider without any per-page code changes — just upgrade the framework.
 */
export const DataDetailLevelContext = createContext<DataDetailLevelState | undefined>(undefined);

DataDetailLevelContext.displayName = "DataDetailLevelContext";

export function useDataDetailLevelContext(): DataDetailLevelState | undefined {
    return useContext(DataDetailLevelContext);
}

export const DataDetailLevelProvider: React.FC<{
    state: DataDetailLevelState;
    children: React.ReactNode;
}> = ({ state, children }) => {
    return React.createElement(DataDetailLevelContext.Provider, { value: state }, children);
};
