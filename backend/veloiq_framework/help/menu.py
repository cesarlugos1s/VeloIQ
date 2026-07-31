"""Built-in Configurations menu entry for the contextual-help admin page.

Not a real installed extension package — this manifest is never discovered
via the ``veloiq.extensions`` entry-point group. It's constructed directly
and appended to the extensions list the generator already builds, purely to
ride the existing ``user_menu_items`` -> "Configurations" submenu aggregation
in ``api_schema_gen.py`` without needing any change to that logic.
"""
from veloiq_framework.extension import VeloIQExtension


class _HelpMenuManifest(VeloIQExtension):
    name = "veloiq-help-menu"
    modules_package = "veloiq_framework.help"

    user_menu_items = [
        {
            "key": "veloiq-help-content",
            "label": "Help Content",
            "route": "/veloiq_help_document",
            "group": "Help Content",
            "icon": "QuestionCircleOutlined",
        },
    ]


def get_help_menu_manifest() -> VeloIQExtension:
    return _HelpMenuManifest()
