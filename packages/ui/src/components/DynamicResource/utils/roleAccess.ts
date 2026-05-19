import { useMemo } from "react";
import type { FieldDef, ModelDef } from "../types";

const USER_KEY = "jm_user";

function getCurrentUserRoles(): string[] {
    try {
        const raw = localStorage.getItem(USER_KEY);
        if (!raw) return [];
        return JSON.parse(raw)?.roles ?? [];
    } catch {
        return [];
    }
}

/** Return only the fields the current user is allowed to read. */
export function filterFieldsByRole(fields: FieldDef[], userRoles: string[]): FieldDef[] {
    return fields.filter((f) => {
        if (!f.readRoles || f.readRoles.length === 0) return true;
        return f.readRoles.some((r) => userRoles.includes(r));
    });
}

/**
 * Returns a copy of *model* with fields filtered to those readable by the
 * current authenticated user.  Returns the original object when no fields
 * are removed so referential equality is preserved and re-renders are avoided.
 */
export function useRoleFilteredModel(model: ModelDef): ModelDef {
    const userRoles = useMemo(() => getCurrentUserRoles(), []);
    return useMemo(() => {
        const filtered = filterFieldsByRole(model.fields, userRoles);
        if (filtered.length === model.fields.length) return model;
        return { ...model, fields: filtered };
    }, [model, userRoles]);
}
