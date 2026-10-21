import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAccessSnapshot, refreshAccess, subscribeAccess } from "../access/accessStore";
import {
    evaluateAccess,
    hasAdminRole,
    isModuleLicensedIn,
    moduleKeyForName,
    type AccessAction,
} from "../access/evaluateAccess";

/** Return value of the useAccess hook. */
export interface UseAccessReturn {
    /** True until the user's permissions have been loaded once. */
    loading: boolean;
    /** May the user perform `action` on the model behind Refine resource `resource`? */
    can: (resource: string, action: AccessAction) => boolean;
    /** May the user perform `action` on module `moduleName` as a whole (menu key name)? */
    canModule: (moduleName: string, action: AccessAction) => boolean;
    /** True if the module is licensed (ignores roles and policies). */
    isModuleLicensed: (moduleName: string) => boolean;
    /** True if the user has the Admin role. */
    isAdmin: boolean;
    /** Refetch the user's permissions now. */
    refresh: () => void;
}

/**
 * The frontend's single access check: licensing, role methods, access
 * policies and `@model_access`, evaluated with `evaluateAccess` — the same
 * rules the backend applies. While permissions are still unknown every check
 * passes; the backend still enforces every request.
 */
export function useAccess(): UseAccessReturn {
    const data = useSyncExternalStore(subscribeAccess, getAccessSnapshot, getAccessSnapshot);
    const ctx = data?.context ?? null;

    useEffect(() => {
        if (data === null && localStorage.getItem("jm_access_token")) void refreshAccess();
    }, [data]);

    const can = useCallback(
        (resource: string, action: AccessAction) =>
            ctx === null ? true : evaluateAccess(ctx, null, resource, action).allowed,
        [ctx],
    );

    const canModule = useCallback(
        (moduleName: string, action: AccessAction) =>
            ctx === null ? true : evaluateAccess(ctx, moduleKeyForName(ctx, moduleName), null, action).allowed,
        [ctx],
    );

    const isModuleLicensed = useCallback(
        (moduleName: string) => (ctx === null || !ctx.license ? true : isModuleLicensedIn(moduleName, ctx.license)),
        [ctx],
    );

    // Before permissions load, fall back to the roles cached at sign-in so
    // Admin-only menus never flash for other users.
    const isAdmin = useMemo(() => {
        if (ctx !== null) return hasAdminRole(ctx.roles ?? [], ctx.admin_role);
        try {
            return hasAdminRole(JSON.parse(localStorage.getItem("jm_user") ?? "{}")?.roles ?? []);
        } catch {
            return false;
        }
    }, [ctx]);

    return useMemo(
        () => ({ loading: ctx === null, can, canModule, isModuleLicensed, isAdmin, refresh: () => void refreshAccess() }),
        [ctx, can, canModule, isModuleLicensed, isAdmin],
    );
}

/** Refine's useCan query-key roots (new and legacy key formats). */
const CAN_QUERY_ROOTS = new Set(["access", "useCan"]);

/**
 * Invalidate Refine's cached `useCan` answers whenever the user's permissions
 * change, so buttons and inline edit follow a policy change at once. Mount
 * once inside the Refine app (LayoutWrapper does).
 */
export function useAccessQueryInvalidation(): void {
    const queryClient = useQueryClient();
    const data = useSyncExternalStore(subscribeAccess, getAccessSnapshot, getAccessSnapshot);
    const first = useRef(true);
    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        void queryClient.invalidateQueries({
            predicate: (query) => CAN_QUERY_ROOTS.has(String(query.queryKey?.[0])),
        });
    }, [data, queryClient]);
}

const extractModuleName = (item: any): string | null => {
    let key = String(item?.key ?? item?.name ?? "");
    if (key.startsWith("/")) key = key.slice(1);
    if (key.startsWith("module:")) return key.slice("module:".length);
    return null;
};

/**
 * Remove the menu entries the user can't Read (AC-E1).
 *
 * - A resource item stays when its model is readable.
 * - A module item with children stays when at least one child stays, so an
 *   allowlist that names only one model still shows that model's module.
 * - A module item without children stays when the module itself is readable.
 * - An unlicensed module is always removed, children included.
 * The `access_control` module group is shown, whole, to Admins only.
 */
export function filterMenuItemsByAccess<T>(
    items: T[],
    access: Pick<UseAccessReturn, "can" | "canModule" | "isModuleLicensed" | "isAdmin">,
): T[] {
    if (!Array.isArray(items)) return [];
    const result: any[] = [];
    for (const item of items as any[]) {
        if (typeof item !== "object" || item === null) {
            result.push(item);
            continue;
        }
        const moduleName = extractModuleName(item);
        const children = Array.isArray(item.children) ? item.children : null;
        if (moduleName !== null) {
            if (moduleName === "access_control") {
                if (access.isAdmin) result.push(item);
                continue;
            }
            if (!access.isModuleLicensed(moduleName)) continue;
            if (children && children.length > 0) {
                const kept = filterMenuItemsByAccess(children, access);
                if (kept.length > 0) result.push({ ...item, children: kept });
                continue;
            }
            if (access.canModule(moduleName, "read")) result.push(item);
            continue;
        }
        const resource = String(item.name ?? "");
        if (resource && !access.can(resource, "read")) continue;
        result.push(children ? { ...item, children: filterMenuItemsByAccess(children, access) } : item);
    }
    return result as T[];
}
