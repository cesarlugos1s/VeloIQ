/**
 * Frontend side of the access-policy feature (section E of the spec):
 * menus hide what the user can't Read (AC-E1), CRUD buttons follow the shared
 * decision through accessControlProvider (AC-E2), a denied page opened by URL
 * shows the "no access" page (AC-E3), and permissions are refetched and
 * applied without signing out (AC-E4).
 *
 * Runs in Node (no DOM): localStorage and fetch are stubbed, and pages are
 * rendered with react-dom/server.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import React from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const FIXTURES = JSON.parse(readFileSync(resolve(process.cwd(), "../../test-fixtures/access.json"), "utf-8"));

class MemoryStorage {
    private data = new Map<string, string>();
    getItem(key: string) { return this.data.has(key) ? this.data.get(key)! : null; }
    setItem(key: string, value: string) { this.data.set(key, String(value)); }
    removeItem(key: string) { this.data.delete(key); }
    clear() { this.data.clear(); }
}

function permissionsFor(roles: string[], policies: Record<string, unknown> = {}) {
    return {
        context: { ...FIXTURES.base, roles, policies },
        effective: { modules: {}, models: {} },
    };
}

beforeEach(async () => {
    (globalThis as any).localStorage = new MemoryStorage();
    (globalThis as any).window = { _: (t: string) => t, addEventListener: () => undefined };
    vi.resetModules();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("AC-E1 menus hide what the user can't Read", () => {
    const menu = [
        { key: "module:projects", name: "module:projects", children: [{ key: "/project", name: "project" }] },
        { key: "module:tasks", name: "module:tasks", children: [{ key: "/task", name: "task" }, { key: "/subtask", name: "subtask" }] },
        { key: "module:jobs", name: "module:jobs", children: [{ key: "/job", name: "job" }] },
        { key: "module:access_control", name: "module:access_control", children: [{ key: "/user", name: "user" }] },
        { key: "dashboard", name: "dashboard" },
    ];

    async function accessFor(roles: string[], policies: Record<string, unknown>, license = FIXTURES.base.license) {
        const { evaluateAccess, isModuleLicensedIn, moduleKeyForName } = await import("./evaluateAccess");
        const ctx = { ...FIXTURES.base, roles, policies, license };
        return {
            can: (resource: string, action: any) => evaluateAccess(ctx, null, resource, action).allowed,
            canModule: (name: string, action: any) => evaluateAccess(ctx, moduleKeyForName(ctx, name), null, action).allowed,
            isModuleLicensed: (name: string) => isModuleLicensedIn(name, ctx.license),
        };
    }

    it("keeps everything without a policy", async () => {
        const { filterMenuItemsByAccess } = await import("../hooks/useAccess");
        const kept = filterMenuItemsByAccess(menu, await accessFor(["Manager"], {}));
        expect(kept.map((i: any) => i.key)).toEqual(["module:projects", "module:tasks", "module:jobs", "module:access_control", "dashboard"]);
    });

    it("drops denied modules and models, keeps a module shown through one allowed model", async () => {
        const { filterMenuItemsByAccess } = await import("../hooks/useAccess");
        const policies = { Manager: { mode: "allow", entries: [{ module_key: "app:tasks", model_key: "subtask", can_create: false, can_read: true, can_update: false, can_delete: false }] } };
        const kept = filterMenuItemsByAccess(menu, await accessFor(["Manager"], policies));
        expect(kept.map((i: any) => i.key)).toEqual(["module:tasks", "module:access_control", "dashboard"]);
        const tasks = kept.find((i: any) => i.key === "module:tasks");
        expect(tasks.children.map((c: any) => c.name)).toEqual(["subtask"]);
    });

    it("drops unlicensed modules", async () => {
        const { filterMenuItemsByAccess } = await import("../hooks/useAccess");
        const license = { module_groups: { g: ["jobs"] }, licensed_modules: [], write_allowed_modules: [] };
        const kept = filterMenuItemsByAccess(menu, await accessFor(["Admin"], {}, license));
        expect(kept.map((i: any) => i.key)).not.toContain("module:jobs");
    });
});

describe("AC-E2 buttons follow the shared decision through accessControlProvider", () => {
    async function canFor(roles: string[], policies: Record<string, unknown>, action: string, resource: string) {
        localStorage.setItem("jm_user", JSON.stringify({ roles }));
        const store = await import("./accessStore");
        store.setAccessPermissions(permissionsFor(roles, policies) as any);
        const { accessControlProvider } = await import("../providers/accessControlProvider");
        return (await accessControlProvider.can({ action, resource } as any)).can;
    }

    const blockTaskWrites = { Manager: { mode: "block", entries: [{ module_key: "app:tasks", model_key: null, can_create: true, can_read: false, can_update: true, can_delete: true }] } };

    it("hides Create, Edit, Delete and Clone when the policy denies them", async () => {
        for (const action of ["create", "edit", "delete", "clone"]) {
            expect(await canFor(["Manager"], blockTaskWrites, action, "task")).toBe(false);
        }
        expect(await canFor(["Manager"], blockTaskWrites, "list", "task")).toBe(true);
        expect(await canFor(["Manager"], blockTaskWrites, "show", "task")).toBe(true);
    });

    it("leaves other models alone", async () => {
        expect(await canFor(["Manager"], blockTaskWrites, "edit", "project")).toBe(true);
    });

    it("never grants beyond the role's methods", async () => {
        const allowAll = { Viewer: { mode: "allow", entries: [{ module_key: "app:projects", model_key: null, can_create: true, can_read: true, can_update: true, can_delete: true }] } };
        expect(await canFor(["Viewer"], allowAll, "create", "project")).toBe(false);
    });

    it("exempts Admin from policies and @model_access, not from licensing", async () => {
        const policies = { Admin: { mode: "allow", entries: [] } };
        expect(await canFor(["Admin"], policies, "delete", "task")).toBe(true);
        expect(await canFor(["Admin"], policies, "edit", "invoice")).toBe(true);
    });

    it("denies a signed-out user", async () => {
        const { accessControlProvider } = await import("../providers/accessControlProvider");
        expect((await accessControlProvider.can({ action: "list", resource: "task" } as any)).can).toBe(false);
    });
});

describe("AC-E3 a denied page opened by URL shows the no-access page", () => {
    it("renders the no-access page instead of the page", async () => {
        (globalThis as any).window = { _: (t: string) => t, addEventListener: () => undefined };
        const store = await import("./accessStore");
        store.setAccessPermissions(permissionsFor(["Manager"], { Manager: { mode: "allow", entries: [] } }) as any);
        const { ResourceAccessGate } = await import("../components/AccessGate");
        const html = renderToString(
            <MemoryRouter>
                <ResourceAccessGate resource="task" action="read"><div>TASK LIST</div></ResourceAccessGate>
            </MemoryRouter>,
        );
        expect(html).not.toContain("TASK LIST");
        expect(html).toContain("No Access");
    });

    it("renders the page when allowed, and nothing for a denied embedded view", async () => {
        (globalThis as any).window = { _: (t: string) => t, addEventListener: () => undefined };
        const store = await import("./accessStore");
        store.setAccessPermissions(permissionsFor(["Manager"], { Manager: { mode: "allow", entries: [{ module_key: "app:tasks", model_key: null, can_create: false, can_read: true, can_update: false, can_delete: false }] } }) as any);
        const { ResourceAccessGate } = await import("../components/AccessGate");
        const allowed = renderToString(
            <MemoryRouter><ResourceAccessGate resource="task" action="read"><div>TASK LIST</div></ResourceAccessGate></MemoryRouter>,
        );
        expect(allowed).toContain("TASK LIST");
        const embedded = renderToString(
            <MemoryRouter><ResourceAccessGate resource="project" action="read" embedded><div>PROJECTS</div></ResourceAccessGate></MemoryRouter>,
        );
        expect(embedded).not.toContain("PROJECTS");
        expect(embedded).not.toContain("No Access");
    });
});

describe("AC-E4 permissions refresh without signing out", () => {
    it("refetches /auth/resource-permissions and notifies subscribers", async () => {
        localStorage.setItem("jm_access_token", "token");
        (globalThis as any).window = { _: (t: string) => t, addEventListener: () => undefined };
        const first = permissionsFor(["Manager"]);
        const second = permissionsFor(["Manager"], { Manager: { mode: "allow", entries: [] } });
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: async () => first })
            .mockResolvedValueOnce({ ok: true, json: async () => second });
        vi.stubGlobal("fetch", fetchMock);

        const store = await import("./accessStore");
        const { evaluateAccess } = await import("./evaluateAccess");
        const seen: number[] = [];
        store.subscribeAccess(() => seen.push(1));

        await store.refreshAccess();
        expect(evaluateAccess(store.getAccessSnapshot()!.context, null, "task", "read").allowed).toBe(true);
        await store.refreshAccess();
        expect(evaluateAccess(store.getAccessSnapshot()!.context, null, "task", "read").allowed).toBe(false);

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(String(fetchMock.mock.calls[0][0])).toBe("/auth/resource-permissions");
        expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer token");
        expect(seen.length).toBe(2);
        // Persisted so a reload starts with the latest permissions.
        expect(JSON.parse(localStorage.getItem("jm_resource_permissions")!).context.policies.Manager.mode).toBe("allow");
    });

    it("refetches when the window regains focus", async () => {
        localStorage.setItem("jm_access_token", "token");
        const handlers: Record<string, () => void> = {};
        (globalThis as any).window = { _: (t: string) => t, addEventListener: (name: string, fn: () => void) => { handlers[name] = fn; } };
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => permissionsFor(["Manager"]) });
        vi.stubGlobal("fetch", fetchMock);
        const store = await import("./accessStore");
        store.subscribeAccess(() => undefined);
        handlers.focus();
        await Promise.resolve();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("clears permissions on logout", async () => {
        const store = await import("./accessStore");
        store.setAccessPermissions(permissionsFor(["Manager"]) as any);
        store.clearAccess();
        expect(store.getAccessSnapshot()).toBeNull();
        expect(localStorage.getItem("jm_resource_permissions")).toBeNull();
    });
});
