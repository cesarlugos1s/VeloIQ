/**
 * Which external portal the app is (if any) and whether it lets signed-out visitors browse.
 *
 * Set once by ``VeloIQPortalApp`` from the portal's public settings. Every API
 * request then names the portal (header ``X-VeloIQ-Portal``), so the backend can
 * serve a signed-out visitor of a public portal as that portal's anonymous user
 * (``[portals.<site>] anonymous_user``; backend: portals/portal_anonymous_visitors.py).
 * The admin app sets nothing and sends no such header.
 */

/** Request header naming the portal (backend PORTAL_REQUEST_HEADER). */
export const PORTAL_REQUEST_HEADER = "X-VeloIQ-Portal";

let activePortalSite: string | null = null;
let activePortalAllowsSignedOutVisitors = false;

/** Record the portal the app is, and whether signed-out visitors may browse it. */
export function setPortalRequestContext(site: string, allowsSignedOutVisitors: boolean): void {
    activePortalSite = site;
    activePortalAllowsSignedOutVisitors = allowsSignedOutVisitors;
}

/** The portal's site key, or null in the admin app. */
export function portalSiteOfRequests(): string | null {
    return activePortalSite;
}

/** Whether the app is a portal whose signed-out visitors may browse. */
export function signedOutVisitorsAllowed(): boolean {
    return activePortalAllowsSignedOutVisitors;
}
