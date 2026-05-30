"""veloiq add-module — scaffold a new module inside an existing VeloIQ project."""
from __future__ import annotations

import json
import re
from pathlib import Path

import click


# ---------------------------------------------------------------------------
# Inline module templates
# ---------------------------------------------------------------------------

_MODELS_PY = '''\
from typing import Optional
from veloiq_framework import TimestampedModel


class {ModelClass}(TimestampedModel, table=True):
    __tablename__ = "{table_name}"

    name: str
    description: Optional[str] = None
'''

_CUSTOM_API_PY = '''\
from fastapi import Depends, HTTPException
from sqlmodel import Session, select

from veloiq_framework import get_session
from .api import router  # import the auto-generated router
from .models import {ModelClass}


# Add custom endpoints below. This file is never overwritten by `veloiq generate`.
#
# Example — extra filter endpoint:
# @router.get("/recent")
# def list_recent(session: Session = Depends(get_session)):
#     items = session.exec(
#         select({ModelClass}).order_by({ModelClass}.created_at.desc()).limit(10)
#     ).all()
#     return items
#
# Example — action endpoint:
# @router.post("/{{id}}/activate")
# def activate(id: int, session: Session = Depends(get_session)):
#     obj = session.get({ModelClass}, id)
#     if obj is None:
#         raise HTTPException(404, detail="{ModelClass} not found")
#     # obj.is_active = True
#     # session.add(obj)
#     # session.commit()
#     return obj
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
# Icon heuristics (minimal — full version in api_schema_gen.py)
# ---------------------------------------------------------------------------

_ICON_KEYWORDS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"user|person|people|member|staff|employee|contact|customer|client", re.I), "UserOutlined"),
    (re.compile(r"team|group|department|division|unit|crew", re.I), "TeamOutlined"),
    (re.compile(r"task|todo|checklist|backlog|ticket", re.I), "CheckSquareOutlined"),
    (re.compile(r"project|initiative|program|campaign|sprint|epic", re.I), "FolderOpenOutlined"),
    (re.compile(r"invoice|bill|payment|financ|transaction|ledger|receipt", re.I), "FileTextOutlined"),
    (re.compile(r"product|catalog|inventory|stock|sku|variant", re.I), "ShoppingOutlined"),
    (re.compile(r"order|purchase|sale|cart|checkout|shipment", re.I), "ShoppingCartOutlined"),
    (re.compile(r"report|analytic|metric|stat|chart|insight", re.I), "BarChartOutlined"),
    (re.compile(r"document|file|attachment|note|memo|contract", re.I), "FileOutlined"),
    (re.compile(r"calendar|event|schedule|appointment|booking", re.I), "CalendarOutlined"),
    (re.compile(r"setting|config|preference|option|setup", re.I), "SettingOutlined"),
    (re.compile(r"location|address|region|area|country|city|place", re.I), "EnvironmentOutlined"),
]


def _guess_icon(text: str, is_module: bool = False) -> str:
    normalized = re.sub(r"[_:\-]", " ", text.lower())
    for pattern, icon in _ICON_KEYWORDS:
        if pattern.search(normalized):
            return icon
    return "FolderOutlined" if is_module else "TableOutlined"


# ---------------------------------------------------------------------------
# Command
# ---------------------------------------------------------------------------

@click.command("add-module")
@click.argument("module_name")
@click.option("--with-admin", "admin", is_flag=True, default=False,
              help="Also create admin/admin_views.py stub.")
@click.option("--project-root", default=None,
              help="Project root directory (default: auto-detected from CWD).")
def add_module(module_name: str, admin: bool, project_root: str | None):
    """Add a new module to an existing VeloIQ project.

    \b
    Creates the module skeleton under backend/app/modules/<module>/:

      __init__.py
      models.py          — a starter model you fill in
      custom_api.py      — custom endpoint stubs (never overwritten by generate)
      admin/
        __init__.py
        admin_views.py   — (with --with-admin)

    Also adds an entry to frontend/src/navigation.config.json so you can
    immediately set the menu label, icon, and display order.

    After scaffolding, run:

      veloiq generate     — regenerates api.py and frontend TypeScript schemas

    \b
    Examples:
      veloiq add-module inventory
      veloiq add-module inventory --with-admin
    """
    slug = _to_snake(module_name)
    model_class = _to_pascal(slug)
    table_name = slug
    label = slug.replace("_", " ").title()

    root = Path(project_root).resolve() if project_root else _find_project_root()
    if root is None:
        click.echo(
            "❌  Could not locate a VeloIQ project from the current directory.\n"
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
    _write(mod_dir / "custom_api.py", _CUSTOM_API_PY.format(**ctx))

    if admin:
        _write(mod_dir / "admin" / "__init__.py", "")
        _write(mod_dir / "admin" / "admin_views.py", _ADMIN_VIEWS_PY.format(**ctx))

    _update_nav_config(root, slug, model_class, label)

    click.echo(f"\n✅  Module '{slug}' created.")
    click.echo("\nNext steps:")
    click.echo(f"  1. Edit  {mod_dir}/models.py  and define your fields.")
    click.echo("  2. Run   veloiq generate       to generate api.py and frontend schemas.")
    click.echo("  3. Run   veloiq db upgrade     to apply the new table migration.")


# ---------------------------------------------------------------------------
# Navigation config
# ---------------------------------------------------------------------------

def _update_nav_config(root: Path, slug: str, model_class: str, label: str) -> None:
    """Add menu entries for the new module to navigation.config.json."""
    nav_file = root / "frontend" / "src" / "navigation.config.json"
    if not nav_file.exists():
        return

    try:
        existing: list[dict] = json.loads(nav_file.read_text())
    except Exception:
        existing = []

    existing_by_key = {e["key"]: e for e in existing if "key" in e}

    # Place new entries after existing app modules but before Access Control (900+).
    app_seqs = [e.get("sequence", 0) for e in existing if 0 < e.get("sequence", 0) < 900]
    next_seq = (max(app_seqs) + 10) if app_seqs else 10

    new_entries: list[dict] = []
    module_key = f"module:{slug}"

    if module_key not in existing_by_key:
        new_entries.append({
            "key": module_key,
            "label": label,
            "icon": _guess_icon(label, is_module=True),
            "sequence": next_seq,
            "type": "module",
        })

    if slug not in existing_by_key:
        model_label = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", model_class)
        new_entries.append({
            "key": slug,
            "label": model_label,
            "icon": _guess_icon(model_label, is_module=False),
            "sequence": next_seq + 1,
            "type": "model",
        })

    if not new_entries:
        return

    merged = list(existing) + new_entries
    nav_file.write_text(json.dumps(merged, indent=2))
    click.echo(f"  📐 navigation.config.json (+{len(new_entries)} entries)")
    click.echo("     Edit frontend/src/navigation.config.json to adjust labels, icons, and order.")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
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
