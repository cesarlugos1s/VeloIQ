/**
 * Client-side store for the signed-in user's access context.
 *
 * Holds what `/auth/resource-permissions` returns (`context` for
 * `evaluateAccess`, plus the backend's own `effective` table), caches it in
 * localStorage so a page reload has it at once, and refetches it:
 *   - on login (authProvider calls `refreshAccess`),
 *   - when the window regains focus,
 *   - after an Admin saves or deletes an access policy.
 * So signed-in users pick up policy changes without signing out (AC-E4).
 */
import { authenticatedFetch } from "../utils/authenticatedFetch";
import type { AccessAction, AccessContext } from "./evaluateAccess";

export const ACCESS_STORAGE_KEY = "jm_resource_permissions";
const RESOURCE_PERMISSIONS_URL = "/auth/resource-permissions";
/** Minimum gap between two focus-triggered refetches. */
const FOCUS_REFRESH_MIN_MS = 5000;

export interface EffectivePermissions {
    context: AccessContext;
    effective: {
        modules: Record<string, Record<AccessAction, boolean>>;
        models: Record<string, Record<AccessAction, boolean>>;
    };
}

type Listener = () => void;

let current: EffectivePermissions | null = null;
let loaded = false;
let inFlight: Promise<EffectivePermissions | null> | null = null;
let lastFetch = 0;
let focusListenerInstalled = false;
const listeners = new Set<Listener>();

/** Only the new `{context, effective}` shape is accepted from storage. */
function isEffectivePermissions(value: unknown): value is EffectivePermissions {
    return !!value && typeof value === "object" && "context" in (value as any) && "effective" in (value as any);
}

function readStored(): EffectivePermissions | null {
    try {
        const raw = localStorage.getItem(ACCESS_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return isEffectivePermissions(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function notify(): void {
    listeners.forEach((fn) => fn());
}

/** Current permissions (memory first, then localStorage), or null when unknown. */
export function getAccessSnapshot(): EffectivePermissions | null {
    if (!loaded) {
        current = readStored();
        loaded = true;
    }
    return current;
}

/** Store permissions fetched elsewhere (e.g. by the login flow). */
export function setAccessPermissions(data: EffectivePermissions | null): void {
    current = data;
    loaded = true;
    try {
        if (data) localStorage.setItem(ACCESS_STORAGE_KEY, JSON.stringify(data));
        else localStorage.removeItem(ACCESS_STORAGE_KEY);
    } catch {
        // Storage may be unavailable (private mode); memory still works.
    }
    notify();
}

/** Refetch the signed-in user's permissions; resolves to the new value (or null). */
export function refreshAccess(): Promise<EffectivePermissions | null> {
    if (inFlight) return inFlight;
    lastFetch = Date.now();
    inFlight = (async () => {
        try {
            const res = await authenticatedFetch(RESOURCE_PERMISSIONS_URL);
            if (!res.ok) return getAccessSnapshot();
            const data = await res.json();
            if (isEffectivePermissions(data)) setAccessPermissions(data);
            return getAccessSnapshot();
        } catch {
            return getAccessSnapshot();
        } finally {
            inFlight = null;
        }
    })();
    return inFlight;
}

function installFocusListener(): void {
    if (focusListenerInstalled || typeof window === "undefined") return;
    focusListenerInstalled = true;
    window.addEventListener("focus", () => {
        if (!localStorage.getItem("jm_access_token")) return;
        if (Date.now() - lastFetch < FOCUS_REFRESH_MIN_MS) return;
        void refreshAccess();
    });
}

/** Subscribe to permission changes (for useSyncExternalStore). */
export function subscribeAccess(listener: Listener): () => void {
    installFocusListener();
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** Forget the permissions (on logout). */
export function clearAccess(): void {
    setAccessPermissions(null);
}
