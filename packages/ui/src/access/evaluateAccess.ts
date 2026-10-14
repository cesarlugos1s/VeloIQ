/**
 * The frontend side of VeloIQ's shared access decision.
 *
 * `evaluateAccess` mirrors the backend's `evaluate_access`
 * (`veloiq_framework/access/decision.py`) over the same plain data, which the
 * backend sends from `/auth/resource-permissions`. Both run the shared cases
 * in `test-fixtures/access.json`, so they must give the same answer for each.
 *
 * Evaluation order (first deny wins):
 *   2. licensing — module licensed; writes also outside the grace period
 *   3. the role's global HTTP methods
 *   4. the role's access policy (allowlist / blocklist)
 *   5. `@model_access` rules from code
 * Steps 3–5 run per role and any role allowing wins. The Admin role skips
 * steps 4 and 5 but not licensing or its methods.
 */

export type AccessAction = "create" | "read" | "update" | "delete";

export const ACCESS_ACTIONS: AccessAction[] = ["create", "read", "update", "delete"];

export interface AccessPolicyEntry {
    module_key: string;
    model_key?: string | null;
    can_create: boolean;
    can_read: boolean;
    can_update: boolean;
    can_delete: boolean;
}

export interface AccessPolicy {
    mode: "allow" | "block";
    entries: AccessPolicyEntry[];
}

export interface AccessLicensePool {
    module_groups?: Record<string, string[]>;
    licensed_modules?: string[];
    write_allowed_modules?: string[];
    [key: string]: unknown;
}

export interface AccessRegistry {
    modules: Record<string, { source: string; name: string; models: string[] }>;
    models: Record<string, string>;
}

/** Everything the decision needs about the signed-in user and the installation. */
export interface AccessContext {
    roles: string[];
    admin_role?: string;
    role_methods: Record<string, string[]>;
    policies: Record<string, AccessPolicy>;
    model_access: Record<string, Record<string, string[]>>;
    license: AccessLicensePool | null;
    registry: AccessRegistry;
}

export interface AccessDecision {
    allowed: boolean;
    reason?: string;
}

/** HTTP methods that carry each action. */
export const ACTION_METHODS: Record<AccessAction, string[]> = {
    read: ["GET", "HEAD"],
    create: ["POST"],
    update: ["PUT", "PATCH"],
    delete: ["DELETE"],
};

/**
 * Refine actions (as used by `@model_access`) that count as each action.
 * Mirrors the backend's `HTTP_TO_REFINE` grouped by action.
 */
export const ACTION_REFINE: Record<AccessAction, string[]> = {
    read: ["list", "show", "field", "clone"],
    create: ["create"],
    update: ["edit"],
    delete: ["delete"],
};

/** Refine action → access action, for the Refine access-control provider. */
export const REFINE_TO_ACTION: Record<string, AccessAction> = {
    list: "read",
    show: "read",
    field: "read",
    create: "create",
    clone: "create",
    edit: "update",
    delete: "delete",
};

const DEFAULT_ADMIN_ROLE = "Admin";

/** Modules always accessible regardless of licensing (backend `_ALWAYS_ON_MODULES`). */
const ALWAYS_ON = new Set(["authobjs", "lib", "license"]);

const lowerSet = (values: string[] | undefined): Set<string> => new Set((values ?? []).map((v) => v.toLowerCase()));

const inAnyGroup = (key: string, pool: AccessLicensePool): boolean =>
    Object.values(pool.module_groups ?? {}).some((mods) => lowerSet(mods).has(key));

/** Same rule as the backend's `is_module_licensed`. */
export function isModuleLicensedIn(moduleName: string, pool: AccessLicensePool): boolean {
    const key = moduleName.toLowerCase();
    if (ALWAYS_ON.has(key)) return true;
    if (!inAnyGroup(key, pool)) return true;
    return lowerSet(pool.licensed_modules).has(key);
}

/** Same rule as the backend's `is_module_write_allowed` (grace period is read-only). */
export function isModuleWriteAllowedIn(moduleName: string, pool: AccessLicensePool): boolean {
    const key = moduleName.toLowerCase();
    if (ALWAYS_ON.has(key)) return true;
    if (!inAnyGroup(key, pool)) return true;
    return lowerSet(pool.write_allowed_modules).has(key);
}

