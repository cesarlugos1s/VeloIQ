"""veloiq add-model — add a new model class to a VeloIQ project."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Optional

import click


# ── Templates ──────────────────────────────────────────────────────────────────

_NEW_MODELS_PY = '''\
from typing import Optional
from sqlmodel import Field
from veloiq_framework import TimestampedModel


class {ModelClass}(TimestampedModel, table=True):
    """{description}"""

    __tablename__ = "{table_name}"

    name: str = Field(description="{ModelClass} name")
    description: Optional[str] = Field(default=None, description="")
'''

_APPEND_CLASS = '''

class {ModelClass}(TimestampedModel, table=True):
    """{description}"""

    __tablename__ = "{table_name}"

    name: str = Field(description="{ModelClass} name")
    description: Optional[str] = Field(default=None, description="")
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
'''


# ── Command ────────────────────────────────────────────────────────────────────

@click.command(name="add-model")
@click.argument("model_name")
@click.option("--module", default=None,
              help="Module to place the model in (default: pluralized snake_case of model name). "
                   "Created if it does not exist.")
@click.option("--description", "-d", default=None,
              help="One-line docstring description for the model.")
@click.option("--migrate/--no-migrate", default=None,
              help="Run Alembic migration after adding. Default: prompt interactively.")
@click.option("--root", "-C", default=None, type=click.Path(exists=True, file_okay=False),
              help="Project root (default: auto-detect).")
def add_model(model_name, module, description, migrate, root):
    """Add a new model class to a VeloIQ project.

    \b
    MODEL_NAME   PascalCase class name (e.g. Invoice, TeamMember)

    \b
    If the target module does not exist it is created with a full scaffold
    (models.py, custom_api.py, navigation entry). If it already exists the
    new class is appended to its models.py.

    \b
    Examples:
      veloiq add-model Invoice
      veloiq add-model Invoice --module billing --description "A customer invoice"
      veloiq add-model TeamMember --module team
    """
    from veloiq_framework.cli.explorer import _find_project_root
    from veloiq_framework.cli.add_field import _maybe_migrate

    project_root = Path(root) if root else _find_project_root()
    if not project_root:
        click.echo(click.style("❌  Not inside a VeloIQ project.", fg="red"))
        raise SystemExit(1)

    class_name = _to_pascal(model_name)
    table_name = _to_snake(class_name)
    module_slug = module or (table_name + "s")
    desc = description or f"A {class_name.lower()} record."

    modules_dir = project_root / "backend" / "app" / "modules"
    mod_dir = modules_dir / module_slug

    # Guard: class already exists somewhere in this project
    if _class_exists(modules_dir, class_name):
        click.echo(click.style(f"⚠️   A class named '{class_name}' already exists in this project.", fg="yellow"))
        raise SystemExit(1)

    ctx = {"ModelClass": class_name, "table_name": table_name, "description": desc}

    if not mod_dir.exists():
        _create_module(mod_dir, project_root, ctx, module_slug)
    else:
        _append_to_module(mod_dir, project_root, ctx, module_slug)

    _maybe_generate(project_root)
    _maybe_migrate(project_root, class_name, table_name, migrate)


# ── Module creation ────────────────────────────────────────────────────────────

def _create_module(mod_dir: Path, project_root: Path, ctx: dict, slug: str) -> None:
    label = slug.replace("_", " ").title()
    click.echo(f"\n🧩 Creating module: {label}  ({slug})")

    _write(mod_dir / "__init__.py", "")
    _write(mod_dir / "models.py", _NEW_MODELS_PY.format(**ctx))
    _write(mod_dir / "custom_api.py", _CUSTOM_API_PY.format(**ctx))

    _update_nav_config(project_root, slug, ctx["ModelClass"], label)

    click.echo(click.style(f"\n✅  Model '{ctx['ModelClass']}' created in new module '{slug}'.", fg="green"))


def _append_to_module(mod_dir: Path, project_root: Path, ctx: dict, slug: str) -> None:
    models_file = mod_dir / "models.py"

    if not models_file.exists():
        _write(models_file, _NEW_MODELS_PY.format(**ctx))
    else:
        text = models_file.read_text(encoding="utf-8")
        text = _ensure_import(text, "from typing import", "Optional")
        text = _ensure_import(text, "from sqlmodel import", "Field")
        text = _ensure_veloiq_import(text, "TimestampedModel")
        text = text.rstrip() + _APPEND_CLASS.format(**ctx)
        models_file.write_text(text, encoding="utf-8")

    _update_nav_config(project_root, slug, ctx["ModelClass"], slug.replace("_", " ").title())

    try:
        rel = models_file.relative_to(mod_dir.parent.parent.parent.parent)
    except ValueError:
        rel = models_file
    click.echo(click.style(f"\n✅  Model '{ctx['ModelClass']}' appended to {rel}", fg="green"))


def _maybe_generate(project_root: Path) -> None:
    import subprocess, shutil
    frontend_src = project_root / "frontend" / "src"
    if not (frontend_src / "allModels.gen.ts").exists():
        return
    veloiq_bin = shutil.which("veloiq")
    if not veloiq_bin:
        click.echo("   Run `veloiq generate` to update frontend schemas.")
        return
    click.echo("\n   Regenerating frontend schemas...")
    result = subprocess.run([veloiq_bin, "generate"], cwd=str(project_root))
    if result.returncode != 0:
        click.echo(click.style("   ⚠️  veloiq generate failed — run it manually.", fg="yellow"))


# ── Navigation config ──────────────────────────────────────────────────────────

def _update_nav_config(root: Path, slug: str, model_class: str, label: str) -> None:
    import json
    nav_file = root / "frontend" / "src" / "navigation.config.json"
    if not nav_file.exists():
        return
    try:
        existing: list[dict] = json.loads(nav_file.read_text())
    except Exception:
        existing = []

    existing_keys = {e.get("key") for e in existing}
    app_seqs = [e.get("sequence", 0) for e in existing if 0 < e.get("sequence", 0) < 900]
    next_seq = (max(app_seqs) + 10) if app_seqs else 10

    new_entries = []
    if f"module:{slug}" not in existing_keys:
        new_entries.append({
            "key": f"module:{slug}",
            "label": label,
            "icon": _guess_icon(label, is_module=True),
            "sequence": next_seq,
            "type": "module",
        })
    if slug not in existing_keys:
        model_label = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", model_class)
        new_entries.append({
            "key": slug,
            "label": model_label,
            "icon": _guess_icon(model_label),
            "sequence": next_seq + 1,
            "type": "model",
        })

    if new_entries:
        nav_file.write_text(json.dumps(existing + new_entries, indent=2))
        click.echo(f"  📐 navigation.config.json  (+{len(new_entries)} entries)")


# ── Helpers ────────────────────────────────────────────────────────────────────

def _class_exists(modules_dir: Path, class_name: str) -> bool:
    if not modules_dir.exists():
        return False
    pattern = re.compile(rf'^class\s+{re.escape(class_name)}\s*\(', re.M)
    for mp in modules_dir.rglob("models.py"):
        if pattern.search(mp.read_text(encoding="utf-8")):
            return True
    return False


def _ensure_import(text: str, from_stmt: str, name: str) -> str:
    """Ensure `name` appears in the `from X import ...` line."""
    m = re.search(re.escape(from_stmt) + r'\s+([^\n]+)', text)
    if m and name in m.group(1):
        return text
    if m:
        return text.replace(m.group(0), f"{from_stmt} {name}, {m.group(1)}")
    # Insert after last import line
    lines = text.splitlines(keepends=True)
    last = 0
    for i, ln in enumerate(lines):
        if ln.startswith(("import ", "from ")):
            last = i
    lines.insert(last + 1, f"{from_stmt} {name}\n")
    return "".join(lines)


def _ensure_veloiq_import(text: str, name: str) -> str:
    if "from veloiq_framework import" in text:
        m = re.search(r'from veloiq_framework import\s+([^\n]+)', text)
        if m and name in m.group(1):
            return text
        if m:
            return text.replace(m.group(0), f"from veloiq_framework import {name}, {m.group(1)}")
    else:
        lines = text.splitlines(keepends=True)
        last = 0
        for i, ln in enumerate(lines):
            if ln.startswith(("import ", "from ")):
                last = i
        lines.insert(last + 1, f"from veloiq_framework import {name}\n")
        return "".join(lines)
    return text


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    click.echo(f"  📄 {path.name}")


def _to_pascal(name: str) -> str:
    """Convert any casing to PascalCase."""
    # Split on underscores, hyphens, spaces, or existing camel boundaries
    parts = re.sub(r'([a-z])([A-Z])', r'\1_\2', name)
    parts = re.sub(r'[^a-zA-Z0-9]+', '_', parts)
    return "".join(p.capitalize() for p in parts.split("_") if p)


def _to_snake(name: str) -> str:
    """PascalCase → snake_case."""
    s = re.sub(r'(.)([A-Z][a-z]+)', r'\1_\2', name)
    return re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', s).lower()


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
