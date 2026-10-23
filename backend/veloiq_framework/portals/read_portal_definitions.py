"""External portal definitions, from the ``[portals.<site>]`` tables of ``veloiq.toml``.

An external portal (e.g. VeilMatch's candidate site) is a separate UI for users
who are not administrators. Each one is declared once in the host app's
``veloiq.toml``::

    [portals.candidate-portal]
    folder = "ext/candidate-portal"         # the portal's frontend (veloiq new-portal)
    roles = ["Candidate"]                   # the roles of its users
    title = "VeilMatch"                     # shown in its header
    token_storage_key = "veilmatch_candidate_token"  # where its sign-in token is kept
    default_layout = "horizontal"           # "vertical" or "horizontal" menu
    show_dashboard_menu_entry = false       # default: false in portals

    [portals.candidate-portal.features]     # framework UI features (see framework_ui_features)
    analyze = false                         # default: false in portals
    csv_export = true                       # default: true

What a portal's users may read and write stays on the server: their roles'
access policies, ``veloiq_field(read_roles=…, write_roles=…)`` and the
``@rebac`` row filters. The definition only adds the site's menu and feature
profile, and tells ``veloiq generate`` which roles its page schemas are for.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

#: Menu layouts a portal can open with.
PORTAL_LAYOUTS = ("vertical", "horizontal")


@dataclass
class PortalDefinition:
    """One external portal of the host app."""

    site: str
    folder: str
    roles: list[str] = field(default_factory=list)
    title: str = ""
    token_storage_key: str = ""
    default_layout: str = "horizontal"
    show_dashboard_menu_entry: bool = False
    #: Framework UI features switched on or off for this site (unlisted ones use their portal default).
    features: dict[str, bool] = field(default_factory=dict)

    def to_public_settings(self) -> dict:
        """Return what the portal's frontend needs before anyone signs in (no roles)."""
        return {
            "site": self.site,
            "title": self.title,
            "token_storage_key": self.token_storage_key,
            "default_layout": self.default_layout,
            "show_dashboard_menu_entry": self.show_dashboard_menu_entry,
        }


def _portal_definition_from_table(site: str, table: dict) -> PortalDefinition:
    """Return the portal *site* declared by its ``[portals.<site>]`` *table*."""
    layout = str(table.get("default_layout") or "horizontal")
    features = table.get("features") if isinstance(table.get("features"), dict) else {}
    return PortalDefinition(
        site=site,
        folder=str(table.get("folder") or f"ext/{site}"),
        roles=[str(role) for role in (table.get("roles") or [])],
        title=str(table.get("title") or site),
        token_storage_key=str(table.get("token_storage_key") or f"{site}_token"),
        default_layout=layout if layout in PORTAL_LAYOUTS else "horizontal",
        show_dashboard_menu_entry=bool(table.get("show_dashboard_menu_entry", False)),
        features={str(name): bool(value) for name, value in features.items()},
    )


def read_portal_definitions(start: Path | str | None = None) -> dict[str, PortalDefinition]:
    """Return the host app's portals, keyed by site, from the nearest ``veloiq.toml``.

    No file, no ``[portals]`` table or a file that can't be read → no portals.
    """
    from veloiq_framework.extension_registry import _load_toml, find_config_file

    config_file = find_config_file(start)
    if config_file is None:
        return {}
    try:
        data = _load_toml(config_file)
    except Exception:
        return {}
    portals = data.get("portals")
    if not isinstance(portals, dict):
        return {}
    return {
        str(site): _portal_definition_from_table(str(site), table)
        for site, table in portals.items()
        if isinstance(table, dict)
    }


def portal_definitions_of_user(user: Optional[dict], portal_definitions: dict[str, PortalDefinition]) -> list[PortalDefinition]:
    """Return the portals whose roles include one of *user*'s roles."""
    roles = set((user or {}).get("roles") or [])
    return [portal for portal in portal_definitions.values() if roles & set(portal.roles)]
