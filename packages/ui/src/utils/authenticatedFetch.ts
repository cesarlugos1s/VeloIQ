/**
 * Drop-in replacement for ``fetch()`` that injects the JWT Bearer token
 * from localStorage into the ``Authorization`` header.
 *
 * Existing custom_show / custom_edit pages that use raw ``fetch()`` can
 * switch to this wrapper so requests are authenticated.
 */

import { getActiveLocale } from "./activeLocale";
import { ROW_REVISIONS_RESPONSE_HEADER, rememberRowRevisions, rowRevisionFor } from "./trackRowRevisions";
import { answerInPageRowsRequest } from "./serveInPageRowsStores";
import { readAccessToken } from "./signInStorageKeys";


export const authenticatedFetch = (
    url: string,
    options: RequestInit = {},
): Promise<Response> => {
    // Rows that exist only in the page are answered from their store (see serveInPageRowsStores).
    const inPageAnswer = answerInPageRowsRequest(url, options.method, options.body);
    if (inPageAnswer) {
        const responseBody = inPageAnswer.body === null || inPageAnswer.status === 204
            ? null
            : typeof inPageAnswer.body === "string" ? inPageAnswer.body : JSON.stringify(inPageAnswer.body);
        return Promise.resolve(new Response(responseBody, { status: inPageAnswer.status, headers: inPageAnswer.headers }));
    }
    const token = readAccessToken();
    const headers: Record<string, string> = {
        ...(options.headers as Record<string, string> | undefined),
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    if (!headers["Accept-Language"]) {
        headers["Accept-Language"] = getActiveLocale();
    }
    // Concurrent-edit check of non-model data resource rows (see trackRowRevisions).
    const revision = rowRevisionFor(url, options.method);
    if (revision && !headers["If-Match"]) {
        headers["If-Match"] = revision;
    }
    return fetch(url, { ...options, headers }).then((response) => {
        if (response.ok && response.headers?.get?.(ROW_REVISIONS_RESPONSE_HEADER)) {
            response.clone().json().then((body) => rememberRowRevisions(url, body)).catch(() => undefined);
        }
        return response;
    });
};
