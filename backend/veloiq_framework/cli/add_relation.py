"""veloiq add-relation — add a relation between two models."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Optional

import click


@click.command(name="add-relation")
@click.argument("source_model")
@click.argument("target_model")
@click.option("--type", "rel_type", default="fk",
              type=click.Choice(["fk", "many-to-many"]),
              help="Relation type: fk (many-to-one, source holds FK) or many-to-many (link table).")
@click.option("--attr", default=None,
              help="Attribute name on source model (default: snake_case of TARGET).")
@click.option("--back-attr", "back_attr", default=None,
              help="Attribute name on target for back_populates (default: snake_case of SOURCE + 's').")
@click.option("--min-items", "min_items", default=0, type=int,
              help="Minimum cardinality on the List side (default: 0).")
@click.option("--max-items", "max_items", default=None, type=int,
              help="Maximum cardinality on the List side (default: unlimited).")
@click.option("--required/--optional", default=False,
              help="Make FK non-nullable (fk type only). Default: optional.")
@click.option("--no-back", is_flag=True, default=False,
              help="Skip adding the reverse relationship to the target model.")
@click.option("--migrate/--no-migrate", default=None,
              help="Run Alembic migration after adding. Default: prompt interactively.")
@click.option("--root", "-C", default=None, type=click.Path(exists=True, file_okay=False),
              help="Project root (default: auto-detect).")
def add_relation(source_model, target_model, rel_type, attr, back_attr,
                 min_items, max_items, required, no_back, migrate, root):
    """Add a relation between two models.

    \b
    SOURCE_MODEL   Model that holds the FK or initiates the relation (e.g., Task)
    TARGET_MODEL   Model being referenced (e.g., Project)

    \b
    FK (many-to-one) — SOURCE has a FK column pointing to TARGET:
      veloiq add-relation Task Project
      veloiq add-relation Task Project --attr project --back-attr tasks --min-items 1

    \b
    Many-to-many — creates a link table, both sides get a List relationship:
      veloiq add-relation Task Tag --type many-to-many
      veloiq add-relation Task Tag --type many-to-many --attr tags --back-attr tasks
    """
    from veloiq_framework.cli.explorer import _find_project_root
    from veloiq_framework.cli.add_field import _maybe_migrate

    project_root = Path(root) if root else _find_project_root()
    if not project_root:
        click.echo(click.style("❌  Not inside a VeloIQ project.", fg="red"))
        raise SystemExit(1)

    src_info = _find_model_info(project_root, source_model)
    if not src_info:
        click.echo(click.style(f"❌  Could not find model '{source_model}'.", fg="red"))
        raise SystemExit(1)

    tgt_info = _find_model_info(project_root, target_model)
    if not tgt_info:
        click.echo(click.style(f"❌  Could not find model '{target_model}'.", fg="red"))
        raise SystemExit(1)

    src_class, src_table, src_file, src_module = src_info
    tgt_class, tgt_table, tgt_file, tgt_module = tgt_info

    attr_name = attr or _to_snake(tgt_class)
    back_name = back_attr or (_to_snake(src_class) + "s")

    if rel_type == "fk":
        _add_fk_relation(
            project_root,
            src_class, src_table, src_file, src_module,
            tgt_class, tgt_table, tgt_file, tgt_module,
            attr_name, back_name, min_items, max_items, required, no_back,
        )
        _maybe_migrate(project_root, source_model, f"{attr_name}_id", migrate)
    else:
        _add_many_to_many(
            project_root,
            src_class, src_table, src_file, src_module,
            tgt_class, tgt_table, tgt_file, tgt_module,
            attr_name, back_name, min_items, max_items, no_back,
        )
        link_class = f"{src_class}{tgt_class}Link"
        _maybe_migrate(project_root, source_model, link_class, migrate)


# ── Relation writers ───────────────────────────────────────────────────────────

def _add_fk_relation(
    project_root: Path,
    src_class: str, src_table: str, src_file: Path, src_module: str,
    tgt_class: str, tgt_table: str, tgt_file: Path, tgt_module: str,
    attr_name: str, back_name: str,
    min_items: int, max_items: Optional[int],
    required: bool, no_back: bool,
) -> None:
    fk_col = f"{attr_name}_id"
    same_file = src_file.resolve() == tgt_file.resolve()

    src_text = src_file.read_text(encoding="utf-8")
    # When both models are in the same file, work on a single text buffer
    tgt_text = src_text if same_file else tgt_file.read_text(encoding="utf-8")

    existing_src_to_tgt = _has_fk_to(src_text, tgt_table)
    existing_tgt_to_src = _has_fk_to(tgt_text, src_table)
    need_disambig = existing_src_to_tgt or existing_tgt_to_src
    fk_expr = f"[{src_class}.{fk_col}]"

    added_src = False
    if re.search(rf'^\s+{re.escape(fk_col)}\s*:', src_text, re.M):
        click.echo(click.style(f"⚠️   '{fk_col}' already exists in {src_file.name}.", fg="yellow"))
    else:
        if required:
            fk_line = f'    {fk_col}: int = Field(foreign_key="{tgt_table}.id")'
        else:
            fk_line = f'    {fk_col}: Optional[int] = Field(default=None, foreign_key="{tgt_table}.id")'

        if need_disambig:
            rel_line = (
                f'    {attr_name}: Optional["{tgt_class}"] = jm_relationship(\n'
                f'        back_populates="{back_name}",\n'
                f'        sa_relationship_kwargs={{"foreign_keys": "{fk_expr}"}},\n'
                f'    )'
            )
        else:
            rel_line = f'    {attr_name}: Optional["{tgt_class}"] = jm_relationship(back_populates="{back_name}")'

        src_text = _ensure_optional_import(src_text)
        src_text = _ensure_jm_relationship_import(src_text)
        if not same_file:
            # Same-file models don't need a TYPE_CHECKING import for each other
            src_text = _ensure_type_checking_import(src_text, tgt_module, tgt_class)
        src_text = _insert_before_relationships(src_text, src_class, fk_line)
        src_text = _insert_after_last_relationship(src_text, src_class, rel_line)
        added_src = True

        if need_disambig:
            if same_file:
                src_text = _patch_same_file_disambig(
                    src_text, src_class, tgt_class, src_table, tgt_table
                )
            else:
                src_text, tgt_text = _patch_existing_rels_for_disambig(
                    src_text, tgt_text, src_class, tgt_class, src_table, tgt_table
                )

    # Sync the unified buffer after src modifications
    if same_file:
        tgt_text = src_text

    added_back = False
    if not no_back:
        if re.search(rf'^\s+{re.escape(back_name)}\s*:', tgt_text, re.M):
            click.echo(click.style(f"⚠️   '{back_name}' already exists in {tgt_file.name}.", fg="yellow"))
        else:
            card_kwargs = _cardinality_kwargs(min_items, max_items)
            card_kwargs.append(f'back_populates="{attr_name}"')
            if need_disambig:
                card_kwargs.append(f'sa_relationship_kwargs={{"foreign_keys": "{fk_expr}"}}')
                args = ',\n        '.join(card_kwargs)
                back_line = f'    {back_name}: List["{src_class}"] = jm_relationship(\n        {args},\n    )'
            else:
                back_line = f'    {back_name}: List["{src_class}"] = jm_relationship({", ".join(card_kwargs)})'

            tgt_text = _ensure_list_import(tgt_text)
            tgt_text = _ensure_jm_relationship_import(tgt_text)
            if not same_file:
                tgt_text = _ensure_type_checking_import(tgt_text, src_module, src_class)
            tgt_text = _insert_after_last_relationship(tgt_text, tgt_class, back_line)
            added_back = True

    # Writes — same_file: single write; different files: write each independently
    if same_file:
        if added_src or added_back:
            src_file.write_text(tgt_text, encoding="utf-8")
            rel = src_file.relative_to(project_root)
            if added_src:
                click.echo(click.style(f"✅  Added '{fk_col}' + '{attr_name}' to {rel}", fg="green"))
            if added_back:
                click.echo(click.style(f"✅  Added '{back_name}' to {rel}", fg="green"))
            if need_disambig and added_src:
                click.echo(click.style(
                    "   ℹ️  Multiple FK paths detected — added foreign_keys disambiguation to existing relationships.",
                    fg="cyan",
                ))
    else:
        if added_src:
            src_file.write_text(src_text, encoding="utf-8")
            rel = src_file.relative_to(project_root)
            click.echo(click.style(f"✅  Added '{fk_col}' + '{attr_name}' to {rel}", fg="green"))
            if need_disambig:
                click.echo(click.style(
                    "   ℹ️  Multiple FK paths detected — added foreign_keys disambiguation to existing relationships.",
                    fg="cyan",
                ))
        if added_back:
            tgt_file.write_text(tgt_text, encoding="utf-8")
            rel = tgt_file.relative_to(project_root)
            click.echo(click.style(f"✅  Added '{back_name}' to {rel}", fg="green"))

    click.echo("   Run `veloiq generate` to update the TypeScript schemas.")


def _add_many_to_many(
    project_root: Path,
    src_class: str, src_table: str, src_file: Path, src_module: str,
    tgt_class: str, tgt_table: str, tgt_file: Path, tgt_module: str,
    attr_name: str, back_name: str,
    min_items: int, max_items: Optional[int],
    no_back: bool,
) -> None:
    link_class = f"{src_class}{tgt_class}Link"
    link_table = f"{src_table}_{tgt_table}_link"

    src_text = src_file.read_text(encoding="utf-8")

    if re.search(rf'^class\s+{re.escape(link_class)}\s*\(', src_text, re.M):
        click.echo(click.style(f"⚠️   '{link_class}' already exists in {src_file.name}.", fg="yellow"))
    else:
        link_block = (
            f"\n\nclass {link_class}(SQLModel, table=True):\n"
            f'    __tablename__ = "{link_table}"\n'
            f'    {src_table}_id: Optional[int] = Field(default=None, foreign_key="{src_table}.id", primary_key=True)\n'
            f'    {tgt_table}_id: Optional[int] = Field(default=None, foreign_key="{tgt_table}.id", primary_key=True)\n'
        )

        kwargs = _cardinality_kwargs(min_items, max_items)
        kwargs.append(f'back_populates="{back_name}"')
        kwargs.append(f"link_model={link_class}")
        rel_line = f'    {attr_name}: List["{tgt_class}"] = jm_relationship({", ".join(kwargs)})'

        src_text = _ensure_optional_import(src_text)
        src_text = _ensure_list_import(src_text)
        src_text = _ensure_sqlmodel_import(src_text)
        src_text = _ensure_jm_relationship_import(src_text)
        src_text = _ensure_type_checking_import(src_text, tgt_module, tgt_class)
        src_text = _insert_before_class(src_text, src_class, link_block)
        src_text = _insert_after_last_relationship(src_text, src_class, rel_line)
        src_file.write_text(src_text, encoding="utf-8")

        rel = src_file.relative_to(project_root)
        click.echo(click.style(f"✅  Added '{link_class}' + '{attr_name}' to {rel}", fg="green"))

    if not no_back:
        tgt_text = tgt_file.read_text(encoding="utf-8")
        if re.search(rf'^\s+{re.escape(back_name)}\s*:', tgt_text, re.M):
            click.echo(click.style(f"⚠️   '{back_name}' already exists in {tgt_file.name}.", fg="yellow"))
        else:
            kwargs = _cardinality_kwargs(min_items, max_items)
            kwargs.append(f'back_populates="{attr_name}"')
            kwargs.append(f"link_model={link_class}")
            back_line = f'    {back_name}: List["{src_class}"] = jm_relationship({", ".join(kwargs)})'

            tgt_text = _ensure_list_import(tgt_text)
            tgt_text = _ensure_jm_relationship_import(tgt_text)
            tgt_text = _ensure_type_checking_import(tgt_text, src_module, src_class)
            # link_model= is evaluated at runtime, so this import must be direct (not TYPE_CHECKING)
            tgt_text = _ensure_direct_import(tgt_text, src_module, link_class)
            tgt_text = _insert_after_last_relationship(tgt_text, tgt_class, back_line)
            tgt_file.write_text(tgt_text, encoding="utf-8")

            rel = tgt_file.relative_to(project_root)
            click.echo(click.style(f"✅  Added '{back_name}' to {rel}", fg="green"))

    click.echo("   Run `veloiq generate` to update the TypeScript schemas.")


# ── Disambiguation helpers ─────────────────────────────────────────────────────

def _has_fk_to(text: str, table: str) -> bool:
    """Return True if text contains any FK column pointing to table."""
    return bool(re.search(rf"""foreign_key=['"]({re.escape(table)}\.id)['"]""", text))


