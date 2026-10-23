"""The external portals of the host app as a non-model data resource (administrators only).

Each ``[portals.<site>]`` table of ``veloiq.toml`` (with its
``[portals.<site>.features]`` table) is one row of ``/api/veloiq_portals``, so
the Portals page (Configurations → General Configuration → Portals) is the
standard list, show, create and edit pages of that resource: no page code of
its own. Administrators change a portal's title, roles, menu layout, Dashboard
entry and feature switches, declare a new portal or remove one. Creating the
portal's frontend and building it stay with ``veloiq new-portal`` and
``veloiq build`` (they need npm); the row shows whether the portal is built and
where it is served.

Only the edited portal's tables are rewritten; the rest of ``veloiq.toml``
(other tables, comments) is kept as it is. The settings take effect at once:
the portals' public settings and feature profiles are read from the file on
every request.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from fastapi import HTTPException, Request
from sqlmodel import Session, select

from veloiq_framework.non_model_data_resources import (
    DataSourceRequestContext,
    NonModelDataField,
    NonModelDataRelation,
    NonModelDataResource,
    PythonFunctionsDataSource,
)
from veloiq_framework.portals.framework_ui_features import FRAMEWORK_UI_FEATURES
from veloiq_framework.portals.portal_configuration_files_non_model_data_resources import (
    PORTAL_FIELD_OVERRIDES_RESOURCE_NAME,
    PORTAL_MENU_ENTRIES_RESOURCE_NAME,
)
from veloiq_framework.portals.read_portal_definitions import (
    PORTAL_LAYOUTS,
    PortalDefinition,
    read_portal_definitions,
)
from veloiq_framework.portals.serve_built_portals import portal_dist_dir, portal_url_path
from veloiq_framework.utils.views_utils import jm_log
from veloiq_framework.utils.i18n_utils import _

#: Name of the resource (endpoint ``/api/veloiq_portals``, page ``/veloiq_portals``).
PORTALS_RESOURCE_NAME = "veloiq_portals"

#: Path (under ``/api``) answering the role names offered for a portal's roles.
PORTAL_ROLE_NAMES_PATH = "/veloiq/role-names"

_SITE_NAME_PATTERN = re.compile(r"^[a-z][a-z0-9-]*$")
_TOML_TABLE_HEADER_PATTERN = re.compile(r"^\s*\[([^\[\]]+)\]\s*(#.*)?$")


def _project_veloiq_toml() -> Path:
    """Return the host app's ``veloiq.toml`` (404 when there is none)."""
    from veloiq_framework.extension_registry import find_config_file

    config_file = find_config_file()
    if config_file is None:
        raise HTTPException(status_code=404, detail=_("veloiq.toml not found in project"))
    return config_file


def _portal_row(portal: PortalDefinition, project_root: Path) -> dict:
    """Return the row of *portal*: its settings, effective feature switches, build state and address."""
    row: dict[str, Any] = {
        "site": portal.site,
        "title": portal.title,
        "roles": list(portal.roles),
        "default_layout": portal.default_layout,
        "show_dashboard_menu_entry": portal.show_dashboard_menu_entry,
        "folder": portal.folder,
        "token_storage_key": portal.token_storage_key,
        "built": (portal_dist_dir(project_root, portal) / "index.html").is_file(),
        "address": f"{portal_url_path(portal.site)}/",
    }
    for name, _label, portal_default in FRAMEWORK_UI_FEATURES:
        row[name] = portal.features.get(name, portal_default)
    return row


def _load_portal_rows(request_context: DataSourceRequestContext) -> list[dict]:
    """Return one row per portal declared in ``veloiq.toml``."""
    config_file = _project_veloiq_toml()
    return [_portal_row(portal, config_file.parent) for portal in read_portal_definitions(config_file.parent).values()]


def _toml_string(value: str) -> str:
    """Return *value* as a TOML basic string."""
    from veloiq_framework.system_config.read_write_system_config_files import toml_dump_scalar

    return toml_dump_scalar(str(value))


