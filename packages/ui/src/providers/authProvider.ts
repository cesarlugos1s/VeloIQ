/**
 * Refine AuthProvider implementation for VeloIQ.
 *
 * Uses JWT Bearer tokens stored in localStorage.  The backend issues
 * tokens via ``POST /auth/login`` and validates them on every
 * request through its auth middleware.
 */

import type { AuthProvider } from "@refinedev/core";

const AUTH_BASE = "/auth";
const TOKEN_KEY = "jm_access_token";
const USER_KEY = "jm_user";
const ROLE_PERMISSIONS_KEY = "jm_role_permissions";
const RESOURCE_PERMISSIONS_KEY = "jm_resource_permissions";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

export const authProvider: AuthProvider = {
    /**
     * Authenticate by username + password.
     * Stores the JWT and user profile in localStorage on success.
     */
    login: async ({ username, password }) => {
        try {
            const response = await fetch(`${AUTH_BASE}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                return {
                    success: false,
                    error: {
                        name: _("Login failed"),
                        message: body?.detail || _("Invalid credentials"),
                    },
                };
            }
            const data = await response.json();
            localStorage.setItem(TOKEN_KEY, data.access_token);
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));

            // Fetch and cache role + resource permissions for the access control provider.
            const token = data.access_token;
            try {
                const [rolesRes, resourceRes] = await Promise.all([
                    fetch(`${AUTH_BASE}/roles`, { headers: { Authorization: `Bearer ${token}` } }),
                    fetch(`${AUTH_BASE}/resource-permissions`, { headers: { Authorization: `Bearer ${token}` } }),
                ]);
                if (rolesRes.ok) {
                    const roles: Array<{ name: string; allowed_actions: string[] }> = await rolesRes.json();
                    const permsMap: Record<string, string[]> = {};
                    for (const role of roles) {
                        permsMap[role.name] = role.allowed_actions;
                    }
                    localStorage.setItem(ROLE_PERMISSIONS_KEY, JSON.stringify(permsMap));
                }
                if (resourceRes.ok) {
                    const resourcePerms = await resourceRes.json();
                    localStorage.setItem(RESOURCE_PERMISSIONS_KEY, JSON.stringify(resourcePerms));
                }
            } catch {
                // Non-critical — accessControlProvider falls back to built-in defaults.
            }

            return { success: true, redirectTo: "/" };
        } catch (err: any) {
            return {
                success: false,
                error: {
                    name: _("Login failed"),
                    message: err?.message || _("Network error"),
                },
            };
        }
    },

    /**
     * Clear stored credentials and redirect to the login page.
     */
    logout: async () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(ROLE_PERMISSIONS_KEY);
        localStorage.removeItem(RESOURCE_PERMISSIONS_KEY);
        return { success: true, redirectTo: "/login" };
    },

    /**
     * Check whether the user is currently authenticated.
     * Returns ``authenticated`` when a token is present.
     */
    check: async () => {
        const token = localStorage.getItem(TOKEN_KEY);
        if (token) {
            return { authenticated: true };
        }
        return { authenticated: false, redirectTo: "/login" };
    },

    /**
     * Return the cached user identity (from localStorage) or fetch it
     * from the backend ``/auth/me`` endpoint.
     */
    getIdentity: async () => {
        const cached = localStorage.getItem(USER_KEY);
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch { /* fall through to fetch */ }
        }

        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return null;

        try {
            const response = await fetch(`${AUTH_BASE}/me`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) return null;
            const user = await response.json();
            localStorage.setItem(USER_KEY, JSON.stringify(user));
            return user;
        } catch {
            return null;
        }
    },

    /**
     * Return the user's roles for role-based UI rendering.
     */
    getPermissions: async () => {
        const cached = localStorage.getItem(USER_KEY);
        if (cached) {
            try {
                return JSON.parse(cached)?.roles ?? [];
            } catch { /* ignore */ }
        }
        return [];
    },

    /**
     * Handle API errors — trigger logout on 401.
     */
    onError: async (error) => {
        const status = error?.statusCode || error?.response?.status;
        if (status === 401) {
            return { logout: true, redirectTo: "/login" };
        }
        return { error };
    },
};
