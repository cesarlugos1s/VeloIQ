"""veloiq add-field — add a field to an existing model."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Optional

import click


# Maps CLI type aliases → (python_annotation, needs_datetime_import, needs_text_import)
_TYPE_MAP: dict[str, tuple[str, bool, bool]] = {
    "str":      ("str",             False, False),
    "string":   ("str",             False, False),
    "text":     ("str",             False, True),   # stored as TEXT column
    "int":      ("int",             False, False),
    "integer":  ("int",             False, False),
    "float":    ("float",           False, False),
    "number":   ("float",           False, False),
    "bool":     ("bool",            False, False),
    "boolean":  ("bool",            False, False),
    "date":     ("datetime.date",   True,  False),
    "datetime": ("datetime.datetime", True, False),
}


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
@click.option("--root", "-C", default=None, type=click.Path(exists=True, file_okay=False),
              help="Project root (default: auto-detect)")
def add_field(model, field_name, field_type, optional, default_val, description, options, root):
    """Add a field to an existing model's models.py.

    \b
    MODEL       Model class name or resource/table name (e.g. Task or task)
    FIELD_NAME  New field attribute name in snake_case
    FIELD_TYPE  Python type: str, text, int, float, bool, date, datetime  [default: str]

    \b
    Examples:
      veloiq add-field Task notes str --description "Internal notes"
      veloiq add-field project budget float --optional --description "Budget cap"
      veloiq add-field task status str --options todo,in_progress,done --default todo
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
    field_line = _build_field_line(field_name, py_type, optional, default_val, description, opt_list, needs_text)

    text = _ensure_imports(text, needs_datetime, needs_text, bool(opt_list or (default_val is not None and not optional)))
    text = _insert_field(text, model, field_line)
    models_py.write_text(text, encoding="utf-8")

    rel = models_py.relative_to(project_root)
    click.echo(click.style(f"✅  Added '{field_name}' to {rel}", fg="green"))
    click.echo("   Run `veloiq generate` to update the TypeScript schemas.")


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
) -> str:
    """Build the complete field declaration line."""
    use_veloiq = bool(options)

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
