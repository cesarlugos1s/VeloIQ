"""Read/write helpers behind the System Configuration Console endpoints.

Settings live in two places: ``config/jm_config.ini`` (sections such as
``[logging]``) and the ``[views]`` table of the project's ``veloiq.toml``. The
writers update a single key at a time, preserve everything else in the file and
replace the file atomically.
"""
from __future__ import annotations

import os
import tempfile

from fastapi import HTTPException, Request
from sqlmodel import Session, select

from veloiq_framework.auth.models import Role
from veloiq_framework.db import get_engine
from veloiq_framework.utils.views_utils import jm_log


def require_configure_layout(request: Request) -> None:
    """Verify the authenticated user has CONFIGURE_LAYOUT in their role's allowed_methods.

    Reads the user from request.state.user (set by auth middleware). In dev mode
    (VELOIQ_AUTH_DISABLED=1) the check is skipped. Returns None on success, raises
    HTTPException 403 on failure.
    """
    if os.environ.get("VELOIQ_AUTH_DISABLED", "") in ("1", "true", "True"):
        return

    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    roles = user.get("roles", []) if isinstance(user, dict) else []
    if not roles:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # Check if any role has CONFIGURE_LAYOUT in its allowed_methods
    import json as _json

    engine = get_engine()
    with Session(engine) as session:
        db_roles = session.exec(
            select(Role).where(Role.name.in_(roles))
        ).all()
        for role in db_roles:
            try:
                methods = _json.loads(role.allowed_methods or "[]")
            except Exception:
                methods = []
            if "CONFIGURE_LAYOUT" in methods:
                return  # permission granted

    raise HTTPException(
        status_code=403,
        detail="CONFIGURE_LAYOUT permission required",
    )


def write_ini_updates(updates: dict[str, dict[str, str]]) -> None:
    """Write ini section updates to config/jm_config.ini using atomic tempfile.

    Only writes keys whose value differs from the VeloIQ framework's packaged
    default jm_config.ini. Removes keys from the override when they match the
    default.
    """
    import configparser as _configparser

    # VeloIQ framework packaged default (veloiq_framework/jm_config.ini)
    _vf_package = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "jm_config.ini")

    raw_pkg = _configparser.ConfigParser()
    if os.path.exists(_vf_package):
        raw_pkg.read(_vf_package, encoding="utf-8")

    # Host override file
    _cwd = os.getcwd()
    host_override = os.path.join(_cwd, "config", "jm_config.ini")
    os.makedirs(os.path.dirname(host_override), exist_ok=True)

    current = _configparser.ConfigParser()
    if os.path.exists(host_override):
        current.read(host_override, encoding="utf-8")

    for section, keys in updates.items():
        if not current.has_section(section):
            current.add_section(section)
        for key, value in keys.items():
            pkg_val = raw_pkg.get(section, key, fallback=None) if raw_pkg.has_section(section) else None
            if str(value) == pkg_val:
                current.remove_option(section, key)
            else:
                current.set(section, key, str(value))
        if not current.options(section):
            current.remove_section(section)

    with tempfile.NamedTemporaryFile("w", dir=os.path.dirname(host_override),
                                     suffix=".tmp", delete=False,
                                     encoding="utf-8") as f:
        current.write(f)
        tmp = f.name
    os.replace(tmp, host_override)

    # Invalidate the memoized config cache
    import veloiq_framework.utils.data_mgmt_utils as _dm
    _dm._jm_config_cache = None
    _dm._jm_config_cache_signature = None




