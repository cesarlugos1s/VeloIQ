"""veloiq import-schema — reflect an existing DB and scaffold VeloIQ models via CLI helpers."""
from __future__ import annotations

import curses
import re
import shutil
import subprocess
from pathlib import Path
from typing import Optional

import click


# ── Driver install hints ───────────────────────────────────────────────────────

_DRIVER_HINTS: dict[str, str] = {
    "postgresql": "pip install psycopg2-binary",
    "mysql":      "pip install pymysql",
    "mariadb":    "pip install pymysql",
    "mssql":      "pip install pyodbc",
    "oracle":     "pip install cx_oracle",
}

_DB_TYPES = ["sqlite", "postgresql", "mysql", "mariadb", "mssql", "oracle"]

_DEFAULT_PORTS: dict[str, str] = {
    "postgresql": "5432",
    "mysql":      "3306",
    "mariadb":    "3306",
    "mssql":      "1433",
    "oracle":     "1521",
}

# Tables the framework owns — hide from the picker
_FRAMEWORK_TABLES = {"alembic_version"}
_FRAMEWORK_PREFIX = "veloiq_"

# Timestamp/audit column names: skip them when adding fields (TimestampedModel covers them)
_INNOCUOUS_COLS = {
    "created_at", "updated_at", "modified_at",
    "created_on", "updated_on",
    "last_update", "last_updated", "last_modified",
    "date_created", "date_updated", "date_modified",
}


# ── Click command ──────────────────────────────────────────────────────────────

@click.command(name="import-schema")
@click.option("--url", default=None,
              help="Full SQLAlchemy database URL (skips interactive connection prompts).")
@click.option("--module", default=None,
              help="Target module name for the generated models (default: derived from DB name).")
@click.option("--tables", default=None,
              help="Comma-separated table names to import, or 'all' for every available table "
                   "(skips the interactive table picker — required when running non-interactively).")
@click.option("--root", "-C", default=None, type=click.Path(exists=True, file_okay=False),
              help="Project root (default: auto-detect).")
def import_schema(url, module, tables, root):
    """Import models from an existing database into a VeloIQ project.

    \b
    Connects to a live database, reads its tables and relations, then scaffolds
    idiomatic VeloIQ models by calling the same  add-model / add-field /
    add-relation  CLI helpers a developer would use by hand.  Alembic migrations
    are generated once at the end, so all schema changes stay in sync.

    \b
    The command walks you through:
      1. Connecting to your database (SQLite, PostgreSQL, MySQL, MSSQL, Oracle)
      2. Choosing which tables to import
      3. Naming the target module

    \b
    When --url, --module, and --tables are all supplied the command runs fully
    non-interactively (suitable for the VeloIQ Studio command panel).

    \b
    Examples:
      veloiq import-schema
      veloiq import-schema --url postgresql+psycopg2://user:pw@localhost/mydb
      veloiq import-schema --url sqlite:///app.db --module legacy --tables all
      veloiq import-schema --url sqlite:///app.db --tables orders,customers
    """
    from veloiq_framework.cli.explorer import _find_project_root

    project_root = Path(root) if root else _find_project_root()
    if not project_root:
        click.echo(click.style("❌  Not inside a VeloIQ project.", fg="red"))
        raise SystemExit(1)

    # ── Step 1: DB connection ──────────────────────────────────────────────────
    if url:
        db_url = url
        db_type = _db_type_from_url(url)
        engine = _test_connection(db_url, db_type)
        if engine is None:
            raise SystemExit(1)
    else:
        result = _prompt_db_connection()
        if result is None:
            raise SystemExit(0)
        db_url, db_type, engine = result

    # ── Step 2: Database selection (PostgreSQL / MySQL) ────────────────────────
    if db_type in ("postgresql", "mysql", "mariadb") and not _url_has_database(db_url):
        engine, db_url = _pick_database(engine, db_url, db_type)
        if engine is None:
            raise SystemExit(0)

    # ── Step 3: Table selection ────────────────────────────────────────────────
    from sqlalchemy import inspect as sa_inspect
    inspector = sa_inspect(engine)
    all_tables = sorted(inspector.get_table_names())

    modules_dir = project_root / "backend" / "app" / "modules"
    existing_classes, existing_tables = _scan_existing(modules_dir)

    user_tables = [
        t for t in all_tables
        if t not in _FRAMEWORK_TABLES and not t.startswith(_FRAMEWORK_PREFIX)
    ]

    if not user_tables:
        click.echo(click.style("⚠️   No user tables found in this database.", fg="yellow"))
        raise SystemExit(0)

    db_name = _db_name_from_url(db_url)

    if tables is not None:
        if tables.strip().lower() == "all":
            selected = [t for t in user_tables if t not in existing_tables]
        else:
            requested = [t.strip() for t in tables.split(",") if t.strip()]
            unknown = [t for t in requested if t not in user_tables]
            if unknown:
                click.echo(click.style(
                    f"  ⚠️  Unknown tables (ignored): {', '.join(unknown)}", fg="yellow"
                ))
            selected = [t for t in requested if t in user_tables]
        if not selected:
            click.echo("  No tables to import — nothing to do.")
            raise SystemExit(0)
    else:
        tables_info = [
            (t, len(inspector.get_columns(t)), t in existing_tables)
            for t in user_tables
        ]
        selected = _run_table_picker(tables_info, db_name)
        if not selected:
            click.echo("  No tables selected — nothing to do.")
            raise SystemExit(0)

    # ── Step 4: Module name ────────────────────────────────────────────────────
    default_module = re.sub(r"[^a-z0-9]+", "_", db_name.lower()).strip("_") or "imported"
    if module:
        module_name = re.sub(r"[^a-z0-9_]", "_", module.lower()).strip("_") or "imported"
    else:
        raw = click.prompt("\n  Target module name", default=default_module).strip()
        module_name = re.sub(r"[^a-z0-9_]", "_", raw.lower()).strip("_") or "imported"

    # ── Step 5: Scaffold via add-model / add-field / add-relation ─────────────
    click.echo()
    _scaffold_from_schema(
        selected, inspector, module_name, project_root,
        existing_classes, existing_tables,
    )

    # ── Step 6: Offer to point DATABASE_URL at the source database ───────────────
    non_interactive = url is not None and tables is not None and module is not None
    click.echo()
    pointed_to_source = False
    if not non_interactive:
        pointed_to_source = _offer_set_database_url(project_root, db_url, db_name)

    # ── Step 7: Single Alembic migration ──────────────────────────────────────
    # Default to "no" when the project now points at the source DB — tables exist already.
    click.echo()
    migrate_default = not pointed_to_source
    migrate_prompt = (
        f"  Tables already exist in the source DB. Create a migration record anyway?"
        if pointed_to_source else
        f"  Create Alembic migration for module '{module_name}'?"
    )
    if non_interactive or click.confirm(migrate_prompt, default=migrate_default):
        veloiq_bin = shutil.which("veloiq")
        if veloiq_bin:
            import os
            env = os.environ.copy()
            if pointed_to_source:
                # Ensure the subprocess uses the newly-written DATABASE_URL,
                # not whatever the parent shell had in its environment.
                env["DATABASE_URL"] = db_url
            subprocess.run(
                [veloiq_bin, "db", "migrate",
                 "--message", f"import {module_name} schema"],
                cwd=str(project_root),
                env=env,
            )
        else:
            click.echo("  Run `veloiq db migrate` manually.")

    # ── Step 8: Generate ──────────────────────────────────────────────────────
    click.echo()
    if non_interactive or click.confirm(
        "  Run `veloiq generate` to refresh frontend schemas?", default=True
    ):
        veloiq_bin = shutil.which("veloiq")
        if veloiq_bin:
            subprocess.run([veloiq_bin, "generate"], cwd=str(project_root))
        else:
            click.echo("  Run `veloiq generate` manually.")