def _portal_toml_tables(row: dict) -> str:
    """Return the ``[portals.<site>]`` and ``[portals.<site>.features]`` tables of *row*."""
    site = row["site"]
    roles = ", ".join(_toml_string(role) for role in row.get("roles") or [])
    lines = [
        f"[portals.{site}]",
        f"folder = {_toml_string(row.get('folder') or f'ext/{site}')}",
        f"roles = [{roles}]",
        f"title = {_toml_string(row.get('title') or site)}",
        f"token_storage_key = {_toml_string(row.get('token_storage_key') or f'{site}_token')}",
        f"default_layout = {_toml_string(row.get('default_layout') or PORTAL_LAYOUTS[1])}",
        f"show_dashboard_menu_entry = {'true' if row.get('show_dashboard_menu_entry') else 'false'}",
        "",
        f"[portals.{site}.features]",
    ]
    for name, _label, portal_default in FRAMEWORK_UI_FEATURES:
        enabled = row.get(name)
        lines.append(f"{name} = {'true' if (portal_default if enabled is None else enabled) else 'false'}")
    return "\n".join(lines) + "\n"


def _write_portal_tables(site: str, new_tables: str | None) -> None:
    """Replace the tables of portal *site* in ``veloiq.toml`` by *new_tables* (``None`` removes them).

    The portal's tables are ``[portals.<site>]`` and every ``[portals.<site>.…]``
    sub-table; everything else in the file is kept. A portal not yet in the
    file is appended at its end.
    """
    config_file = _project_veloiq_toml()
    lines = config_file.read_text(encoding="utf-8").splitlines()
    portal_table_names = (f"portals.{site}", f'portals."{site}"')
    kept_lines: list[str] = []
    insert_at: int | None = None
    inside_portal_tables = False
    for line in lines:
        header = _TOML_TABLE_HEADER_PATTERN.match(line)
        if header:
            table_name = header.group(1).strip()
            inside_portal_tables = any(
                table_name == name or table_name.startswith(f"{name}.") for name in portal_table_names
            )
            if inside_portal_tables and insert_at is None:
                insert_at = len(kept_lines)
        if not inside_portal_tables:
            kept_lines.append(line)
    if new_tables is not None:
        new_lines = new_tables.rstrip("\n").split("\n") + [""]
        if insert_at is None:
            if kept_lines and kept_lines[-1].strip():
                kept_lines.append("")
            kept_lines.extend(new_lines)
        else:
            kept_lines[insert_at:insert_at] = new_lines
    temporary_file = config_file.with_suffix(".toml.tmp")
    temporary_file.write_text("\n".join(kept_lines).rstrip("\n") + "\n", encoding="utf-8")
    temporary_file.replace(config_file)
    jm_log(1, f"portals: {'removed' if new_tables is None else 'wrote'} [portals.{site}] in {config_file}")


def _validated_portal_row(row: dict) -> dict:
    """Check *row*'s site name, roles and layout; return it with defaults for the empty settings."""
    site = str(row.get("site") or "").strip()
    if not _SITE_NAME_PATTERN.match(site):
        raise HTTPException(status_code=422, detail=_(
            "The site name must start with a letter and use lowercase letters, digits and dashes."))
    roles = [str(role) for role in (row.get("roles") or []) if str(role).strip()]
    if not roles:
        raise HTTPException(status_code=422, detail=_("A portal needs at least one role."))
    layout = row.get("default_layout") or PORTAL_LAYOUTS[1]
    if layout not in PORTAL_LAYOUTS:
        raise HTTPException(status_code=422, detail=_("Unknown menu layout."))
    return {**row, "site": site, "roles": roles, "default_layout": layout}


def _create_portal_row(request_context: DataSourceRequestContext, row: dict) -> dict:
    """Declare a new portal in ``veloiq.toml``."""
    row = _validated_portal_row(row)
    config_file = _project_veloiq_toml()
    if row["site"] in read_portal_definitions(config_file.parent):
        raise HTTPException(status_code=409, detail=_("A portal with this site name already exists."))
    _write_portal_tables(row["site"], _portal_toml_tables(row))
    return _portal_row(read_portal_definitions(config_file.parent)[row["site"]], config_file.parent)


