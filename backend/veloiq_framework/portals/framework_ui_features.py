"""The framework's own UI features, switched on or off per role and per external portal.

The standard pages offer tools that administrators need but a portal's users
(candidates, employers, shoppers) usually don't. Each one is a feature of the
shared access registry, so a role's feature policy (Access Control → Roles)
can turn it off, and each portal's ``[portals.<site>.features]`` table sets it
for that site's users:

==================  ====================================================  ==============
feature             what it covers                                         portal default
==================  ====================================================  ==============
analyze             the Analyze section (charts, summaries) of lists       off
csv_export          CSV export of lists and of selected rows               on
saved_views         saving views and page layouts (preferences)            on
column_selector     choosing a list's columns                              on
record_metadata     the model metadata window                              on
==================  ====================================================  ==============

A user gets a feature when their roles' feature policy allows it and, when
their roles belong to a portal, that portal enables it. Administrators always
get every feature. The server refuses what a feature covers (exports, the
server-side Analyze, saving preferences) with ``require_framework_ui_feature``,
and the UI hides it (``GET /api/veloiq/ui-features``).
"""
from __future__ import annotations

from typing import Optional

from fastapi import Request

from veloiq_framework.portals.read_portal_definitions import (
    PortalDefinition,
    portal_definitions_of_user,
    read_portal_definitions,
)

#: Source name of the framework's features in the access registry (keys ``veloiq:<name>``).
FRAMEWORK_UI_FEATURE_SOURCE = "veloiq"

#: The framework UI features: name, label (catalog msgid), default in external portals.
FRAMEWORK_UI_FEATURES: tuple[tuple[str, str, bool], ...] = (
    ("analyze", "Analyze section of lists", False),
    ("csv_export", "CSV export", True),
    ("saved_views", "Saved views and page layouts", True),
    ("column_selector", "Column selector", True),
    ("record_metadata", "Model metadata", True),
)
FRAMEWORK_UI_FEATURE_NAMES = tuple(name for name, _label, _default in FRAMEWORK_UI_FEATURES)
_PORTAL_DEFAULT_BY_FEATURE = {name: default for name, _label, default in FRAMEWORK_UI_FEATURES}


def framework_ui_feature_key(name: str) -> str:
    """Return the access-registry key of the framework UI feature *name*."""
    return f"{FRAMEWORK_UI_FEATURE_SOURCE}:{name}"


def register_framework_ui_features() -> None:
    """Register the framework UI features in the access registry (role feature policies can name them)."""
    from veloiq_framework.access.registry import register_feature

    for name, label, _portal_default in FRAMEWORK_UI_FEATURES:
        register_feature(FRAMEWORK_UI_FEATURE_SOURCE, name, label, group="User interface")


def _portal_enables(portal: PortalDefinition, name: str) -> bool:
    """Whether *portal* enables the feature *name* (its own setting, else the portal default)."""
    return portal.features.get(name, _PORTAL_DEFAULT_BY_FEATURE[name])


def framework_ui_features_for_user(user: Optional[dict],
                                   portal_definitions: Optional[dict[str, PortalDefinition]] = None) -> dict[str, bool]:
    """Return, for each framework UI feature, whether *user* may use it."""
    from veloiq_framework.access.decision import ADMIN_ROLE, can_use_feature

    roles = set((user or {}).get("roles") or [])
    if ADMIN_ROLE in roles:
        return {name: True for name in FRAMEWORK_UI_FEATURE_NAMES}
    if portal_definitions is None:
        portal_definitions = read_portal_definitions()
    user_portals = portal_definitions_of_user(user, portal_definitions)
    features = {}
    for name in FRAMEWORK_UI_FEATURE_NAMES:
        allowed_by_role = bool(can_use_feature(user, framework_ui_feature_key(name))) if user else True
        allowed_by_portal = not user_portals or any(_portal_enables(portal, name) for portal in user_portals)
        features[name] = allowed_by_role and allowed_by_portal
    return features


def require_framework_ui_feature(name: str):
    """Return a FastAPI dependency that refuses the request (403) when the user may not use *name*.

    Requests without a signed-in user are left to the auth middleware.
    """
    if name not in FRAMEWORK_UI_FEATURE_NAMES:
        raise ValueError(f"Unknown framework UI feature '{name}'")

    def _require_framework_ui_feature(request: Request) -> None:
        user = getattr(request.state, "user", None)
        if user is None:
            return
        if not framework_ui_features_for_user(user).get(name, False):
            from veloiq_framework.access.decision import denied_exception

            raise denied_exception()

    return _require_framework_ui_feature