# ── Model class templates (import-schema always uses SQLModel, never TimestampedModel) ──

_IMPORT_MODELS_PY = '''\
from typing import TYPE_CHECKING, List, Optional
from sqlmodel import SQLModel, Field
from veloiq_framework import jm_relationship


class {ModelClass}(SQLModel, table=True):
    """{description}"""

    __tablename__ = "{table_name}"

    {pk_col}: Optional[{pk_py_type}] = Field(default=None, primary_key=True)
'''

_IMPORT_APPEND_CLASS = '''

class {ModelClass}(SQLModel, table=True):
    """{description}"""

    __tablename__ = "{table_name}"

    {pk_col}: Optional[{pk_py_type}] = Field(default=None, primary_key=True)
'''


# ── Orchestration ──────────────────────────────────────────────────────────────

def _scaffold_from_schema(
    selected: list[str],
    inspector,
    module_name: str,
    project_root: Path,
    existing_classes: set[str],
    existing_tables: set[str],
) -> None:
    """
    Map an existing database schema into VeloIQ models using plain SQLModel.

    import-schema always generates SQLModel (not TimestampedModel) so that the
    source table's own primary key and columns are used exactly as-is, without
    adding any spurious id / created_at / updated_at columns.

    Phases:
      1. Model skeletons  — bare SQLModel class with the source PK field
      2. Plain fields     — all non-PK, non-innocuous columns; FK cols declared
                            with foreign_key= so SQLAlchemy knows the relationship
      3. Relationships    — jm_relationship attributes (both sides); FK col already
                            written in Phase 2, so no new DB column is added here
      4. M2M junctions    — link class for existing junction table + M2M relationships
    """
    from veloiq_framework.cli.add_model import _class_exists, _update_nav_config
    from veloiq_framework.cli.add_field import (
        _build_field_line, _find_models_file,
        _ensure_imports as _af_ensure_imports,
        _insert_field,
    )
    from veloiq_framework.cli.add_relation import (
        _find_model_info,
        _ensure_optional_import, _ensure_list_import,
        _ensure_jm_relationship_import, _ensure_type_checking_import,
        _insert_before_relationships, _insert_after_last_relationship,
        _get_class_body, _ensure_sqlmodel_import, _insert_before_class,
    )

    modules_dir = project_root / "backend" / "app" / "modules"
    mod_dir     = modules_dir / module_name
    mod_path    = f"app.modules.{module_name}.models"

    junctions   = _detect_junctions(selected, inspector)
    non_junction = [t for t in selected if t not in junctions]
    ordered     = _topo_sort(non_junction, inspector)

    # Pre-compute source PKs: {table: (pk_col_name, py_type_str)}
    source_pks: dict[str, tuple[str, str]] = {}
    for t in selected:
        pk_constraint = inspector.get_pk_constraint(t)
        pk_cols_list = pk_constraint.get("constrained_columns", [])
        if pk_cols_list:
            pk_col = pk_cols_list[0]
            # Determine Python type from the actual column definition
            col_info = next((c for c in inspector.get_columns(t) if c["name"] == pk_col), {})
            pk_py = _sa_type_to_addfield_type(col_info.get("type", "")) if col_info else "int"
            source_pks[t] = (pk_col, _TYPE_MAP.get(pk_py, ("int", False, False))[0])
        else:
            source_pks[t] = ("id", "int")

    created: list[str] = []
    skipped: list[str] = []

    # ── Phase 1: bare model skeletons ─────────────────────────────────────────
    click.echo(click.style("  Phase 1 — scaffolding model classes", bold=True))
    for table in ordered:
        cls = _to_pascal(table)
        if cls in existing_classes or table in existing_tables:
            click.echo(click.style(f"    ⏭️  {cls} — already in project, skipping", fg="yellow"))
            skipped.append(table)
            continue
        if _class_exists(modules_dir, cls):
            click.echo(click.style(f"    ⏭️  {cls} — class exists elsewhere, skipping", fg="yellow"))
            skipped.append(table)
            continue

        pk_col, pk_py_type = source_pks[table]
        ctx = {
            "ModelClass":  cls,
            "table_name":  table,          # keep original table name, not snake-cased class
            "description": f"Imported from {table}.",
            "pk_col":      pk_col,
            "pk_py_type":  pk_py_type,
        }

        if not mod_dir.exists():
            mod_dir.mkdir(parents=True, exist_ok=True)
            (mod_dir / "__init__.py").write_text("", encoding="utf-8")
            (mod_dir / "models.py").write_text(_IMPORT_MODELS_PY.format(**ctx), encoding="utf-8")
            (mod_dir / "custom_api.py").write_text(
                f'from fastapi import APIRouter\nrouter = APIRouter()\n', encoding="utf-8"
            )
            _update_nav_config(project_root, module_name, cls,
                               module_name.replace("_", " ").title())
            click.echo(f"\n🧩 Created module '{module_name}' with model '{cls}'")
        else:
            mf = mod_dir / "models.py"
            text = mf.read_text(encoding="utf-8")
            text = text.rstrip() + _IMPORT_APPEND_CLASS.format(**ctx)
            mf.write_text(text, encoding="utf-8")
            click.echo(f"    + class {cls}")

        created.append(cls)

    if not created:
        click.echo(click.style("  Nothing new to create — all tables already imported.", fg="yellow"))
        return

    # ── Phase 2: all columns (plain + FK) ────────────────────────────────────
    # FK columns are included here (not skipped) so that SQLAlchemy knows
    # which column carries the foreign key — essential for query correctness.
    # We do NOT add them in Phase 3 (unlike add-relation which creates new cols).
    click.echo(click.style("\n  Phase 2 — adding fields", bold=True))

    # Build FK lookup: (table, fk_col) → (ref_table, ref_col)
    fk_lookup: dict[tuple[str, str], tuple[str, str]] = {}
    for t in non_junction:
        for fk in inspector.get_foreign_keys(t):
            constrained = fk.get("constrained_columns", [])
            referred    = fk.get("referred_columns", [])
            ref_table   = fk["referred_table"]
            if constrained and referred:
                fk_lookup[(t, constrained[0])] = (ref_table, referred[0])

    for table in ordered:
        if table in skipped:
            continue
        cls     = _to_pascal(table)
        pk_col  = source_pks[table][0]
        pk_cols = set(inspector.get_pk_constraint(table).get("constrained_columns", []))
        fk_cols = {c for fk in inspector.get_foreign_keys(table) for c in fk["constrained_columns"]}

        mf = _find_models_file(project_root, cls)
        if mf is None:
            click.echo(click.style(f"    ⚠️  models.py not found for {cls}", fg="yellow"))
            continue

        for col in inspector.get_columns(table):
            cname   = col["name"]
            nullable = col.get("nullable", True)

            # Skip the PK (already in the class skeleton) and innocuous timestamp cols
            if cname in pk_cols or cname in _INNOCUOUS_COLS:
                continue

            text = mf.read_text(encoding="utf-8")
            if re.search(rf'^\s+{re.escape(cname)}\s*:', _get_class_body(text, cls), re.M):
                continue  # already present in this class

            if cname in fk_cols:
                # FK column — declare with foreign_key= so SQLAlchemy tracks it
                ref_table, ref_col = fk_lookup.get((table, cname), ("", "id"))
                if ref_table:
                    if nullable:
                        line = f'    {cname}: Optional[int] = Field(default=None, foreign_key="{ref_table}.{ref_col}")'
                    else:
                        line = f'    {cname}: int = Field(foreign_key="{ref_table}.{ref_col}")'
                    text = _ensure_optional_import(text)
                    text = _insert_before_relationships(text, cls, line)
                    mf.write_text(text, encoding="utf-8")
                    click.echo(f"    + {cls}.{cname} → {ref_table}.{ref_col}")
            else:
                # Plain data column
                ft = _sa_type_to_addfield_type(col["type"])
                if ft == "binary":
                    continue  # binary columns (bytea/blob) are not UI-renderable
                py_type, needs_dt, needs_txt = _TYPE_MAP[ft]
                line = _build_field_line(cname, py_type, nullable, None, "", [], needs_txt, None)
                text = _af_ensure_imports(text, needs_dt, needs_txt, False)
                text = _insert_field(text, cls, line)
                mf.write_text(text, encoding="utf-8")
                click.echo(f"    + {cls}.{cname}: {ft}")

    # ── Phase 3: relationships (jm_relationship only — no new FK columns) ─────
    click.echo(click.style("\n  Phase 3 — relationships", bold=True))
    selected_set = set(selected)

    # Pre-compute FK multiplicity straight from the live schema (never assume
    # column / primary-key names) so we can disambiguate ambiguous joins:
    #   • pair_fk_count[{A, B}] > 1  → more than one FK path between the two
    #     tables (either direction) → SQLAlchemy cannot infer the join, so every
    #     relationship between them must carry an explicit foreign_keys.
    #   • directed_fk_cols[(A, B)]   → the FK columns A → B, used to give the
    #     reverse collection a unique name when A has several FKs to B.
    rel_targets = set(non_junction)
    pair_fk_count: dict[frozenset, int] = {}
    directed_fk_cols: dict[tuple[str, str], list[str]] = {}
    for t in non_junction:
        for fk in inspector.get_foreign_keys(t):
            rt = fk["referred_table"]
            constrained_cols = fk.get("constrained_columns", [])
            if rt not in rel_targets or rt in junctions or not constrained_cols:
                continue
            key = frozenset((t, rt))
            pair_fk_count[key] = pair_fk_count.get(key, 0) + 1
            directed_fk_cols.setdefault((t, rt), []).append(constrained_cols[0])
    for cols in directed_fk_cols.values():
        cols.sort()  # deterministic ordering for reverse-name qualification

    for table in ordered:

        if table in skipped:
            continue
        src_cls = _to_pascal(table)

        for fk in inspector.get_foreign_keys(table):
            ref_table = fk["referred_table"]
            if ref_table not in selected_set or ref_table in junctions:
                continue
            tgt_cls = _to_pascal(ref_table)

            constrained = fk.get("constrained_columns", [])
            if not constrained:
                continue
            col_name = constrained[0]

            # attr name on source side (e.g. language_id → language); never assume
            # the column literally ends in "_id" — fall back to a column-derived name.
            attr_name = re.sub(r"_id$", "", col_name)
            if attr_name == col_name:
                attr_name = _to_snake(col_name) + "_ref"

            # Reverse (collection) name. Qualify it with the source attr when the
            # same source table has more than one FK to the same target, so the
            # generated names never collide (e.g. films vs original_language_films).
            back_base = _pluralize(_to_snake(src_cls))
            pair_cols = directed_fk_cols.get((table, ref_table), [])
            if len(pair_cols) > 1 and col_name in pair_cols and pair_cols.index(col_name) > 0:
                back_name = f"{attr_name}_{back_base}"
            else:
                back_name = back_base

            # More than one FK path between these two tables (either direction) means
            # SQLAlchemy cannot infer the join — every relationship between them must
            # carry an explicit foreign_keys pointing at the real child FK column.
            need_fk = pair_fk_count.get(frozenset((table, ref_table)), 0) > 1
            fk_expr = f"[{src_cls}.{col_name}]"

            src_info = _find_model_info(project_root, src_cls)
            tgt_info = _find_model_info(project_root, tgt_cls)
            if not src_info or not tgt_info:
                click.echo(click.style(
                    f"    ⚠️  Cannot locate {src_cls} or {tgt_cls} — skipping", fg="yellow"
                ))
                continue

            src_class, _, src_file, src_module = src_info
            tgt_class, _, tgt_file, tgt_module = tgt_info
            same_file = src_file.resolve() == tgt_file.resolve()

            src_text = src_file.read_text(encoding="utf-8")
            tgt_text = src_text if same_file else tgt_file.read_text(encoding="utf-8")

            # Source side: Optional["TgtClass"] = jm_relationship(...)
            if need_fk:
                rel_line = (
                    f'    {attr_name}: Optional["{tgt_class}"] = jm_relationship(\n'
                    f'        back_populates="{back_name}",\n'
                    f'        sa_relationship_kwargs={{"foreign_keys": "{fk_expr}"}},\n'
                    f'    )'
                )
            else:
                rel_line = f'    {attr_name}: Optional["{tgt_class}"] = jm_relationship(back_populates="{back_name}")'
            if not re.search(rf'^\s+{re.escape(attr_name)}\s*:', _get_class_body(src_text, src_class), re.M):
                src_text = _ensure_optional_import(src_text)
                src_text = _ensure_jm_relationship_import(src_text)
                if not same_file:
                    src_text = _ensure_type_checking_import(src_text, tgt_module, tgt_class)
                src_text = _insert_after_last_relationship(src_text, src_class, rel_line)
                if same_file:
                    tgt_text = src_text
                src_file.write_text(src_text, encoding="utf-8")
                click.echo(f"    + {src_class}.{attr_name} → {tgt_class}")

            # Re-sync the target buffer after a same-file source write.
            if same_file:
                tgt_text = src_file.read_text(encoding="utf-8")

            # Target side: List["SrcClass"] = jm_relationship(...)
            if need_fk:
                back_line = (
                    f'    {back_name}: List["{src_class}"] = jm_relationship(\n'
                    f'        back_populates="{attr_name}",\n'
                    f'        sa_relationship_kwargs={{"foreign_keys": "{fk_expr}"}},\n'
                    f'    )'
                )
            else:
                back_line = f'    {back_name}: List["{src_class}"] = jm_relationship(back_populates="{attr_name}")'
            if not re.search(rf'^\s+{re.escape(back_name)}\s*:', _get_class_body(tgt_text, tgt_class), re.M):
                tgt_text = _ensure_list_import(tgt_text)
                tgt_text = _ensure_jm_relationship_import(tgt_text)
                if not same_file:
                    tgt_text = _ensure_type_checking_import(tgt_text, src_module, src_class)
                tgt_text = _insert_after_last_relationship(tgt_text, tgt_class, back_line)
                tgt_file.write_text(tgt_text, encoding="utf-8")
                click.echo(f"    + {tgt_class}.{back_name} ← {src_class}")


    # ── Phase 4: M2M junction link classes + relationships ───────────────────
    click.echo(click.style("\n  Phase 4 — M2M relations", bold=True))
    for jt, (ta, tb) in junctions.items():
        if jt in existing_tables:
            click.echo(click.style(f"    ⏭️  {jt} junction already in project", fg="yellow"))
            continue

        cls_a   = _to_pascal(ta)
        cls_b   = _to_pascal(tb)
        link_cls = _to_pascal(jt)  # use actual junction table name as class name
        attr_b   = _pluralize(_to_snake(cls_b))
        back_b   = _pluralize(_to_snake(cls_a))

        src_info = _find_model_info(project_root, cls_a)
        tgt_info = _find_model_info(project_root, cls_b)
        if not src_info or not tgt_info:
            click.echo(click.style(f"    ⚠️  Cannot locate {cls_a} or {cls_b} — skipping", fg="yellow"))
            continue

        src_class, _, src_file, src_module = src_info
        tgt_class, _, tgt_file, tgt_module = tgt_info
        same_file = src_file.resolve() == tgt_file.resolve()

        # Detect the actual FK columns and their referred columns in the junction table
        jt_fks = inspector.get_foreign_keys(jt)
        fk_a = next((f for f in jt_fks if f["referred_table"] == ta), None)
        fk_b = next((f for f in jt_fks if f["referred_table"] == tb), None)
        if not fk_a or not fk_b:
            click.echo(click.style(f"    ⚠️  Cannot resolve FKs for {jt} — skipping", fg="yellow"))
            continue

        col_a     = fk_a["constrained_columns"][0]
        ref_col_a = fk_a["referred_columns"][0]
        col_b     = fk_b["constrained_columns"][0]
        ref_col_b = fk_b["referred_columns"][0]

        # Write the link class before BOTH classes that reference it via
        # link_model= (maps the actual junction table). Their order in the file
        # is not guaranteed, so anchor on whichever class comes first.
        link_block = (
            f"\n\nclass {link_cls}(SQLModel, table=True):\n"
            f'    __tablename__ = "{jt}"\n'
            f'    {col_a}: Optional[int] = Field(default=None, foreign_key="{ta}.{ref_col_a}", primary_key=True)\n'
            f'    {col_b}: Optional[int] = Field(default=None, foreign_key="{tb}.{ref_col_b}", primary_key=True)\n'
        )

        src_text = src_file.read_text(encoding="utf-8")
        if not re.search(rf'^class\s+{re.escape(link_cls)}\s*\(', src_text, re.M):
            src_text = _ensure_sqlmodel_import(src_text)
            src_text = _ensure_optional_import(src_text)
            if same_file:
                src_text = _insert_before_earliest_class(src_text, [src_class, tgt_class], link_block)
            else:
                src_text = _insert_before_class(src_text, src_class, link_block)
            src_file.write_text(src_text, encoding="utf-8")
            click.echo(f"    + {link_cls} (maps existing {jt})")


        # Re-read after potential write
        src_text = src_file.read_text(encoding="utf-8")
        tgt_text = src_text if same_file else tgt_file.read_text(encoding="utf-8")

        # M2M on cls_a side
        rel_a = f'    {attr_b}: List["{tgt_class}"] = jm_relationship(back_populates="{back_b}", link_model={link_cls})'
        if not re.search(rf'^\s+{re.escape(attr_b)}\s*:', _get_class_body(src_text, src_class), re.M):
            src_text = _ensure_list_import(src_text)
            src_text = _ensure_jm_relationship_import(src_text)
            if not same_file:
                src_text = _ensure_type_checking_import(src_text, tgt_module, tgt_class)
            src_text = _insert_after_last_relationship(src_text, src_class, rel_a)
            if same_file:
                tgt_text = src_text
            src_file.write_text(src_text, encoding="utf-8")
            click.echo(f"    + {src_class}.{attr_b} ↔ {tgt_class} via {link_cls}")

        # M2M on cls_b side
        if same_file:
            tgt_text = src_file.read_text(encoding="utf-8")
        rel_b = f'    {back_b}: List["{src_class}"] = jm_relationship(back_populates="{attr_b}", link_model={link_cls})'
        if not re.search(rf'^\s+{re.escape(back_b)}\s*:', _get_class_body(tgt_text, tgt_class), re.M):
            tgt_text = _ensure_list_import(tgt_text)
            tgt_text = _ensure_jm_relationship_import(tgt_text)
            if not same_file:
                tgt_text = _ensure_type_checking_import(tgt_text, src_module, src_class)
            tgt_text = _insert_after_last_relationship(tgt_text, tgt_class, rel_b)
            tgt_file.write_text(tgt_text, encoding="utf-8")
            click.echo(f"    + {tgt_class}.{back_b} ↔ {src_class} via {link_cls}")

    n_created  = len(created)
    n_junction = sum(1 for jt in junctions if jt not in existing_tables)
    click.echo(click.style(
        f"\n✅  Created {n_created} model(s) + {n_junction} M2M junction(s) "
        f"in module '{module_name}'.",
        fg="green",
    ))


