/**
 * Refine AccessControlProvider for JuiceMantics.
 *
 * Implements role-based access control (RBAC) on the frontend.
 * The backend enforces the same rules via middleware — this provider
 * controls UI visibility (buttons, menu items) so users don't see
 * actions they cannot perform.
 */

import type { AccessControlProvider } from "@refinedev/core";

const USER_KEY = "jm_user";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

/**
 * Maps each role to the set of Refine actions it may perform.
 * "field" is a synthetic action used by Refine for field-level checks.
 */
const ROLE_ACTIONS: Record<string, Set<string>> = {
    Admin:   new Set(["list", "show", "create", "edit", "delete", "clone", "field"]),
    Manager: new Set(["list", "show", "create", "edit", "clone", "field"]),
    Viewer:  new Set(["list", "show", "field"]),
};

export const accessControlProvider: AccessControlProvider = {
    can: async ({ action }) => {
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

        // Admin can do everything.
        if (roles.some((r) => r.toLowerCase() === "admin")) {
            return { can: true };
        }

        // Check if any of the user's roles permit this action (case-insensitive).
        const allowed = roles.some((role) => {
            const key = Object.keys(ROLE_ACTIONS).find((k) => k.toLowerCase() === role.toLowerCase());
            return key ? ROLE_ACTIONS[key].has(action) : false;
        });

        if (!allowed) {
            return {
                can: false,
                reason: _("Access denied — insufficient role for this action"),
            };
        }

        return { can: true };
    },
    options: {
        buttons: {
            enableAccessControl: true,
            hideIfUnauthorized: true,
        },
    },
};