# Comment templates for each [views] key — inserted when a key is written
# for the first time (i.e. was not present in the original veloiq.toml).
VIEWS_KEY_COMMENTS: dict[str, str] = {
    "modules_color_schema": (
        "# Color schema for modules in the UI.\n"
        '#   "color-coded" = each module gets a different color.\n'
        '#   "plain-color" = every module uses the same color, compatible with the\n'
        "#                   light or dark mode of the UI.\n"
    ),
    "models_color_schema": (
        "# Color schema for models in the UI (same options as modules_color_schema).\n"
    ),
    "plain_color_base_hex": (
        '# Base hex color used when a color schema is set to "plain-color".\n'
        '# If left blank it defaults to dark blue. Example: "#c2410c" (burnt rust).\n'
    ),
    "show_view_type": (
        "# Default view type for a model's show page. Possible types: table,\n"
        "# editable-table, list, editable-list, csv, primary, gallery, calendar, kanban,\n"
        "# totals-details.\n"
    ),
    "edit_view_type": (
        "# Default view type for a model's edit page (same options as show_view_type).\n"
    ),
    "list_view_type": "# Default view type for list pages.\n",
    "file_list_view_type": "# Default view type for file / attachment list views.\n",
    "gallery_image_width": "# Pixel width for images rendered in gallery views (default: 180).\n",
    "gallery_image_height": "# Pixel height for images rendered in gallery views (default: 140).\n",
    "relations_max_rows_to_load": (
        "# Maximum number of rows to load in relation tables in the UI, to avoid\n"
        "# high latency when there are too many related objects (default: 1000).\n"
    ),
    "max_distinct_column_filter_values_to_ranges": (
        "# If a column filter dropdown on a table has more than this many distinct\n"
        "# numeric values, the filter offers range-based selection instead of\n"
        "# individual values (default: 20).\n"
    ),
    "analyze_server_aggregation_threshold": (
        "# Above this many rows, the Analyze section of a list aggregates on the server\n"
        "# instead of downloading every row into the browser (default: 10000).\n"
    ),
    "maximum_columns_in_kanban_view": (
        "# Most columns a kanban view shows; with more distinct values of the split\n"
        "# fields, the columns with the most records are kept (default: 10).\n"
    ),
    "general_actions_button_position": (
        '# Where the general action buttons are rendered on model pages:\n'
        '# "top-right", "left", or "right" (default: "top-right").\n'
    ),
    "add_tabs_for_non_configured_relations": (
        "# If true, forward relations not configured in views_preferences.json\n"
        "# each get their own tab on show/edit pages (default: true).\n"
    ),
    "show_dashboard_menu_entry": (
        "# If true, the app's menus show the Dashboard entry (default: true).\n"
        "# External portals have their own setting (hidden by default).\n"
    ),
    "panes_layout_mode": (
        "# Layout of the right-side panels opened by following a link: \"stack\",\n"
        "# \"breadcrumb\", \"overlay\" or \"scroll\" (default: \"stack\").\n"
    ),
    "panes_max_visible": (
        "# Stack layout: maximum number of panels shown in full; older ones\n"
        "# collapse into narrow spines (default: 2).\n"
    ),
    "panes_fixed_width": (
        "# Minimum width in px of each page in the breadcrumb, overlay and scroll\n"
        "# layouts; pages use any extra room (default: 480).\n"
    ),
}


def write_toml_views_updates(updates: dict[str, str]) -> None:
    """Write [views] table updates to veloiq.toml, preserving other sections.

    Finds the project's veloiq.toml, reads the original text, updates only the
    [views] table, and writes back atomically.  Sections outside [views] and
    inline comments within other sections are preserved verbatim.

    When a key was not previously present in the file a descriptive comment
    (from VIEWS_KEY_COMMENTS) is inserted above it.
    """
    import re as _re
    from veloiq_framework.extension_registry import find_config_file, _VIEWS_KEY_MAP

    cfg_path = find_config_file()
    if cfg_path is None:
        raise FileNotFoundError("veloiq.toml not found in project")

    original_text = cfg_path.read_text(encoding="utf-8")

    # Split the file at the [views] section header, preserving everything else.
    _views_header_re = _re.compile(r"(?m)^\[views\]\s*$")
    m = _views_header_re.search(original_text)

    before_views: str = ""
    views_body_original: str = ""
    after_views: str = ""

    if m:
        before_views = original_text[:m.start()]
        tail = original_text[m.end():]
        _next_section = _re.search(r"(?m)^\[", tail)
        if _next_section:
            views_body_original = tail[:_next_section.start()]
            after_views = tail[_next_section.start():]
        else:
            views_body_original = tail
            after_views = ""
    else:
        before_views = original_text.rstrip() + "\n\n"
        views_body_original = ""
        after_views = ""

    # Parse existing key=value lines from the original views body.
    _kv_re = _re.compile(r"^\s*([a-z_][a-z0-9_]*)\s*=\s*(.+)$")
    existing_keys: set[str] = set()
    preserved_lines: list[str] = []
    for raw_line in views_body_original.splitlines():
        line = raw_line.strip()
        match = _kv_re.match(line)
        if match:
            key = match.group(1)
            existing_keys.add(key)
            if key in updates:
                continue  # skip old value — we will write the new one below
            preserved_lines.append(raw_line)
        else:
            preserved_lines.append(raw_line)

    # Build the output [views] body: preserved non-updated lines + new entries.
    output_lines: list[str] = list(preserved_lines)
    if output_lines and output_lines[-1].strip() != "":
        output_lines.append("")

    from veloiq_framework.extension_registry import _VIEWS_KEY_MAP as _VKM
    for snake_key, str_value in updates.items():
        if snake_key in _VKM:
            _frontend_key, coerce = _VKM[snake_key]
            try:
                typed_value = coerce(str_value)
            except (TypeError, ValueError):
                jm_log(3, f"write_toml_views_updates: cannot coerce {snake_key}={str_value}")
                continue
        else:
            typed_value = str_value

        # Emit a comment for keys being added for the first time.
        if snake_key not in existing_keys and snake_key in VIEWS_KEY_COMMENTS:
            comment = VIEWS_KEY_COMMENTS[snake_key].rstrip("\n")
            output_lines.append(comment)

        output_lines.append(f"{snake_key} = {toml_dump_scalar(typed_value)}")

    views_body_new = "\n".join(output_lines)
    if views_body_new and not views_body_new.startswith("\n"):
        views_body_new = "\n" + views_body_new

    new_text = before_views + "[views]" + views_body_new + "\n" + after_views

    # Atomic write
    tmp_path = cfg_path.with_suffix(".toml.tmp")
    tmp_path.write_text(new_text, encoding="utf-8")
    tmp_path.replace(cfg_path)

    jm_log(1, f"write_toml_views_updates: wrote {len(updates)} key(s) to {cfg_path}")