def _find_back_populates(text: str, attr_name: str) -> Optional[str]:
    """Return the back_populates value for the named relationship, or None."""
    m = re.search(
        rf'^\s+{re.escape(attr_name)}\s*:.*?back_populates=["\'](\w+)["\']',
        text, re.M | re.S,
    )
    return m.group(1) if m else None


def _patch_rel_foreign_keys(text: str, attr_name: str, fk_expr: str) -> str:
    """
    Inject sa_relationship_kwargs={"foreign_keys": fk_expr} into an existing jm_relationship.
    Skips if foreign_keys already present; skips if sa_relationship_kwargs present (to avoid
    overwriting deliberate custom kwargs).
    """
    lines = text.splitlines(keepends=True)
    start = -1
    for i, ln in enumerate(lines):
        if re.match(rf'\s+{re.escape(attr_name)}\s*:.*=\s*jm_relationship\s*\(', ln):
            start = i
            break
    if start < 0:
        return text

    depth = 0
    end = start
    for i in range(start, len(lines)):
        depth += lines[i].count('(') - lines[i].count(')')
        if depth <= 0:
            end = i
            break

    span = ''.join(lines[start:end + 1])
    if 'foreign_keys' in span or 'sa_relationship_kwargs' in span:
        return text  # already handled

    indent = re.match(r'(\s*)', lines[start]).group(1)
    inner_indent = indent + "    "
    fk_kwarg = f'sa_relationship_kwargs={{"foreign_keys": "{fk_expr}"}}'

    if start == end:
        m = re.match(r'(\s*\w+\s*:.*=\s*jm_relationship\s*\()([^)]*)\)(.*)', lines[start])
        if not m:
            return text
        before, inner, after = m.group(1), m.group(2).strip().rstrip(','), m.group(3).rstrip('\n')
        parts = ([f'{inner},'] if inner else []) + [f'{fk_kwarg},']
        args = '\n'.join(f'{inner_indent}{p}' for p in parts)
        lines[start] = f'{before}\n{args}\n{indent}){after}\n'
    else:
        # Multi-line: insert fk_kwarg before the closing paren line
        lines.insert(end, f'{inner_indent}{fk_kwarg},\n')

    return ''.join(lines)


