# External Portals

An **external portal** is a second UI of a host app, for users who are not its
administrators: candidates and employers of a job marketplace, shoppers of a
store, the members of a club. VeloIQ builds a portal from the same standard
pieces as the admin app — the Dynamic Resource lists, record pages and forms,
the vertical and horizontal menus, the Command Center, light and dark mode,
Help, banners and the host app's translations — limited to what the portal's
users may see.

The second half of this page, [Building criteria](#building-criteria), is the
guideline for choosing standard or custom components when building a new
portal.

## Quick start

```bash
veloiq new-portal candidate-portal --role Candidate --title "Candidates"
cd ext/candidate-portal && npm install
veloiq build          # builds the app and every portal
veloiq run            # the portal is at http://localhost:8000/portals/candidate-portal/
```

`veloiq new-portal` creates the portal's frontend (`ext/<site>/`), declares it
in `veloiq.toml` and runs `veloiq generate`, which writes the portal's page
schemas and its menu. The portal is served by the app's own backend, on the
same port, at `/portals/<site>/`; no separate server is needed.

## Declaring a portal (`veloiq.toml`)

```toml
[portals.candidate-portal]
folder = "ext/candidate-portal"            # the portal's frontend
roles = ["Candidate"]                      # the roles of its users
title = "VeilMatch"                        # header and sign-in page
token_storage_key = "veilmatch_candidate_token"  # the browser key of its sign-in session
default_layout = "horizontal"              # or "vertical"
show_dashboard_menu_entry = false          # portals hide the Dashboard entry by default
# anonymous_user = "storefront"            # optional: signed-out visitors browse as this user

[portals.candidate-portal.features]        # the framework's list tools, per site
analyze = false                            # default: off in portals
csv_export = true
saved_views = true
column_selector = true
record_metadata = true
```

Administrators edit the same settings on **Configurations → General
Configuration → Portals** (administrators only), together with each portal's
menu entries and page overrides. Each portal record has an **Open portal**
button.

What a portal's users may read and write is decided on the server, never in
the portal: their roles' methods, the role access policies (Access Control →
Roles), `@model_access`, `veloiq_field(read_roles=…, write_roles=…)` and the
`@rebac` row rules. The feature switches are enforced on the server too
(exports, the server-side Analyze, saving views and layouts). The WYSIWYG page
configuration tool is limited to administrators.

## What `veloiq generate` writes for a portal

For every portal whose folder exists:

| File (in `<folder>/src/`) | Content | Regenerated |
|---|---|---|
| `pages/<module>/<module>Schema.gen.ts` | The module's models with only the fields and relations the portal's roles read (`@model_access`, `veloiq_field(read_roles)`) | Every time |
| `pages/<module>/<module>Schema.manual.ts` | The portal's own overrides: labels, view types, `omit` for fields and relations | Created once |
| `pages/<module>/<module>Schema.ts` | The two merged by `mergeUiModelSchemas` | Every time |
| `portalModels.gen.ts` | The modules `VeloIQPortalApp` loads | Every time |
| `navigation.<site>.config.json` | The portal's menu | Created once |

A portal's menu **is** its menu file: only the entries it lists appear, with
its labels. The other readable models still have their pages (relation links
and record pages open), they are just not in the menu. A `"page"` entry lists
one of the portal's own pages:

```json
{ "key": "deck", "label": "Deck", "icon": "HeartOutlined", "sequence": 10, "type": "page", "route": "/deck" }
```

`portalPageOverrides.json` (edited on the Portals configuration page) holds
more per-field overrides, applied when the portal starts, so a change shows
without rebuilding.

## The portal app (`VeloIQPortalApp`)

```tsx
<VeloIQPortalApp
    site="employer-portal"
    dataProvider={dataProvider(API_URL, httpClient)}
    moduleRegistrations={portalModuleRegistrations}
    navConfig={portalNavigationConfig as NavConfig}
    pageRoutes={portalPageRoutes}          // the site's own pages, loaded on first use
    pageOverrides={portalPageOverrides}    // replacements of standard pages, by resource
    showHeaderButtons={portalShowHeaderButtons}  // buttons on standard record pages, by resource
    landingPath="/job_posting"
    loginPage={<EmployerSignInPage />}     // optional: a custom sign-in (e.g. with a second factor)
/>
```