# ── Type mapper (SA type → add-field type key) ─────────────────────────────────

# Mirrors the keys in add_field._TYPE_MAP
_TYPE_MAP = {
    "str":      ("str",               False, False),
    "int":      ("int",               False, False),
    "float":    ("float",             False, False),
    "bool":     ("bool",              False, False),
    "date":     ("datetime.date",     True,  False),
    "datetime": ("datetime.datetime", True,  False),
    "time":     ("datetime.time",     True,  False),
    "text":     ("str",               False, True),
    "json":     ("str",               False, True),
}


def _sa_type_to_addfield_type(col_type) -> str:
    name = type(col_type).__name__.upper()
    if name in ("STRING", "VARCHAR", "CHAR", "NVARCHAR", "UNICODE",
                "UNICODETEXT", "ENUM", "UUID"):
        return "str"
    if name in ("TEXT", "CLOB", "NTEXT", "LONGTEXT", "MEDIUMTEXT"):
        return "text"
    if name in ("INTEGER", "INT", "BIGINTEGER", "BIGINT", "SMALLINTEGER",
                "SMALLINT", "TINYINT", "MEDIUMINT"):
        return "int"
    if name in ("FLOAT", "REAL", "DOUBLE", "DOUBLE_PRECISION",
                "NUMERIC", "DECIMAL", "MONEY", "SMALLMONEY"):
        return "float"
    if name in ("BOOLEAN", "BOOL", "BIT"):
        return "bool"
    if name == "DATE":
        return "date"
    if name in ("DATETIME", "TIMESTAMP"):
        return "datetime"
    if name == "TIME":
        return "time"
    if name in ("JSON", "JSONB"):
        return "json"
    if name in ("BYTEA", "BINARY", "VARBINARY", "LARGEBINARY", "BLOB",
                "MEDIUMBLOB", "LONGBLOB", "IMAGE"):
        return "binary"
    return "str"


