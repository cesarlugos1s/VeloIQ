"""veloiq add-dashboard — add/remove models from the dashboard configuration."""
from __future__ import annotations

import json
import re
import uuid
from pathlib import Path
from typing import Optional

import click

_AUTH_MODELS = {"user", "role", "tenant", "veloiq_user", "veloiq_role", "veloiq_tenant"}
_AUTH_MODULE = "access_control"
_DASHBOARD_KEY = "__dashboard__"
_CONFIG_RELATIVE = Path("config") / "views_configuration.json"


# ---------------------------------------------------------------------------
# Command
# ---------------------------------------------------------------------------

@click.command("add-dashboard")
@click.argument("models", nargs=-1)
@click.option(
    "--remove", "remove_models", multiple=True, metavar="MODEL",
    help="Models to remove from the dashboard.",
)
@click.option(
    "--project-root", default=None,
    help="Project root directory (default: auto-detected from CWD).",
)
def add_dashboard(
    models: tuple[str, ...],
    remove_models: tuple[str, ...],
    project_root: Optional[str],
) -> None:
    """Add or remove models from the app dashboard.

    Positional models are added; --remove models are removed.

    \b
    Examples:
      veloiq add-dashboard project task team user role
      veloiq add-dashboard --remove user role
      veloiq add-dashboard tenant --remove user role
    """
    if not models and not remove_models:
        click.echo("Nothing to do — provide models to add and/or --remove models to remove.", err=True)
        raise SystemExit(1)

    root = Path(project_root).resolve() if project_root else _find_project_root()
    if root is None:
        click.echo(
            "❌  Could not locate a VeloIQ project from the current directory.\n"
            "   Run this command from inside a project, or pass --project-root.",
            err=True,
        )
        raise SystemExit(1)

    config_path = root / "backend" / _CONFIG_RELATIVE
    data = _load_config(config_path)
    user_all = data.setdefault("user:all", {})
    dashboard = user_all.setdefault(_DASHBOARD_KEY, {"tabs": []})

    modules_dir = root / "backend" / "app" / "modules"

    # ── Collect current model set across all tabs ─────────────────────────
    existing_models: set[str] = set()
    for tab in dashboard.get("tabs", []):
        for cell in tab.get("cells", []):
            existing_models.add(cell["model"])

    added: list[str] = []
    skipped_present: list[str] = []
    removed: list[str] = []
    skipped_absent: list[str] = []

    # ── Remove ────────────────────────────────────────────────────────────
    for m in remove_models:
        m = m.strip().lower()
        if m in existing_models:
            _remove_model_from_dashboard(dashboard, m)
            existing_models.discard(m)
            removed.append(m)
        else:
            skipped_absent.append(m)

    # ── Add ───────────────────────────────────────────────────────────────
    for m in models:
        m = m.strip().lower()
        if m in existing_models:
            skipped_present.append(m)
            continue
        module = _detect_module(m, modules_dir)
        resolved = _resolve_model_name(m, modules_dir)
        if resolved in existing_models:
            skipped_present.append(m)
            continue
        _add_model_to_dashboard(dashboard, resolved, module)
        existing_models.add(resolved)
        added.append(resolved)

    user_all[_DASHBOARD_KEY] = dashboard
    _save_config(config_path, data)

    # ── Summary ───────────────────────────────────────────────────────────
    click.echo("\n📊  Dashboard updated\n")
    if added:
        click.echo(f"  ✅  Added   : {', '.join(added)}")
    if removed:
        click.echo(f"  🗑️   Removed : {', '.join(removed)}")
    if skipped_present:
        click.echo(f"  ⏭️   Already present (skipped): {', '.join(skipped_present)}")
    if skipped_absent:
        click.echo(f"  ⏭️   Not found (skipped): {', '.join(skipped_absent)}")

    current: list[str] = []
    for tab in dashboard.get("tabs", []):
        for cell in tab.get("cells", []):
            current.append(cell["model"])
    click.echo(f"\n  Current dashboard models: {', '.join(current) if current else '(none)'}")
    click.echo(f"  Config: {config_path}\n")


# ---------------------------------------------------------------------------
# Dashboard manipulation helpers
# ---------------------------------------------------------------------------