def _update_portal_row(request_context: DataSourceRequestContext, eid: str, row: dict) -> dict:
    """Write the changed settings of portal *eid* (its site name stays)."""
    config_file = _project_veloiq_toml()
    current = read_portal_definitions(config_file.parent).get(eid)
    if current is None:
        raise HTTPException(status_code=404, detail=_("This portal is not declared in veloiq.toml."))
    row = _validated_portal_row({**_portal_row(current, config_file.parent), **row, "site": eid})
    _write_portal_tables(eid, _portal_toml_tables(row))
    return _portal_row(read_portal_definitions(config_file.parent)[eid], config_file.parent)


def _delete_portal_row(request_context: DataSourceRequestContext, eid: str) -> None:
    """Remove portal *eid*'s tables from ``veloiq.toml`` (its frontend folder is left as it is)."""
    _write_portal_tables(eid, None)


def require_portal_administrator(request: Request, action: str) -> None:
    """Allow only administrators (the Portals configuration pages), after the shared licensing and access decision."""
    from veloiq_framework.access.decision import ADMIN_ROLE, denied_exception
    from veloiq_framework.non_model_data_resources import check_shared_non_model_data_resource_access

    user = getattr(request.state, "user", None) or {}
    if ADMIN_ROLE not in (user.get("roles") or []):
        raise denied_exception()
    check_shared_non_model_data_resource_access(request, build_portal_definitions_non_model_data_resource(), action)


def list_role_names(request: Request) -> list[str]:
    """Return every role name (administrators only), for a portal's roles."""
    from veloiq_framework.access.decision import ADMIN_ROLE, denied_exception
    from veloiq_framework.auth.models import Role
    from veloiq_framework.db import get_engine

    user = getattr(request.state, "user", None) or {}
    if ADMIN_ROLE not in (user.get("roles") or []):
        raise denied_exception()
    with Session(get_engine()) as session:
        return sorted(role.name for role in session.exec(select(Role)).all())


def build_portal_definitions_non_model_data_resource() -> NonModelDataResource:
    """Return the Portals non-model data resource."""
    feature_fields = [
        NonModelDataField(key=name, label=label, type="boolean", default=portal_default)
        for name, label, portal_default in FRAMEWORK_UI_FEATURES
    ]
    return NonModelDataResource(
        name=PORTALS_RESOURCE_NAME,
        label="Portals",
        description="External portals of this app: who uses them, their menu and the list tools they offer.",
        pk_fields=["site"],
        fields=[
            NonModelDataField(key="site", label="Site", required=True,
                              description="Name of the portal in its address (/portals/<site>/)."),
            NonModelDataField(key="title", label="Title", description="Shown in the portal's header and sign-in page."),
            NonModelDataField(key="roles", label="Roles", multiple=True, required=True,
                              options_url=PORTAL_ROLE_NAMES_PATH,
                              description="Roles of the portal's users."),
            NonModelDataField(key="default_layout", label="Menu layout", options=list(PORTAL_LAYOUTS),
                              default=PORTAL_LAYOUTS[1]),
            NonModelDataField(key="show_dashboard_menu_entry", label="Show the Dashboard menu entry",
                              type="boolean", default=False),
            *feature_fields,
            NonModelDataField(key="folder", label="Frontend folder", show_in_list=False,
                              description="Folder of the portal's frontend (veloiq new-portal), relative to the app."),
            NonModelDataField(key="token_storage_key", label="Sign-in storage key", show_in_list=False,
                              description="Browser storage key of the portal's sign-in session."),
            NonModelDataField(key="built", label="Built", type="boolean", read_only=True,
                              description="Whether veloiq build has built the portal's frontend."),
            NonModelDataField(key="address", label="Address", read_only=True),
        ],
        # Configuration rows: no charts or summaries.
        show_analyze_section=False,
        data_source=PythonFunctionsDataSource(
            _load_portal_rows,
            create_row_function=_create_portal_row,
            update_row_function=_update_portal_row,
            delete_row_function=_delete_portal_row,
        ),
        relations=[
            NonModelDataRelation(related_resource_name=PORTAL_MENU_ENTRIES_RESOURCE_NAME, target_key="site",
                                 label="Menu", show_view_type="editable-table", edit_view_type="editable-table"),
            NonModelDataRelation(related_resource_name=PORTAL_FIELD_OVERRIDES_RESOURCE_NAME, target_key="site",
                                 label="Page overrides", show_view_type="editable-table",
                                 edit_view_type="editable-table"),
        ],
        access_check=require_portal_administrator,
    )
