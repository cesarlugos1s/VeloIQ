/**
 * Where the signed-in session is kept in the browser (localStorage keys).
 *
 * The admin app keeps its session under the ``jm_*`` keys. An external portal
 * served from the same origin (``/portals/<site>/``) must keep its own session,
 * or signing in to one would sign in (or out) the other. ``VeloIQPortalApp``
 * therefore calls ``setSignInStorageNamespace(<the portal's token storage key>)``
 * before anything reads the session, and every key below is derived from it.
 *
 * Every module that reads or writes the session (auth provider, HTTP clients,
 * access stores) asks this module for its key, never a literal.
 */

const ADMIN_APP_SIGN_IN_STORAGE_KEYS = {
    accessToken: "jm_access_token",
    signedInUser: "jm_user",
    rolePermissions: "jm_role_permissions",
    resourcePermissions: "jm_resource_permissions",
};

export type SignInStorageKeys = typeof ADMIN_APP_SIGN_IN_STORAGE_KEYS;

let activeSignInStorageKeys: SignInStorageKeys = ADMIN_APP_SIGN_IN_STORAGE_KEYS;
/** The portal's namespace (its token storage key), or null in the admin app. */
let activeSignInStorageNamespace: string | null = null;

/**
 * Keep the session under *accessTokenStorageKey* and keys derived from it
 * (``<key>:user``, ``<key>:role_permissions``, ``<key>:resource_permissions``).
 * Call once, before the app first renders.
 */
export function setSignInStorageNamespace(accessTokenStorageKey: string): void {
    activeSignInStorageNamespace = accessTokenStorageKey;
    activeSignInStorageKeys = {
        accessToken: accessTokenStorageKey,
        signedInUser: `${accessTokenStorageKey}:user`,
        rolePermissions: `${accessTokenStorageKey}:role_permissions`,
        resourcePermissions: `${accessTokenStorageKey}:resource_permissions`,
    };
}

/** Return the localStorage keys of the current session. */
export function signInStorageKeys(): SignInStorageKeys {
    return activeSignInStorageKeys;
}

/** Return the signed-in user's access token, or null when signed out. */
export function readAccessToken(): string | null {
    return localStorage.getItem(activeSignInStorageKeys.accessToken);
}

/**
 * Return the localStorage key of the per-browser preference *preferenceName*
 * (menu layout, collapsed menus...) for this app: the name itself in the admin
 * app, ``<namespace>:<name>`` in a portal, so each site keeps its own choices.
 */
export function siteScopedStorageKey(preferenceName: string): string {
    return activeSignInStorageNamespace ? `${activeSignInStorageNamespace}:${preferenceName}` : preferenceName;
}