# ── DATABASE_URL updater ───────────────────────────────────────────────────────

def _offer_set_database_url(
    project_root: Path,
    db_url: str,
    db_name: str,
) -> bool:
    """Offer to write (or update) DATABASE_URL in backend/.env.  Returns True if updated."""
    env_file = project_root / "backend" / ".env"
    if not env_file.exists():
        env_file = project_root / ".env"

    current_url: Optional[str] = None
    if env_file.exists():
        text = env_file.read_text(encoding="utf-8")
        m = re.search(r'^DATABASE_URL\s*=\s*(.+)$', text, re.M)
        if m:
            current_url = m.group(1).strip()

    if current_url == db_url:
        click.echo(f"  ℹ️   DATABASE_URL already points to '{db_name}' — nothing to change.")
        return False

    if current_url:
        click.echo(f"  Current DATABASE_URL: {current_url}")
    click.echo(f"  Source database URL:  {db_url}")

    if not click.confirm(
        f"\n  Point this project's DATABASE_URL to '{db_name}'?", default=False
    ):
        return False

    if env_file.exists():
        text = env_file.read_text(encoding="utf-8")
        if re.search(r'^DATABASE_URL\s*=', text, re.M):
            text = re.sub(r'^DATABASE_URL\s*=.*$', f'DATABASE_URL={db_url}', text, flags=re.M)
        else:
            text = text.rstrip() + f'\nDATABASE_URL={db_url}\n'
        env_file.write_text(text, encoding="utf-8")
    else:
        env_file.write_text(f'DATABASE_URL={db_url}\n', encoding="utf-8")

    rel = env_file.relative_to(project_root)
    click.echo(click.style(f"  ✅  Updated DATABASE_URL in {rel}", fg="green"))
    return True