def _patch_existing_rels_for_disambig(
    src_text: str, tgt_text: str,
    src_class: str, tgt_class: str,
    src_table: str, tgt_table: str,
) -> tuple[str, str]:
    """
    Patch all existing jm_relationship attrs between src and tgt to include explicit foreign_keys.
    Called when a second FK path is being introduced between the two tables.
    """
    # Rels in src that reference TgtClass — FK is on src side: [SrcClass.{attr}_id]
    for ra in re.findall(
        rf'^\s+(\w+)\s*:\s*Optional\["{re.escape(tgt_class)}"\]\s*=\s*jm_relationship',
        src_text, re.M,
    ):
        src_text = _patch_rel_foreign_keys(src_text, ra, f"[{src_class}.{ra}_id]")

    # List["TgtClass"] in src — reverse relationship; FK is on tgt side: [TgtClass.{bp}_id]
    for ra in re.findall(
        rf'^\s+(\w+)\s*:\s*List\["{re.escape(tgt_class)}"\]\s*=\s*jm_relationship',
        src_text, re.M,
    ):
        bp = _find_back_populates(src_text, ra)
        if bp:
            src_text = _patch_rel_foreign_keys(src_text, ra, f"[{tgt_class}.{bp}_id]")

    # Rels in tgt that reference SrcClass — FK on tgt side: [TgtClass.{attr}_id]
    for ra in re.findall(
        rf'^\s+(\w+)\s*:\s*Optional\["{re.escape(src_class)}"\]\s*=\s*jm_relationship',
        tgt_text, re.M,
    ):
        tgt_text = _patch_rel_foreign_keys(tgt_text, ra, f"[{tgt_class}.{ra}_id]")

    # List["SrcClass"] in tgt — FK is on src side: [SrcClass.{bp}_id]
    for ra in re.findall(
        rf'^\s+(\w+)\s*:\s*List\["{re.escape(src_class)}"\]\s*=\s*jm_relationship',
        tgt_text, re.M,
    ):
        bp = _find_back_populates(tgt_text, ra)
        if bp:
            tgt_text = _patch_rel_foreign_keys(tgt_text, ra, f"[{src_class}.{bp}_id]")

    return src_text, tgt_text


