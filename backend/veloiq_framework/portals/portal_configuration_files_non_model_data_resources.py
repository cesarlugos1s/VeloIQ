"""Each external portal's menu and page overrides as non-model data resources (administrators only).

Two files in each portal's ``<folder>/src/`` configure what its users see:

- ``navigation.<site>.config.json`` — the portal's menu (``veloiq generate``
  creates it once with the models the portal's roles read; then it's the
  site's own). Served as ``veloiq_portal_menu_entries``: one row per entry,
  keyed by (site, key).
- ``portalPageOverrides.json`` — per-field overrides of the portal's pages
  (label, omit, show/edit view type), in the ``ModelOverride`` shape that
  ``mergeUiModelSchemas`` applies after the generated schema and the
  hand-written ``<module>Schema.manual.ts``. Served as
  ``veloiq_portal_field_overrides``: one row per (site, model, field).

Both are edited on the standard list and record pages (Configurations →
General Configuration → Portals, the "Menu" and "Page overrides" tabs of a
portal, or their own lists), and both are read by the portal when it starts
(``GET /api/veloiq/portals/{site}/configuration``), so a change shows without
rebuilding the portal. Writes replace the file atomically and keep the
entries' other properties.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable, Optional

from fastapi import HTTPException, Request

from veloiq_framework.non_model_data_resources import (
    DataSourceRequestContext,
    NonModelDataField,
    NonModelDataResource,
    PythonFunctionsDataSource,
    decode_eid,
)
from veloiq_framework.portals.generate_portal_page_schemas import portal_navigation_config_file_name
from veloiq_framework.portals.read_portal_definitions import PortalDefinition, read_portal_definitions
from veloiq_framework.utils.i18n_utils import _
from veloiq_framework.utils.views_utils import jm_log

#: Resource of the portals' menu entries (``/api/veloiq_portal_menu_entries``).
PORTAL_MENU_ENTRIES_RESOURCE_NAME = "veloiq_portal_menu_entries"
#: Resource of the portals' per-field page overrides (``/api/veloiq_portal_field_overrides``).
PORTAL_FIELD_OVERRIDES_RESOURCE_NAME = "veloiq_portal_field_overrides"
#: The portal's page overrides file (in its ``src/``), applied by ``mergeUiModelSchemas``.
PORTAL_PAGE_OVERRIDES_FILE_NAME = "portalPageOverrides.json"

#: Menu entry types (``NavConfigEntry.type``).
PORTAL_MENU_ENTRY_TYPES = ("module", "model", "page")

_MENU_ENTRY_KEYS = ("site", "key")
_FIELD_OVERRIDE_KEYS = ("site", "model", "field")
#: Row field → ``FieldOverride`` property of the page overrides file.
_FIELD_OVERRIDE_PROPERTIES = {
    "label": "label",
    "omit": "omit",
    "show_view_type": "showViewType",
    "edit_view_type": "editViewType",
}


# ── Files of a portal ─────────────────────────────────────────────────────────

def _project_root() -> Path:
    """Return the host app's root (the folder of ``veloiq.toml``)."""
    from veloiq_framework.extension_registry import find_config_file

    config_file = find_config_file()
    if config_file is None:
        raise HTTPException(status_code=404, detail=_("veloiq.toml not found in project"))
    return config_file.parent


def _portal_source_dir(project_root: Path, portal: PortalDefinition) -> Path:
    """Return the ``src/`` folder of *portal*'s frontend."""
    return project_root / portal.folder / "src"


def portal_navigation_file(project_root: Path, portal: PortalDefinition) -> Path:
    """Return *portal*'s menu file."""
    return _portal_source_dir(project_root, portal) / portal_navigation_config_file_name(portal.site)


def portal_page_overrides_file(project_root: Path, portal: PortalDefinition) -> Path:
    """Return *portal*'s page overrides file."""
    return _portal_source_dir(project_root, portal) / PORTAL_PAGE_OVERRIDES_FILE_NAME


