"""HTTP endpoints of the System Configuration Console.

``GET /system-config`` returns every registered setting with its current value
and metadata; ``PUT /system-config`` persists changed values to
``config/jm_config.ini`` and the ``[views]`` table of ``veloiq.toml``. Both
require the ``CONFIGURE_LAYOUT`` permission.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from veloiq_framework.utils.views_utils import jm_log

from .read_write_system_config_files import (
    read_system_config_items,
    require_configure_layout,
    save_system_config_updates,
)

router = APIRouter(tags=["system-config"])


@router.get("/system-config")
def get_system_config(request: Request):
    """Return system configuration keys with current values and metadata.

    See :func:`read_system_config_items`. Returns a flat list of config items
    for the System Configuration console frontend.

    Requires CONFIGURE_LAYOUT permission in the user's role.
    """
    require_configure_layout(request)
    return {"items": read_system_config_items()}


@router.put("/system-config")
def update_system_config(body: dict, request: Request):
    """Update system configuration keys across jm_config.ini and veloiq.toml.

    Body: { "updates": { "log_up_to_relevance": "2", "plain_color_base_hex": "#1e708a", ... } }

    See :func:`save_system_config_updates`. Requires CONFIGURE_LAYOUT
    permission in the user's role.
    """
    require_configure_layout(request)

    updates = body.get("updates", {})
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")
    save_system_config_updates(updates)
    jm_log(1, f"update_system_config: saved {len(updates)} key(s) successfully")
    return {"status": "ok", "updated": len(updates)}