def _add_model_to_dashboard(dashboard: dict, model: str, module: str) -> None:
    """Insert model into the correct tab (by module), creating the tab if needed."""
    tabs: list[dict] = dashboard.setdefault("tabs", [])
    # Find existing tab for this module — match by stored module key or display name.
    display = _module_display_name(module)
    tab = next(
        (t for t in tabs
         if t.get("module") == module
         or t.get("name", "").lower() == display.lower()),
        None,
    )
    if tab is None:
        tab = {"id": str(uuid.uuid4()), "module": module, "name": display, "cells": []}
        tabs.append(tab)

    cells: list[dict] = tab.setdefault("cells", [])
    # Determine next position in a 2-column grid.
    max_row = max((c.get("row", 0) for c in cells), default=-1)
    # Count cells in the last row to decide whether to start a new row.
    if cells:
        last_row_cells = [c for c in cells if c.get("row", 0) == max_row]
        if len(last_row_cells) < 2:
            row, col = max_row, len(last_row_cells)
        else:
            row, col = max_row + 1, 0
    else:
        row, col = 0, 0

    cells.append({
        "id": str(uuid.uuid4()),
        "model": model,
        "source_type": "model",
        "row": row,
        "col": col,
        "view_type": None,
        "html_style": "",
        "min_width": None,
        "max_width": None,
        "min_height": None,
        "max_height": None,
    })


def _remove_model_from_dashboard(dashboard: dict, model: str) -> None:
    """Remove all cells for the given model and prune empty tabs."""
    tabs: list[dict] = dashboard.get("tabs", [])
    for tab in tabs:
        tab["cells"] = [c for c in tab.get("cells", []) if c.get("model") != model]
    # Remove tabs that became empty.
    dashboard["tabs"] = [t for t in tabs if t.get("cells")]


# ---------------------------------------------------------------------------
# Module detection
# ---------------------------------------------------------------------------

def _detect_module(model: str, modules_dir: Path) -> str:
    """Best-effort: map a model resource name to its module folder name."""
    if model in _AUTH_MODELS:
        return _AUTH_MODULE

    if not modules_dir.exists():
        return "dashboard"

    module_names = [
        d.name for d in modules_dir.iterdir()
        if d.is_dir() and not d.name.startswith("__")
    ]

    # Priority 1: exact match.
    for m in module_names:
        if m.lower() == model.lower():
            return m

    # Priority 2: module is plural of model (projects ↔ project).
    for m in module_names:
        if m.lower() == model.lower() + "s" or model.lower() == m.lower() + "s":
            return m

    # Priority 3: model starts with the module name (team_member → team).
    for m in module_names:
        if model.lower().startswith(m.lower()):
            return m

    return "dashboard"


def _resolve_model_name(name: str, modules_dir: Path) -> str:
    """If name matches a module directory, return its primary __tablename__; otherwise return name as-is."""
    if not modules_dir.exists():
        return name
    module_dir = modules_dir / name
    if not module_dir.is_dir():
        return name
    models_file = module_dir / "models.py"
    if not models_file.exists():
        return name
    tables = re.findall(r'__tablename__\s*=\s*["\']([^"\']+)["\']', models_file.read_text(encoding="utf-8"))
    return tables[0] if tables else name


def _module_display_name(module: str) -> str:
    if module == _AUTH_MODULE:
        return "Access Control"
    return module.replace("_", " ").title()


# ---------------------------------------------------------------------------
# File I/O helpers
# ---------------------------------------------------------------------------

def _load_config(path: Path) -> dict:
    if not path.exists():
        return {"schema_version": "1.0", "user:all": {}}
    try:
        return json.loads(path.read_text(encoding="utf-8")) or {}
    except Exception:
        return {"schema_version": "1.0", "user:all": {}}


def _save_config(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


# ---------------------------------------------------------------------------
# Project root detection (reuses the same heuristic as add-module)
# ---------------------------------------------------------------------------

def _find_project_root() -> Optional[Path]:
    cwd = Path.cwd().resolve()
    for directory in [cwd, *cwd.parents]:
        if (directory / "backend" / "app" / "modules").exists():
            return directory
        if (directory / "app" / "modules").exists():
            parent = directory.parent
            if (parent / "backend").exists():
                return parent
    return None