def _read_json_list(path: Path) -> list[dict]:
    """Return the list of objects in *path* (empty when the file is missing or not a list)."""
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        jm_log(3, f"portals: cannot read {path}: {error}")
        return []
    return [item for item in data if isinstance(item, dict)] if isinstance(data, list) else []


def _write_json_list(path: Path, items: list[dict]) -> None:
    """Write *items* to *path* atomically (its ``src/`` folder must exist)."""
    if not path.parent.is_dir():
        raise HTTPException(status_code=409, detail=_(
            "The portal's frontend folder does not exist. Create it with veloiq new-portal."))
    temporary_file = path.with_suffix(".json.tmp")
    temporary_file.write_text(json.dumps(items, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary_file.replace(path)
    jm_log(1, f"portals: wrote {path}")


def _declared_portal(project_root: Path, site: str) -> PortalDefinition:
    """Return the portal *site* (404 when ``veloiq.toml`` doesn't declare it)."""
    portal = read_portal_definitions(project_root).get(site)
    if portal is None:
        raise HTTPException(status_code=404, detail=_("This portal is not declared in veloiq.toml."))
    return portal


def read_portal_runtime_configuration(site: str) -> dict:
    """Return the menu and page overrides the portal *site* reads when it starts.

    ``navigation`` is ``None`` when the portal has no menu file yet (it then
    keeps the menu it was built with).
    """
    project_root = _project_root()
    portal = _declared_portal(project_root, site)
    navigation_file = portal_navigation_file(project_root, portal)
    return {
        "navigation": _read_json_list(navigation_file) if navigation_file.is_file() else None,
        "page_overrides": _read_json_list(portal_page_overrides_file(project_root, portal)),
    }


# ── Menu entries ──────────────────────────────────────────────────────────────

def _menu_entry_row(site: str, entry: dict) -> dict:
    """Return the row of the menu entry *entry* of portal *site*."""
    return {
        "site": site,
        "key": entry.get("key", ""),
        "label": entry.get("label", ""),
        "icon": entry.get("icon", ""),
        "sequence": entry.get("sequence", 0),
        "type": entry.get("type", "model"),
        "route": entry.get("route", ""),
        "parent": entry.get("parent", ""),
    }


def _menu_entry_from_row(row: dict, previous_entry: Optional[dict] = None) -> dict:
    """Return the menu file entry of *row*, keeping *previous_entry*'s other properties."""
    entry = dict(previous_entry or {})
    entry.update({
        "key": row["key"],
        "label": row.get("label") or row["key"],
        "icon": row.get("icon") or "",
        "sequence": int(row.get("sequence") or 0),
        "type": row.get("type") or "model",
    })
    for optional_property in ("route", "parent"):
        if row.get(optional_property):
            entry[optional_property] = row[optional_property]
        else:
            entry.pop(optional_property, None)
    return entry


def _load_menu_entry_rows(request_context: DataSourceRequestContext) -> list[dict]:
    """Return every portal's menu entries."""
    project_root = _project_root()
    return [
        _menu_entry_row(portal.site, entry)
        for portal in read_portal_definitions(project_root).values()
        for entry in _read_json_list(portal_navigation_file(project_root, portal))
    ]


def _change_portal_menu(site: str, change_menu_entries: Callable[[list[dict]], list[dict]]) -> None:
    """Read portal *site*'s menu, apply *change_menu_entries* and write it back."""
    project_root = _project_root()
    navigation_file = portal_navigation_file(project_root, _declared_portal(project_root, site))
    _write_json_list(navigation_file, change_menu_entries(_read_json_list(navigation_file)))


def _create_menu_entry_row(request_context: DataSourceRequestContext, row: dict) -> dict:
    """Add an entry to a portal's menu."""
    def add_entry(entries: list[dict]) -> list[dict]:
        if any(entry.get("key") == row["key"] for entry in entries):
            raise HTTPException(status_code=409, detail=_("This menu already has an entry with this key."))
        return entries + [_menu_entry_from_row(row)]

    _change_portal_menu(row["site"], add_entry)
    return row


def _update_menu_entry_row(request_context: DataSourceRequestContext, eid: str, row: dict) -> dict:
    """Change a portal's menu entry (its site and key stay)."""
    site, key = decode_eid(eid, len(_MENU_ENTRY_KEYS))
    row = {**row, "site": site, "key": key}

    def change_entry(entries: list[dict]) -> list[dict]:
        if not any(entry.get("key") == key for entry in entries):
            raise HTTPException(status_code=404, detail=_("Menu entry not found."))
        return [_menu_entry_from_row(row, entry) if entry.get("key") == key else entry for entry in entries]

    _change_portal_menu(site, change_entry)
    return row


def _delete_menu_entry_row(request_context: DataSourceRequestContext, eid: str) -> None:
    """Remove an entry from a portal's menu."""
    site, key = decode_eid(eid, len(_MENU_ENTRY_KEYS))
    _change_portal_menu(site, lambda entries: [entry for entry in entries if entry.get("key") != key])


# ── Page overrides ────────────────────────────────────────────────────────────

def _load_field_override_rows(request_context: DataSourceRequestContext) -> list[dict]:
    """Return every portal's per-field page overrides."""
    project_root = _project_root()
    rows = []
    for portal in read_portal_definitions(project_root).values():
        for model_override in _read_json_list(portal_page_overrides_file(project_root, portal)):
            for field_override in model_override.get("fields") or []:
                if not isinstance(field_override, dict) or not field_override.get("key"):
                    continue
                row = {"site": portal.site, "model": model_override.get("name", ""), "field": field_override["key"]}
                for row_field, override_property in _FIELD_OVERRIDE_PROPERTIES.items():
                    row[row_field] = field_override.get(override_property, False if row_field == "omit" else "")
                rows.append(row)
    return rows


def _field_override_from_row(row: dict, previous_override: Optional[dict] = None) -> dict:
    """Return the ``FieldOverride`` of *row*, keeping *previous_override*'s other properties."""
    field_override = dict(previous_override or {})
    field_override["key"] = row["field"]
    for row_field, override_property in _FIELD_OVERRIDE_PROPERTIES.items():
        value = row.get(row_field)
        if value:
            field_override[override_property] = value
        else:
            field_override.pop(override_property, None)
    return field_override


def _change_portal_field_override(site: str, model: str, field: str,
                                  change_field_override: Callable[[Optional[dict]], Optional[dict]]) -> None:
    """Replace the override of (*model*, *field*) in portal *site*'s overrides file.

    *change_field_override* gets the current override (``None`` when there is
    none) and returns the new one (``None`` removes it). A model left without
    field overrides or other properties is removed from the file.
    """
    project_root = _project_root()
    overrides_file = portal_page_overrides_file(project_root, _declared_portal(project_root, site))
    model_overrides = _read_json_list(overrides_file)
    model_override = next((m for m in model_overrides if m.get("name") == model), None)
    if model_override is None:
        model_override = {"name": model, "fields": []}
        model_overrides.append(model_override)
    field_overrides = [f for f in (model_override.get("fields") or []) if isinstance(f, dict)]
    current = next((f for f in field_overrides if f.get("key") == field), None)
    changed = change_field_override(current)
    others = [f for f in field_overrides if f.get("key") != field]
    model_override["fields"] = others + ([changed] if changed is not None else [])
    if not model_override["fields"] and set(model_override) <= {"name", "fields"}:
        model_overrides = [m for m in model_overrides if m is not model_override]
    _write_json_list(overrides_file, model_overrides)


def _create_field_override_row(request_context: DataSourceRequestContext, row: dict) -> dict:
    """Add a field override to a portal's pages."""
    def add_override(current: Optional[dict]) -> dict:
        if current is not None:
            raise HTTPException(status_code=409, detail=_("This field already has an override."))
        return _field_override_from_row(row)

    _change_portal_field_override(row["site"], row["model"], row["field"], add_override)
    return row


def _update_field_override_row(request_context: DataSourceRequestContext, eid: str, row: dict) -> dict:
    """Change a field override (its site, model and field stay)."""
    site, model, field = decode_eid(eid, len(_FIELD_OVERRIDE_KEYS))
    row = {**row, "site": site, "model": model, "field": field}
    _change_portal_field_override(site, model, field, lambda current: _field_override_from_row(row, current))
    return row


def _delete_field_override_row(request_context: DataSourceRequestContext, eid: str) -> None:
    """Remove a field override."""
    site, model, field = decode_eid(eid, len(_FIELD_OVERRIDE_KEYS))
    _change_portal_field_override(site, model, field, lambda current: None)


# ── Resources ─────────────────────────────────────────────────────────────────

def _require_administrator(request: Request, action: str) -> None:
    """Allow only administrators (the Portals page's rule)."""
    from veloiq_framework.portals.portal_definitions_non_model_data_resource import require_portal_administrator

    require_portal_administrator(request, action)


def build_portal_menu_entries_non_model_data_resource() -> NonModelDataResource:
    """Return the portals' menu entries resource."""
    return NonModelDataResource(
        name=PORTAL_MENU_ENTRIES_RESOURCE_NAME,
        label="Portal menu entries",
        description="The entries of each portal's menu (navigation.<site>.config.json).",
        pk_fields=list(_MENU_ENTRY_KEYS),
        fields=[
            NonModelDataField(key="site", label="Site", required=True, reference="veloiq_portals"),
            NonModelDataField(key="key", label="Key", required=True,
                              description="Resource of a model entry, module:<name> of a module, any key of a page."),
            NonModelDataField(key="label", label="Label"),
            NonModelDataField(key="icon", label="Icon", description="Ant Design icon name, e.g. HomeOutlined."),
            NonModelDataField(key="sequence", label="Sequence", type="number", integer=True, default=0),
            NonModelDataField(key="type", label="Type", options=list(PORTAL_MENU_ENTRY_TYPES), default="model"),
            NonModelDataField(key="route", label="Route", description="Path of a page entry, e.g. /deck."),
            NonModelDataField(key="parent", label="Parent", description="Module of a page entry, e.g. module:matches."),
        ],
        default_sort=("sequence", "asc"),
        # Configuration rows: no charts or summaries.
        show_analyze_section=False,
        data_source=PythonFunctionsDataSource(
            _load_menu_entry_rows,
            create_row_function=_create_menu_entry_row,
            update_row_function=_update_menu_entry_row,
            delete_row_function=_delete_menu_entry_row,
        ),
        access_check=_require_administrator,
    )


def build_portal_field_overrides_non_model_data_resource() -> NonModelDataResource:
    """Return the portals' per-field page overrides resource."""
    return NonModelDataResource(
        name=PORTAL_FIELD_OVERRIDES_RESOURCE_NAME,
        label="Portal page overrides",
        description="Per-field changes to each portal's pages (portalPageOverrides.json).",
        pk_fields=list(_FIELD_OVERRIDE_KEYS),
        fields=[
            NonModelDataField(key="site", label="Site", required=True, reference="veloiq_portals"),
            NonModelDataField(key="model", label="Model", required=True, description="Model name, e.g. Candidate."),
            NonModelDataField(key="field", label="Field", required=True, description="Field key, e.g. description."),
            NonModelDataField(key="label", label="Label"),
            NonModelDataField(key="omit", label="Hide on the portal's pages", type="boolean", default=False),
            NonModelDataField(key="show_view_type", label="Show view type"),
            NonModelDataField(key="edit_view_type", label="Edit view type"),
        ],
        # Configuration rows: no charts or summaries.
        show_analyze_section=False,
        data_source=PythonFunctionsDataSource(
            _load_field_override_rows,
            create_row_function=_create_field_override_row,
            update_row_function=_update_field_override_row,
            delete_row_function=_delete_field_override_row,
        ),
        access_check=_require_administrator,
    )
