"""Serve each external portal's built frontend from the host app at ``/portals/<site>/``.

``veloiq build`` builds every portal declared in ``veloiq.toml`` (its
``<folder>/dist``, built with the Vite base ``/portals/<site>/``), and the
backend serves it next to the app's own UI, on the same origin: one process
and one port serve the admin app, every portal and the API. A portal's pages
fall back to its ``index.html`` (client-side routes), and the HTML is sent
with ``Cache-Control: no-cache`` like the app's own.

A portal that is declared but not built is simply not served (a message says so).
"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI

from veloiq_framework.portals.read_portal_definitions import PortalDefinition, read_portal_definitions

#: URL prefix of the portals (``/portals/<site>/``).
PORTALS_URL_PREFIX = "/portals/"


def portal_url_path(site: str) -> str:
    """Return the URL path the portal *site* is served at (no trailing slash)."""
    return f"{PORTALS_URL_PREFIX}{site}"


def portal_dist_dir(project_root: Path, portal: PortalDefinition) -> Path:
    """Return the folder of *portal*'s production build."""
    return project_root / portal.folder / "dist"


def mount_built_portals(app: FastAPI) -> None:
    """Mount every built portal of the host app at ``/portals/<site>/``."""
    from veloiq_framework.extension_registry import find_config_file
    from veloiq_framework.factory import _SPAFiles

    config_file = find_config_file()
    if config_file is None:
        return
    project_root = config_file.parent
    for portal in read_portal_definitions(project_root).values():
        dist = portal_dist_dir(project_root, portal)
        url_path = portal_url_path(portal.site)
        if not (dist / "index.html").is_file():
            print(f"  ⏭️  Portal {portal.site}: not built ({dist}) — run `veloiq build`")
            continue
        app.mount(url_path, _SPAFiles(directory=str(dist), html=True), name=f"portal_{portal.site}")
        print(f"  🌐 Portal {portal.site}: {url_path}/ → {dist}")
