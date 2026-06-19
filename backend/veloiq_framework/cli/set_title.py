"""veloiq set-title — choose which fields compose a model's title (dc_title / __str__).

The model's title is the human-readable label shown across the UI (list rows,
relation pickers, reference links). By default VeloIQ derives it automatically
from the first text field. This command lets a developer pin the exact fields
whose values are concatenated (separated by a single blank space) to form a
friendlier title.

The configuration is stored on the model class as::

    __veloiq_ui__: ClassVar[Dict] = {"titleFields": ["first_name", "last_name"]}

It is entirely optional — a model with no ``titleFields`` keeps the automatic
behaviour. The command works on any existing model, not just freshly scaffolded
ones; if the model has no ``__veloiq_ui__`` yet, one is created.
"""
from __future__ import annotations

import ast
import re
from pathlib import Path
from typing import Optional

import click


# ── Command ────────────────────────────────────────────────────────────────────

@click.command(name="set-title")
@click.argument("model")
@click.option("--fields", "fields_csv", default=None,
              help="Comma-separated field names whose values compose the title, "
                   "in order (e.g. 'first_name,last_name'). Two special tokens are "
                   "also accepted and rendered in brackets: 'model_name' (the model's "
                   "name) and 'pk' (its primary key). Omit with --clear to reset.")
@click.option("--clear", is_flag=True, default=False,
              help="Remove the configured title fields and restore automatic title derivation.")
@click.option("--no-generate", "no_generate", is_flag=True, default=False,
              help="Do not regenerate frontend schemas after editing (run `veloiq generate` yourself).")
@click.option("--root", "-C", default=None, type=click.Path(exists=True, file_okay=False),
              help="Project root (default: auto-detect).")
def set_title(model, fields_csv, clear, no_generate, root):
    """Define or change the fields that compose a model's title (dc_title / __str__).

    \b
    MODEL   Model class name or resource/table name (e.g. Contact or contact).

    \b
    Examples:
      veloiq set-title Contact --fields first_name,last_name
      veloiq set-title invoice --fields number,customer_name
      veloiq set-title Contact --clear
    """
    from veloiq_framework.cli.explorer import _find_project_root
    from veloiq_framework.cli.add_field import _find_models_file

    project_root = Path(root) if root else _find_project_root()
    if not project_root:
        click.echo(click.style("❌  Not inside a VeloIQ project.", fg="red"))
        raise SystemExit(1)

    if not clear:
        fields = _parse_fields(fields_csv)
        if not fields:
            click.echo(click.style(
                "❌  Provide --fields field1,field2,… or use --clear to reset the title.", fg="red"))
            raise SystemExit(1)
    else:
        fields = []
        if fields_csv:
            click.echo(click.style("⚠️   --clear ignores --fields.", fg="yellow"))

    models_py = _find_models_file(project_root, model)
    if not models_py:
        click.echo(click.style(f"❌  Could not find models.py for '{model}'.", fg="red"))
        click.echo("     Make sure the model class name or resource name is correct.")
        raise SystemExit(1)

    text = models_py.read_text(encoding="utf-8")
    class_start = _find_class_start(text, model)
    if class_start is None:
        click.echo(click.style(
            f"❌  Could not locate the class for '{model}' in {models_py.name}.", fg="red"))
        raise SystemExit(1)

    # Validate requested fields against the ones declared on the class (best-effort).
    if fields:
        declared = _declared_field_names(text, class_start)
        fields = _normalize_special(fields, declared)
        unknown = [
            f for f in fields
            if f not in declared and f not in _ALWAYS_AVAILABLE and f not in _SPECIAL_TOKENS
        ]
        if unknown:
            click.echo(click.style(
                f"⚠️   Field(s) not found on {model}: {', '.join(unknown)}. "
                "Writing anyway (they will be skipped at runtime if absent).", fg="yellow"))

    new_text, changed, summary = _apply_title_fields(text, class_start, fields, clear)
    if not changed:
        click.echo(summary)
        return

    models_py.write_text(new_text, encoding="utf-8")
    rel = models_py.relative_to(project_root)
    click.echo(click.style(f"✅  {summary} in {rel}", fg="green"))
    if fields:
        click.echo("   Title preview:  " + " ".join(_preview_label(f) for f in fields))

    if no_generate:
        click.echo("   Run `veloiq generate` to update the frontend schemas.")
        return
    _maybe_generate(project_root)


# ── Helpers ────────────────────────────────────────────────────────────────────

# Fields that may be inherited from the base model and so are not declared in the
# module's models.py body, but are still valid title sources.
_ALWAYS_AVAILABLE = {
    "id", "eid", "created_at", "updated_at", "creation_date", "modification_date",
}

