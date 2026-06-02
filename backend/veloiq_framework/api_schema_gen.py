"""VeloIQ code generator — backend models → api.py + frontend TypeScript schemas + navigation config.

Drives ``veloiq generate``.  Projects can also invoke this directly::

    from veloiq_framework.api_schema_gen import run_api_schema_gen
    run_api_schema_gen()          # auto-discovers paths from CWD

Or from a project-level ``api_schema_gen.py``::

    from veloiq_framework.api_schema_gen import run_api_schema_gen
    run_api_schema_gen(
        modules_dir="app/modules",
        frontend_src="../frontend/src",
    )

For each module that contains a ``models.py`` the generator produces:

Backend (written into the module directory itself):
  ``api.py``  — auto-generated CRUD router using ``create_crud_router()``.
               Do not edit.  Use ``custom_api.py`` for custom endpoints.

Frontend (written into the frontend source tree):
  ``src/pages/{module}/{module}Schema.gen.ts``  — TypeScript field definitions.
  ``src/allModels.gen.ts``                      — barrel that imports all modules.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import warnings
from pathlib import Path


def run_api_schema_gen(
    modules_dir: str | Path | None = None,
    frontend_src: str | Path | None = None,
    project_root: str | Path | None = None,
) -> None:
    """Run the full code-generation pipeline.

    Discovery order for *project_root*:
      1. Explicit *project_root* argument.
      2. CWD (when running ``veloiq generate`` from the project root).
      3. CWD parent (when running from the ``backend/`` subdirectory).

    The generator looks for a project-level ``api_schema_gen.py`` in
    ``{project_root}/backend/`` or ``{project_root}/`` and delegates to it.
    If none is found it runs the built-in generator.
    """
    cwd = Path(project_root).resolve() if project_root else Path.cwd().resolve()
    calling_script = Path(sys.argv[0]).resolve() if sys.argv else None

    candidates = [
        cwd / "api_schema_gen.py",
        cwd / "backend" / "api_schema_gen.py",
        cwd.parent / "api_schema_gen.py",
        cwd.parent / "backend" / "api_schema_gen.py",
    ]
    script = next(
        (p for p in candidates if p.exists() and p.resolve() != calling_script),
        None,
    )

    if script:
        _run_script(script)
    else:
        _run_builtin(
            modules_dir=Path(modules_dir) if modules_dir else _guess_modules_dir(cwd),
            frontend_src=Path(frontend_src) if frontend_src else _guess_frontend_src(cwd),
        )


# ---------------------------------------------------------------------------
# Script delegation
# ---------------------------------------------------------------------------

def _run_script(script: Path) -> None:
    print(f"🔧 Running {script.name} …")
    result = subprocess.run(
        [sys.executable, str(script)],
        cwd=str(script.parent),
    )
    if result.returncode != 0:
        raise SystemExit(result.returncode)


# ---------------------------------------------------------------------------
# Built-in generator
# ---------------------------------------------------------------------------

def _run_builtin(modules_dir: Path, frontend_src: Path) -> None:
    """Scan modules_dir and generate api.py + TypeScript schemas for each module."""
    import importlib

    if not modules_dir.exists():
        print(f"❌ Modules directory not found: {modules_dir}")
        return

    pages_dir = frontend_src / "pages"
    pages_dir.mkdir(parents=True, exist_ok=True)

    backend_dir = modules_dir.parent.parent
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))

    from sqlmodel import SQLModel

    generated: list[str] = []

    # Pre-load auth models so veloiq_user / veloiq_role / veloiq_tenant tables
    # are registered in SQLAlchemy's MetaData before any app module is imported.
    # Without this, FK columns that reference veloiq_user.id cause mapper errors
    # during configure_mappers() even though the FK is column-only (no ORM rel).
    try:
        import veloiq_framework.auth.models  # noqa: F401
    except Exception:
        pass

    # First pass: import every models.py silently so that cross-module forward
    # references (e.g. Optional["TeamMember"] in tasks when team hasn't loaded
    # yet) are resolved before the second pass processes each module.
    mod_dirs = sorted(
        d for d in modules_dir.iterdir()
        if d.is_dir() and not d.name.startswith("__") and (d / "models.py").exists()
    )
    for mod_dir in mod_dirs:
        # Suppress the "already contains a class" SAWarning that SQLAlchemy emits
        # when a module fails mid-import (partially registering some classes) and
        # is then re-imported in the second pass — expected artifact of two-pass loading.
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", message=".*already contains a class.*")
            try:
                importlib.import_module(f"app.modules.{mod_dir.name}.models")
            except Exception:
                pass  # A later module may satisfy the missing forward ref; retry below.

    # Force SQLAlchemy to resolve all forward-reference relationships now that
    # every module has been imported.  Cross-module back_populates (e.g. Horse →
    # Stall across modules) fail mid-import because the target class doesn't
    # exist yet; calling configure_mappers() here, after all modules are loaded,
    # gives SQLAlchemy the complete picture it needs before introspection begins.
    try:
        from sqlalchemy.orm import configure_mappers
        configure_mappers()
    except Exception:
        pass

    for mod_dir in mod_dirs:
        module_name = mod_dir.name

        dotted = f"app.modules.{module_name}.models"
        try:
            importlib.import_module(dotted)
        except Exception as exc:
            print(f"  ⚠️  {module_name}: could not import ({exc})")
            continue

        # Collect non-link table models belonging to this module.
        module_models = [
            cls for cls in _iter_subclasses(SQLModel)
            if getattr(cls, "__module__", "").startswith(f"app.modules.{module_name}")
            and getattr(cls, "__tablename__", None)
            and not _is_link_model(cls)
        ]
        if not module_models:
            continue

        # ── Generate backend api.py ───────────────────────────────────────
        api_py = mod_dir / "api.py"
        if not api_py.exists():
            api_py.write_text(_build_api_py(module_name, module_models))
            print(f"  ✅ {module_name}/api.py ({len(module_models)} model(s))")
        else:
            # Regenerate only if it is itself auto-generated (first line marker).
            first_line = api_py.read_text().splitlines()[0] if api_py.stat().st_size else ""
            if first_line.startswith("# AUTO-GENERATED"):
                api_py.write_text(_build_api_py(module_name, module_models))
                print(f"  🔄 {module_name}/api.py (regenerated)")
            else:
                print(f"  ⏭️  {module_name}/api.py is custom — skipped")

        # ── Generate frontend TypeScript schema ───────────────────────────
        out_dir = pages_dir / module_name
        out_dir.mkdir(parents=True, exist_ok=True)
        schema_lines = _build_ts_schema_lines(module_name, module_models)
        # Append any named queries defined in this module's queries.py.
        named_query_lines = _collect_named_query_ts_lines(mod_dir, module_name)
        schema_lines += named_query_lines
        schema_lines += ["];", "", f"export default {module_name}ModelsGen;", ""]
        (out_dir / f"{module_name}Schema.gen.ts").write_text("\n".join(schema_lines))
        print(f"  ✅ {module_name}Schema.gen.ts")
        _write_manual_schema_if_missing(module_name, out_dir)
        _write_merged_schema(module_name, out_dir)

        generated.append(module_name)

    _write_all_models(generated, frontend_src)

    # Collect model names per module for navConfig (order matches generated order)
    module_model_names: dict[str, list[str]] = {}
    for mod_dir in mod_dirs:
        module_name = mod_dir.name
        if module_name not in generated:
            continue
        dotted = f"app.modules.{module_name}.models"
        try:
            import importlib as _il
            _mod = _il.import_module(dotted)
            from sqlmodel import SQLModel as _SM
            names = [
                cls.__name__
                for cls in _iter_subclasses(_SM)
                if getattr(cls, "__module__", "").startswith(f"app.modules.{module_name}")
                and getattr(cls, "__tablename__", None)
                and not _is_link_model(cls)
            ]
            module_model_names[module_name] = names
        except Exception:
            module_model_names[module_name] = []

    _update_nav_config(generated, module_model_names, frontend_src)

    # ── Sync installed extension schema files ─────────────────────────────────
    _sync_extension_schemas(frontend_src)

    print(f"\n✅ Generation complete — {len(generated)} module(s).")


# ---------------------------------------------------------------------------
# api.py builder
# ---------------------------------------------------------------------------

def _build_api_py(module_name: str, models: list) -> str:
    """Produce the content of an auto-generated api.py for one module."""
    model_names = [m.__name__ for m in models]
    imports = ", ".join(model_names)

    if len(models) == 1:
        body = f"router = create_crud_router({model_names[0]})"
    else:
        sub_routers = "\n".join(
            f"router.include_router(create_crud_router({name}))"
            for name in model_names
        )
        body = f"router = APIRouter()\n{sub_routers}"

    lines = [
        "# AUTO-GENERATED — do not edit. Run `veloiq generate` to update.",
        f'"""Standard CRUD API for the {module_name} module."""',
    ]
    if len(models) > 1:
        lines.append("from fastapi import APIRouter")
    lines += [
        "from veloiq_framework.crud import create_crud_router",
        f"from .models import {imports}",
        "",
        body,
        "",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# TypeScript schema builder
# ---------------------------------------------------------------------------

def _build_ts_schema(module_name: str, models: list) -> str:
    """Compatibility wrapper — returns the complete TypeScript schema file content."""
    lines = _build_ts_schema_lines(module_name, models)
    lines += ["];", "", f"export default {module_name}Models;", ""]
    return "\n".join(lines)


def _build_ts_schema_lines(module_name: str, models: list) -> list[str]:
    from sqlalchemy.inspection import inspect as sa_inspect

    lines = [
        "// AUTO-GENERATED — do not edit. Run `veloiq generate` to update.",
        "import type { ModelDef } from '@juicemantics/veloiq-ui';",
        "",
        f"export const {module_name}ModelsGen: ModelDef[] = [",
    ]

    for model in models:
        model_name = model.__name__
        tablename = getattr(model, "__tablename__", model_name.lower())
        try:
            mapper = sa_inspect(model)
            pk_field = next(
                (p.key for p in mapper.column_attrs if any(c.primary_key for c in p.columns)),
                "id",
            )
            _TIMESTAMP_KEYS = {"created_at", "updated_at", "creation_date", "modification_date"}
            fields = []
            timestamp_fields = []
            for p in mapper.column_attrs:
                if p.key == pk_field:
                    continue
                col = p.columns[0]
                ts_type = _col_to_ts_type(col, field_key=p.key)
                label = p.key.replace("_", " ").title()
                # If the column is a FK, add reference so the UI renders a dropdown.
                reference_extra = ""
                if col.foreign_keys:
                    fk = next(iter(col.foreign_keys))
                    ref_table = fk.column.table.name
                    reference_extra = f', reference: "{ref_table}"'
                # Emit required: true for non-nullable columns with no default.
                required_extra = ""
                if (
                    not col.nullable
                    and col.default is None
                    and col.server_default is None
                    and p.key not in _TIMESTAMP_KEYS
                ):
                    required_extra = ", required: true"
                # Emit veloiq_field read/write role restrictions if present.
                role_extra = ""
                try:
                    fi = model.model_fields.get(p.key)
                    if fi is not None:
                        jse = getattr(fi, "json_schema_extra", None)
                        if isinstance(jse, dict):
                            if "veloiq_read_roles" in jse:
                                rr = jse["veloiq_read_roles"]
                                role_extra += f', readRoles: {_to_ts_array(rr)}'
                            if "veloiq_write_roles" in jse:
                                wr = jse["veloiq_write_roles"]
                                role_extra += f', writeRoles: {_to_ts_array(wr)}'
                except Exception:
                    pass
                field_str = f'{{ key: "{p.key}", label: "{label}", type: "{ts_type}"{reference_extra}{required_extra}{role_extra} }}'
                if p.key in _TIMESTAMP_KEYS:
                    timestamp_fields.append(field_str)
                else:
                    fields.append(field_str)
            fields.extend(timestamp_fields)
            if not fields:
                print(
                    f"  ⚠️  {model.__name__}: no fields found — schema will be empty.\n"
                    f"     Check models.py: use jm_relationship (not Relationship/relationship),\n"
                    f"     do not add 'from __future__ import annotations'."
                )
        except Exception as exc:
            print(
                f"  ❌ {model.__name__}: field introspection failed — {exc}\n"
                f"     Schema will be empty. Check models.py:\n"
                f"     - Use jm_relationship from veloiq_framework (not Relationship/relationship)\n"
                f"     - Do not add 'from __future__ import annotations'\n"
                f"     - Guard cross-module imports with 'if TYPE_CHECKING'"
            )
            pk_field = "id"
            fields = []

        # Discover SQLAlchemy relationships → RelationDef entries.
        # Only emit ONETOMANY relations: RelationsExplorer queries
        #   {child_resource}?{targetKey}={current_record.pk}
        # which only makes sense when the FK (targetKey) lives on the child side.
        # MANYTOONE relations are already represented as FK fields in `fields`.
        relations = []
        try:
            from sqlalchemy.orm import ONETOMANY
            orm_covered_children: set[str] = set()
            for rel in mapper.relationships:
                if rel.direction != ONETOMANY:
                    continue
                other_cls = rel.mapper.class_
                other_tablename = getattr(other_cls, "__tablename__", other_cls.__name__.lower())
                orm_covered_children.add(other_tablename)
                # The FK column is on the remote (child) side.
                remote_cols = list(rel.remote_side)
                target_key = remote_cols[0].key if remote_cols else "id"
                is_recursive = other_cls is model
                rel_label = rel.key.replace("_", " ").title()
                if is_recursive:
                    # Self-referential: give MillerBrowserLayout everything it needs to render
                    # a tree view without a separate link table.
                    other_pk = next(
                        (p.key for p in sa_inspect(other_cls).column_attrs if any(c.primary_key for c in p.columns)),
                        "id",
                    )
                    extra = (
                        f', isRecursive: true'
                        f', otherKey: "{other_pk}"'
                        f', otherResource: "{other_tablename}"'
                        f', resourcePath: "{other_tablename}"'
                        f', showViewType: "tree-details"'
                        f', showViewTypeFromCsv: true'
                    )
                else:
                    extra = ''
                relations.append(
                    f'{{ resource: "{other_tablename}", targetKey: "{target_key}", label: "{rel_label}"{extra} }}'
                )

            # Auto-discover FK back-relations not covered by explicit ORM relationship declarations.
            # A bare FK column (e.g. trip_id on trip_manifest) registers in SQLAlchemy's MetaData
            # but not in the mapper's relationship list, so the ORM loop above misses it.
            # This pass closes that gap so parent show pages get linked tables for free.
            from sqlmodel import SQLModel as _SM_all
            for child_table in _SM_all.metadata.tables.values():
                if child_table.name == tablename:
                    continue  # skip self
                if child_table.name in orm_covered_children:
                    continue  # already handled by an ORM relationship declaration
                # Skip link/junction tables: ≥2 FK cols and no meaningful data columns beyond PKs
                child_fk_count = sum(1 for c in child_table.columns if c.foreign_keys)
                child_pk_count = sum(1 for c in child_table.columns if c.primary_key)
                child_col_count = len(list(child_table.columns))
                if child_fk_count >= 2 and child_col_count <= child_pk_count + 2:
                    continue
                for col in child_table.columns:
                    if not col.foreign_keys:
                        continue
                    for fk in col.foreign_keys:
                        if fk.column.table.name == tablename and child_table.name not in orm_covered_children:
                            child_label = child_table.name.replace("_", " ").title()
                            relations.append(
                                f'{{ resource: "{child_table.name}", targetKey: "{col.key}", label: "{child_label}" }}'
                            )
                            orm_covered_children.add(child_table.name)
        except Exception:
            pass

        model_label = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', model_name)
        # Extra UI config declared on the model via __veloiq_ui__ = {"listViewType": "gallery", ...}
        veloiq_ui: dict = getattr(model, "__veloiq_ui__", {}) or {}
        extra_props = []
        if "listViewType" in veloiq_ui:
            extra_props.append(f'    listViewType: "{veloiq_ui["listViewType"]}",')

        lines += [
            "  {",
            f'    name: "{model_name}",',
            f'    label: "{model_label}",',
            f'    resource: "{tablename}",',
            f'    pkField: "{pk_field}",',
            *extra_props,
            "    fields: [",
            *[f"      {f}," for f in fields],
            "    ],",
            "    relations: [",
            *[f"      {r}," for r in relations],
            "    ],",
            "  },",
        ]

    return lines


def _to_ts_array(values: list[str]) -> str:
    """Convert a Python list of strings to a TypeScript array literal."""
    inner = ", ".join(f'"{v}"' for v in values)
    return f"[{inner}]"


_IMAGE_URL_FIELD_NAMES = {"avatar_url", "image_url", "photo_url", "thumbnail_url", "cover_url", "picture_url"}


def _col_to_ts_type(col, field_key: str = "") -> str:
    """Map a SQLAlchemy column type to a DynamicResource field type string."""
    from sqlalchemy import types
    if field_key in _IMAGE_URL_FIELD_NAMES:
        return "image_url"
    t = col.type
    if isinstance(t, (types.Integer, types.BigInteger, types.SmallInteger, types.Numeric, types.Float)):
        return "number"
    if isinstance(t, types.Boolean):
        return "boolean"
    if isinstance(t, types.Date):
        return "date"
    if isinstance(t, types.DateTime):
        return "datetime"
    return "string"


# ---------------------------------------------------------------------------
# Manual schema sidecar + merged schema writers
# ---------------------------------------------------------------------------

_SCHEMA_TYPE_BLOCK = """\
import type { ModelDef } from '@juicemantics/veloiq-ui';

