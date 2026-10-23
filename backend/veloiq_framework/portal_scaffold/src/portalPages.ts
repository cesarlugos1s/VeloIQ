import type { PortalPageOverrides, PortalPageRoute } from "@juicemantics/veloiq-ui";

/**
 * The portal's own pages, each loaded when first opened. List a page in
 * navigation.{{site}}.config.json as a "page" entry to show it in the menu:
 *     { "key": "welcome", "label": "Welcome", "icon": "HomeOutlined", "sequence": 0, "type": "page", "route": "/welcome" }
 * Pages used before signing in (e.g. a signup page) set availableSignedOut.
 */
export const portalPageRoutes: PortalPageRoute[] = [
    // { path: "/welcome", loadPage: () => import("./pages/custom/WelcomePage") },
    // { path: "/signup", loadPage: () => import("./pages/custom/SignupPage"), availableSignedOut: true },
];

/** The portal's replacements for standard list / show / create / edit pages, by resource. */
export const portalPageOverrides: PortalPageOverrides = {
    // show: { candidate: CandidateProfilePage },
};