def _patch_same_file_disambig(
    text: str,
    src_class: str, tgt_class: str,
    src_table: str, tgt_table: str,
) -> str:
    """Like _patch_existing_rels_for_disambig but for a single file containing both models."""
    for ra in re.findall(
        rf'^\s+(\w+)\s*:\s*Optional\["{re.escape(tgt_class)}"\]\s*=\s*jm_relationship',
        text, re.M,
    ):
        text = _patch_rel_foreign_keys(text, ra, f"[{src_class}.{ra}_id]")
    for ra in re.findall(
        rf'^\s+(\w+)\s*:\s*List\["{re.escape(tgt_class)}"\]\s*=\s*jm_relationship',
        text, re.M,
    ):
        bp = _find_back_populates(text, ra)
        if bp:
            text = _patch_rel_foreign_keys(text, ra, f"[{tgt_class}.{bp}_id]")
    for ra in re.findall(
        rf'^\s+(\w+)\s*:\s*Optional\["{re.escape(src_class)}"\]\s*=\s*jm_relationship',
        text, re.M,
    ):
        text = _patch_rel_foreign_keys(text, ra, f"[{tgt_class}.{ra}_id]")
    for ra in re.findall(
        rf'^\s+(\w+)\s*:\s*List\["{re.escape(src_class)}"\]\s*=\s*jm_relationship',
        text, re.M,
    ):
        bp = _find_back_populates(text, ra)
        if bp:
            text = _patch_rel_foreign_keys(text, ra, f"[{src_class}.{bp}_id]")
    return text


