"""veloiq add-field — add a field to an existing model."""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path
from typing import Optional

import click


# Maps CLI type aliases → (python_annotation, needs_datetime_import, needs_text_import)
# Includes Studio UI display-hint types so the dropdown values pass through cleanly.
_TYPE_MAP: dict[str, tuple[str, bool, bool]] = {
    # Core Python types
    "str":          ("str",               False, False),
    "string":       ("str",               False, False),
    "int":          ("int",               False, False),
    "integer":      ("int",               False, False),
    "float":        ("float",             False, False),
    "number":       ("float",             False, False),
    "decimal":      ("float",             False, False),
    "bool":         ("bool",              False, False),
    "boolean":      ("bool",              False, False),
    "date":         ("datetime.date",     True,  False),
    "datetime":     ("datetime.datetime", True,  False),
    "time":         ("datetime.time",     True,  False),
    # TEXT-backed string types
    "text":         ("str",               False, True),
    "textarea":     ("str",               False, True),
    "richtext":     ("str",               False, True),
    "json":         ("str",               False, True),
    "multiselect":  ("str",               False, True),
    # Short-string display-hint types (varchar)
    "email":        ("str",               False, False),
    "password":     ("str",               False, False),
    "url":          ("str",               False, False),
    "phone":        ("str",               False, False),
    "color":        ("str",               False, False),
    "select":       ("str",               False, False),
    "file":         ("str",               False, False),
    "image":        ("str",               False, False),
    "uuid":         ("str",               False, False),
}

# Automatically derive the best frontend view-type from the field's display-hint type.
# Keys are field type aliases; values are the view-type suffix used in showViewType /
# editViewType (e.g. "email" → showViewType: "read-only-email").
_VIEW_TYPE_DEFAULT: dict[str, str] = {
    "textarea":   "textarea",
    "richtext":   "markdown",
    "email":      "email",
    "password":   "password",
    "url":        "url",
    "phone":      "phone",
    "color":      "color",
    "image":      "image-url",
    "json":       "json",
}

# All view-type suffixes the UI library understands.
_VALID_VIEW_TYPES: frozenset[str] = frozenset({
    "textarea", "markdown", "json", "email", "password", "url", "phone",
    "color", "image-url", "currency", "percentage", "progress", "rating",
    "duration", "code", "qrcode", "relative", "truncated-text",
})


@click.command(name="add-field")
@click.argument("model")
@click.argument("field_name")
@click.argument("field_type", default="str")
@click.option("--optional/--required", default=True,
              help="Whether the field is Optional (nullable). Default: optional.")
@click.option("--default", "default_val", default=None,
              help="Default value (e.g. 'active', '0', 'true')")
@click.option("--description", "-d", default=None, help="Field description")
@click.option("--options", "-o", default=None,
              help="Comma-separated valid values (e.g. 'todo,in_progress,done')")
@click.option("--view-type", "view_type", default=None,
              help="Frontend view-type hint (e.g. email, url, markdown, image-url). "
                   "Auto-derived from FIELD_TYPE when not specified.")
@click.option("--migrate/--no-migrate", default=None,
              help="Run Alembic migration after adding the field. Default: prompt interactively.")
@click.option("--root", "-C", default=None, type=click.Path(exists=True, file_okay=False),
              help="Project root (default: auto-detect)")