# ── DB connection helpers ──────────────────────────────────────────────────────

def _prompt_db_connection():
    """Interactive DB connection wizard. Returns (url, db_type, engine) or None."""
    click.echo()
    click.echo(click.style("  Connect to existing database", bold=True))
    click.echo("  " + "─" * 38)

    db_type = click.prompt(
        "  DB type",
        type=click.Choice(_DB_TYPES, case_sensitive=False),
        default="sqlite",
    ).lower()

    if db_type == "sqlite":
        path = click.prompt("  SQLite file path", default="app.db")
        url = f"sqlite:///{path}"
        engine = _test_connection(url, db_type)
        return (url, db_type, engine) if engine else None

    host     = click.prompt("  Host",     default="localhost")
    port     = click.prompt("  Port",     default=_DEFAULT_PORTS.get(db_type, "5432"))
    user     = click.prompt("  User",     default="")
    password = click.prompt("  Password", default="", hide_input=True)
    dbname   = click.prompt("  Database", default="")

    url = _build_url(db_type, host, port, user, password, dbname)
    engine = _test_connection(url, db_type)
    return (url, db_type, engine) if engine else None


def _build_url(db_type: str, host: str, port: str, user: str, password: str, dbname: str) -> str:
    import urllib.parse
    pwd = urllib.parse.quote_plus(password)
    usr = urllib.parse.quote_plus(user)
    if db_type == "postgresql":
        return f"postgresql+psycopg2://{usr}:{pwd}@{host}:{port}/{dbname}"
    if db_type in ("mysql", "mariadb"):
        return f"mysql+pymysql://{usr}:{pwd}@{host}:{port}/{dbname}"
    if db_type == "mssql":
        return (
            f"mssql+pyodbc://{usr}:{pwd}@{host}:{port}/{dbname}"
            "?driver=ODBC+Driver+17+for+SQL+Server"
        )
    if db_type == "oracle":
        return f"oracle+cx_oracle://{usr}:{pwd}@{host}:{port}/{dbname}"
    return f"{db_type}://{usr}:{pwd}@{host}:{port}/{dbname}"


