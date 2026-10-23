"""Page configurations merged from VeloIQ, the enabled extensions and the host app.

Each test points the layers at its own files, so no real page_configs.json is touched.
"""
import json

import pytest

from veloiq_framework import merge_layered_page_configs as layers


def _write(path, configs):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"configs": configs}), encoding="utf-8")
    return path


def _section(section_id, *keys):
    return {"id": section_id, "name": section_id, "grid_row": 1, "grid_col": 1,
            "entries": [{"kind": "field", "key": key, "row": 1, "column": index + 1} for index, key in enumerate(keys)]}


@pytest.fixture
def layer_files(tmp_path, monkeypatch):
    """Return (framework file, extension file, host file) paths wired into the loader."""
    framework_file = tmp_path / "framework" / "page_configs.json"
    extension_file = tmp_path / "extension" / "page_configs.json"
    host_file = tmp_path / "host" / "config" / "page_configs.json"
    monkeypatch.setattr(layers, "FRAMEWORK_PAGE_CONFIGS_FILE", framework_file)
    monkeypatch.setattr(layers, "HOST_PAGE_CONFIGS_FILE_CANDIDATES", (host_file,))
    layers.configure_extension_page_configs_files([extension_file])
    yield framework_file, extension_file, host_file
    layers.configure_extension_page_configs_files([])


def test_extension_sections_merge_into_framework_page(layer_files):
    """An extension replaces a framework section with the same id and adds its own."""
    framework_file, extension_file, _host_file = layer_files
    _write(framework_file, {"settings:show": {"sections": [_section("a", "x"), _section("b", "y")]}})
    _write(extension_file, {"settings:show": {"sections": [_section("b", "y", "z"), _section("c", "w")]}})
    sections = layers.load_merged_page_configs()["settings:show"]["sections"]
    assert [section["id"] for section in sections] == ["a", "b", "c"]
    assert [entry["key"] for entry in sections[1]["entries"]] == ["y", "z"]


def test_host_configuration_replaces_the_whole_page(layer_files):
    """A host app's saved page wins over every package layer, and other pages are kept."""
    framework_file, _extension_file, host_file = layer_files
    _write(framework_file, {"settings:show": {"sections": [_section("a", "x")]},
                            "other:show": {"sections": [_section("o", "k")]}})
    _write(host_file, {"settings:show": {"sections": [_section("h", "x")]}})
    merged = layers.load_merged_page_configs()
    assert [section["id"] for section in merged["settings:show"]["sections"]] == ["h"]
    assert "other:show" in merged


def test_named_section_styles_resolve_in_order(layer_files):
    """Page default style, then the section's style, then the section's own keys; a later
    layer replaces a style with the same name."""
    framework_file, extension_file, _host_file = layer_files
    framework_file.parent.mkdir(parents=True, exist_ok=True)
    framework_file.write_text(json.dumps({
        "section_styles": {"base": {"css_class": "c-base", "icon": "I1"}, "accent": {"accent_color": "#111111"}},
        "configs": {"settings:show": {"default_section_style": "base", "sections": [
            {**_section("a", "x"), "style": "accent"},
            {**_section("b", "y"), "style": "accent", "accent_color": "#222222"},
        ]}},
    }), encoding="utf-8")
    extension_file.parent.mkdir(parents=True, exist_ok=True)
    extension_file.write_text(json.dumps({"section_styles": {"base": {"css_class": "c-ext"}}}), encoding="utf-8")
    styles = layers.load_merged_section_styles()
    page = layers.apply_section_styles(layers.load_merged_page_configs()["settings:show"], styles)
    first, second = page["sections"]
    assert first["css_class"] == "c-ext" and "icon" not in first and first["accent_color"] == "#111111"
    assert second["accent_color"] == "#222222"


def test_unreadable_layer_is_skipped(layer_files):
    """A broken file is left out instead of failing the page."""
    framework_file, _extension_file, host_file = layer_files
    _write(framework_file, {"settings:show": {"sections": [_section("a", "x")]}})
    host_file.parent.mkdir(parents=True, exist_ok=True)
    host_file.write_text("{not json", encoding="utf-8")
    assert [s["id"] for s in layers.load_merged_page_configs()["settings:show"]["sections"]] == ["a"]


def test_unplaced_setting_appears_in_trailing_section(client, auth, monkeypatch):
    """A setting registered without a page configuration still shows, in "Other settings"."""
    from veloiq_framework.system_config import system_config_settings_registry as registry

    extra = {"key": "test_unplaced_setting", "type": "string", "source": "toml", "card": "views",
             "label": "test_unplaced_setting", "tooltip": ""}
    monkeypatch.setitem(registry._REGISTRY, extra["key"], extra)
    rows = client.get("/api/views/configurations/VeloiqSystemConfig?view_type=show", headers=auth).json()
    trailing = [row for row in rows if row["object_name"] == "test_unplaced_setting"]
    assert trailing and trailing[0]["section"] == "Other settings"
