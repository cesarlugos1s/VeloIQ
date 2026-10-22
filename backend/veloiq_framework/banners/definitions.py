"""Loading of the collapsible banner definitions (``banners.json``).

A banner is defined only by configuration. Each enabled extension may ship a
packaged ``banners.json`` (its manifest's ``banners_file``) and the host app
keeps its own in ``config/banners.json`` (relative to the backend working
directory, next to ``jm_config.ini``). The files are merged by banner key in
that order, so the host app can override any extension banner, or turn it off
with ``"enabled": false``.

A file is a JSON object keyed by banner key::

    {
      "exception_alerts": {
        "title": "Exception alerts",
        "icon": "WarningOutlined",
        "tone": "neutral" | "info" | "success" | "warning" | "error",
        "source": {"orm": {...}} | {"model": "Exceptionalert"} | {"named_query": "..."},
        "filters": [{"fieldKey": "...", "operator": "...", "value": ..., "value2": ...}],
        "sort": {"field": "...", "order": "asc" | "desc"},
        "display_fields": ["description", {"key": "alert_count", "label": "Alerts"}],
        "max_rows": 50,
        "show_on": {"all": true} | {"models": [...], "modules": [...]} | {"sites": [...]},
        "position": {"horizontal": "left" | "center" | "right",
                     "vertical": "top" | "middle" | "bottom"},
        "collapsed": {"max_width": 20, "max_height": 8},
        "expanded": {"max_width": 50, "max_height": 50},
        "collapsed_content": "count" | "title" | "title_and_count" | "icon",
        "row_resource": "jm_exceptionalert",
        "view_all_resource": "jm_exceptionalert",
        "movable": true,
        "priority": 0,
        "hide_when_empty": true,
        "enabled": true
      }
    }

Only ``source`` is required; every other key has a default (see
:data:`BANNER_DEFAULTS`). The files are re-read whenever one of them changes.
"""
from __future__ import annotations

import copy
import json
import os
from pathlib import Path
from typing import Any

from veloiq_framework.utils.views_utils import jm_log

#: Name of the host app's banner file inside its ``config`` directory.
HOST_BANNERS_FILE = Path("config") / "banners.json"

#: Allowed values of the positional and display options.
HORIZONTAL_POSITIONS = ("left", "center", "right")
VERTICAL_POSITIONS = ("top", "middle", "bottom")
COLLAPSED_CONTENT_OPTIONS = ("count", "title", "title_and_count", "icon")
TONES = ("neutral", "info", "success", "warning", "error")
SOURCE_KINDS = ("model", "named_query", "orm")

#: Defaults applied to every banner definition before validation.
BANNER_DEFAULTS: dict[str, Any] = {
    "title": "",
    "icon": "NotificationOutlined",
    "tone": "neutral",
    "filters": [],
    "sort": None,
    "display_fields": [],
    "max_rows": 50,
    "show_on": {"all": True},
    "position": {"horizontal": "left", "vertical": "bottom"},
    "collapsed": {"max_width": 25, "max_height": 10},
    "expanded": {"max_width": 50, "max_height": 50},
    "collapsed_content": "count",
    "row_resource": None,
    "view_all_resource": None,
    "movable": True,
    "priority": 0,
    "hide_when_empty": True,
    "enabled": True,
}

# Parsed definitions and the (path, mtime) signature they were parsed from.
_cache: dict[str, dict] | None = None
_cache_signature: tuple | None = None

# The enabled extensions' packaged banners.json files, set by create_veloiq_app().
_extension_banner_files: tuple[Path, ...] | None = None


def configure_banner_files(extension_banner_files: list[Path]) -> None:
    """Set the enabled extensions' packaged ``banners.json`` files.

    Called by ``create_veloiq_app()`` in the order the app enables the
    extensions, so a later extension's banner takes precedence over an earlier
    one's with the same key; the host app's own file still overrides them all.

    :param extension_banner_files: The files, lowest priority first.
    """
    global _extension_banner_files, _cache
    _extension_banner_files = tuple(Path(path) for path in extension_banner_files if path)
    _cache = None


def _resolve_extension_banner_files() -> tuple[Path, ...]:
    """Return the extensions' banner files, resolving them from the enabled extensions when not configured."""
    global _extension_banner_files
    if _extension_banner_files is None:
        _extension_banner_files = ()
        try:
            from veloiq_framework.extension_registry import read_enabled_extensions
            from veloiq_framework.extensions import discover_extensions, order_extensions
            enabled_extensions = read_enabled_extensions()
            _extension_banner_files = tuple(
                path for path in (ext.resolved_banners_file() for ext in order_extensions(
                    discover_extensions(enabled_extensions, quiet=True), enabled_extensions))
                if path is not None)
        except Exception as resolve_error:
            jm_log(1, "banner_file_paths: could not resolve the extensions' banners.json files:", resolve_error)
    return _extension_banner_files


def banner_file_paths() -> list[Path]:
    """Return the banner files to merge, lowest priority first.

    The enabled extensions' packaged files come first (in extension order),
    then the host app's ``config/banners.json``. Files that do not exist are
    left out.
    """
    paths: list[Path] = [path for path in _resolve_extension_banner_files() if path.is_file()]
    host_file = Path(os.getcwd()) / HOST_BANNERS_FILE
    if host_file.is_file():
        paths.append(host_file)
    return paths