- **Own pages** (`pageRoutes`): `{ path, loadPage: () => import("./pages/custom/Deck"), availableSignedOut? }`.
  Pages used before signing in (signup) set `availableSignedOut: true`.
- **Standard pages with a few site actions**: give a standard list row actions
  (a `pageOverrides.list` component that renders `DynamicList` with
  `rowActions`), and record pages header buttons (`showHeaderButtons`), instead
  of writing a custom page.
- **Custom sign-in flows**: a page that obtains a token itself (an MFA step, a
  customer sign-in) hands it to the standard sign-in:
  `useLogin().mutateAsync({ accessToken, redirectTo })`.
- **The session**: each portal keeps its own sign-in session under its
  `token_storage_key`, separate from the admin app's even on the same origin.

## Public portals (signed-out visitors)

A portal whose definition sets `anonymous_user` lets visitors browse without
signing in: the backend serves a signed-out request from that portal (header
`X-VeloIQ-Portal: <site>`, sent by the portal) as that user. No password is
kept in `veloiq.toml` and no token reaches the browser. Give that user a role
with an **allowlist access policy** limited to what visitors may read (e.g.
the catalog), and limit any other role of the portal the same way: without a
policy a role reads every model of the app through the generic API.

Signed-out visitors see a **Sign in** button instead of the user menu.

## Creating rows from standard forms

A standard create form only shows what the user edits. Fields the server
derives (the user's company, a denormalized tenant, a name from a title) are
filled by the model before validation:

```python
@classmethod
def veloiq_complete_new_row(cls, payload: dict, user: dict, session) -> dict:
    """Fill the posting's company and tenant from the signed-in employer."""
    ...
    return payload
```

Refuse a row by raising `HTTPException` (e.g. a company the user doesn't
belong to). Hide the derived fields in the portal's overrides (`omit`).

## Building criteria

Follow these steps for each need of a new external portal, for model data and
for non-model data alike.

1. **List the portal's needs** page by page: lists, record pages, forms,
   galleries, flows (signup, onboarding, checkout, matching, chat).
2. **Look for a standard component that fits** each need:
   - lists, tables, galleries, calendars, totals-details and record pages:
     the Dynamic Resource views (DynamicList, DynamicShow, DynamicCreate,
     DynamicEdit) with the view type that fits; a site action is a row action
     or a record-page header button;
   - data that is not a model (configuration files, computed summaries, an
     external service): a [non-model data resource](non-model-data-resources.md), shown with the same
     views;
   - fields or relations the portal's users may read but its pages should not
     show: `omit` in the portal's overrides; data they may not read: the
     server's rules, never the UI.
3. **If a standard component clearly fits** and gives the intended user
   experience, use it.
4. **If not**, ask the requester (the person asking for the app) to decide.
   Present the alternatives with their pros and cons — for example a standard
   list with a row action versus a custom page — and implement their decision.
   Product experiences with no list or record equivalent (a swipe deck, a
   chat, a signup or checkout flow, a payment provider's widget) are usually
   custom pages; build them inside the portal shell, and use standard views
   for any record data inside them.
5. **Decide per site whether it has a performance or SEO target** before
   choosing components for its public pages. Standard components render in the
   browser, as custom ones do; pages that must be read by search engines
   without JavaScript need server-side output (server-side rendering or
   prerendering), which is decided per site and is not provided by the
   standard components. Keep public pages light: the portal loads its own
   pages on first use.

Every portal page, standard or custom, runs inside the portal shell, so it has
the portal's menu, color modes, translations (from the host app's catalogs)
and session.

### Decisions recorded for the existing portals

| Portal | Standard | Custom, inside the shell |
|---|---|---|
| VeilMatch candidates | Sign-in, profile (Candidate record with skills and blocked domains), matches (match summaries), notifications | Swipe deck, chat, signup |
| VeilMatch employers | Job postings (with "View candidates" and "Activate"), matches, billing history | Sign-in with a second factor, MFA enrolment, candidate swipe deck, chat, payment method setup, signup |
| Retail store | Catalog (gallery of the store's products), product pages (with "Add to cart"), customer orders | Customer sign-in, cart, checkout |

The retail store's SEO target was **deferred** (decided for this site): its
catalog and product pages are client-rendered.
