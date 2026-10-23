/**
 * A portal served from the admin app's origin keeps its own sign-in session:
 * after setSignInStorageNamespace(<site key>), signing in, reading the token
 * and signing out use the site's keys and leave the admin app's session alone.
 *
 * Runs in Node (no DOM): localStorage, window and fetch are stubbed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

class MemoryStorage {
    private data = new Map<string, string>();
    getItem(key: string) { return this.data.has(key) ? this.data.get(key)! : null; }
    setItem(key: string, value: string) { this.data.set(key, String(value)); }
    removeItem(key: string) { this.data.delete(key); }
    clear() { this.data.clear(); }
    keys() { return [...this.data.keys()]; }
}

const jsonResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body, headers: { get: () => null } });

beforeEach(() => {
    (globalThis as any).localStorage = new MemoryStorage();
    (globalThis as any).window = { _: (t: string) => t, addEventListener: () => undefined };
    (globalThis as any).fetch = vi.fn(async (url: string) => {
        if (url.endsWith("/auth/login")) return jsonResponse({ access_token: "portal-token", user: { username: "c", roles: ["Candidate"] } });
        if (url.endsWith("/auth/roles")) return jsonResponse([{ name: "Candidate", allowed_actions: ["list", "show"] }]);
        if (url.endsWith("/auth/me")) return jsonResponse({ username: "employer", roles: ["Employer"] });
        return jsonResponse({ context: { roles: ["Candidate"] }, effective: { modules: {}, models: {} } });
    });
    vi.resetModules();
});

describe("signInStorageKeys", () => {
    it("uses the admin app's keys by default", async () => {
        const { signInStorageKeys, siteScopedStorageKey } = await import("./signInStorageKeys");
        expect(signInStorageKeys().accessToken).toBe("jm_access_token");
        expect(siteScopedStorageKey("layoutMode")).toBe("layoutMode");
    });

    it("derives every key from a portal's token storage key", async () => {
        const { setSignInStorageNamespace, signInStorageKeys, siteScopedStorageKey } = await import("./signInStorageKeys");
        setSignInStorageNamespace("site_token");
        expect(signInStorageKeys()).toEqual({
            accessToken: "site_token",
            signedInUser: "site_token:user",
            rolePermissions: "site_token:role_permissions",
            resourcePermissions: "site_token:resource_permissions",
        });
        expect(siteScopedStorageKey("layoutMode")).toBe("site_token:layoutMode");
    });

    it("signs a portal user in and out without touching the admin app's session", async () => {
        localStorage.setItem("jm_access_token", "admin-token");
        localStorage.setItem("jm_user", "{\"username\":\"admin\"}");
        const { setSignInStorageNamespace, readAccessToken } = await import("./signInStorageKeys");
        setSignInStorageNamespace("site_token");
        const { authProvider } = await import("../providers/authProvider");

        const signedIn = await authProvider.login({ username: "c", password: "p" });
        expect(signedIn.success).toBe(true);
        expect(readAccessToken()).toBe("portal-token");
        expect(JSON.parse(localStorage.getItem("site_token:user")!).roles).toEqual(["Candidate"]);
        expect(await authProvider.check({})).toMatchObject({ authenticated: true });

        await authProvider.logout({});
        expect(readAccessToken()).toBeNull();
        expect(localStorage.getItem("site_token:user")).toBeNull();
        expect(localStorage.getItem("jm_access_token")).toBe("admin-token");
        expect(localStorage.getItem("jm_user")).toBe("{\"username\":\"admin\"}");
    });

    it("keeps the session of a token obtained by a custom sign-in flow", async () => {
        const { setSignInStorageNamespace, readAccessToken } = await import("./signInStorageKeys");
        setSignInStorageNamespace("employer_token");
        const { authProvider } = await import("../providers/authProvider");
        const signedIn = await authProvider.login({ accessToken: "mfa-token", redirectTo: "/mfa-enroll" });
        expect(signedIn).toMatchObject({ success: true, redirectTo: "/mfa-enroll" });
        expect(readAccessToken()).toBe("mfa-token");
        // The profile comes from /auth/me, as no sign-in response carried it.
        expect(JSON.parse(localStorage.getItem("employer_token:user")!).roles).toEqual(["Employer"]);
        expect((globalThis as any).fetch).not.toHaveBeenCalledWith(expect.stringMatching(/\/auth\/login$/), expect.anything());
    });
});
