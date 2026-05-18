import React from "react";
import type { ModelDef } from "../types";
import { resolveResourcePath } from "./model";

export const getShowHref = (resource: string, id: string | number, allModels?: ModelDef[]) => {
    const resourcePath = resolveResourcePath(resource, allModels);
    return `/${resourcePath}/show/${id}`;
};

export const shouldHandleLinkClick = (event: React.MouseEvent<HTMLElement>) => {
    if (event.defaultPrevented) return false;
    if (event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    return true;
};