def add_field(model, field_name, field_type, optional, default_val, description, options, view_type, migrate, root):
    """Add a field to an existing model's models.py.

    \b
    MODEL       Model class name or resource/table name (e.g. Task or task)
    FIELD_NAME  New field attribute name in snake_case
    FIELD_TYPE  Python type or display hint: str, text, email, url, textarea,
                richtext, int, float, bool, date, datetime, …  [default: str]

    \b
    Examples:
      veloiq add-field Task notes str --description "Internal notes"
      veloiq add-field project budget float --optional --description "Budget cap"
      veloiq add-field task status str --options todo,in_progress,done --default todo
      veloiq add-field contact website url
      veloiq add-field article body richtext
    """
    from veloiq_framework.cli.explorer import _find_project_root

    project_root = Path(root) if root else _find_project_root()
    if not project_root:
        click.echo(click.style("❌  Not inside a VeloIQ project.", fg="red"))
        raise SystemExit(1)

    ft = field_type.lower()
    if ft not in _TYPE_MAP:
        valid = ", ".join(sorted(_TYPE_MAP))
        click.echo(click.style(f"❌  Unknown type '{field_type}'. Choose from: {valid}", fg="red"))
        raise SystemExit(1)

    py_type, needs_datetime, needs_text = _TYPE_MAP[ft]

    # Resolve view type: explicit flag > auto-derive from field type > None.
    if view_type is not None:
        vt = view_type.lower()
        if vt not in _VALID_VIEW_TYPES:
            valid_vt = ", ".join(sorted(_VALID_VIEW_TYPES))
            click.echo(click.style(f"❌  Unknown view type '{view_type}'. Choose from: {valid_vt}", fg="red"))
            raise SystemExit(1)
        resolved_view_type: Optional[str] = vt
    else:
        resolved_view_type = _VIEW_TYPE_DEFAULT.get(ft)

    models_py = _find_models_file(project_root, model)
    if not models_py:
        click.echo(click.style(f"❌  Could not find models.py for '{model}'.", fg="red"))
        click.echo("     Make sure the model class name or resource name is correct.")
        raise SystemExit(1)

    text = models_py.read_text(encoding="utf-8")

    # Guard: field already exists
    if re.search(rf'^\s+{re.escape(field_name)}\s*:', text, re.M):
        click.echo(click.style(f"⚠️   Field '{field_name}' already exists in {models_py.name}.", fg="yellow"))
        return

    opt_list = [v.strip() for v in options.split(",")] if options else []
    field_line = _build_field_line(
        field_name, py_type, optional, default_val, description,
        opt_list, needs_text, resolved_view_type,
    )

    needs_veloiq = bool(opt_list or resolved_view_type or (default_val is not None and not optional))
    text = _ensure_imports(text, needs_datetime, needs_text, needs_veloiq)
    text = _insert_field(text, model, field_line)
    models_py.write_text(text, encoding="utf-8")

    rel = models_py.relative_to(project_root)
    click.echo(click.style(f"✅  Added '{field_name}' to {rel}", fg="green"))
    click.echo("   Run `veloiq generate` to update the TypeScript schemas.")

    # Offer to run an Alembic migration so the DB column is created immediately
    _maybe_migrate(project_root, model, field_name, migrate)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _find_models_file(root: Path, model_id: str) -> Optional[Path]:
    """Locate the models.py that contains a class or resource matching model_id."""
    modules_dir = root / "backend" / "app" / "modules"
    if not modules_dir.exists():
        return None

    # Normalise: "Task" → "task", "team_member" stays "team_member"
    needle = model_id.lower()

    for mod_dir in modules_dir.iterdir():
        if not mod_dir.is_dir():
            continue
        mp = mod_dir / "models.py"
        if not mp.exists():
            continue
        text = mp.read_text(encoding="utf-8")
        # Match by class name (case-insensitive) or __tablename__
        if re.search(rf'^class\s+{re.escape(model_id)}\s*\(', text, re.M | re.I):
            return mp
        if re.search(rf'__tablename__\s*=\s*["\']({re.escape(needle)})["\']', text):
            return mp
    return None


def _build_field_line(
    field_name: str,
    py_type: str,
    optional: bool,
    default_val: Optional[str],
    description: Optional[str],
    options: list[str],
    needs_text: bool,
    view_type: Optional[str] = None,
) -> str:
    """Build the complete field declaration line."""
    use_veloiq = bool(options or view_type)

    if optional:
        annotation = f"Optional[{py_type}]"
    else:
        annotation = py_type

    # Build field kwargs
    kwargs: list[str] = []
    if optional and default_val is None:
        kwargs.append("default=None")
    elif default_val is not None:
        # Try to infer type for the default value
        if py_type in ("int",):
            kwargs.append(f"default={default_val}")
        elif py_type in ("float",):
            kwargs.append(f"default={default_val}")
        elif default_val.lower() in ("true", "false"):
            kwargs.append(f"default={default_val.capitalize()}")
        else:
            kwargs.append(f'default="{default_val}"')

    if options:
        opts_repr = "[" + ", ".join(f'"{v}"' for v in options) + "]"
        kwargs.append(f"options={opts_repr}")

    if view_type:
        kwargs.append(f'view_type="{view_type}"')

    if description:
        kwargs.append(f'description="{description}"')

    if needs_text:
        kwargs.append("sa_column=Column(Text)")

    func = "veloiq_field" if use_veloiq else "Field"
    kwargs_str = ", ".join(kwargs)
    return f"    {field_name}: {annotation} = {func}({kwargs_str})"