def _test_connection(url: str, db_type: str = ""):
    """Try to create an engine and connect. Returns engine or None."""
    try:
        from sqlalchemy import create_engine, text
        engine = create_engine(url)
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        click.echo(click.style("  ✅  Connected.", fg="green"))
        return engine
    except Exception as exc:
        msg = str(exc)
        if "No module named" in msg or "ModuleNotFoundError" in msg or "Can't load plugin" in msg:
            hint = _DRIVER_HINTS.get(db_type, "")
            click.echo(click.style(f"  ❌  Missing driver — install with: {hint}", fg="red"))
        else:
            click.echo(click.style(f"  ❌  Connection failed: {exc}", fg="red"))
        return None


def _db_type_from_url(url: str) -> str:
    lower = url.lower()
    for t in _DB_TYPES:
        if lower.startswith(t):
            return t
    return ""


def _db_name_from_url(url: str) -> str:
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        name = parsed.path.lstrip("/")
        if "/" in name:
            name = name.rsplit("/", 1)[-1]
        name = re.sub(r"\.[a-z]+$", "", name)
        return name or "db"
    except Exception:
        return "db"


def _url_has_database(url: str) -> bool:
    from urllib.parse import urlparse
    path = urlparse(url).path.lstrip("/").split("?")[0]
    return bool(path)


