"""Endpoints the standard pages and the external portals' frontends read.

* ``GET /api/veloiq/ui-features`` — the framework UI features the signed-in
  user may use (``framework_ui_features``), so the pages hide the others;
* ``GET /api/veloiq/portals/{site}`` — a portal's public settings (title, menu
  layout, Dashboard entry, where its sign-in token is kept), read by the
  portal's frontend before anyone signs in; never its roles;
* ``GET /api/veloiq/portals/{site}/configuration`` — the portal's menu and page
  overrides (its configuration files), read by the portal when it starts, so a
  change on the Portals pages shows without rebuilding the portal;
* ``GET /api/veloiq/role-names`` — every role name, for the Portals page (administrators).
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from veloiq_framework.portals.framework_ui_features import framework_ui_features_for_user
from veloiq_framework.portals.read_portal_definitions import portal_definitions_of_user, read_portal_definitions
from veloiq_framework.utils.i18n_utils import _

#: Path of the portals' public settings (exempt from sign-in).
PORTAL_PUBLIC_SETTINGS_PATH_PREFIX = "/api/veloiq/portals/"

portal_settings_router = APIRouter(prefix="/veloiq", tags=["VELOIQ-PORTALS"])


@portal_settings_router.get("/ui-features")
def get_framework_ui_features(request: Request) -> dict:
    """Return the framework UI features of the signed-in user, and the portal their roles belong to."""
    user = getattr(request.state, "user", None)
    portal_definitions = read_portal_definitions()
    user_portals = portal_definitions_of_user(user, portal_definitions)
    return {
        "features": framework_ui_features_for_user(user, portal_definitions),
        "portal": user_portals[0].site if user_portals else None,
    }


@portal_settings_router.get("/role-names")
def get_role_names(request: Request) -> list[str]:
    """Return every role name (administrators only): the choices of a portal's roles."""
    from veloiq_framework.portals.portal_definitions_non_model_data_resource import list_role_names
    return list_role_names(request)


@portal_settings_router.get("/portals/{site}")
def get_portal_public_settings(site: str) -> dict:
    """Return the public settings of the portal *site* (404 when the app declares no such portal)."""
    portal = read_portal_definitions().get(site)
    if portal is None:
        raise HTTPException(status_code=404, detail=_("This portal is not declared in veloiq.toml."))
    return portal.to_public_settings()


@portal_settings_router.get("/portals/{site}/configuration")
def get_portal_runtime_configuration(site: str) -> dict:
    """Return the portal *site*'s menu and page overrides (404 when the app declares no such portal)."""
    from veloiq_framework.portals.portal_configuration_files_non_model_data_resources import (
        read_portal_runtime_configuration,
    )
    return read_portal_runtime_configuration(site)
