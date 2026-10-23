/**
 * Concurrent-edit detection for non-model data resources, in the HTTP layer.
 *
 * The backend marks responses whose rows carry a `_revision` (non-model data
 * resources) with the `X-VeloIQ-Row-Revisions` header. The two HTTP helpers
 * (`httpClient` for Refine's data provider and `authenticatedFetch` for the
 * Dynamic Resource views) remember each row's revision by its URL, and send it
 * back as `If-Match` when that row is changed or deleted. The backend refuses
 * the write with 409 when someone else changed the row in between, so every
 * standard view gets the check without code of its own.
 */

/** Response header of the rows that carry `_revision`. */
export const ROW_REVISIONS_RESPONSE_HEADER = "x-veloiq-row-revisions";

/** Last revision read for each row, keyed by the row's decoded URL path. */
const rowRevisionsByRowPath = new Map<string, string>();

/** Return the decoded path of a URL (no origin, no query), with no trailing slash. */
function decodedRowUrlPath(url: string): string {
    let path = url;
    try {
        path = new URL(url, "http://local").pathname;
    } catch {
        path = url.split("?")[0];
    }
    try {
        path = decodeURIComponent(path);
    } catch {
        // Keep the path as it is when it isn't valid percent-encoding.
    }
    return path.replace(/\/+$/, "");
}

/**
 * Remember the revisions of the rows in a response body.
 *
 * @param url  The request URL: a list (`/api/x?...`) or a row (`/api/x/<eid>`).
 * @param body The parsed response: an array of rows, or one row.
 */
export function rememberRowRevisions(url: string, body: unknown): void {
    const path = decodedRowUrlPath(url);
    if (Array.isArray(body)) {
        for (const row of body) {
            if (row && typeof row === "object" && (row as any)._revision && (row as any).eid != null) {
                rowRevisionsByRowPath.set(`${path}/${(row as any).eid}`, String((row as any)._revision));
            }
        }
        return;
    }
    if (body && typeof body === "object" && (body as any)._revision) {
        const eid = (body as any).eid;
        // A create (POST to the list) answers with the new row: key it under the list path.
        const key = eid != null && !path.endsWith(`/${eid}`) ? `${path}/${eid}` : path;
        rowRevisionsByRowPath.set(key, String((body as any)._revision));
    }
}

/** Return the `If-Match` value for a write to a row, or undefined when none is known. */
export function rowRevisionFor(url: string, method: string | undefined): string | undefined {
    const verb = (method || "GET").toUpperCase();
    if (verb !== "PUT" && verb !== "PATCH" && verb !== "DELETE") return undefined;
    return rowRevisionsByRowPath.get(decodedRowUrlPath(url));
}
