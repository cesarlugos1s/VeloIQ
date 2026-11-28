"""Built-in Configurations menu entries and record pages of the shared connection registry.

Like the System Configuration console, this is not an installed extension package: the manifest is appended to the extensions the
generator builds, so the pages are delivered to the host app's frontend by ``veloiq generate``. The lists, side panels and record pages
are the standard ones of the registry's non-model data resources (see connection_registry_non_model_data_resources.py); the manifest
adds the menu entries (for administrators) and the show and create overrides that embed the shared operation interface.
"""
from veloiq_framework.extension import VeloIQExtension


class _ConnectionRegistryMenuManifest(VeloIQExtension):
    # Underscore, not hyphen: the codegen builds a JS import identifier from the extension name.
    name = "veloiq_connection_registry"
    modules_package = "veloiq_framework.shared_connection_registry"
    frontend_components_dir = "shared_connection_registry/frontend/components"

    show_overrides = [
        {"resource": "veloiq_registry_connections", "component": "ConnectionShow", "source": "ConnectionRegistryPages.tsx", "export": "ConnectionShow"},
        {"resource": "veloiq_registry_operations", "component": "OperationShow", "source": "ConnectionRegistryPages.tsx", "export": "OperationShow"},
    ]

    create_overrides = [
        {"resource": "veloiq_registry_operations", "component": "OperationCreate", "source": "ConnectionRegistryPages.tsx", "export": "OperationCreate"},
    ]

    user_menu_items = [
        {"key": "veloiq-registry-connections", "label": "Connections", "route": "/veloiq_registry_connections",
         "group": "General Configuration", "icon": "ApiOutlined", "roles": ["Admin"]},
        {"key": "veloiq-registry-operations", "label": "Operations", "route": "/veloiq_registry_operations",
         "group": "General Configuration", "icon": "ThunderboltOutlined", "roles": ["Admin"]},
    ]


def get_connection_registry_menu_manifest() -> VeloIQExtension:
    """Return the built-in manifest of the connection registry."""
    return _ConnectionRegistryMenuManifest()
