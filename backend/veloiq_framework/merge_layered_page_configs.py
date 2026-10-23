"""Page configurations of VeloIQ, its extensions and the host app, merged in layers.

A page configuration says which fields a show/edit page has, grouped in
sections (Sections Grid cells, placed with ``grid_row``/``grid_col``) and laid
out inside each section by ``row``/``column``. It is stored in
``page_configs.json`` files with the shape::

    {"configs": {"<resource or model name>:<show|edit|list|create>": {
        "sections": [{"id": "...", "name": "<msgid>", "grid_row": 1, "grid_col": 1,
                      "description": "<msgid>", "icon": "<AntD icon name>",
                      "accent_color": "#hex", "css_class": "jm-settings-section",
                      "entries": [{"kind": "field", "key": "...", "row": 1, "column": 1}]}],
        "tabs": [{"name": "...", "sections": [...]}]}},
     "section_styles": {"<style name>": {"css_class": "...", "icon": "...", "accent_color": "#hex"}}}

A section's look (``css_class``, ``icon``, ``accent_color``, ``description``,
``html_snippet``) can come from a **named section style**, so similar pages
share it instead of repeating it on every section: a page sets
``default_section_style`` for all its sections, and a section may add its own
``style``. The page default applies first, then the section's style, then any
look key written on the section itself. VeloIQ ships the ``settings`` style
(the shared look of settings forms); extensions and host apps can add styles,
or replace one with the same name, in their own layer.

The layers, lowest priority first:

1. VeloIQ's own ``page_configs.json`` (next to this module), for the framework's pages;
2. each enabled extension's packaged file (its manifest's ``page_configs_file``), for its pages;
3. the host app's ``config/page_configs.json``, written by the host app (by hand,
   or with a page configuration tool).

Within the package layers (1 and 2) a later layer's section replaces the
section with the same ``id`` and adds the others, so an extension can add a
section to a VeloIQ page. A host app configuration of a page replaces that
page's configuration as a whole, since the host app saves complete pages.
"""
from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Optional

from veloiq_framework.utils.views_utils import jm_log

#: VeloIQ's own page configurations (the framework's pages, e.g. System Configuration).
FRAMEWORK_PAGE_CONFIGS_FILE = Path(__file__).parent / "page_configs.json"

#: Where the host app's file is looked for, relative to the backend working directory.
HOST_PAGE_CONFIGS_FILE_CANDIDATES = (
    Path("config") / "page_configs.json",
    Path("..") / "config" / "page_configs.json",
)

# The enabled extensions' packaged page_configs.json files, set by create_veloiq_app().
_extension_page_configs_files: tuple[Path, ...] = ()


def configure_extension_page_configs_files(extension_page_configs_files: list[Path]) -> None:
    """Set the enabled extensions' packaged ``page_configs.json`` files.

    Called by ``create_veloiq_app()`` in the order the app enables the
    extensions, so a later extension's section takes precedence over an
    earlier one's with the same ``id``.
    """
    global _extension_page_configs_files
    _extension_page_configs_files = tuple(Path(path) for path in extension_page_configs_files if path)


#: Section keys a named section style can set.
SECTION_LOOK_KEYS = ("css_class", "icon", "accent_color", "description", "html_snippet")


def _read_page_configs_document(path: Path) -> Optional[dict]:
    """Return a page_configs.json file's content, or None when missing or unreadable."""
    if not path.is_file():
        return None
    try:
        document = json.loads(path.read_text(encoding="utf-8")) or {}
    except Exception as read_error:
        jm_log(2, f"merge_layered_page_configs: could not read {path}:", read_error)
        return None
    return document if isinstance(document, dict) else None


def _read_page_configs(path: Path) -> Optional[dict]:
    """Return the ``configs`` of a page_configs.json file, or None when missing or unreadable."""
    configs = (_read_page_configs_document(path) or {}).get("configs") if path.is_file() else None
    return configs if isinstance(configs, dict) else None


