/**
 * Refine AccessControlProvider for VeloIQ.
 *
 * Three-layer permission model (mirrors the backend):
 *   Layer 1 — Role global permissions (fetched from /auth/roles on login,
 *              stored as jm_role_permissions in localStorage).
 *   Layer 2 — Model-level exceptions (fetched from /auth/resource-permissions
 *              on login, stored as jm_resource_permissions).
 *   Layer 3 — Field-level exceptions (readRoles/writeRoles emitted by the
 *              schema generator into FieldDef; handled by CanAccess wrappers).
 *
 * Falls back to built-in Admin/Manager/Viewer defaults when the cached
 * permissions are absent (e.g. on first load before a login).
 */

import type { AccessControlProvider } from "@refinedev/core";

const USER_KEY = "jm_user";
const ROLE_PERMISSIONS_KEY = "jm_role_permissions";
const RESOURCE_PERMISSIONS_KEY = "jm_resource_permissions";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

/**
 * Built-in fallback role→actions map (used when jm_role_permissions is absent).
 * Matches the framework's DEFAULT_ROLES.
 */
const FALLBACK_ROLE_ACTIONS: Record<string, string[]> = {
    Admin:   ["list", "show", "create", "edit", "delete", "clone", "field"],
    Manager: ["list", "show", "create", "edit", "clone", "field"],
    Viewer:  ["list", "show", "field"],
};

function getRoleActions(): Record<string, Set<string>> {
    const cached = localStorage.getItem(ROLE_PERMISSIONS_KEY);
    const source: Record<string, string[]> = cached
        ? (() => { try { return JSON.parse(cached); } catch { return FALLBACK_ROLE_ACTIONS; } })()
        : FALLBACK_ROLE_ACTIONS;
    return Object.fromEntries(
        Object.entries(source).map(([k, v]) => [k, new Set(v as string[])])
    );
}

/**
 * Returns the model-level permission exceptions map:
 *   { "<resource>": { "<RoleName>": ["list", "show", ...] } }
 */
function getResourcePermissions(): Record<string, Record<string, string[]>> {
    const cached = localStorage.getItem(RESOURCE_PERMISSIONS_KEY);
    if (!cached) return {};
    try { return JSON.parse(cached); } catch { return {}; }
}

export const accessControlProvider: AccessControlProvider = {
    can: async ({ action, resource }) => {
        const cached = localStorage.getItem(USER_KEY);
        if (!cached) {
            return { can: false, reason: _("Not authenticated") };
        }

        let user: any;
        try {
            user = JSON.parse(cached);
        } catch {
            return { can: false, reason: _("Not authenticated") };
        }

        const roles: string[] = user?.roles ?? [];

        // Admin always wins — bypass all checks.
        if (roles.some((r) => r.toLowerCase() === "admin")) {
            return { can: true };
        }

        const roleActions = getRoleActions();
        const resourcePerms = getResourcePermissions();

        // Walk each role: if any role grants access, allow.
        for (const role of roles) {
            // Find the canonical casing stored in the permissions map.
            const roleKey = Object.keys(roleActions).find(
                (k) => k.toLowerCase() === role.toLowerCase()
            ) ?? role;

            // Layer 2: check model-level exception for this resource.
            if (resource && resourcePerms[resource]?.[roleKey] !== undefined) {
                const allowedByException = resourcePerms[resource][roleKey];
                if (allowedByException.includes(action)) {
                    return { can: true };
                }
                // This role is restricted on this resource — do not fall through to Layer 1.
                continue;
            }

            // Layer 1: use global role permissions.
            const globalActions = roleActions[roleKey];
            if (globalActions?.has(action)) {
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
