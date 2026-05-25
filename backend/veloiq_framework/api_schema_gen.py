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
        schema_lines += ["];", "", f"export default {module_name}Models;", ""]
        (out_dir / f"{module_name}Schema.gen.ts").write_text("\n".join(schema_lines))
        print(f"  ✅ {module_name}Schema.gen.ts")

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