def _layer_files() -> list[Path]:
    """Return the existing layer files, lowest priority first (the first host candidate found)."""
    files = [FRAMEWORK_PAGE_CONFIGS_FILE, *_extension_page_configs_files]
    host_file = next((candidate for candidate in HOST_PAGE_CONFIGS_FILE_CANDIDATES if candidate.is_file()), None)
    return [*files, host_file] if host_file is not None else files


def _merge_sections_by_id(lower_sections: list, higher_sections: list) -> list:
    """Return *lower_sections* with each *higher_sections* entry replacing the same ``id`` or appended."""
    merged = list(lower_sections or [])
    positions = {section.get("id"): index for index, section in enumerate(merged) if section.get("id")}
    for section in higher_sections or []:
        section_id = section.get("id")
        if section_id in positions:
            merged[positions[section_id]] = section
        else:
            merged.append(section)
    return merged


def _merge_package_page_config(lower: dict, higher: dict) -> dict:
    """Merge a package layer's configuration of one page into the lower layers' one."""
    merged = copy.deepcopy(lower)
    merged["sections"] = _merge_sections_by_id(lower.get("sections", []), higher.get("sections", []))
    lower_tabs = {tab.get("name"): tab for tab in lower.get("tabs", []) or []}
    for tab in higher.get("tabs", []) or []:
        existing = lower_tabs.get(tab.get("name"))
        lower_tabs[tab.get("name")] = (
            {**tab, "sections": _merge_sections_by_id(existing.get("sections", []), tab.get("sections", []))}
            if existing else tab
        )
    if lower_tabs:
        merged["tabs"] = list(lower_tabs.values())
    for key, value in higher.items():
        if key not in ("sections", "tabs"):
            merged[key] = value
    return merged


def load_merged_page_configs() -> dict:
    """Return every page configuration, keyed ``"<resource or model>:<view type>"``, with the layers merged."""
    merged: dict = {}
    for package_file in (FRAMEWORK_PAGE_CONFIGS_FILE, *_extension_page_configs_files):
        for config_key, page_config in (_read_page_configs(package_file) or {}).items():
            merged[config_key] = (
                _merge_package_page_config(merged[config_key], page_config) if config_key in merged else page_config
            )
    for host_file in HOST_PAGE_CONFIGS_FILE_CANDIDATES:
        host_configs = _read_page_configs(host_file)
        if host_configs is not None:
            merged.update(host_configs)
            break
    return merged


def load_merged_section_styles() -> dict:
    """Return every named section style, a later layer's style replacing one with the same name."""
    styles: dict = {}
    for layer_file in _layer_files():
        layer_styles = (_read_page_configs_document(layer_file) or {}).get("section_styles") or {}
        if isinstance(layer_styles, dict):
            styles.update({name: style for name, style in layer_styles.items() if isinstance(style, dict)})
    return styles


def _section_with_style(section: dict, page_default_style: Optional[str], section_styles: dict) -> dict:
    """Return *section* with its look resolved: page default style, then its own style, then its own keys."""
    look: dict = {}
    for style_name in (page_default_style, section.get("style")):
        if style_name:
            style = section_styles.get(style_name)
            if style is None:
                jm_log(2, f"merge_layered_page_configs: unknown section style '{style_name}'")
                continue
            look.update({key: value for key, value in style.items() if key in SECTION_LOOK_KEYS})
    look.update({key: section[key] for key in SECTION_LOOK_KEYS if section.get(key) not in (None, "")})
    return {**section, **look}


def apply_section_styles(page_config: dict, section_styles: dict) -> dict:
    """Return a copy of *page_config* whose sections (also inside tabs) carry their resolved look."""
    page_default_style = page_config.get("default_section_style")
    resolved = dict(page_config)
    resolved["sections"] = [_section_with_style(section, page_default_style, section_styles)
                            for section in page_config.get("sections", []) or []]
    if page_config.get("tabs"):
        resolved["tabs"] = [
            {**tab, "sections": [_section_with_style(section, page_default_style, section_styles)
                                 for section in tab.get("sections", []) or []]}
            for tab in page_config["tabs"]
        ]
    return resolved
