"""safem add-module — scaffold a new module inside an existing SafeMantIQ project."""
from __future__ import annotations

import re
from pathlib import Path

import click


# ---------------------------------------------------------------------------
# Inline module templates
# ---------------------------------------------------------------------------

_MODELS_PY = '''\
from typing import Optional
from safemantiq_framework import TimestampedModel


class {ModelClass}(TimestampedModel, table=True):
    __tablename__ = "{table_name}"

    name: str
    description: Optional[str] = None
'''

_CUSTOM_API_PY = '''\
from fastapi import Depends, HTTPException
from sqlmodel import Session

from safemantiq_framework import get_session
from .api import router  # import the auto-generated router
from .models import {ModelClass}


# Add custom endpoints here.  The loader picks up custom_api.py automatically.
# Example:
# @router.post("/{{id}}/activate")
# def activate(id: int, session: Session = Depends(get_session)):
#     obj = session.get({ModelClass}, id)
#     if obj is None:
#         raise HTTPException(404, detail="{ModelClass} not found")
#     ...
'''

_ADMIN_VIEWS_PY = '''\
from sqladmin import ModelView
from ..models import {ModelClass}


class {ModelClass}Admin(ModelView, model={ModelClass}):
    column_list = [{ModelClass}.id, {ModelClass}.name]
    column_searchable_list = [{ModelClass}.name]
    icon = "fa-solid fa-circle"
'''


# ---------------------------------------------------------------------------
# Command
# ---------------------------------------------------------------------------

@click.command("add-module")
@click.argument("module_name")
@click.option("--with-custom-api", "custom_api", is_flag=True, default=False,
              help="Also create a custom_api.py stub.")
@click.option("--with-admin", "admin", is_flag=True, default=False,
              help="Also create admin/admin_views.py stub.")
@click.option("--project-root", default=None,
              help="Project root directory (default: auto-detected from CWD).")
def add_module(module_name: str, custom_api: bool, admin: bool, project_root: str | None):
    """Add a new module to an existing SafeMantIQ project.

    \b
    Creates the module skeleton under backend/app/modules/<module>/:

      __init__.py
      models.py          — a starter model you fill in
      custom_api.py      — (with --with-custom-api)
      admin/
        __init__.py
        admin_views.py   — (with --with-admin)

    After scaffolding, run:

      safem generate     — regenerates api.py and frontend TypeScript schemas

    \b
    Examples:
      safem add-module inventory
      safem add-module inventory --with-custom-api --with-admin
    """
    slug = _to_snake(module_name)
    model_class = _to_pascal(slug)
    table_name = slug
    label = slug.replace("_", " ").title()

    root = Path(project_root).resolve() if project_root else _find_project_root()
    if root is None:
        click.echo(
            "❌  Could not locate a SafeMantIQ project from the current directory.\n"
            "   Run this command from inside a project, or pass --project-root.",
            err=True,
        )
        raise SystemExit(1)

    modules_dir = root / "backend" / "app" / "modules"
    mod_dir = modules_dir / slug

    if mod_dir.exists():
        click.echo(f"❌  Module directory already exists: {mod_dir}", err=True)
        raise SystemExit(1)

    ctx = {"ModelClass": model_class, "table_name": table_name, "label": label}

    click.echo(f"\n🧩 Adding module: {label}  ({slug})")
    click.echo(f"   Location: {mod_dir}\n")

    _write(mod_dir / "__init__.py", "")
    _write(mod_dir / "models.py", _MODELS_PY.format(**ctx))

    if custom_api:
        _write(mod_dir / "custom_api.py", _CUSTOM_API_PY.format(**ctx))

    if admin:
        _write(mod_dir / "admin" / "__init__.py", "")
        _write(mod_dir / "admin" / "admin_views.py", _ADMIN_VIEWS_PY.format(**ctx))

    click.echo(f"\n✅  Module '{slug}' created.")
    click.echo("\nNext steps:")
    click.echo(f"  1. Edit  {mod_dir}/models.py  and define your fields.")
    click.echo("  2. Run   safem generate       to generate api.py and frontend schemas.")
    click.echo("  3. Run   safem db upgrade     to apply the new table migration.")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    # Show path relative to backend/ for a clean display.
    try:
        backend_idx = path.parts.index("backend")
        rel = Path(*path.parts[backend_idx:])
    except ValueError:
        rel = path
    click.echo(f"  📄 {rel}")


def _find_project_root() -> Path | None:
    """Walk up from CWD looking for backend/app/modules/."""
    cwd = Path.cwd().resolve()
    for directory in [cwd, *cwd.parents]:
        if (directory / "backend" / "app" / "modules").exists():
            return directory
        if (directory / "app" / "modules").exists():
            return directory.parent if (directory.parent / "backend").exists() else directory
    return None


def _to_snake(name: str) -> str:
    """Normalise any input to snake_case."""
    name = name.strip().lower()
    name = re.sub(r"[^a-z0-9_]", "_", name)
    name = re.sub(r"_+", "_", name).strip("_")
    return name or "module"


def _to_pascal(snake: str) -> str:
    """Convert snake_case to PascalCase."""
    return "".join(part.capitalize() for part in snake.split("_"))
