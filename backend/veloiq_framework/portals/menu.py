"""Built-in Configurations menu entry and page button of the Portals configuration page.

Not a real installed extension package — this manifest is never discovered via
the ``veloiq.extensions`` entry-point group. Like the System Configuration
manifest (``system_config/menu.py``), it is constructed directly and appended
to the extensions list ``veloiq generate`` builds, so its menu entry and its
Show header button reach the host app's frontend through the standard
extension mechanisms:

* Configurations → General Configuration → Portals (administrators only),
  the standard pages of the ``veloiq_portals`` non-model data resource;
* "Open portal" on a portal's record page (``show_header_button_components``),
  opening ``/portals/<site>/`` in a new tab.
"""
from veloiq_framework.extension import VeloIQExtension


class _PortalsMenuManifest(VeloIQExtension):
    # Underscore, not hyphen: codegen builds JS import identifiers from the name.
    name = "veloiq_portals"
    # Resolves the package directory the frontend components dir is relative to.
    modules_package = "veloiq_framework.portals"
    frontend_components_dir = "portals/frontend/components"

    global_components = [
        {
            "component": "OpenPortalShowHeaderButton",
            "source": "OpenPortalShowHeaderButton.tsx",
            "export": "default",
            "export_name": "openPortalShowHeaderButton",
        },
    ]
    # Rendered by every standard Show page; the button shows only on a portal's record.
    show_header_button_components = ["openPortalShowHeaderButton"]

    user_menu_items = [
        {
            # Portals — the external portals of veloiq.toml ([portals.*]): the
            # standard pages of the veloiq_portals non-model data resource.
            "key": "veloiq-portals",
            "label": "Portals",
            "route": "/veloiq_portals",
            "group": "General Configuration",
            "icon": "GlobalOutlined",
            "roles": ["Admin"],
        },
    ]


def get_portals_menu_manifest() -> VeloIQExtension:
    """Return the built-in Portals manifest."""
    return _PortalsMenuManifest()
