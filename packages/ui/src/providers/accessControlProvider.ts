/**
 * Refine AccessControlProvider for VeloIQ.
 *
 * CRUD actions (list/show/field → Read, create/clone → Create, edit →
 * Update, delete → Delete) go through `evaluateAccess`, the frontend twin of
 * the backend's shared access decision: licensing, the role's global
 * methods, the role's access policy and `@model_access` (fetched from
 * /auth/resource-permissions on login, on window focus and after a policy
 * is saved). The Admin role is exempt from access policies and
 * `@model_access` but not from licensing — the same rule as the backend.
 *
 * Other actions (e.g. `configure_layout`) keep the role-global check from
 * /auth/roles. Field-level rules (readRoles/writeRoles) stay with the
 * CanAccess wrappers.
 *
 * Falls back to built-in Admin/Manager/Viewer defaults when nothing has been
 * fetched yet (e.g. on first load before a login).
 */

import type { AccessControlProvider } from "@refinedev/core";
import { getAccessSnapshot } from "../access/accessStore";
import { REFINE_TO_ACTION, evaluateAccess } from "../access/evaluateAccess";
import { signInStorageKeys } from "../utils/signInStorageKeys";
import { signedOutVisitorsAllowed } from "../utils/portalRequestContext";

const ADMIN_ROLE = "Admin";
/** Refine actions a public portal's signed-out visitor may take (reading pages). */
const SIGNED_OUT_VISITOR_ACTIONS = new Set(["list", "show"]);

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

/**
 * Built-in fallback role→actions map (used when the role permissions aren't stored yet).
 * Matches the framework's DEFAULT_ROLES.
 */
const FALLBACK_ROLE_ACTIONS: Record<string, string[]> = {
    Admin:   ["list", "show", "create", "edit", "delete", "clone", "field", "configure_layout"],
    Manager: ["list", "show", "create", "edit", "clone", "field", "configure_layout"],
    Viewer:  ["list", "show", "field"],
};

function getRoleActions(): Record<string, Set<string>> {
    const cached = localStorage.getItem(signInStorageKeys().rolePermissions);
    const source: Record<string, string[]> = cached
        ? (() => { try { return JSON.parse(cached); } catch { return FALLBACK_ROLE_ACTIONS; } })()
        : FALLBACK_ROLE_ACTIONS;
    return Object.fromEntries(
        Object.entries(source).map(([k, v]) => [k, new Set(v as string[])])
    );
}

export const accessControlProvider: AccessControlProvider = {
    can: async ({ action, resource }) => {
        const cached = localStorage.getItem(signInStorageKeys().signedInUser);
        if (!cached) {
            // A public portal's signed-out visitor may open pages; anything else needs a sign-in
            // (the server decides what the portal's anonymous user may read).
            if (signedOutVisitorsAllowed() && SIGNED_OUT_VISITOR_ACTIONS.has(action)) {
                return { can: true };
            }
            return { can: false, reason: _("Not authenticated") };
        }

        let user: any;
        try {
            user = JSON.parse(cached);
        } catch {
            return { can: false, reason: _("Not authenticated") };
        }

        const roles: string[] = user?.roles ?? [];

        // CRUD actions: the shared access decision.
        const accessAction = REFINE_TO_ACTION[action];
        const access = getAccessSnapshot();
        if (accessAction && access) {
            const decision = evaluateAccess(access.context, null, resource ?? null, accessAction);
            return decision.allowed
                ? { can: true }
                : { can: false, reason: _("You do not have permission to perform this action.") };
        }

        // Admin exemption for non-CRUD actions (same role the backend exempts).
        if (roles.includes(ADMIN_ROLE)) {
            return { can: true };
        }

        // Non-CRUD actions, or permissions not loaded yet: role global methods.
        const roleActions = getRoleActions();
        for (const role of roles) {
            // Find the canonical casing stored in the permissions map.
            const roleKey = Object.keys(roleActions).find(
                (k) => k.toLowerCase() === role.toLowerCase()
            ) ?? role;
            if (roleActions[roleKey]?.has(action)) {
                return { can: true };
            }
        }

        return {
            can: false,
            reason: _("Access denied — insufficient role for this action"),
        };
    },
    options: {
        buttons: {
            enableAccessControl: true,
            hideIfUnauthorized: true,
        },
    },
};
