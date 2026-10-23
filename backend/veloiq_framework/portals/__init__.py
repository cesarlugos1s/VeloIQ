"""External portals of a host app: their definitions (``veloiq.toml``), the
framework UI features each site enables, and the endpoints their frontends read.

See :mod:`veloiq_framework.portals.read_portal_definitions` and
:mod:`veloiq_framework.portals.framework_ui_features`.
"""
from veloiq_framework.portals.framework_ui_features import (
    FRAMEWORK_UI_FEATURE_NAMES,
    FRAMEWORK_UI_FEATURES,
    framework_ui_feature_key,
    framework_ui_features_for_user,
    register_framework_ui_features,
    require_framework_ui_feature,
)
from veloiq_framework.portals.read_portal_definitions import (
    PortalDefinition,
    portal_definitions_of_user,
    read_portal_definitions,
)

__all__ = [
    "FRAMEWORK_UI_FEATURE_NAMES",
    "FRAMEWORK_UI_FEATURES",
    "PortalDefinition",
    "framework_ui_feature_key",
    "framework_ui_features_for_user",
    "portal_definitions_of_user",
    "read_portal_definitions",
    "register_framework_ui_features",
    "require_framework_ui_feature",
]
