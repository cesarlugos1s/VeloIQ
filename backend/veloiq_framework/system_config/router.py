"""HTTP endpoints of the System Configuration Console.

``GET /system-config`` returns every registered setting with its current value
and metadata; ``PUT /system-config`` persists changed values to
``config/jm_config.ini`` and the ``[views]`` table of ``veloiq.toml``. Both
require the ``CONFIGURE_LAYOUT`` permission.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from veloiq_framework.utils.data_mgmt_utils import jm_obtain_config
from veloiq_framework.utils.views_utils import jm_log

from .registry import get_system_config_keys
from .service import require_configure_layout, write_ini_updates, write_toml_views_updates

router = APIRouter(tags=["system-config"])


@router.get("/system-config")
def get_system_config(request: Request):
    """Return system configuration keys with current values and metadata.

    Reads values from both jm_config.ini (via jm_obtain_config) and
    veloiq.toml [views] (via read_views_config). Returns a flat list
    of config items for the System Configuration console frontend.

    For toml-sourced keys not yet present in veloiq.toml, returns the
    entry's registered default so the frontend always shows a sensible
    starting point.

    Requires CONFIGURE_LAYOUT permission in the user's role.
    """
    require_configure_layout(request)

    # ini values
    config = jm_obtain_config()

    # toml [views] values (read_views_config returns camelCase keys)
    from veloiq_framework.extension_registry import read_views_config, _VIEWS_KEY_MAP
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
            # File value if present, otherwise the entry's own registered default.
            entry["value"] = snake_case_values.get(item["key"]) or item.get("default", "")
        result.append(entry)

    return {"items": result}


@router.put("/system-config")
def update_system_config(body: dict, request: Request):
    """Update system configuration keys across jm_config.ini and veloiq.toml.

    Body: { "updates": { "log_up_to_relevance": "2", "plain_color_base_hex": "#1e708a", ... } }

    Keys with source "ini" are written to config/jm_config.ini using the atomic
    tempfile pattern. Keys with source "toml" are written to veloiq.toml [views].

    Requires CONFIGURE_LAYOUT permission in the user's role.
    """
    require_configure_layout(request)

    updates = body.get("updates", {})
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")

    # Lookup: key -> item metadata; unknown keys are ignored.
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
            jm_log(3, f"update_system_config: ini write error: {exc}")

    if toml_updates:
        try:
            write_toml_views_updates(toml_updates)
        except Exception as exc:
            errors.append(f"Failed to write veloiq.toml: {exc}")
            jm_log(3, f"update_system_config: toml write error: {exc}")

    if errors:
        raise HTTPException(status_code=500, detail="; ".join(errors))

    jm_log(1, f"update_system_config: saved {len(updates)} key(s) successfully")
    return {"status": "ok", "updated": len(updates)}
