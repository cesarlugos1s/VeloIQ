"""veloiq generate — generate frontend TypeScript schemas from backend models."""
import json
import click
from pathlib import Path


def _check_migration_needed(project_root_override=None) -> None:
    """Print a hint when config/views_configuration.json has not been migrated yet."""
    root = Path(project_root_override).resolve() if project_root_override else Path.cwd()
    # When running from backend/, the project root is one level up.
    candidates = [root, root.parent]
    for candidate in candidates:
        legacy = candidate / "backend" / "config" / "views_configuration.json"
        prefs = candidate / "backend" / "views_preferences.json"
        if not legacy.exists():
            continue
        try:
            data = json.loads(legacy.read_text(encoding="utf-8")) or {}
        except Exception:
            continue
        has_dashboard = bool(data.get("user:all", {}).get("__dashboard__"))
        if not has_dashboard:
            continue
        already_migrated = False
        if prefs.exists():
            try:
                pd = json.loads(prefs.read_text(encoding="utf-8")) or {}
                already_migrated = "__dashboard__" in pd.get("user:all", {})
            except Exception:
                pass
        if not already_migrated:
            click.echo(
                "\n💡  config/views_configuration.json detected.\n"
                "    Run `veloiq migrate` to consolidate it into views_preferences.json.\n"
            )
        break


@click.command()
@click.option("--modules-dir", default=None, help="Path to the modules directory.")
@click.option("--frontend-src", default=None, help="Path to frontend/src directory.")
@click.option("--project-root", default=None, help="Project root (default: CWD).")
def generate(modules_dir, frontend_src, project_root):
    """Generate backend api.py files and frontend TypeScript schemas from SQLModel definitions.

    Scans backend modules and emits:

    \b
      backend/app/modules/{module}/api.py          (CRUD endpoints, do not edit)
      frontend/src/pages/{module}/{module}Schema.gen.ts
      frontend/src/allModels.gen.ts

    Run this whenever you add or change a model.
    Use custom_api.py (not api.py) for custom endpoints.
    """
    from veloiq_framework.api_schema_gen import run_api_schema_gen
    run_api_schema_gen(
        modules_dir=modules_dir,
        frontend_src=frontend_src,
        project_root=project_root,
    )
    _check_migration_needed(project_root)
