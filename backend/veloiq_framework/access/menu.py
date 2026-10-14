"""Built-in Configurations menu entry and route for the Access Policies screen.

Not a real installed extension package — this manifest is never discovered via
the ``veloiq.extensions`` entry-point group. It is appended to the extensions
list the generator already builds (like the Help and System Configuration
manifests), so ``veloiq generate`` delivers the page to the host app's
frontend and lists it under Configurations → Access Control, for the Admin
role only (AC-A1, AC-A2).
"""
from veloiq_framework.extension import VeloIQExtension


class _AccessPoliciesMenuManifest(VeloIQExtension):
    # Underscore, not hyphen: `routes` codegen builds a JS import identifier
    # from the extension name (see help/menu.py).
    name = "veloiq_access_policies"
    # Resolves the package directory the frontend components dir is relative to.
    modules_package = "veloiq_framework.access"
    frontend_components_dir = "access/frontend/components"

    routes = [
        {
            "path": "/access-policies",
            "component": "AccessPoliciesPage",
            "source": "AccessPoliciesPage.tsx",
            "export": "default",
        },
    ]

    user_menu_items = [
        {
            "key": "veloiq-access-policies",
            "label": "Access Policies",
            "route": "/access-policies",
            "group": "Access Control",
            "icon": "SafetyCertificateOutlined",
            "roles": ["Admin"],
        },
    ]


def get_access_policies_menu_manifest() -> VeloIQExtension:
    """Return the built-in Access Policies manifest."""
    return _AccessPoliciesMenuManifest()
