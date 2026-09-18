"""Built-in Configurations menu entry and route for the System Configuration Console.

Not a real installed extension package — this manifest is never discovered via
the ``veloiq.extensions`` entry-point group. It is constructed directly and
appended to the extensions list the generator already builds (like the Help
manifest), so the page is delivered to the host app's frontend by
``veloiq generate`` and listed under Configurations → General Configuration.
"""
from veloiq_framework.extension import VeloIQExtension


class _SystemConfigMenuManifest(VeloIQExtension):
    # Underscore, not hyphen: `routes` codegen builds a JS import identifier
    # from the extension name (see help/menu.py).
    name = "veloiq_system_config"
    # Resolves the package directory the frontend components dir is relative to.
    modules_package = "veloiq_framework.system_config"
    frontend_components_dir = "system_config/frontend/components"

    routes = [
        {
            # System Configuration — application-wide settings for logging,
            # UI appearance (color schemas, base colors), and view defaults
            # (gallery dimensions, relation limits, action button placement,
            # right-side panel layout).
            "path": "/system-config",
            "component": "SystemConfigConsole",
            "source": "SystemConfigConsole.tsx",
            "export": "default",
        },
    ]

    user_menu_items = [
        {
            "key": "veloiq-system-config",
            "label": "System Configuration",
            "route": "/system-config",
            "group": "General Configuration",
            "icon": "SettingOutlined",
        },
    ]


def get_system_config_menu_manifest() -> VeloIQExtension:
    """Return the built-in System Configuration manifest."""
    return _SystemConfigMenuManifest()