def toml_dump_scalar(value) -> str:
    """Serialize a Python scalar to its TOML literal representation."""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return repr(value)
    if isinstance(value, str):
        return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'
    if isinstance(value, list):
        if not value:
            return "[]"
        inner = ",\n".join("    " + toml_dump_scalar(item) for item in value)
        return "[\n" + inner + ",\n]"
    raise TypeError(f"unsupported TOML value: {type(value)!r}")



def read_system_config_items() -> list[dict]:
    """Return every registered setting with its current ``value``.

    Values are read from ``jm_config.ini`` (via ``jm_obtain_config``) for
    ``source: "ini"`` entries and from the ``[views]`` table of ``veloiq.toml``
    for ``source: "toml"`` entries. A toml key not yet in the file gets the
    entry's registered ``default``, so the console always shows a sensible value.
    """
    from veloiq_framework.extension_registry import _VIEWS_KEY_MAP, read_views_config
    from veloiq_framework.utils.data_mgmt_utils import jm_obtain_config

    from .system_config_settings_registry import get_system_config_keys

    config = jm_obtain_config()
    toml_views = read_views_config()
    # Reverse map: snake_case key -> current value from the toml file.
    snake_case_values: dict[str, str] = {}
    for snake_key, (camel_key, _coerce) in _VIEWS_KEY_MAP.items():
        if camel_key in toml_views:
            snake_case_values[snake_key] = str(toml_views[camel_key])

    result: list[dict] = []
    for item in get_system_config_keys():
        entry = {**item}
        if item.get("source") == "ini":
            entry["value"] = config.get(item.get("section", ""), item["key"], fallback="")
        elif item.get("source") == "toml":
            entry["value"] = snake_case_values.get(item["key"]) or item.get("default", "")
        result.append(entry)
    return result


def save_system_config_updates(updates: dict[str, str]) -> None:
    """Persist ``{key: value text}`` to jm_config.ini or veloiq.toml, by each key's ``source``.

    Unknown keys are ignored. ``ini`` keys are written to ``config/jm_config.ini``
    and ``toml`` keys to the ``[views]`` table of ``veloiq.toml``, each atomically.

    :raises HTTPException: 500 when a file can't be written.
    """
    from .system_config_settings_registry import get_system_config_keys

    key_meta: dict[str, dict] = {item["key"]: item for item in get_system_config_keys()}
    ini_updates: dict[str, dict[str, str]] = {}  # {section: {key: value}}
    toml_updates: dict[str, str] = {}  # {snake_key: value}
    for key, value in updates.items():
        meta = key_meta.get(key)
        if not meta:
            continue
        if meta.get("source") == "ini":
            ini_updates.setdefault(meta.get("section", ""), {})[key] = str(value)
        elif meta.get("source") == "toml":
            toml_updates[key] = str(value)

    errors: list[str] = []
    if ini_updates:
        try:
            write_ini_updates(ini_updates)
        except Exception as exc:
            errors.append(f"Failed to write jm_config.ini: {exc}")
            jm_log(3, f"save_system_config_updates: ini write error: {exc}")
    if toml_updates:
        try:
            write_toml_views_updates(toml_updates)
        except Exception as exc:
            errors.append(f"Failed to write veloiq.toml: {exc}")
            jm_log(3, f"save_system_config_updates: toml write error: {exc}")
    if errors:
        raise HTTPException(status_code=500, detail="; ".join(errors))
