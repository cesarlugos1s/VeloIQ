"""sync_ui_vendor: keeps a host app's file:-linked copy of veloiq-ui in step with packages/ui."""
import json
import os
from pathlib import Path

import pytest

from veloiq_framework.cli import ui_vendor


def _write_pkg(directory: Path, version: str, deps: dict | None = None) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    (directory / "package.json").write_text(json.dumps(
        {"name": "@juicemantics/veloiq-ui", "version": version, "dependencies": deps or {}}
    ))


@pytest.fixture
def layout(tmp_path, monkeypatch):
    """Framework packages/ui (source) + a host frontend linking a vendored copy."""
    source = tmp_path / "framework" / "packages" / "ui"
    _write_pkg(source, "0.9.11")
    (source / "dist").mkdir()
    (source / "dist" / "index.mjs").write_text("export const helpSystemModels = [];")
    (source / "dist" / "index.d.ts").write_text("export declare const helpSystemModels: any[];")

    frontend = tmp_path / "app" / "frontend"
    vendor = frontend / ".veloiq-ui-vendor"
    _write_pkg(vendor, "0.9.7")
    (vendor / "dist").mkdir()
    (vendor / "dist" / "index.mjs").write_text("export const old = 1;")
    (vendor / "dist" / "obsolete.mjs").write_text("")
    (frontend / "package.json").write_text(json.dumps(
        {"dependencies": {"@juicemantics/veloiq-ui": "file:./.veloiq-ui-vendor"}}
    ))
    (frontend / "node_modules" / "@juicemantics").mkdir(parents=True)
    os.symlink(vendor, frontend / "node_modules" / "@juicemantics" / "veloiq-ui")

    monkeypatch.setattr(ui_vendor, "_framework_ui_package", lambda: source)
    return source, frontend, vendor


def test_stale_vendor_copy_is_mirrored(layout, capsys):
    source, frontend, vendor = layout
    assert ui_vendor.sync_ui_vendor(frontend) is True

    assert "helpSystemModels" in (vendor / "dist" / "index.mjs").read_text()
    assert (vendor / "dist" / "index.d.ts").exists()
    assert not (vendor / "dist" / "obsolete.mjs").exists()
    assert json.loads((vendor / "package.json").read_text())["version"] == "0.9.11"
    out = capsys.readouterr().out
    assert "0.9.7 → 0.9.11" in out
    assert "npm install" not in out  # symlinked + same deps: nothing to reinstall


def test_up_to_date_copy_is_left_alone(layout, capsys):
    _, frontend, _ = layout
    ui_vendor.sync_ui_vendor(frontend)
    capsys.readouterr()
    assert ui_vendor.sync_ui_vendor(frontend) is False
    assert capsys.readouterr().out == ""


def test_changed_dependencies_prompt_npm_install(layout, capsys):
    source, frontend, _ = layout
    _write_pkg(source, "0.9.11", {"react-markdown": "^9.0.0"})
    ui_vendor.sync_ui_vendor(frontend)
    assert "npm install" in capsys.readouterr().out


def test_registry_spec_is_ignored(layout):
    _, frontend, vendor = layout
    (frontend / "package.json").write_text(json.dumps(
        {"dependencies": {"@juicemantics/veloiq-ui": "^0.9.0"}}
    ))
    assert ui_vendor.sync_ui_vendor(frontend) is False
    assert json.loads((vendor / "package.json").read_text())["version"] == "0.9.7"


def test_direct_link_to_packages_ui_is_ignored(layout):
    source, frontend, _ = layout
    (frontend / "package.json").write_text(json.dumps(
        {"dependencies": {"@juicemantics/veloiq-ui": f"file:{source}"}}
    ))
    assert ui_vendor.sync_ui_vendor(frontend) is False


def test_wheel_install_without_packages_ui_is_ignored(layout, monkeypatch):
    _, frontend, vendor = layout
    monkeypatch.setattr(ui_vendor, "_framework_ui_package", lambda: None)
    assert ui_vendor.sync_ui_vendor(frontend) is False
    assert json.loads((vendor / "package.json").read_text())["version"] == "0.9.7"