# ── Other helpers ──────────────────────────────────────────────────────────────

def _find_model_info(root: Path, model_id: str) -> Optional[tuple[str, str, Path, str]]:
    """Return (class_name, table_name, models_py_path, module_import_path) or None."""
    modules_dir = root / "backend" / "app" / "modules"
    if not modules_dir.exists():
        return None

    needle = model_id.lower()
    for mod_dir in sorted(modules_dir.iterdir()):
        if not mod_dir.is_dir():
            continue
        mp = mod_dir / "models.py"
        if not mp.exists():
            continue
        text = mp.read_text(encoding="utf-8")

        m = re.search(rf'^class\s+({re.escape(model_id)})\s*\(', text, re.M | re.I)
        if m:
            class_name = m.group(1)
            class_start = m.start()
        else:
            tm_match = re.search(rf'__tablename__\s*=\s*["\']({re.escape(needle)})["\']', text)
            if not tm_match:
                continue
            # Find the class that contains this tablename (search backwards from the match)
            cm = re.search(r'^class\s+(\w+)\s*\(', text[: tm_match.start()], re.M)
            if not cm:
                cm = re.search(r'^class\s+(\w+)\s*\(', text, re.M)
            class_name = cm.group(1) if cm else model_id
            class_start = cm.start() if cm else 0

        # Extract only this class's body to find its __tablename__ (avoids picking up
        # the wrong tablename when multiple models share the same file)
        after_class = text[class_start:]
        next_class_m = re.search(r'^class\s', after_class[1:], re.M)
        class_body = after_class[: 1 + next_class_m.start()] if next_class_m else after_class

        tm = re.search(r'__tablename__\s*=\s*["\'](\w+)["\']', class_body)
        table_name = tm.group(1) if tm else needle
        module_path = f"app.modules.{mod_dir.name}.models"
        return (class_name, table_name, mp, module_path)

    return None