/** Split `<source>:<module>` into `[source, module]`. */
export function splitModuleKey(moduleKey: string): [string, string] {
    const idx = moduleKey.indexOf(":");
    return idx < 0 ? ["", moduleKey] : [moduleKey.slice(0, idx), moduleKey.slice(idx + 1)];
}

const FLAG: Record<AccessAction, keyof AccessPolicyEntry> = {
    create: "can_create",
    read: "can_read",
    update: "can_update",
    delete: "can_delete",
};

function policyAllows(policy: AccessPolicy, moduleKey: string, modelKey: string | null, action: AccessAction): boolean {
    const entries = policy.entries ?? [];
    let entry: AccessPolicyEntry | undefined;
    if (modelKey) {
        entry = entries.find((e) => e.module_key === moduleKey && e.model_key === modelKey);
    }
    if (entry === undefined) {
        entry = entries.find((e) => e.module_key === moduleKey && !e.model_key);
    }
    const flag = FLAG[action];
    if (policy.mode === "allow") return entry !== undefined && Boolean(entry[flag]);
    return entry === undefined || !entry[flag];
}

function evaluateRole(
    ctx: AccessContext,
    role: string,
    moduleKey: string | null,
    modelKey: string | null,
    action: AccessAction,
): string | null {
    const methods = new Set(ctx.role_methods?.[role] ?? []);
    if (!ACTION_METHODS[action].some((m) => methods.has(m))) return "role_method";
    if (role === (ctx.admin_role ?? DEFAULT_ADMIN_ROLE)) return null;

    const registeredModules = ctx.registry?.modules ?? {};
    if (moduleKey && Object.prototype.hasOwnProperty.call(registeredModules, moduleKey)) {
        const policy = ctx.policies?.[role];
        if (policy && !policyAllows(policy, moduleKey, modelKey, action)) return "policy";
    }

    if (modelKey) {
        const roleRules = ctx.model_access?.[modelKey]?.[role];
        if (roleRules !== undefined && roleRules !== null
            && !ACTION_REFINE[action].some((a) => roleRules.includes(a))) {
            return "model_access";
        }
    }
    return null;
}

/**
 * Decide (module, model, action) for the user described by `ctx`.
 * Pass `moduleKey` for a module-level check, `modelKey` (a table name) for a
 * model — its module is looked up in the registry — or both.
 */
export function evaluateAccess(
    ctx: AccessContext,
    moduleKey: string | null,
    modelKey: string | null,
    action: string,
): AccessDecision {
    if (!(ACCESS_ACTIONS as string[]).includes(action)) return { allowed: false, reason: "unknown_action" };
    const act = action as AccessAction;
    let module = moduleKey;
    if (module === null && modelKey) module = ctx.registry?.models?.[modelKey] ?? null;

    const pool = ctx.license;
    if (module && pool !== null && pool !== undefined) {
        const moduleName = splitModuleKey(module)[1];
        if (!isModuleLicensedIn(moduleName, pool)) return { allowed: false, reason: "not_licensed" };
        if (act !== "read" && !isModuleWriteAllowedIn(moduleName, pool)) {
            return { allowed: false, reason: "license_read_only" };
        }
    }

    const roles = ctx.roles ?? [];
    if (roles.length === 0) return { allowed: false, reason: "no_role" };
    let firstReason: string | null = null;
    for (const role of roles) {
        const reason = evaluateRole(ctx, role, module, modelKey, act);
        if (reason === null) return { allowed: true };
        firstReason = firstReason ?? reason;
    }
    return { allowed: false, reason: firstReason ?? undefined };
}

/**
 * Return the namespaced key of the module named `moduleName` (as used in menu
 * keys, e.g. `module:tasks`). A module that isn't registered for policies
 * (a framework system module) gets `:<name>`, so licensing still applies.
 */
export function moduleKeyForName(ctx: AccessContext, moduleName: string): string {
    const match = Object.entries(ctx.registry?.modules ?? {}).find(([, info]) => info.name === moduleName);
    return match ? match[0] : `:${moduleName}`;
}