type FieldDef = ModelDef['fields'][number];
type RelationDef = NonNullable<ModelDef['relations']>[number];
type FieldOverride = Partial<FieldDef> & Pick<FieldDef, 'key'>;
type RelationOverride = Partial<RelationDef> & ({ resource: string } | { label: string });
type ModelOverride = Partial<Omit<ModelDef, 'fields' | 'relations'>> & {
    name: string;
    fields?: FieldOverride[];
    relations?: RelationOverride[];
};\
"""

_MERGE_FUNCTIONS_BLOCK = """\
const defaultField = (override: FieldOverride): FieldDef => ({
    key: override.key,
    label: override.label ?? override.key,
    type: override.type ?? 'string',
    ...override,
});

const mergeFields = (base: FieldDef[], overrides?: FieldOverride[]): FieldDef[] => {
    if (!overrides || overrides.length === 0) return base;
    const merged = [...base];
    for (const override of overrides) {
        const idx = merged.findIndex((f) => f.key === override.key);
        if (idx >= 0) {
            merged[idx] = { ...merged[idx], ...override };
        } else {
            merged.push(defaultField(override));
        }
    }
    return merged;
};

const relationKey = (r: RelationDef | RelationOverride): string | undefined =>
    'resource' in r && r.resource ? r.resource : r.label;