def _to_snake(name: str) -> str:
    s = re.sub(r'(.)([A-Z][a-z]+)', r'\1_\2', name)
    return re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', s).lower()


def _cardinality_kwargs(min_items: int, max_items: Optional[int]) -> list[str]:
    """Return non-default cardinality kwargs as strings."""
    out = []
    if min_items != 0:
        out.append(f"min_items={min_items}")
    if max_items is not None:
        out.append(f"max_items={max_items}")
    return out


def _ensure_optional_import(text: str) -> str:
    if "Optional" in text:
        return text
    return re.sub(
        r"(from typing import\s+)([^\n]+)",
        lambda m: m.group(1) + "Optional, " + m.group(2),
        text, count=1,
    )


def _ensure_list_import(text: str) -> str:
    if "List" in text:
        return text
    return re.sub(
        r"(from typing import\s+)([^\n]+)",
        lambda m: m.group(1) + "List, " + m.group(2),
        text, count=1,
    )


def _ensure_sqlmodel_import(text: str) -> str:
    if re.search(r"from sqlmodel import[^\n]*\bSQLModel\b", text):
        return text
    return re.sub(
        r"(from sqlmodel import\s+)([^\n]+)",
        lambda m: m.group(1) + "SQLModel, " + m.group(2),
        text, count=1,
    )


def _ensure_jm_relationship_import(text: str) -> str:
    if "jm_relationship" in text:
        return text
    return re.sub(
        r"(from veloiq_framework import\s+)([^\n]+)",
        lambda m: m.group(1) + "jm_relationship, " + m.group(2),
        text, count=1,
    )


def _ensure_type_checking_import(text: str, module_path: str, class_name: str) -> str:
    """Add 'from module_path import class_name' inside the if TYPE_CHECKING block."""
    import_line = f"    from {module_path} import {class_name}"

    if re.search(rf"from\s+{re.escape(module_path)}\s+import\s+.*\b{re.escape(class_name)}\b", text):
        return text

    if re.search(r"^if TYPE_CHECKING:", text, re.M):
        return re.sub(
            r"(if TYPE_CHECKING:\n)",
            r"\1" + import_line + "\n",
            text, count=1,
        )

    # Create the block — first ensure TYPE_CHECKING is imported
    if "TYPE_CHECKING" not in text:
        text = re.sub(
            r"(from typing import\s+)([^\n]+)",
            lambda m: m.group(1) + "TYPE_CHECKING, " + m.group(2)
                      if "TYPE_CHECKING" not in m.group(0) else m.group(0),
            text, count=1,
        )

    lines = text.splitlines(keepends=True)
    last_import = 0
    for i, ln in enumerate(lines):
        if ln.startswith(("import ", "from ")):
            last_import = i
    lines.insert(last_import + 1, f"\n\nif TYPE_CHECKING:\n{import_line}\n")
    return "".join(lines)