# Special selectable tokens — resolve at render time to the model's display name
# / primary-key value and are wrapped in brackets in the UI. They may appear in
# --fields alongside real field names, in any order.
_SPECIAL_TOKENS = {"__model_name__", "__pk__"}
_SPECIAL_ALIASES = {
    "model_name": "__model_name__", "modelname": "__model_name__",
    "model-name": "__model_name__", ":model": "__model_name__",
    "pk": "__pk__", "primary_key": "__pk__", "primarykey": "__pk__",
    "primary-key": "__pk__", ":pk": "__pk__",
}


def _normalize_special(fields: list[str], declared: set[str]) -> list[str]:
    """Map friendly aliases (e.g. 'model_name', 'pk') to the canonical special
    tokens, unless the model actually declares a real field of that name."""
    out: list[str] = []
    for f in fields:
        if f in _SPECIAL_TOKENS:
            out.append(f)
        elif f.lower() in _SPECIAL_ALIASES and f not in declared:
            out.append(_SPECIAL_ALIASES[f.lower()])
        else:
            out.append(f)
    return out


def _preview_label(f: str) -> str:
    if f == "__model_name__":
        return "[Model name]"
    if f == "__pk__":
        return "[Primary key]"
    return f

# Lines inside the class body we never treat as eligible "fields".
_DUNDER_RE = re.compile(r"^\s+__\w+__\s*[:=]")


def _parse_fields(fields_csv: Optional[str]) -> list[str]:
    if not fields_csv:
        return []
    return [f.strip() for f in fields_csv.split(",") if f.strip()]


def _find_class_start(text: str, model_id: str) -> Optional[int]:
    """Return the 0-based line index of the target class definition, or None."""
    lines = text.splitlines()
    needle = model_id.lower()
    # 1. Match by class name (case-insensitive).
    for i, ln in enumerate(lines):
        if re.match(rf"\s*class\s+{re.escape(model_id)}\s*\(", ln, re.I):
            return i
    # 2. Match by __tablename__ within a class block.
    current_class = None
    for i, ln in enumerate(lines):
        cm = re.match(r"\s*class\s+(\w+)\s*\(", ln)
        if cm:
            current_class = i
        elif current_class is not None and re.search(
            rf'__tablename__\s*=\s*[\"\']({re.escape(needle)})[\"\']', ln
        ):
            return current_class
    return None


def _class_body_end(lines: list[str], class_start: int) -> int:
    """Return the line index just past the end of the class body."""
    for i in range(class_start + 1, len(lines)):
        ln = lines[i]
        if not ln.strip():
            continue
        # A top-level (non-indented) statement / class / decorator ends the body.
        if not ln[:1].isspace():
            return i
    return len(lines)


def _body_indent(lines: list[str], class_start: int, end: int) -> str:
    for i in range(class_start + 1, end):
        ln = lines[i]
        if ln.strip() and ln[:1].isspace():
            return ln[: len(ln) - len(ln.lstrip())]
    return "    "


def _declared_field_names(text: str, class_start: int) -> set[str]:
    lines = text.splitlines()
    end = _class_body_end(lines, class_start)
    names: set[str] = set()
    for i in range(class_start + 1, end):
        ln = lines[i]
        if not ln.strip() or _DUNDER_RE.match(ln):
            continue
        m = re.match(r"\s+([A-Za-z_]\w*)\s*:", ln)
        if m:
            names.add(m.group(1))
    return names


def _py_literal(value) -> str:
    """Serialize a Python value to a source literal using double quotes."""
    if isinstance(value, str):
        return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'
    if isinstance(value, bool):
        return "True" if value else "False"
    if isinstance(value, (int, float)):
        return repr(value)
    if isinstance(value, (list, tuple)):
        return "[" + ", ".join(_py_literal(v) for v in value) + "]"
    if isinstance(value, dict):
        return "{" + ", ".join(f"{_py_literal(k)}: {_py_literal(v)}" for k, v in value.items()) + "}"
    return repr(value)