def _list_databases(engine, db_type: str) -> list[str]:
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            if db_type == "postgresql":
                rows = conn.execute(
                    text("SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname")
                )
            else:
                rows = conn.execute(text("SHOW DATABASES"))
            return [row[0] for row in rows]
    except Exception:
        return []


def _pick_database(engine, current_url: str, db_type: str):
    dbs = _list_databases(engine, db_type)
    if not dbs:
        return engine, current_url

    click.echo(f"\n  Available databases on this server:")
    for i, name in enumerate(dbs, 1):
        click.echo(f"    [{i}]  {name}")

    raw = click.prompt(f"  Choose database (1-{len(dbs)} or name)", default="").strip()

    if raw.isdigit():
        idx = int(raw) - 1
        chosen = dbs[idx] if 0 <= idx < len(dbs) else raw
    else:
        chosen = raw

    if not chosen:
        return engine, current_url

    from urllib.parse import urlparse, urlunparse
    parsed = urlparse(current_url)
    new_url = urlunparse(parsed._replace(path=f"/{chosen}"))

    from sqlalchemy import text as satext, create_engine
    try:
        new_engine = create_engine(new_url)
        with new_engine.connect() as conn:
            conn.execute(satext("SELECT 1"))
        click.echo(click.style(f"  ✅  Using database '{chosen}'.", fg="green"))
        return new_engine, new_url
    except Exception as exc:
        click.echo(click.style(f"  ❌  Could not connect to '{chosen}': {exc}", fg="red"))
        return None, None


# ── Curses table picker ────────────────────────────────────────────────────────

_PC_HDR  = 1
_PC_SEL  = 2
_PC_OK   = 3
_PC_WARN = 4
_PC_TTL  = 5
_PC_ERR  = 6
_PC_DIM  = 7


