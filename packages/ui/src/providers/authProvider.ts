/**
 * Refine AuthProvider implementation for VeloIQ.
 *
 * Uses JWT Bearer tokens stored in localStorage.  The backend issues
 * tokens via ``POST /auth/login`` and validates them on every
 * request through its auth middleware.
 */

import type { AuthProvider } from "@refinedev/core";
import { clearAccess, refreshAccess } from "../access/accessStore";
import { resetFrameworkUiFeatures } from "../hooks/useFrameworkUiFeatures";
import { readAccessToken, signInStorageKeys } from "../utils/signInStorageKeys";

const AUTH_BASE = "/auth";

const _ = (((window as any)._ as ((text: string) => string) | undefined) || ((text: string) => text));

/**
 * Keep the session of a signed-in user: their token, their profile (from the
 * sign-in response, else ``/auth/me``), their roles' actions and their
 * effective permissions. Shared by the password sign-in and custom sign-in
 * flows that obtain the token themselves.
 */
async function startSignedInSession(token: string, signedInUser: any): Promise<void> {
    localStorage.setItem(signInStorageKeys().accessToken, token);
    // The new user's framework UI features are asked for again.
    resetFrameworkUiFeatures();
    let user = signedInUser;
    if (!user) {
        const meResponse = await fetch(`${AUTH_BASE}/me`, { headers: { Authorization: `Bearer ${token}` } });
        user = meResponse.ok ? await meResponse.json() : null;
    }
    if (user) localStorage.setItem(signInStorageKeys().signedInUser, JSON.stringify(user));
    else localStorage.removeItem(signInStorageKeys().signedInUser);

    // Fetch and cache role + resource permissions for the access control provider.
    try {
        const [rolesRes] = await Promise.all([
            fetch(`${AUTH_BASE}/roles`, { headers: { Authorization: `Bearer ${token}` } }),
            // Effective permissions for the shared access check (stored by accessStore).
            refreshAccess(),
        ]);
        if (rolesRes.ok) {
            const roles: Array<{ name: string; allowed_actions: string[] }> = await rolesRes.json();
            const permsMap: Record<string, string[]> = {};
            for (const role of roles) {
                permsMap[role.name] = role.allowed_actions;
            }
            localStorage.setItem(signInStorageKeys().rolePermissions, JSON.stringify(permsMap));
        }
    } catch {
        // Non-critical — accessControlProvider falls back to built-in defaults.
    }
}

export const authProvider: AuthProvider = {
    /**
     * Authenticate by username + password, or with ``accessToken`` obtained by a
     * custom sign-in flow; ``redirectTo`` (default "/") is where to go next.
     * Stores the JWT and user profile in localStorage on success.
     */
    login: async ({ username, password, accessToken, redirectTo }) => {
        try {
            // A custom sign-in flow (e.g. a portal's sign-in with a second factor) passes the
            // token it obtained; otherwise sign in with the username and password.
            let token: string = accessToken;
            let signedInUser: any = null;
            if (!token) {
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
                token = data.access_token;
                signedInUser = data.user;
            }
            await startSignedInSession(token, signedInUser);
            return { success: true, redirectTo: redirectTo || "/" };
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
        localStorage.removeItem(signInStorageKeys().accessToken);
        resetFrameworkUiFeatures();
        localStorage.removeItem(signInStorageKeys().signedInUser);
        localStorage.removeItem(signInStorageKeys().rolePermissions);
        clearAccess();
        return { success: true, redirectTo: "/login" };
    },

    /**
     * Check whether the user is currently authenticated.
     * Returns ``authenticated`` when a token is present.
     */
    check: async () => {
        const token = readAccessToken();
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
        const cached = localStorage.getItem(signInStorageKeys().signedInUser);
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch { /* fall through to fetch */ }
        }

        const token = readAccessToken();
        if (!token) return null;

        try {
            const response = await fetch(`${AUTH_BASE}/me`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) return null;
            const user = await response.json();
            localStorage.setItem(signInStorageKeys().signedInUser, JSON.stringify(user));
            return user;
        } catch {
            return null;
        }
    },

    /**
     * Return the user's roles for role-based UI rendering.
     */
    getPermissions: async () => {
        const cached = localStorage.getItem(signInStorageKeys().signedInUser);
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