def _apply_title_fields(text: str, class_start: int, fields: list[str], clear: bool):
    """Insert/update/remove __veloiq_ui__["titleFields"]. Returns (text, changed, summary)."""
    lines = text.splitlines(keepends=True)
    end = _class_body_end(lines, class_start)
    indent = _body_indent(lines, class_start, end)

    ui_line_idx = None
    ui_dict: dict = {}
    annotation = ": ClassVar[Dict]"
    line_re = re.compile(r"^(\s*)__veloiq_ui__\s*(:[^=]+)?=\s*(\{.*\})\s*$")
    for i in range(class_start + 1, end):
        m = line_re.match(lines[i].rstrip("\n"))
        if m:
            ui_line_idx = i
            indent = m.group(1)
            if m.group(2):
                annotation = m.group(2).rstrip()
            try:
                parsed = ast.literal_eval(m.group(3))
                if isinstance(parsed, dict):
                    ui_dict = parsed
            except Exception:
                click.echo(click.style(
                    "❌  Existing __veloiq_ui__ is not a simple single-line dict literal — "
                    "edit it by hand to set titleFields.", fg="red"))
                raise SystemExit(1)
            break

    current = ui_dict.get("titleFields")

    if clear:
        if not current:
            return text, False, "ℹ️  No title fields were set — nothing to clear."
        ui_dict.pop("titleFields", None)
        if ui_dict:
            lines[ui_line_idx] = f"{indent}__veloiq_ui__{annotation} = {_py_literal(ui_dict)}\n"
        else:
            lines.pop(ui_line_idx)
        return ("".join(lines), True, "Cleared title fields (restored automatic title)")

    if current == fields:
        return text, False, f"ℹ️  Title fields already set to: {', '.join(fields)}"

    ui_dict["titleFields"] = fields

    if ui_line_idx is not None:
        lines[ui_line_idx] = f"{indent}__veloiq_ui__{annotation} = {_py_literal(ui_dict)}\n"
        new_text = "".join(lines)
        return new_text, True, f"Updated title fields: {', '.join(fields)}"

    # No __veloiq_ui__ yet — create one right after __tablename__ (or the class
    # declaration / docstring) so it works on any pre-existing model.
    insert_at = _meta_insert_point(lines, class_start, end)
    new_line = f"{indent}__veloiq_ui__: ClassVar[Dict] = {_py_literal(ui_dict)}\n"
    lines.insert(insert_at, new_line)
    new_text = _ensure_typing_imports("".join(lines), ("ClassVar", "Dict"))
    return new_text, True, f"Set title fields: {', '.join(fields)}"


def _meta_insert_point(lines: list[str], class_start: int, end: int) -> int:
    """Best insertion line for a new __veloiq_ui__: after __tablename__ if present,
    else after the class declaration line and any docstring."""
    for i in range(class_start + 1, end):
        if re.match(r"\s+__tablename__\s*=", lines[i]):
            return i + 1
    # Skip a docstring that immediately follows the class declaration.
    i = class_start + 1
    while i < end and not lines[i].strip():
        i += 1
    if i < end and lines[i].lstrip().startswith(('"""', "'''")):
        quote = lines[i].lstrip()[:3]
        if lines[i].strip().count(quote) >= 2 and len(lines[i].strip()) > 3:
            return i + 1  # single-line docstring
        for j in range(i + 1, end):
            if quote in lines[j]:
                return j + 1
    return class_start + 1


def _ensure_typing_imports(text: str, names: tuple[str, ...]) -> str:
    """Ensure each name is imported from typing."""
    m = re.search(r"^from typing import\s+([^\n]+)$", text, re.M)
    if m:
        existing = {n.strip() for n in m.group(1).split(",")}
        missing = [n for n in names if n not in existing]
        if not missing:
            return text
        merged = ", ".join(sorted(existing | set(names)))
        return text[: m.start()] + f"from typing import {merged}" + text[m.end():]
    # No typing import — add one after the last top-of-file import, else at the top.
    lines = text.splitlines(keepends=True)
    insert_at = 0
    for i, ln in enumerate(lines):
        if ln.startswith(("import ", "from ")):
            insert_at = i + 1
    lines.insert(insert_at, f"from typing import {', '.join(names)}\n")
    return "".join(lines)


def _maybe_generate(project_root: Path) -> None:
    """Regenerate frontend schemas so the new titleFields reach the UI (best-effort)."""
    import shutil
    import subprocess

    frontend_src = project_root / "frontend" / "src"
    if not (frontend_src / "allModels.gen.ts").exists():
        click.echo("   Run `veloiq generate` to update the frontend schemas.")
        return
    veloiq_bin = shutil.which("veloiq")
    if not veloiq_bin:
        click.echo("   Run `veloiq generate` to update the frontend schemas.")
        return
    click.echo("\n   Regenerating frontend schemas...")
    result = subprocess.run([veloiq_bin, "generate"], cwd=str(project_root))
    if result.returncode != 0:
        click.echo(click.style("   ⚠️  veloiq generate failed — run it manually.", fg="yellow"))

