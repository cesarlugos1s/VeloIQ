/**
 * Drop-in replacement for ``fetch()`` that injects the JWT Bearer token
 * from localStorage into the ``Authorization`` header.
 *
 * Existing custom_show / custom_edit pages that use raw ``fetch()`` can
 * switch to this wrapper so requests are authenticated.
 */

const TOKEN_KEY = "jm_access_token";

export const authenticatedFetch = (
    url: string,
    options: RequestInit = {},
): Promise<Response> => {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> | undefined),
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers });
};