def _ensure_imports(text: str, needs_datetime: bool, needs_text: bool, needs_veloiq: bool) -> str:
    """Add missing imports to the top of the models.py file."""
    lines = text.splitlines(keepends=True)

    # datetime import
    if needs_datetime and not re.search(r'^import datetime', text, re.M):
        # Insert after the last `from __future__` or at top
        insert_at = 0
        for i, ln in enumerate(lines):
            if ln.startswith(("import ", "from ")):
                insert_at = i
        lines.insert(insert_at, "import datetime\n")
        text = "".join(lines)

    # Column / Text import for sa_column
    if needs_text and "Column" not in text:
        text = re.sub(
            r'(from sqlmodel import [^\n]+)',
            lambda m: m.group(1) if "Column" in m.group(1)
                      else m.group(1).rstrip() + "\nfrom sqlalchemy import Column, Text",
            text, count=1,
        )

    # veloiq_field import
    if needs_veloiq and "veloiq_field" not in text:
        text = re.sub(
            r'(from veloiq_framework import [^\n]+)',
            lambda m: m.group(1).rstrip() + ", veloiq_field"
                      if "veloiq_field" not in m.group(1) else m.group(1),
            text, count=1,
        )

    return text


def _maybe_migrate(project_root: Path, model: str, field_name: str, flag: Optional[bool]) -> None:
    """Auto-generate and apply an Alembic migration for the new field."""
    backend_dir = project_root / "backend"
    if not (backend_dir / "alembic.ini").exists():
        click.echo(
            "   ℹ️  No alembic.ini found — skipping migration.\n"
            "      Run `veloiq db init` to set up Alembic, then `veloiq db upgrade`."
        )
        return

    if flag is False:
        click.echo("   (skipping migration — run `veloiq db migrate -m '...' && veloiq db upgrade` when ready)")
        return

    if flag is None:
        run_it = click.confirm(
            "\n   Run database migration now? (alembic autogenerate + upgrade head)",
            default=True,
        )
        if not run_it:
            click.echo("   Skipped. Run `veloiq db migrate -m '...' && veloiq db upgrade` when ready.")
            return

    click.echo()
    msg = f"add {field_name} to {model}"
    _load_env(backend_dir)
    for alembic_args in (
        ["revision", "--autogenerate", "-m", msg],
        ["upgrade", "head"],
    ):
        cmd = [sys.executable, "-m", "alembic", *alembic_args]
        click.echo(f"  $ {' '.join(cmd)}")
        result = subprocess.run(cmd, cwd=str(backend_dir))
        if result.returncode != 0:
            click.echo(click.style("❌  Migration failed — check the output above.", fg="red"))
            raise SystemExit(result.returncode)

    click.echo(click.style("✅  Database migrated successfully.", fg="green"))


def _load_env(backend_dir: Path) -> None:
    """Load .env from backend dir (best-effort)."""
    for name in (".env", ".env.local"):
        env_file = backend_dir / name
        if env_file.exists():
            try:
                from dotenv import load_dotenv
                load_dotenv(env_file, override=False)
            except ImportError:
                pass
            return


def _insert_field(text: str, model_id: str, field_line: str) -> str:
    """Insert field_line just before the first relationship or at end of class body."""
    needle = model_id.lower()
    lines = text.splitlines(keepends=True)

    # Find the class
    class_start = -1
    for i, ln in enumerate(lines):
        if re.match(rf'\s*class\s+{re.escape(model_id)}\s*\(', ln, re.I):
            class_start = i
            break
        # Also match by tablename comment/variable in the block
        if class_start >= 0 and re.search(rf'__tablename__.*["\']({re.escape(needle)})["\']', ln):
            break

    if class_start < 0:
        # Fallback: append at end of file
        return text.rstrip() + "\n" + field_line + "\n"

    # Scan forward from class start to find insertion point:
    # just before the first jm_relationship / Relationship / back_populates line,
    # or just before the end of the class (blank line or next class).
    insert_before = len(lines)
    for i in range(class_start + 1, len(lines)):
        ln = lines[i].strip()
        if not ln:
            continue
        if re.match(r'^class\s', lines[i]):
            insert_before = i
            break
        if any(kw in lines[i] for kw in ("jm_relationship", "Relationship(", "relationship(")):
            insert_before = i
            break

    lines.insert(insert_before, field_line + "\n")
    return "".join(lines)
