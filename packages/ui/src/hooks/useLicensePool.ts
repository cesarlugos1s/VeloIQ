import { useCallback, useEffect, useState } from "react";
import { API_URL } from "../providers/constants";
import { authenticatedFetch } from "../utils/authenticatedFetch";

/** A license warning returned by the licensing/status endpoint. */
export interface LicenseWarning {
    type: "expiry_approaching" | "grace_period";
    group: string;
    days_remaining: number;
}

/** The combined license pool from the host app and all installed extensions. */
export interface LicensePool {
    installation_id?: string | null;
    licensed_modules: string[];
    write_allowed_modules: string[];
    group_statuses: Record<string, string>;
    module_groups: Record<string, string[]>;
    warnings: LicenseWarning[];
}

/** Return value of the useLicensePool hook. */
export interface UseLicensePoolReturn {
    /** The license pool, or null while loading / on error. */
    pool: LicensePool | null;
    /** True while the initial fetch is in progress. */
    loading: boolean;
    /** True if the module should be visible in the navigation menu. */
    isModuleLicensed: (moduleName: string) => boolean;
    /** True if the module allows write operations (active license, not grace). */
    isModuleWriteAllowed: (moduleName: string) => boolean;
}

/** Modules that are always accessible regardless of licensing. */
const ALWAYS_ON = new Set(["authobjs", "lib", "license"]);

/**
 * Fetch the combined license pool from /api/licensing/status and provide
 * helpers to check whether a given module is licensed.
 *
 * The hook is called inside menu-rendering components (CustomSider,
 * HorizontalMenu) to filter unlicensed modules from the navigation without
 * any host-app code changes.
 */
export function useLicensePool(): UseLicensePoolReturn {
    const [pool, setPool] = useState<LicensePool | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await authenticatedFetch(`${API_URL}/licensing/status`);
                if (!cancelled) {
                    setPool(res.ok ? await res.json() : null);
                }
            } catch {
                if (!cancelled) setPool(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const isModuleLicensed = useCallback(
        (moduleName: string): boolean => {
            const key = moduleName.toLowerCase();
            if (ALWAYS_ON.has(key)) return true;
            if (loading || pool === null) return true;
            // Modules not assigned to any module group are always accessible.
            const moduleGroups = pool.module_groups ?? {};
            const inAnyGroup = Object.values(moduleGroups).some(
                (mods) => mods.map((m) => m.toLowerCase()).includes(key),
            );
            if (!inAnyGroup) return true;
            return (pool.licensed_modules ?? []).map((m) => m.toLowerCase()).includes(key);
        },
        [pool, loading],
    );

    const isModuleWriteAllowed = useCallback(
        (moduleName: string): boolean => {
            const key = moduleName.toLowerCase();
            if (ALWAYS_ON.has(key)) return true;
            if (loading || pool === null) return true;
            return (pool?.write_allowed_modules ?? []).map((m) => m.toLowerCase()).includes(key);
        },
        [pool, loading],
    );

    return { pool, loading, isModuleLicensed, isModuleWriteAllowed };
}