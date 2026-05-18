"""SafeMantIQ code generator — backend models → api.py + frontend TypeScript schemas.

Drives ``safem generate``.  Projects can also invoke this directly::

    from safemantiq_framework.api_schema_gen import run_api_schema_gen
    run_api_schema_gen()          # auto-discovers paths from CWD

Or from a project-level ``api_schema_gen.py``::

    from safemantiq_framework.api_schema_gen import run_api_schema_gen
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

import re
import subprocess
import sys
from pathlib import Path


def run_api_schema_gen(
    modules_dir: str | Path | None = None,
    frontend_src: str | Path | None = None,
    project_root: str | Path | None = None,
) -> None:
    """Run the full code-generation pipeline.

    Discovery order for *project_root*:
      1. Explicit *project_root* argument.
      2. CWD (when running ``safem generate`` from the project root).
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

    # First pass: import every models.py silently so that cross-module forward
    # references (e.g. Optional["TeamMember"] in tasks when team hasn't loaded
    # yet) are resolved before the second pass processes each module.
    mod_dirs = sorted(
        d for d in modules_dir.iterdir()
        if d.is_dir() and not d.name.startswith("__") and (d / "models.py").exists()
    )
    for mod_dir in mod_dirs:
        try:
            importlib.import_module(f"app.modules.{mod_dir.name}.models")
        except Exception:
            pass  # A later module may satisfy the missing forward ref; retry below.

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
        schema = _build_ts_schema(module_name, module_models)
        (out_dir / f"{module_name}Schema.gen.ts").write_text(schema)
        print(f"  ✅ {module_name}Schema.gen.ts")

        generated.append(module_name)

    _write_all_models(generated, frontend_src)
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
        "# AUTO-GENERATED — do not edit. Run `safem generate` to update.",
        f'"""Standard CRUD API for the {module_name} module."""',
    ]
    if len(models) > 1:
        lines.append("from fastapi import APIRouter")
    lines += [
        "from safemantiq_framework.crud import create_crud_router",
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
    from sqlalchemy.inspection import inspect as sa_inspect

    lines = [
        "// AUTO-GENERATED — do not edit. Run `safem generate` to update.",
        "import type { ModelDef } from '@safemantiq/ui';",
        "",
        f"export const {module_name}Models: ModelDef[] = [",
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
                field_str = f'{{ key: "{p.key}", label: "{label}", type: "{ts_type}"{reference_extra} }}'
                if p.key in _TIMESTAMP_KEYS:
                    timestamp_fields.append(field_str)
                else:
                    fields.append(field_str)
            fields.extend(timestamp_fields)
        except Exception:
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
            for rel in mapper.relationships:
                if rel.direction != ONETOMANY:
                    continue
                other_cls = rel.mapper.class_
                other_tablename = getattr(other_cls, "__tablename__", other_cls.__name__.lower())
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
        except Exception:
            pass

        model_label = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', model_name)
        # Extra UI config declared on the model via __safem_ui__ = {"listViewType": "gallery", ...}
        safem_ui: dict = getattr(model, "__safem_ui__", {}) or {}
        extra_props = []
        if "listViewType" in safem_ui:
            extra_props.append(f'    listViewType: "{safem_ui["listViewType"]}",')

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

    lines += ["];", "", f"export default {module_name}Models;", ""]
    return "\n".join(lines)


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
# allModels.gen.ts writer
# ---------------------------------------------------------------------------

def _write_all_models(modules: list[str], frontend_src: Path) -> None:
    pages_dir = frontend_src / "pages"
    valid = [m for m in modules if (pages_dir / m / f"{m}Schema.gen.ts").exists()]
    lines = [
        "// AUTO-GENERATED — do not edit. Run `safem generate` to update.",
        "import type { ModelDef } from '@safemantiq/ui';",
        "",
    ]
    for mod in valid:
        lines.append(f'import {{ {mod}Models }} from "./pages/{mod}/{mod}Schema.gen";')
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
