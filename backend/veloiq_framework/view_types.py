"""
View types: the Python side of the framework's single catalog of view types.

``view_types.json`` is the one source of truth. This module reads it for the
backend (system configuration options, dashboard view type resolution,
extension validation); the UI package reads the same file. Never keep a list of
view types anywhere else.

Selector contexts (``offeredIn`` in the file): ``list-page``, ``relation-show``,
``relation-edit``, ``kanban-column`` and ``default-setting`` (the default view
type settings of System Configuration). The context ``configuration`` is
implicit and stands for every entry.
"""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List

VIEW_TYPES_FILE = Path(__file__).with_name("view_types.json")
CONFIGURATION_CONTEXT = "configuration"


@lru_cache(maxsize=1)
def _read_catalog() -> List[Dict[str, Any]]:
    with VIEW_TYPES_FILE.open(encoding="utf-8") as catalog_file:
        return json.load(catalog_file)["viewTypes"]


def get_all_view_types() -> List[str]:
    """Every known view type token, in catalog order."""
    return [entry["token"] for entry in _read_catalog()]


def get_view_types_for_context(context: str) -> List[str]:
    """The tokens a selector in *context* can offer, before a model's fields are considered."""
    if context == CONFIGURATION_CONTEXT:
        return get_all_view_types()
    return [entry["token"] for entry in _read_catalog() if context in entry["offeredIn"]]


def get_view_type_label_text(token: str) -> str:
    """The label's catalog msgid of *token* (the token itself when unknown); translate it with the catalog."""
    for entry in _read_catalog():
        if entry["token"] == token:
            return entry["label"]
    return token


def _loose_key(raw: object) -> str:
    return re.sub(r"[\s_-]", "", str(raw or "").strip().lower())


def resolve_view_type_token(raw: object) -> str:
    """The token a configuration's spelling stands for ("Editable Table", "totalsdetails", "images"); "" when unknown."""
    key = _loose_key(raw).removesuffix("view")
    if not key:
        return ""
    for entry in _read_catalog():
        if _loose_key(entry["token"]) == key or any(_loose_key(alias) == key for alias in entry.get("aliases", [])):
            return entry["token"]
    return ""