def _signature(paths: list[Path]) -> tuple:
    """Return a value that changes whenever one of *paths* is added, removed or edited."""
    signature = []
    for path in paths:
        try:
            signature.append((str(path), path.stat().st_mtime_ns))
        except OSError:
            signature.append((str(path), None))
    return tuple(signature)


#: Banner keys whose objects are merged key by key; every other key is replaced whole.
_MERGED_KEYS = ("position", "collapsed", "expanded")


def _merge_dict(base: dict, override: dict) -> dict:
    """Return *base* updated with *override*, merging the :data:`_MERGED_KEYS` objects key by key.

    Used both for applying :data:`BANNER_DEFAULTS` and for letting a host app
    override only some keys of an extension's banner (e.g. its ``position``).
    Other keys such as ``source`` and ``show_on`` are replaced whole, so a page
    targeting never inherits the default ``{"all": true}``.
    """
    merged = copy.deepcopy(base)
    for key, value in (override or {}).items():
        if key in _MERGED_KEYS and isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = {**merged[key], **value}
        else:
            merged[key] = copy.deepcopy(value)
    return merged


def validate_banner(key: str, banner: dict) -> list[str]:
    """Return the configuration problems of one merged banner (empty when valid).

    :param key: The banner key, used in the messages.
    :param banner: The banner definition with defaults applied.
    """
    problems: list[str] = []
    source = banner.get("source")
    if not isinstance(source, dict) or len([kind for kind in SOURCE_KINDS if kind in source]) != 1:
        problems.append(f"banner '{key}': 'source' must hold exactly one of {', '.join(SOURCE_KINDS)}")
    elif "orm" in source and not isinstance(source["orm"], dict):
        problems.append(f"banner '{key}': 'source.orm' must be an ORM spec object")
    if not isinstance(banner.get("filters"), list):
        problems.append(f"banner '{key}': 'filters' must be a list of filter rules")
    position = banner.get("position") or {}
    if position.get("horizontal") not in HORIZONTAL_POSITIONS:
        problems.append(f"banner '{key}': 'position.horizontal' must be one of {', '.join(HORIZONTAL_POSITIONS)}")
    if position.get("vertical") not in VERTICAL_POSITIONS:
        problems.append(f"banner '{key}': 'position.vertical' must be one of {', '.join(VERTICAL_POSITIONS)}")
    if banner.get("collapsed_content") not in COLLAPSED_CONTENT_OPTIONS:
        problems.append(f"banner '{key}': 'collapsed_content' must be one of {', '.join(COLLAPSED_CONTENT_OPTIONS)}")
    for size_key in ("collapsed", "expanded"):
        sizes = banner.get(size_key) or {}
        for dimension in ("max_width", "max_height"):
            value = sizes.get(dimension)
            if not isinstance(value, (int, float)) or not 0 < value <= 100:
                problems.append(f"banner '{key}': '{size_key}.{dimension}' must be a percentage between 0 and 100")
    if banner.get("tone") not in TONES:
        problems.append(f"banner '{key}': 'tone' must be one of {', '.join(TONES)}")
    if not isinstance(banner.get("show_on"), dict):
        problems.append(f"banner '{key}': 'show_on' must be an object")
    return problems


def load_banner_definitions(paths: list[Path]) -> dict[str, dict]:
    """Parse and merge the banner files in *paths* (lowest priority first).

    Invalid files and invalid banners are logged with :func:`jm_log` and left
    out, so one configuration mistake never hides the other banners. Disabled
    banners are left out as well.

    :return: The valid, enabled banners keyed by banner key, with defaults applied.
    """
    raw: dict[str, dict] = {}
    for path in paths:
        try:
            with open(path, encoding="utf-8") as banner_file:
                content = json.load(banner_file)
        except Exception as read_error:
            jm_log(1, f"load_banner_definitions: could not read {path}:", read_error)
            continue
        if not isinstance(content, dict):
            jm_log(1, f"load_banner_definitions: {path} must hold a JSON object keyed by banner key.")
            continue
        for key, banner in content.items():
            if not isinstance(banner, dict):
                jm_log(1, f"load_banner_definitions: banner '{key}' in {path} must be an object.")
                continue
            raw[key] = _merge_dict(raw.get(key, {}), banner)

    definitions: dict[str, dict] = {}
    for key, banner in raw.items():
        merged = _merge_dict(BANNER_DEFAULTS, banner)
        if not merged.get("enabled", True):
            continue
        problems = validate_banner(key, merged)
        if problems:
            for problem in problems:
                jm_log(1, "load_banner_definitions:", problem)
            continue
        merged["key"] = key
        definitions[key] = merged
    jm_log(2, f"load_banner_definitions: {len(definitions)} banner(s) loaded from {len(paths)} file(s).")
    return definitions


def get_banner_definitions() -> dict[str, dict]:
    """Return the current banner definitions, re-reading the files when they changed."""
    global _cache, _cache_signature
    paths = banner_file_paths()
    signature = _signature(paths)
    if _cache is None or signature != _cache_signature:
        _cache = load_banner_definitions(paths)
        _cache_signature = signature
    return _cache