def _run_table_picker(tables_info: list[tuple[str, int, bool]], db_name: str) -> list[str]:
    result: list[str] = []

    def _main(stdscr):
        curses.start_color()
        curses.use_default_colors()
        curses.init_pair(_PC_HDR,  curses.COLOR_WHITE,  curses.COLOR_BLUE)
        curses.init_pair(_PC_SEL,  curses.COLOR_BLACK,  curses.COLOR_CYAN)
        curses.init_pair(_PC_OK,   curses.COLOR_GREEN,  -1)
        curses.init_pair(_PC_WARN, curses.COLOR_YELLOW, -1)
        curses.init_pair(_PC_TTL,  curses.COLOR_CYAN,   -1)
        curses.init_pair(_PC_ERR,  curses.COLOR_RED,    -1)
        curses.curs_set(0)
        stdscr.keypad(True)

        selected = {name for name, _, exists in tables_info if not exists}
        cursor = 0
        scroll = 0

        while True:
            stdscr.erase()
            max_y, max_x = stdscr.getmaxyx()

            hdr = f" Import tables from '{db_name}' "
            stdscr.addstr(0, 0, " " * max_x, curses.color_pair(_PC_HDR))
            stdscr.addstr(0, max(0, (max_x - len(hdr)) // 2), hdr,
                          curses.color_pair(_PC_HDR) | curses.A_BOLD)

            list_h = max_y - 4
            if cursor < scroll:
                scroll = cursor
            elif cursor >= scroll + list_h:
                scroll = cursor - list_h + 1

            for i in range(list_h):
                idx = scroll + i
                if idx >= len(tables_info):
                    break
                name, ncols, exists = tables_info[idx]
                is_sel_cursor = idx == cursor
                row_attr = curses.color_pair(_PC_SEL) if is_sel_cursor else 0

                if exists:
                    chk = "[skip]"
                    chk_attr = curses.color_pair(_PC_ERR)
                elif name in selected:
                    chk = "[✓]   "
                    chk_attr = curses.color_pair(_PC_OK) | curses.A_BOLD
                else:
                    chk = "[ ]   "
                    chk_attr = curses.A_DIM

                stdscr.addstr(2 + i, 0, " " * min(max_x, 100), row_attr)
                stdscr.addstr(2 + i, 2, chk, chk_attr if not is_sel_cursor else row_attr)
                label = f"  {name:<40}  ({ncols} cols)"
                stdscr.addstr(2 + i, 8, label[:max_x - 10], row_attr)

            sel_count = len(selected)
            footer1 = f"  {sel_count}/{len(tables_info)} selected"
            footer2 = "  Space toggle · a all · n none · Enter confirm · q cancel"
            try:
                stdscr.addstr(max_y - 2, 0, footer1, curses.color_pair(_PC_TTL))
                stdscr.addstr(max_y - 1, 0, footer2, curses.color_pair(_PC_WARN))
            except curses.error:
                pass

            stdscr.refresh()
            key = stdscr.getch()

            if key in (curses.KEY_UP, ord('k')):
                cursor = max(0, cursor - 1)
            elif key in (curses.KEY_DOWN, ord('j')):
                cursor = min(len(tables_info) - 1, cursor + 1)
            elif key == ord(' '):
                name, _, exists = tables_info[cursor]
                if not exists:
                    if name in selected:
                        selected.discard(name)
                    else:
                        selected.add(name)
            elif key == ord('a'):
                selected = {name for name, _, exists in tables_info if not exists}
            elif key == ord('n'):
                selected = set()
            elif key in (curses.KEY_ENTER, ord('\n'), ord('\r')):
                result.extend(sorted(selected))
                return
            elif key in (ord('q'), 27):
                return

    curses.wrapper(_main)
    return result


# ── Schema introspection ───────────────────────────────────────────────────────

def _scan_existing(modules_dir: Path) -> tuple[set[str], set[str]]:
    classes: set[str] = set()
    tables: set[str] = set()
    if not modules_dir.exists():
        return classes, tables
    for mp in modules_dir.rglob("models.py"):
        text = mp.read_text(encoding="utf-8")
        for m in re.finditer(r"^class\s+(\w+)\s*\(", text, re.M):
            classes.add(m.group(1))
        for m in re.finditer(r'__tablename__\s*=\s*["\'](\w+)["\']', text):
            tables.add(m.group(1))
    return classes, tables


def _detect_junctions(
    selected: list[str], inspector
) -> dict[str, tuple[str, str]]:
    """Return {junction_table: (table_a, table_b)} for pure M2M link tables."""
    selected_set = set(selected)
    junctions: dict[str, tuple[str, str]] = {}
    for table in selected:
        fks = inspector.get_foreign_keys(table)
        if len(fks) != 2:
            continue
        t1 = fks[0]["referred_table"]
        t2 = fks[1]["referred_table"]
        if t1 == t2:
            continue
        if t1 not in selected_set or t2 not in selected_set:
            continue
        pk_cols = set(inspector.get_pk_constraint(table).get("constrained_columns", []))
        fk_cols = {c for fk in fks for c in fk["constrained_columns"]}
        # True junction: PK is entirely FK columns (no dedicated surrogate key)
        if not pk_cols.issubset(fk_cols):
            continue
        all_cols = {c["name"] for c in inspector.get_columns(table)}
        extra = all_cols - pk_cols - fk_cols - _INNOCUOUS_COLS
        if extra:
            continue
        junctions[table] = (t1, t2)
    return junctions


def _topo_sort(tables: list[str], inspector) -> list[str]:
    deps: dict[str, list[str]] = {t: [] for t in tables}
    tset = set(tables)
    for t in tables:
        for fk in inspector.get_foreign_keys(t):
            ref = fk["referred_table"]
            if ref in tset and ref != t:
                deps[t].append(ref)

    visited: set[str] = set()
    result: list[str] = []

    def visit(t: str):
        if t in visited:
            return
        visited.add(t)
        for dep in deps.get(t, []):
            visit(dep)
        result.append(t)

    for t in tables:
        visit(t)
    return result


# ── Name helpers ───────────────────────────────────────────────────────────────

def _to_pascal(name: str) -> str:
    parts = re.sub(r"[^a-zA-Z0-9]+", "_", name)
    return "".join(p.capitalize() for p in parts.split("_") if p)


def _to_snake(name: str) -> str:
    s = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s).lower()


def _pluralize(word: str) -> str:
    if word.endswith(("s", "x", "z", "ch", "sh")):
        return word + "es"
    if word.endswith("y") and len(word) > 1 and word[-2] not in "aeiou":
        return word[:-1] + "ies"
    return word + "s"


def _insert_before_earliest_class(text: str, class_names: list[str], block: str) -> str:
    """Insert ``block`` before whichever of ``class_names`` appears first in ``text``.

    A junction link class is referenced via ``link_model=`` by *both* sides of the
    M2M, so it must be defined before either class — regardless of the order in
    which they were scaffolded. Anchoring on the earliest class guarantees that.
    """
    from veloiq_framework.cli.add_relation import _insert_before_class

    positions: list[tuple[int, str]] = []
    for name in class_names:
        m = re.search(rf'^class\s+{re.escape(name)}\s*\(', text, re.M)
        if m:
            positions.append((m.start(), name))
    if not positions:
        return text.rstrip() + "\n" + block + "\n"
    positions.sort()
    return _insert_before_class(text, positions[0][1], block)

