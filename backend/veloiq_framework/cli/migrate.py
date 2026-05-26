"""veloiq migrate — consolidate legacy layout configuration into views_preferences.json."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

import click

_DASHBOARD_KEY = "__dashboard__"
_USER_KEY = "user:all"
_PREFS_FILE = Path("views_preferences.json")
_LEGACY_FILE = Path("config") / "views_configuration.json"


@click.command("migrate")
@click.option(
    "--project-root", default=None,
    help="Project root directory (default: auto-detected from CWD).",
)
@click.option(
    "--dry-run", is_flag=True, default=False,
    help="Show what would be migrated without writing any files.",
)
def migrate(project_root: Optional[str], dry_run: bool) -> None:
    """Consolidate legacy layout files into views_preferences.json.

    Detects config/views_configuration.json (the legacy separate dashboard
    layout file) and merges its dashboard configuration into
    views_preferences.json, which is the unified configuration file.

    The legacy file is renamed to config/views_configuration.json.bak so it
    can be reviewed or restored if needed.

    Safe to run multiple times — already-migrated projects are reported and
    skipped without modification.
    """
    root = Path(project_root).resolve() if project_root else _find_project_root()
    if root is None:
        click.echo(
            "❌  Could not locate a VeloIQ project from the current directory.\n"
            "   Run this command from inside a project, or pass --project-root.",
            err=True,
        )
        raise SystemExit(1)

    backend = root / "backend"
    legacy_path = backend / _LEGACY_FILE
    prefs_path = backend / _PREFS_FILE

    if not legacy_path.exists():
        click.echo("✅  No legacy config/views_configuration.json found — nothing to migrate.")
        return

    # Load legacy dashboard config
    try:
        legacy_data = json.loads(legacy_path.read_text(encoding="utf-8")) or {}
    except Exception as exc:
        click.echo(f"❌  Could not read {legacy_path}: {exc}", err=True)
        raise SystemExit(1)

    dashboard = legacy_data.get(_USER_KEY, {}).get(_DASHBOARD_KEY)
    if not dashboard:
        click.echo(
            "ℹ️  config/views_configuration.json has no dashboard configuration — nothing to migrate.\n"
            f"   File: {legacy_path}"
        )
        return

    # Load views_preferences.json
    prefs_data: dict = {}
    if prefs_path.exists():
        try:
            prefs_data = json.loads(prefs_path.read_text(encoding="utf-8")) or {}
        except Exception as exc:
            click.echo(f"❌  Could not read {prefs_path}: {exc}", err=True)
            raise SystemExit(1)

    # Check if already migrated
    existing_dashboard = prefs_data.get(_USER_KEY, {}).get(_DASHBOARD_KEY)
    if existing_dashboard is not None:
        click.echo(
            "✅  Dashboard configuration already present in views_preferences.json — skipping.\n"
            f"   If you want to re-import, remove the \"{_DASHBOARD_KEY}\" key from views_preferences.json first."
        )
        return

    tab_count = len(dashboard.get("tabs", []))
    cell_count = sum(len(t.get("cells", [])) for t in dashboard.get("tabs", []))

    if dry_run:
        click.echo(
            f"🔍  Dry run — would migrate dashboard config from config/views_configuration.json:\n"
            f"    {tab_count} tab(s), {cell_count} cell(s)\n"
            f"    → views_preferences.json (user:all.__dashboard__)\n"
            f"    → config/views_configuration.json → config/views_configuration.json.bak"
        )
        return

    # Write merged prefs
    prefs_data.setdefault(_USER_KEY, {})[_DASHBOARD_KEY] = dashboard
    _write_json(prefs_path, prefs_data)

    # Rename legacy file to .bak
    bak_path = legacy_path.with_suffix(".json.bak")
    legacy_path.rename(bak_path)

    click.echo(
        f"\n✅  Migration complete\n\n"
        f"   Moved dashboard config ({tab_count} tab(s), {cell_count} cell(s))\n"
        f"     from: config/views_configuration.json\n"
        f"       to: views_preferences.json (user:all.__dashboard__)\n\n"
        f"   Legacy file backed up as: config/views_configuration.json.bak\n"
        f"   You can safely delete the .bak file once you've verified everything works.\n"
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    tmp.replace(path)


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