def _ensure_direct_import(text: str, module_path: str, class_name: str) -> str:
    """Add a direct (non-TYPE_CHECKING) import — needed for link_model which is evaluated at runtime."""
    if re.search(rf"^from\s+{re.escape(module_path)}\s+import\s+.*\b{re.escape(class_name)}\b", text, re.M):
        return text
    import_line = f"from {module_path} import {class_name}\n"
    lines = text.splitlines(keepends=True)
    # Insert after the last top-level import that is NOT inside TYPE_CHECKING
    last_import = 0
    in_type_checking = False
    for i, ln in enumerate(lines):
        if ln.strip() == "if TYPE_CHECKING:":
            in_type_checking = True
        elif in_type_checking and not ln.startswith(" ") and ln.strip():
            in_type_checking = False
        if not in_type_checking and ln.startswith(("import ", "from ")):
            last_import = i
    lines.insert(last_import + 1, import_line)
    return "".join(lines)


def _insert_before_relationships(text: str, class_name: str, line: str) -> str:
    """Insert line before the first relationship definition in the class."""
    lines = text.splitlines(keepends=True)
    class_start = -1
    for i, ln in enumerate(lines):
        if re.match(rf"\s*class\s+{re.escape(class_name)}\s*\(", ln, re.I):
            class_start = i
            break
    if class_start < 0:
        return text.rstrip() + "\n" + line + "\n"

    insert_before = len(lines)
    for i in range(class_start + 1, len(lines)):
        ln = lines[i].strip()
        if not ln:
            continue
        if re.match(r"^class\s", lines[i]):
            insert_before = i
            break
        if any(kw in lines[i] for kw in ("jm_relationship", "Relationship(", "relationship(")):
            insert_before = i
            break

    lines.insert(insert_before, line + "\n")
    return "".join(lines)


def _insert_after_last_relationship(text: str, class_name: str, line: str) -> str:
    """Insert line after the last relationship in the class, or at end of class body."""
    lines = text.splitlines(keepends=True)
    class_start = -1
    for i, ln in enumerate(lines):
        if re.match(rf"\s*class\s+{re.escape(class_name)}\s*\(", ln, re.I):
            class_start = i
            break
    if class_start < 0:
        return text.rstrip() + "\n" + line + "\n"

    last_rel_end = -1
    i = class_start + 1
    while i < len(lines):
        if re.match(r"^class\s", lines[i]):
            break
        if any(kw in lines[i] for kw in ("jm_relationship", "Relationship(", "relationship(")):
            # Track through multi-line call to find closing paren
            j = i
            depth = lines[j].count("(") - lines[j].count(")")
            while depth > 0 and j + 1 < len(lines):
                j += 1
                depth += lines[j].count("(") - lines[j].count(")")
            last_rel_end = j
            i = j + 1
        else:
            i += 1

    if last_rel_end >= 0:
        lines.insert(last_rel_end + 1, line + "\n")
    else:
        insert_at = len(lines)
        for i in range(class_start + 1, len(lines)):
            if re.match(r"^class\s", lines[i]):
                insert_at = i
                break
        lines.insert(insert_at, line + "\n")

    return "".join(lines)


def _insert_before_class(text: str, class_name: str, block: str) -> str:
    """Insert a block of text just before the named class definition."""
    lines = text.splitlines(keepends=True)
    for i, ln in enumerate(lines):
        if re.match(rf"\s*class\s+{re.escape(class_name)}\s*\(", ln, re.I):
            lines.insert(i, block)
            return "".join(lines)
    return text.rstrip() + "\n" + block + "\n"
