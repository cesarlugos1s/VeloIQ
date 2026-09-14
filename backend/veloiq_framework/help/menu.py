"""Built-in Configurations menu entry for the contextual-help admin page.

Not a real installed extension package — this manifest is never discovered
via the ``veloiq.extensions`` entry-point group. It's constructed directly
and appended to the extensions list the generator already builds, purely to
ride the existing ``user_menu_items`` -> "Configurations" submenu aggregation
in ``api_schema_gen.py`` without needing any change to that logic.
"""
from veloiq_framework.extension import VeloIQExtension


class _HelpMenuManifest(VeloIQExtension):
    # Underscore, not hyphen: `routes` codegen builds a JS import identifier
    # as f"{ext.name}_{component}" — a hyphen there produces invalid JS
    # (confirmed via a live `veloiq generate` run once `routes` was added
    # below; harmless before that, since `user_menu_items`-only extensions
    # never feed `name` into an identifier).
    name = "veloiq_help_menu"
    modules_package = "veloiq_framework.help"
    frontend_components_dir = "help/frontend/components"

    routes = [
        {
            "path": "/veloiq-generate-user-guide",
            "component": "GenerateUserGuidePage",
            "source": "GenerateUserGuidePage.tsx",
            "export": "default",
        },
    ]

    user_menu_items = [
        {
            "key": "veloiq-help-content",
            "label": "Help Content",
            "route": "/veloiq_help_document",
            "group": "Help Content",
            "icon": "QuestionCircleOutlined",
        },
        {
            "key": "veloiq-generate-user-guide",
            "label": "Generate User Guide",
            "route": "/veloiq-generate-user-guide",
            "group": "Help Content",
            "icon": "FilePdfOutlined",
            "roles": ["Admin"],
        },
    ]


def get_help_menu_manifest() -> VeloIQExtension:
    return _HelpMenuManifest()