const mergeRelations = (
    base: RelationDef[] | undefined,
    overrides?: RelationOverride[],
): RelationDef[] | undefined => {
    if (!overrides || overrides.length === 0) return base;
    const merged = base ? [...base] : [];
    for (const override of overrides) {
        const key = relationKey(override);
        if (!key) { merged.push(override as RelationDef); continue; }
        const idx = merged.findIndex((r) => relationKey(r) === key);
        if (idx >= 0) {
            merged[idx] = { ...merged[idx], ...override } as RelationDef;
        } else {
            merged.push(override as RelationDef);
        }
    }
    return merged;
};

const mergeModel = (base: ModelDef, override?: ModelOverride): ModelDef => {
    if (!override) return base;
    return {
        ...base,
        ...override,
        fields: mergeFields(base.fields, override.fields),
        relations: mergeRelations(base.relations, override.relations),
    };
};\
"""


def _write_manual_schema_if_missing(module_name: str, out_dir: Path) -> None:
    manual_file = out_dir / f"{module_name}Schema.manual.ts"
    if manual_file.exists():
        return
    lines = [
        _SCHEMA_TYPE_BLOCK,
        "",
        f"export const {module_name}ManualOverrides: ModelOverride[] = [",
        "    // Add field/relation/model overrides here. This file is never overwritten by veloiq generate.",
        "    // Examples:",
        "    // {",
        "    //     name: 'MyModel',",
        "    //     fields: [",
        "    //         // Override an existing field's view type:",
        "    //         { key: 'description', showViewType: 'read-only-markdown', editViewType: 'editable-markdown' },",
        "    //         // Add a new virtual field:",
        "    //         { key: 'custom_field', label: 'Custom', type: 'string' },",
        "    //     ],",
        "    //     relations: [",
        "    //         // Override a relation's label:",
        "    //         { resource: 'task', label: 'Project Tasks' },",
        "    //     ],",
        "    // },",
        "];",
        "",
    ]
    manual_file.write_text("\n".join(lines))
    print(f"  ✅ {module_name}Schema.manual.ts (created)")


def _write_merged_schema(module_name: str, out_dir: Path) -> None:
    merged_file = out_dir / f"{module_name}Schema.ts"
    lines = [
        "// AUTO-GENERATED — do not edit. Run `veloiq generate` to update.",
        f"import {{ {module_name}ModelsGen }} from './{module_name}Schema.gen';",
        f"import {{ {module_name}ManualOverrides }} from './{module_name}Schema.manual';",
        _SCHEMA_TYPE_BLOCK,
        "",
        _MERGE_FUNCTIONS_BLOCK,
        "",
        f"const baseNames = new Set({module_name}ModelsGen.map((m) => m.name));",
        f"const extraModels: ModelDef[] = {module_name}ManualOverrides",
        "    .filter((o) => !baseNames.has(o.name))",
        "    .map((o) => ({",
        "        name: o.name,",
        "        label: o.label ?? o.name,",
        "        resource: o.resource ?? o.name.toLowerCase(),",
        "        pkField: o.pkField ?? 'id',",
        "        fields: mergeFields([], o.fields),",
        "        relations: mergeRelations(undefined, o.relations),",
        "        ...o,",
        "    }));",
        "",
        f"export const {module_name}Models: ModelDef[] = [",
        f"    ...{module_name}ModelsGen.map((m) =>",
        f"        mergeModel(m, {module_name}ManualOverrides.find((o) => o.name === m.name))",
        "    ),",
        "    ...extraModels,",
        "];",
        "",
        f"export default {module_name}Models;",
        "",
    ]
    merged_file.write_text("\n".join(lines))
    print(f"  ✅ {module_name}Schema.ts (merged)")


# allModels.gen.ts writer
# ---------------------------------------------------------------------------

def _write_all_models(modules: list[str], frontend_src: Path) -> None:
    pages_dir = frontend_src / "pages"
    valid = [m for m in modules if (pages_dir / m / f"{m}Schema.gen.ts").exists()]
    lines = [
        "// AUTO-GENERATED — do not edit. Run `veloiq generate` to update.",
        "import type { ModelDef } from '@juicemantics/veloiq-ui';",
        "",
    ]
    for mod in valid:
        lines.append(f'import {{ {mod}Models }} from "./pages/{mod}/{mod}Schema";')
    lines += [
        "",
        "export const allModuleRegistrations: Array<{ moduleName: string; models: ModelDef[] }> = [",
    ]
    for mod in valid:
        lines.append(f'  {{ moduleName: "{mod}", models: {mod}Models ?? [] }},')
    lines += [
        "];",
        "",
        "export const allSystemModels: ModelDef[] = allModuleRegistrations.flatMap((r) => r.models);",
        "",
    ]
    (frontend_src / "allModels.gen.ts").write_text("\n".join(lines))
    print(f"📦 allModels.gen.ts updated ({len(valid)} modules)")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _iter_subclasses(base: type) -> list[type]:
    out: list[type] = []
    stack = list(base.__subclasses__())
    while stack:
        cls = stack.pop()
        out.append(cls)
        stack.extend(cls.__subclasses__())
    return out


def _is_link_model(cls: type) -> bool:
    """Heuristic: link/junction models have exactly two FK columns and no other data columns."""
    try:
        from sqlalchemy.inspection import inspect as sa_inspect
        mapper = sa_inspect(cls)
        fk_cols = [c for p in mapper.column_attrs for c in p.columns if c.foreign_keys]
        pk_cols = [c for p in mapper.column_attrs for c in p.columns if c.primary_key]
        all_cols = [c for p in mapper.column_attrs for c in p.columns]
        return len(fk_cols) >= 2 and len(all_cols) <= len(pk_cols) + 2
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Named query TypeScript helpers
# ---------------------------------------------------------------------------

def _collect_named_query_ts_lines(mod_dir: Path, module_name: str) -> list[str]:
    """Import *module_name*/queries.py and return TypeScript lines for each NamedQuery."""
    import importlib

    queries_file = mod_dir / "queries.py"
    if not queries_file.exists():
        return []

    try:
        from veloiq_framework.queries import NamedQuery
        qs_mod = importlib.import_module(f"app.modules.{module_name}.queries")
    except Exception as exc:
        print(f"  ⚠️  {module_name}/queries: could not import ({exc})")
        return []

    lines: list[str] = []
    for attr_name in dir(qs_mod):
        obj = getattr(qs_mod, attr_name)
        if isinstance(obj, NamedQuery):
            lines += _build_ts_named_query(obj)
            print(f"  ✅ {module_name}/{obj.name} (named query)")
    return lines


def _build_ts_named_query(q: "object") -> list[str]:
    """Return TypeScript lines for a single NamedQuery to insert into the ModelDef array."""
    from veloiq_framework.queries import NamedQuery, NamedQueryField
    from veloiq_framework.models import get_pk_field_name

    assert isinstance(q, NamedQuery)

    pk_field = get_pk_field_name(q.primary_model)
    primary_tablename = getattr(q.primary_model, "__tablename__", q.primary_model.__name__.lower())
    name_pascal = "".join(part.title() for part in q.name.split("_"))
    model_label = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', name_pascal)

    # Build field entries.
    field_lines: list[str] = []
    for f in q.fields:
        parts = [f'key: "{f.key}"', f'label: "{f.label}"', f'type: "{f.type}"']
        if f.reference:
            parts.append(f'reference: "{f.reference}"')
        if f.read_only:
            parts.append("readOnly: true")
        field_lines.append("{ " + ", ".join(parts) + " }")

    # defaultSort
    sort_str = ""
    if q.default_sort:
        sort_str = f'    defaultSort: {{ field: "{q.default_sort[0]}", order: "{q.default_sort[1]}" }},'

    lines = ["  {"]
    lines.append(f'    name: "{name_pascal}",')
    lines.append(f'    label: "{q.label}",')
    lines.append(f'    resource: "{q.name}",')
    lines.append(f'    pkField: "{pk_field}",')
    lines.append("    isNamedQuery: true,")
    lines.append(f'    primaryResource: "{primary_tablename}",')
    lines.append(f'    listViewType: "{q.list_view_type}",')
    if sort_str:
        lines.append(sort_str)
    lines.append("    fields: [")
    for fl in field_lines:
        lines.append(f"      {fl},")
    lines.append("    ],")
    lines.append("    relations: [],")
    lines.append("  },")
    return lines


# ---------------------------------------------------------------------------
# navigation.config.json management
# ---------------------------------------------------------------------------

_ICON_KEYWORD_MAP: list[tuple[re.Pattern, str]] = [
    (re.compile(r"dashboard|overview|home", re.I), "DashboardOutlined"),
    (re.compile(r"user|person|people|member|staff|employee|contact|customer|client", re.I), "UserOutlined"),
    (re.compile(r"team|group|department|division|unit|crew", re.I), "TeamOutlined"),
    (re.compile(r"role|permission|access|security|privilege|policy", re.I), "LockOutlined"),
    (re.compile(r"tenant|organization|company|account|workspace|business", re.I), "BankOutlined"),
    (re.compile(r"task|todo|checklist|backlog|ticket", re.I), "CheckSquareOutlined"),
    (re.compile(r"project|initiative|program|campaign|sprint|epic", re.I), "FolderOpenOutlined"),
    (re.compile(r"invoice|bill|payment|financ|transaction|ledger|accounting|receipt", re.I), "FileTextOutlined"),
    (re.compile(r"product|catalog|inventory|stock|sku|variant", re.I), "ShoppingOutlined"),
    (re.compile(r"order|purchase|sale|cart|checkout|shipment", re.I), "ShoppingCartOutlined"),
    (re.compile(r"setting|config|preference|option|setup", re.I), "SettingOutlined"),
    (re.compile(r"report|analytic|metric|stat|chart|analysis|insight", re.I), "BarChartOutlined"),
    (re.compile(r"document|file|attachment|note|memo|contract|paper", re.I), "FileOutlined"),
    (re.compile(r"calendar|event|schedule|appointment|booking|slot", re.I), "CalendarOutlined"),
    (re.compile(r"message|email|notification|comment|chat|inbox|mail", re.I), "MailOutlined"),
    (re.compile(r"categor|tag|label|class", re.I), "TagOutlined"),
    (re.compile(r"location|address|region|area|country|city|place|site", re.I), "EnvironmentOutlined"),
    (re.compile(r"equipment|asset|machine|hardware", re.I), "ToolOutlined"),
    (re.compile(r"log|audit|histor|trail|activity", re.I), "HistoryOutlined"),
    (re.compile(r"animal|pet|livestock|breed|horse", re.I), "DatabaseOutlined"),
    (re.compile(r"building|room|floor|facility|barn|stable|stall", re.I), "HomeOutlined"),
    (re.compile(r"vehicle|car|truck|fleet|transport|bike", re.I), "CarOutlined"),
    (re.compile(r"health|medical|clinical|treatment|drug|patient", re.I), "MedicineBoxOutlined"),
]


def _guess_icon_py(text: str, is_module: bool = False) -> str:
    normalized = re.sub(r"[_:\-]", " ", text.lower())
    for pattern, icon in _ICON_KEYWORD_MAP:
        if pattern.search(normalized):
            return icon
    return "FolderOutlined" if is_module else "TableOutlined"


def _update_nav_config(
    modules: list[str],
    module_model_names: dict[str, list[str]],
    frontend_src: Path,
) -> None:
    """Upsert entries in navigation.config.json — preserves manual edits."""
    nav_file = frontend_src / "navigation.config.json"

    # Load existing config (developer may have edited icons/sequences manually)
    existing: list[dict] = []
    if nav_file.exists():
        try:
            existing = json.loads(nav_file.read_text())
        except Exception:
            existing = []

    existing_by_key: dict[str, dict] = {e["key"]: e for e in existing if "key" in e}

    new_entries: list[dict] = []

    # ── Dashboard ─────────────────────────────────────────────────────────
    if "dashboard" not in existing_by_key:
        new_entries.append({
            "key": "dashboard",
            "label": "Dashboard",
            "icon": "DashboardOutlined",
            "sequence": 0,
            "type": "module",
        })

    # ── App modules ───────────────────────────────────────────────────────
    for mod_seq, module_name in enumerate(modules, start=1):
        module_key = f"module:{module_name}"
        module_label = module_name.replace("_", " ").title()
        if module_key not in existing_by_key:
            new_entries.append({
                "key": module_key,
                "label": module_label,
                "icon": _guess_icon_py(module_label, is_module=True),
                "sequence": mod_seq * 10,
                "type": "module",
            })
        for model_seq, model_name in enumerate(module_model_names.get(module_name, []), start=1):
            try:
                import importlib as _il
                from sqlmodel import SQLModel as _SM
                model_cls = next(
                    (c for c in _iter_subclasses(_SM)
                     if c.__name__ == model_name
                     and getattr(c, "__module__", "").startswith(f"app.modules.{module_name}")),
                    None,
                )
                resource_key = getattr(model_cls, "__tablename__", model_name.lower()) if model_cls else model_name.lower()
            except Exception:
                resource_key = re.sub(r"(?<=[a-z])(?=[A-Z])", "_", model_name).lower()

            if resource_key not in existing_by_key:
                model_label = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", model_name)
                new_entries.append({
                    "key": resource_key,
                    "label": model_label,
                    "icon": _guess_icon_py(model_label, is_module=False),
                    "sequence": mod_seq * 10 + model_seq,
                    "type": "model",
                })

    # ── Access Control (auth) ─────────────────────────────────────────────
    if "module:access_control" not in existing_by_key:
        new_entries.append({
            "key": "module:access_control",
            "label": "Access Control",
            "icon": "LockOutlined",
            "sequence": 900,
            "type": "module",
        })
    for auth_key, auth_label, auth_icon in [
        ("user", "User", "UserOutlined"),
        ("role", "Role", "LockOutlined"),
        ("tenant", "Tenant", "BankOutlined"),
    ]:
        if auth_key not in existing_by_key:
            new_entries.append({
                "key": auth_key,
                "label": auth_label,
                "icon": auth_icon,
                "sequence": 901 + ["user", "role", "tenant"].index(auth_key),
                "type": "model",
            })

    if not new_entries:
        return

    # Merge: preserve existing, append new
    merged = list(existing) + new_entries
    nav_file.write_text(json.dumps(merged, indent=2))
    print(f"  📐 navigation.config.json updated (+{len(new_entries)} entries)")


def _sync_extension_schemas(frontend_src: Path) -> None:
    """Copy installed extension schema files into the host app's frontend/src/pages/.

    For each installed extension that declares a ``frontend_pages_dir``:
    - Copies ``{extension}/frontend/pages/{module}/`` into
      ``frontend_src/pages/{module}/`` (existing files are overwritten so
      the extension stays in sync with the installed version).
    - Writes ``{module}Schema.manual.ts`` stubs only if they don't exist yet
      (preserving any developer customisations).
    - Updates ``allModels.gen.ts`` and ``navigation.config.json`` to include
      the extension's modules.
    """
    from veloiq_framework.extensions import discover_extensions
    from veloiq_framework.extension_registry import read_enabled_extensions
    import shutil

    # Only sync schemas for extensions this app has explicitly enabled
    # (veloiq.toml / VELOIQ_EXTENSIONS) — mirrors the startup opt-in so generate
    # and runtime never diverge.
    enabled = read_enabled_extensions(frontend_src)
    extensions = discover_extensions(enabled)
    if not extensions:
        return

    pages_dir = frontend_src / "pages"
    pages_dir.mkdir(parents=True, exist_ok=True)

    # Deliver page components, routes, and user-menu items (independent of schemas).
    _sync_extension_frontend(extensions, frontend_src)

    ext_modules: list[str] = []          # module names added from extensions
    ext_module_label_map: dict[str, str] = {}  # module_name → extension name label

    for ext in extensions:
        src_pages = ext.resolved_frontend_pages_dir()
        if not src_pages or not src_pages.exists():
            continue

        print(f"\n🔌 Syncing extension '{ext.name}' schemas…")

        for mod_dir in sorted(src_pages.iterdir()):
            if not mod_dir.is_dir() or mod_dir.name.startswith("_"):
                continue
            module_name = mod_dir.name
            dest_dir = pages_dir / module_name
            dest_dir.mkdir(parents=True, exist_ok=True)

            # Copy gen + merged schema (always overwrite — extension owns these).
            for fname in (
                f"{module_name}Schema.gen.ts",
                f"{module_name}Schema.ts",
            ):
                src_file = mod_dir / fname
                if src_file.exists():
                    shutil.copy2(src_file, dest_dir / fname)
                    print(f"  ✅ {module_name}/{fname}")

            # Write manual stub only if missing (developer may have customised it).
            _write_manual_schema_if_missing(module_name, dest_dir)

            ext_modules.append(module_name)
            ext_module_label_map[module_name] = ext.name

    if not ext_modules:
        return

    # Rebuild allModels.gen.ts including extension modules.
    all_modules: list[str] = []
    seen: set[str] = set()
    for d in sorted(pages_dir.iterdir()):
        if d.is_dir() and not d.name.startswith("_"):
            gen_file = d / f"{d.name}Schema.gen.ts"
            if gen_file.exists() and d.name not in seen:
                all_modules.append(d.name)
                seen.add(d.name)

    _write_all_models(all_modules, frontend_src)

    # Parse (name, resource, label) triples from each extension gen schema file
    # so nav config entries use the correct resource key (e.g. "cw_nlchat", not
    # "nlchat"), bypassing the app.modules.* SQLModel lookup in _update_nav_config.
    import re as _re
    import json as _json

    nav_file = frontend_src / "navigation.config.json"
    existing_nav: list[dict] = []
    if nav_file.exists():
        try:
            existing_nav = _json.loads(nav_file.read_text())
        except Exception:
            existing_nav = []
    existing_keys: set[str] = {e.get("key", "") for e in existing_nav if "key" in e}

    # Parse {name, resource} pairs per module from the gen schema files.
    # Modules with NO models (e.g. bundle-only modules whose UI is delivered as a
    # pre-built JS bundle and reached from the user menu) are intentionally NOT
    # added to the left navigation — they have no schema-driven list resource.
    module_models: dict[str, list[tuple[str, str]]] = {}
    for module_name in ext_modules:
        gen_file = pages_dir / module_name / f"{module_name}Schema.gen.ts"
        if not gen_file.exists():
            module_models[module_name] = []
            continue
        content = gen_file.read_text(encoding="utf-8")
        # Extract {name: "...", resource: "..."} pairs from ModelDef objects,
        # in document order.
        pairs = _re.findall(
            r'name:\s*["\']([A-Za-z][A-Za-z0-9_]*)["\']\s*,\s*'
            r'(?:label:\s*["\'][^"\']*["\']\s*,\s*)?'
            r'resource:\s*["\']([^"\']+)["\']',
            content,
        )
        module_models[module_name] = pairs

    new_nav_entries: list[dict] = []
    for mod_seq, module_name in enumerate(ext_modules, start=500):
        models = module_models.get(module_name, [])
        if not models:
            continue  # bundle-only module — never appears in the left nav

        module_key = f"module:{module_name}"
        if module_key not in existing_keys:
            module_label = module_name.replace("_", " ").title()
            new_nav_entries.append({
                "key": module_key,
                "label": module_label,
                "icon": _guess_icon_py(module_label, is_module=True),
                "sequence": mod_seq * 10,
                "type": "module",
            })

        for model_seq, (model_name, resource_key) in enumerate(models, start=1):
            if resource_key not in existing_keys:
                model_label = _re.sub(r"(?<=[a-z])(?=[A-Z])", " ", model_name)
                new_nav_entries.append({
                    "key": resource_key,
                    "label": model_label,
                    "icon": _guess_icon_py(model_label, is_module=False),
                    "sequence": mod_seq * 10 + model_seq,
                    "type": "model",
                })

    if new_nav_entries:
        merged = list(existing_nav) + new_nav_entries
        nav_file.write_text(_json.dumps(merged, indent=2))
        print(f"  📐 navigation.config.json updated (+{len(new_nav_entries)} extension entries)")

    print(f"\n  🔌 {len(ext_modules)} extension module(s) synced.")


def _sync_extension_frontend(extensions: list, frontend_src: Path) -> None:
    """Deliver extension page components, routes, and user-menu items to the host app.

    For each installed extension:
    - Copies ``.tsx`` files from its ``frontend_components_dir`` into the host
      app's ``frontend/src/pages/{name}/`` (always overwritten — extension-owned).
    - Collects its declared ``routes`` and ``user_menu_items``.

    Then writes a single ``frontend/src/extensions.gen.tsx`` exporting:
    - ``extensionRoutes``         — ``[{ path, element }]`` ready to mount.
    - ``extensionUserMenuItems``  — ``[{ key, label, icon, onClick }]`` for LayoutWrapper.

    The file is always (re)written — even with no contributions — so the host
    app's static import never breaks.
    """
    import shutil

    pages_dir = frontend_src / "pages"

    # (import_name, import_path, export) tuples for the generated imports.
    imports: list[tuple[str, str, str]] = []
    route_entries: list[tuple[str, str]] = []   # (path, import_name)
    show_override_entries: list[tuple[str, str]] = []  # (resource, import_name)
    menu_entries: list[dict] = []
    icon_names: set[str] = set()

    for ext in extensions:
        comp_dir = ext.resolved_frontend_components_dir()
        # Copy component files into the host pages dir (namespaced by extension).
        if comp_dir and comp_dir.exists():
            dest = pages_dir / ext.name
            dest.mkdir(parents=True, exist_ok=True)
            for src_file in sorted(comp_dir.rglob("*.tsx")):
                rel = src_file.relative_to(comp_dir)
                target = dest / rel
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src_file, target)
                print(f"  ✅ {ext.name}/{rel} (component)")

        # Routes → imports + route entries.
        for route in (getattr(ext, "routes", None) or []):
            path = route.get("path")
            component = route.get("component")
            source = route.get("source", "")
            export = route.get("export", "default")
            if not path or not component or not source:
                continue
            # Strip a trailing .tsx/.ts for the import specifier.
            mod_rel = source[:-4] if source.endswith(".tsx") else (
                source[:-3] if source.endswith(".ts") else source
            )
            import_path = f"./pages/{ext.name}/{mod_rel}"
            import_name = f"{ext.name}_{component}"
            imports.append((import_name, import_path, export))
            route_entries.append((path, import_name))

        # Show-page overrides → imports + (resource → component) entries.
        for override in (getattr(ext, "show_overrides", None) or []):
            resource = override.get("resource")
            component = override.get("component")
            source = override.get("source", "")
            export = override.get("export", "default")
            if not resource or not component or not source:
                continue
            mod_rel = source[:-4] if source.endswith(".tsx") else (
                source[:-3] if source.endswith(".ts") else source
            )
            import_path = f"./pages/{ext.name}/{mod_rel}"
            import_name = f"{ext.name}_{component}"
            imports.append((import_name, import_path, export))
            show_override_entries.append((resource, import_name))

        # User-menu items.
        for item in (getattr(ext, "user_menu_items", None) or []):
            if not item.get("key") or not item.get("route"):
                continue
            icon = item.get("icon")
            if icon:
                icon_names.add(icon)
            # Grouped items are nested under a single "Configurations" submenu
            # whose parent uses the SettingOutlined icon.
            if item.get("group"):
                icon_names.add("SettingOutlined")
            menu_entries.append(item)

    # ── Emit extensions.gen.tsx ───────────────────────────────────────────────
    lines: list[str] = [
        "// AUTO-GENERATED — do not edit. Run `veloiq generate` to update.",
        "// Extension-contributed routes and user-menu items.",
        'import { createElement } from "react";',
    ]
    if icon_names:
        icon_import = ", ".join(sorted(icon_names))
        lines.append(f'import {{ {icon_import} }} from "@ant-design/icons";')
    seen_imports: set[str] = set()
    for import_name, import_path, export in imports:
        if import_name in seen_imports:
            continue
        seen_imports.add(import_name)
        if export == "default":
            lines.append(f'import {import_name} from "{import_path}";')
        else:
            lines.append(f'import {{ {export} as {import_name} }} from "{import_path}";')

    lines += [
        "",
        "export interface ExtensionRoute { path: string; element: React.ReactNode; }",
        "export const extensionRoutes: ExtensionRoute[] = [",
    ]
    for path, import_name in route_entries:
        lines.append(f'  {{ path: "{path}", element: createElement({import_name}) }},')
    lines += [
        "];",
        "",
        ("export interface ExtensionUserMenuItem { key: string; label: string; "
         "icon?: React.ReactNode; onClick?: () => void; type?: \"group\"; "
         "children?: ExtensionUserMenuItem[]; }"),
        "export const extensionUserMenuItems: ExtensionUserMenuItem[] = [",
    ]

    def _menu_leaf_ts(menu_item: dict) -> str:
        key = menu_item["key"]
        label = menu_item["label"].replace('"', '\\"')
        route = menu_item["route"]
        icon = menu_item.get("icon")
        icon_expr = f"createElement({icon})" if icon else "undefined"
        return (
            f'{{ key: "{key}", label: "{label}", icon: {icon_expr}, '
            f'onClick: () => {{ window.location.assign("{route}"); }} }}'
        )

    ungrouped_items = [it for it in menu_entries if not it.get("group")]
    grouped_items = [it for it in menu_entries if it.get("group")]

    # Items without a group stay at the top level of the user dropdown.
    for item in ungrouped_items:
        lines.append(f'  {_menu_leaf_ts(item)},')

    # Grouped items are bucketed (preserving first-seen order) into Ant
    # ``type: "group"`` sections nested inside a single "Configurations" submenu.
    if grouped_items:
        group_order: list[str] = []
        groups: dict[str, list[dict]] = {}
        for it in grouped_items:
            grp = it["group"]
            if grp not in groups:
                groups[grp] = []
                group_order.append(grp)
            groups[grp].append(it)

        lines.append(
            '  { key: "configurations", label: "Configurations", '
            'icon: createElement(SettingOutlined), children: ['
        )
        for grp in group_order:
            grp_label = grp.replace('"', '\\"')
            grp_slug = re.sub(r'[^a-z0-9]+', '-', grp.lower()).strip('-')
            lines.append(
                f'    {{ key: "cfg-group-{grp_slug}", type: "group", '
                f'label: "{grp_label}", children: ['
            )
            for item in groups[grp]:
                lines.append(f'      {_menu_leaf_ts(item)},')
            lines.append('    ] },')
        lines.append('  ] },')

    lines += ["];", ""]

    # Per-resource Show-page overrides → map consumed by the host App.tsx.
    lines += [
        "// Resource → custom Show component. The host App.tsx renders the mapped",
        "// component at /{resource}/show/:id instead of the default DynamicShow.",
        "export const extensionShowComponents: Record<string, React.ComponentType<any>> = {",
    ]
    for resource, import_name in show_override_entries:
        lines.append(f'  "{resource}": {import_name},')
    lines += ["};", ""]

    out_file = frontend_src / "extensions.gen.tsx"
    out_file.write_text("\n".join(lines))
    print(
        f"  📦 extensions.gen.tsx updated ({len(route_entries)} route(s), "
        f"{len(menu_entries)} menu item(s), {len(show_override_entries)} show override(s))"
    )


def _guess_modules_dir(cwd: Path) -> Path:
    for candidate in [
        cwd / "app" / "modules",
        cwd / "backend" / "app" / "modules",
        cwd.parent / "app" / "modules",
    ]:
        if candidate.exists():
            return candidate
    return cwd / "app" / "modules"


def _guess_frontend_src(cwd: Path) -> Path:
    for candidate in [
        cwd / "frontend" / "src",
        cwd.parent / "frontend" / "src",
    ]:
        if candidate.exists():
            return candidate
    return cwd / "frontend" / "src"
