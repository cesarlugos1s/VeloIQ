"""veloiq explorer — interactive TUI launched by ``veloiq`` with no arguments."""
from __future__ import annotations

import curses
import json
import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

# ── Color pair indices ────────────────────────────────────────────────────────
_C_HDR  = 1   # white on blue — header bar
_C_SEL  = 2   # black on cyan — selected row
_C_OK   = 3   # green — check marks
_C_WARN = 4   # yellow — key hints / warnings
_C_TTL  = 5   # cyan — section titles
_C_ERR  = 6   # red — missing / not configured


# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class FieldInfo:
    key: str
    label: str
    type: str
    required: bool = False
    reference: Optional[str] = None
    read_roles: list[str] = field(default_factory=list)
    write_roles: list[str] = field(default_factory=list)
    read_only: bool = False
    default: Optional[Any] = None
    options: list = field(default_factory=list)
    description: Optional[str] = None
    show_view_type: Optional[str] = None
    edit_view_type: Optional[str] = None


@dataclass
class RelationInfo:
    resource: str
    target_key: str
    label: str
    is_recursive: bool = False
    other_resource: Optional[str] = None   # M2M remote resource or recursive peer
    other_key: Optional[str] = None        # FK column on link-table side (M2M)
    resource_path: Optional[str] = None    # link-table resource name (M2M only)


@dataclass
class ModelInfo:
    name: str
    label: str
    resource: str
    pk_field: str
    module_name: str
    fields: list[FieldInfo] = field(default_factory=list)
    relations: list[RelationInfo] = field(default_factory=list)
    is_named_query: bool = False
    in_dashboard: bool = False
    dashboard_tab: Optional[str] = None
    in_search: bool = False
    permissions: dict[str, list[str]] = field(default_factory=dict)
    has_rebac: bool = False
    custom_pages: set[str] = field(default_factory=set)  # e.g. {"list", "show"}
    models_path: Optional[Path] = None                   # absolute path to models.py
    description: Optional[str] = None                    # from class docstring
    title_fields: list[str] = field(default_factory=list)  # __veloiq_ui__["titleFields"]
    referenced_by: list = field(default_factory=list)    # [(model_name, field_key, resource)]


@dataclass
class ModuleInfo:
    name: str
    path: Path
    models: list[ModelInfo] = field(default_factory=list)


@dataclass
class ExtInfo:
    name: str
    installed: bool = False   # entry point present in this venv
    enabled: bool = False     # listed in the app's veloiq.toml


@dataclass
class AppData:
    name: str
    root: Path
    modules: list[ModuleInfo] = field(default_factory=list)
    search_models: list[str] = field(default_factory=list)
    search_fields: list[str] = field(default_factory=list)
    db_url_sanitized: str = "(not configured)"
    auth_disabled: bool = False
    generate_run: bool = False
    extensions: list[ExtInfo] = field(default_factory=list)

    @property
    def all_models(self) -> list[ModelInfo]:
        return [m for mod in self.modules for m in mod.models]


# ── Project discovery ─────────────────────────────────────────────────────────

def _find_project_root() -> Optional[Path]:
    cwd = Path.cwd().resolve()
    for directory in [cwd, *cwd.parents]:
        if (directory / "backend" / "app" / "modules").exists():
            return directory
        if (directory / "app" / "modules").exists():
            parent = directory.parent
            return parent if (parent / "backend").exists() else directory
    return None


# ── Data loading ──────────────────────────────────────────────────────────────

def _load_app_data(root: Path) -> AppData:
    data = AppData(name=root.name, root=root)
    frontend_src = root / "frontend" / "src"
    data.generate_run = (frontend_src / "allModels.gen.ts").exists()

    for path in [root / "config" / "search.json", root / "backend" / "config" / "search.json"]:
        if path.exists():
            try:
                sc = json.loads(path.read_text())
                data.search_models = sc.get("models", [])
                data.search_fields = sc.get("fields", [])
            except Exception:
                pass
            break

    dashboard_models: set[str] = set()
    dashboard_tabs: dict[str, str] = {}
    prefs_path = root / "backend" / "views_preferences.json"
    if prefs_path.exists():
        try:
            pd = json.loads(prefs_path.read_text())
            for tab in pd.get("user:all", {}).get("__dashboard__", {}).get("tabs", []):
                for cell in tab.get("cells", []):
                    r = cell.get("model", "")
                    if r:
                        dashboard_models.add(r)
                        dashboard_tabs[r] = tab.get("name", "")
        except Exception:
            pass

    env_path = root / "backend" / ".env"
    if env_path.exists():
        try:
            env = env_path.read_text()
            m = re.search(r'^DATABASE_URL\s*=\s*(.+)$', env, re.M)
            if m:
                data.db_url_sanitized = re.sub(r':[^/@:]+@', ':***@', m.group(1).strip().strip('"\''))
            m2 = re.search(r'^VELOIQ_AUTH_DISABLED\s*=\s*(\S+)', env, re.M)
            if m2 and m2.group(1).strip() in ("1", "true", "True", "yes"):
                data.auth_disabled = True
        except Exception:
            pass

    # Extensions: installed (entry points) vs. enabled (veloiq.toml at root).
    try:
        from veloiq_framework.extension_registry import (
            installed_extensions,
            read_enabled_extensions,
        )
        installed = installed_extensions()
        enabled = read_enabled_extensions(root)
        names = sorted({*installed, *enabled})
        data.extensions = [
            ExtInfo(name=n, installed=(n in installed), enabled=(n in enabled))
            for n in names
        ]
    except Exception:
        data.extensions = []

    modules_dir = root / "backend" / "app" / "modules"
    pages_dir = frontend_src / "pages"
    if not modules_dir.exists():
        return data

    search_set = {m.lower() for m in data.search_models}

    for mod_dir in sorted(d for d in modules_dir.iterdir() if d.is_dir() and not d.name.startswith("__")):
        name = mod_dir.name
        mod = ModuleInfo(name=name, path=mod_dir)
        gen_ts = pages_dir / name / f"{name}Schema.gen.ts"
        if gen_ts.exists():
            mod.models = _parse_gen_ts(gen_ts, name, search_set, dashboard_models, dashboard_tabs)
        elif (mod_dir / "models.py").exists():
            mod.models = _scan_models_minimal(mod_dir, name, search_set, dashboard_models, dashboard_tabs)
        _enrich_permissions(mod_dir, mod.models)
        models_py = mod_dir / "models.py"
        for m in mod.models:
            m.models_path = models_py if models_py.exists() else None
        data.modules.append(mod)

    # Read custom_pages.ts and mark which page types each model has scaffolded.
    _enrich_custom_pages(frontend_src, data.all_models)
    # Build reverse-reference index across all app models.
    _enrich_reverse_refs(data.all_models)

    return data


_CUSTOM_MAP_TO_TYPE = {
    "customListComponents":   "list",
    "customShowComponents":   "show",
    "customEditComponents":   "edit",
    "customCreateComponents": "create",
}


def _enrich_reverse_refs(models: list[ModelInfo]) -> None:
    """Populate ModelInfo.referenced_by for each model that other models FK into."""
    resource_map = {m.resource: m for m in models}
    for m in models:
        for fld in m.fields:
            if fld.reference:
                target = resource_map.get(fld.reference)
                if target and target is not m:
                    target.referenced_by.append((m.name, fld.key, m.resource))


def _enrich_custom_pages(frontend_src: Path, models: list) -> None:
    """Read custom_pages.ts and populate ModelInfo.custom_pages for each model."""
    cp = frontend_src / "custom_pages.ts"
    if not cp.exists():
        return
    text = cp.read_text(encoding="utf-8")
    # Build resource → set[page_type] from each map block
    resource_types: dict[str, set[str]] = {}
    block_re = re.compile(
        r'export const (custom\w+Components)[^=]+=\s*\{([^}]*)\}',
        re.MULTILINE | re.DOTALL,
    )
    entry_re = re.compile(r'"([^"]+)"\s*:')
    for bm in block_re.finditer(text):
        page_type = _CUSTOM_MAP_TO_TYPE.get(bm.group(1))
        if not page_type:
            continue
        for em in entry_re.finditer(bm.group(2)):
            resource = em.group(1)
            resource_types.setdefault(resource, set()).add(page_type)
    for model in models:
        if model.resource in resource_types:
            model.custom_pages = resource_types[model.resource]


def _infer_relation_type(r: RelationInfo) -> str:
    if r.is_recursive:
        return "self-ref"
    if r.resource_path and r.other_key:
        return "many-to-many"
    return "one-to-many"


def _parse_gen_ts(path, module_name, search_set, dashboard_models, dashboard_tabs):
    lines = path.read_text(encoding="utf-8").splitlines()
    models = []
    i = 0
    while i < len(lines):
        if lines[i].rstrip() == "  {":
            depth, start = 1, i
            i += 1
            while i < len(lines) and depth > 0:
                s = lines[i].strip()
                if s == "{":
                    depth += 1
                elif s in ("},", "}"):
                    depth -= 1
                i += 1
            m = _parse_model_block(
                "\n".join(lines[start:i]), module_name, search_set, dashboard_models, dashboard_tabs
            )
            if m:
                models.append(m)
        else:
            i += 1
    return models


def _parse_model_block(block, module_name, search_set, dashboard_models, dashboard_tabs):
    def _s(p, flags=0):
        m = re.search(p, block, flags)
        return m.group(1) if m else None

    name = _s(r'name:\s*"([^"]+)"')
    if not name:
        return None
    resource = _s(r'resource:\s*"([^"]+)"') or name.lower()
    label    = _s(r'label:\s*"([^"]+)"') or name
    pk       = _s(r'pkField:\s*"([^"]+)"') or "id"
    # Model-level description lives on its own indented line (4 spaces), distinct from field descriptions
    model_desc = _s(r'^\s{4}description:\s*"([^"]+)"', re.MULTILINE)
    # Developer-configured title fields (set via `veloiq set-title`).
    tf_m = re.search(r'^\s{4}titleFields:\s*\[([^\]]*)\]', block, re.MULTILINE)
    title_fields = (
        [x.strip().strip('"\'') for x in tf_m.group(1).split(",") if x.strip()]
        if tf_m else []
    )

    fields: list[FieldInfo] = []
    relations: list[RelationInfo] = []
    in_fields = in_rel = False

    for line in block.splitlines():
        s = line.strip()
        if "fields: [" in s:
            in_fields, in_rel = True, False
        elif "relations: [" in s:
            in_fields, in_rel = False, True
        elif s in ("],", "]"):
            in_fields = in_rel = False
        elif in_fields and s.startswith("{"):
            km = re.search(r'key:\s*"([^"]+)"', s)
            tm = re.search(r'type:\s*"([^"]+)"', s)
            if km and tm:
                lm  = re.search(r'label:\s*"([^"]+)"', s)
                rm  = re.search(r'reference:\s*"([^"]+)"', s)
                rrm = re.search(r'readRoles:\s*\[([^\]]*)\]', s)
                wrm = re.search(r'writeRoles:\s*\[([^\]]*)\]', s)
                dm  = re.search(r'\bdefault:\s*([^,}]+)', s)
                fld_default = None
                if dm:
                    try:
                        fld_default = json.loads(dm.group(1).strip())
                    except Exception:
                        fld_default = dm.group(1).strip().strip('"')
                om  = re.search(r'\boptions:\s*(\[.*?\])', s)
                fld_options: list = []
                if om:
                    raw_opts = om.group(1)
                    # Try JSON first (plain string arrays); fall back to extracting value: "..." strings
                    try:
                        parsed = json.loads(raw_opts)
                        fld_options = [v["value"] if isinstance(v, dict) else v for v in parsed]
                    except Exception:
                        fld_options = re.findall(r'value:\s*"([^"]+)"', raw_opts) or re.findall(r'"([^"]+)"', raw_opts)
                fdm  = re.search(r'\bdescription:\s*"([^"]+)"', s)
                svtm = re.search(r'showViewType:\s*"([^"]+)"', s)
                evtm = re.search(r'editViewType:\s*"([^"]+)"', s)
                fields.append(FieldInfo(
                    key=km.group(1),
                    label=lm.group(1) if lm else km.group(1),
                    type=tm.group(1),
                    required="required: true" in s,
                    reference=rm.group(1) if rm else None,
                    read_roles=[x.strip(' "') for x in rrm.group(1).split(",") if x.strip()] if rrm else [],
                    write_roles=[x.strip(' "') for x in wrm.group(1).split(",") if x.strip()] if wrm else [],
                    read_only="readOnly: true" in s,
                    default=fld_default,
                    options=fld_options,
                    description=fdm.group(1) if fdm else None,
                    show_view_type=svtm.group(1) if svtm else None,
                    edit_view_type=evtm.group(1) if evtm else None,
                ))
        elif in_rel and s.startswith("{"):
            res_m  = re.search(r'resource:\s*"([^"]+)"', s)
            tk_m   = re.search(r'targetKey:\s*"([^"]+)"', s)
            lm     = re.search(r'label:\s*"([^"]+)"', s)
            or_m   = re.search(r'otherResource:\s*"([^"]+)"', s)
            ok_m   = re.search(r'otherKey:\s*"([^"]+)"', s)
            rp_m   = re.search(r'resourcePath:\s*"([^"]+)"', s)
            if res_m and tk_m:
                relations.append(RelationInfo(
                    resource=res_m.group(1),
                    target_key=tk_m.group(1),
                    label=lm.group(1) if lm else res_m.group(1),
                    is_recursive="isRecursive: true" in s,
                    other_resource=or_m.group(1) if or_m else None,
                    other_key=ok_m.group(1) if ok_m else None,
                    resource_path=rp_m.group(1) if rp_m else None,
                ))

    return ModelInfo(
        name=name, label=label, resource=resource, pk_field=pk,
        module_name=module_name, fields=fields, relations=relations,
        is_named_query="isNamedQuery: true" in block,
        in_dashboard=resource in dashboard_models,
        dashboard_tab=dashboard_tabs.get(resource),
        in_search=name.lower() in search_set,
        description=model_desc,
        title_fields=title_fields,
    )


def _parse_titlefields_py(block: str) -> list[str]:
    """Extract __veloiq_ui__['titleFields'] from a model class's Python source block."""
    m = re.search(r'__veloiq_ui__\s*(?::[^=]+)?=\s*(\{[^}]*\})', block)
    if not m:
        return []
    tm = re.search(r'titleFields["\']?\s*:\s*\[([^\]]*)\]', m.group(1))
    if not tm:
        return []
    return [x.strip().strip('"\'') for x in tm.group(1).split(",") if x.strip()]


_TITLE_TOKEN_LABELS = {"__model_name__": "[Model name]", "__pk__": "[Primary key]"}


def _title_field_display(token: str) -> str:
    """Readable label for a stored title token (special tokens shown bracketed)."""
    return _TITLE_TOKEN_LABELS.get(token, token)


def _scan_models_minimal(mod_dir, module_name, search_set, dashboard_models, dashboard_tabs):
    text = (mod_dir / "models.py").read_text(encoding="utf-8")
    class_starts = [mm.start() for mm in re.finditer(r'^class\s+\w+\s*\(', text, re.M)]
    models = []
    for m in re.finditer(r'^class\s+(\w+)\s*\([^)]*table\s*=\s*True', text, re.M):
        name = m.group(1)
        after = text[m.start(): m.start() + 300]
        # Class body spans up to the next top-level class declaration (or EOF).
        nexts = [p for p in class_starts if p > m.start()]
        block = text[m.start(): min(nexts) if nexts else len(text)]
        tn = re.search(r'__tablename__\s*=\s*["\']([^"\']+)["\']', after)
        resource = tn.group(1) if tn else name.lower()
        # Skip link/junction tables (M2M intermediaries) — detected
        # deterministically via the ORM's MANYTOMANY secondary tables.
        try:
            from veloiq_framework.api_schema_gen import _is_link_model
            import importlib
            mod = importlib.import_module(f"app.modules.{module_name}.models")
            cls = getattr(mod, name, None)
            if cls is not None and _is_link_model(cls):
                continue
        except Exception:
            pass
        models.append(ModelInfo(
            name=name,
            label=re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', name),
            resource=resource, pk_field="id", module_name=module_name,
            in_dashboard=resource in dashboard_models,
            dashboard_tab=dashboard_tabs.get(resource),
            in_search=name.lower() in search_set,
            title_fields=_parse_titlefields_py(block),
        ))
    return models


def _enrich_permissions(mod_dir, models):
    mf = mod_dir / "models.py"
    if not mf.exists():
        return
    text = mf.read_text(encoding="utf-8")
    for m in re.finditer(r'@model_access\(([^)]+)\)\s*\nclass\s+(\w+)', text, re.M):
        perms: dict[str, list[str]] = {}
        for p in re.finditer(r'(\w+)\s*=\s*\[([^\]]*)\]', m.group(1)):
            acts = [a.strip(' "\'') for a in p.group(2).split(',') if a.strip()]
            if acts:
                perms[p.group(1)] = acts
        for model in models:
            if model.name == m.group(2):
                model.permissions = perms
    for m in re.finditer(r'@rebac\([^)]*\)\s*\nclass\s+(\w+)', text, re.M):
        for model in models:
            if model.name == m.group(1):
                model.has_rebac = True


# ── TUI ───────────────────────────────────────────────────────────────────────

@dataclass
class _Frame:
    screen: str
    cursor: int = 0
    scroll: int = 0
    context: Any = None
    filter_str: str = ""


class Explorer:
    def __init__(self, data: AppData):
        self.data = data
        self.nav: list[_Frame] = [_Frame("home")]

    @property
    def _f(self) -> _Frame:
        return self.nav[-1]

    def run(self) -> Optional[str]:
        try:
            return curses.wrapper(self._main)
        except KeyboardInterrupt:
            return None

    def _main(self, stdscr) -> Optional[str]:
        curses.start_color()
        curses.use_default_colors()
        curses.init_pair(_C_HDR,  curses.COLOR_WHITE,  curses.COLOR_BLUE)
        curses.init_pair(_C_SEL,  curses.COLOR_BLACK,  curses.COLOR_CYAN)
        curses.init_pair(_C_OK,   curses.COLOR_GREEN,  -1)
        curses.init_pair(_C_WARN, curses.COLOR_YELLOW, -1)
        curses.init_pair(_C_TTL,  curses.COLOR_CYAN,   -1)
        curses.init_pair(_C_ERR,  curses.COLOR_RED,    -1)
        curses.curs_set(0)
        stdscr.keypad(True)

        while True:
            stdscr.clear()
            max_y, max_x = stdscr.getmaxyx()
            self._draw(stdscr, max_y, max_x)
            stdscr.refresh()
            try:
                key = stdscr.getch()
            except KeyboardInterrupt:
                return None
            result = self._handle(key, stdscr, max_y, max_x)
            if result is not None:
                return result or None

    # ── Safe write helper ─────────────────────────────────────────────────────

    def _w(self, stdscr, row, col, text, attr=0):
        max_y, max_x = stdscr.getmaxyx()
        if row < 0 or row >= max_y or col < 0 or col >= max_x:
            return
        try:
            stdscr.addstr(row, col, str(text)[: max_x - col], attr)
        except curses.error:
            pass

    def _divider(self, stdscr, row, max_x):
        self._w(stdscr, row, 2, "─" * max(0, max_x - 4), curses.A_DIM)

    # ── Top-level draw dispatcher ─────────────────────────────────────────────

    def _draw(self, stdscr, max_y, max_x):
        d = self.data
        # Header bar
        hdr_left  = f"  VeloIQ Explorer  ·  {d.name}"
        hdr_right = f"  {len(d.modules)} module(s) · {len(d.all_models)} model(s)  "
        pad = max(0, max_x - len(hdr_left) - len(hdr_right))
        self._w(stdscr, 0, 0, (hdr_left + " " * pad + hdr_right)[:max_x],
                curses.color_pair(_C_HDR) | curses.A_BOLD)

        screen = self._f.screen
        if screen == "home":
            self._draw_home(stdscr, max_y, max_x)
        elif screen == "modules":
            self._draw_modules(stdscr, max_y, max_x)
        elif screen == "module":
            self._draw_module_detail(stdscr, max_y, max_x)
        elif screen == "model":
            self._draw_model_detail(stdscr, max_y, max_x)
        elif screen == "search":
            self._draw_search(stdscr, max_y, max_x)
        elif screen == "extensions":
            self._draw_extensions(stdscr, max_y, max_x)

    # ── Home ──────────────────────────────────────────────────────────────────

    def _draw_home(self, stdscr, max_y, max_x):
        d = self.data
        f = self._f
        r = 2

        self._w(stdscr, r, 2, "App Summary", curses.color_pair(_C_TTL) | curses.A_BOLD)
        r += 1
        self._divider(stdscr, r, max_x)
        r += 1

        def kv(key, val, val_attr=0):
            nonlocal r
            self._w(stdscr, r, 4, f"{key:<14}", curses.A_DIM)
            self._w(stdscr, r, 18, str(val), val_attr)
            r += 1

        kv("Project", d.name)
        kv("Database", d.db_url_sanitized)
        auth_val  = "disabled" if d.auth_disabled else "enabled"
        auth_attr = curses.color_pair(_C_ERR) if d.auth_disabled else curses.color_pair(_C_OK) | curses.A_BOLD
        kv("Auth", auth_val, auth_attr)
        mod_names = "  ·  ".join(m.name for m in d.modules) or "(none)"
        kv("Modules", f"{len(d.modules)}   {mod_names}")
        kv("Models", f"{len(d.all_models)} app model(s)")
        dash_n = sum(1 for m in d.all_models if m.in_dashboard)
        kv("Dashboard", f"{dash_n} model(s) configured")
        srch_n = sum(1 for m in d.all_models if m.in_search)
        kv("Search", f"{srch_n} model(s) · {len(d.search_fields)} field(s)")
        ext_on = sum(1 for e in d.extensions if e.enabled)
        kv("Extensions", f"{ext_on} enabled · {len(d.extensions)} installed")

        if not d.generate_run:
            r += 1
            self._w(stdscr, r, 4,
                    "⚠  Run `veloiq generate` to enable full field/relation introspection.",
                    curses.color_pair(_C_WARN))
            r += 1

        r += 1
        self._divider(stdscr, r, max_x)
        r += 1

        menu = [
            ("1", "Browse Modules & Models"),
            ("2", "Search Configuration"),
            ("3", "Manage Extensions"),
            ("i", "Import schema from existing database"),
            ("g", "Run: veloiq generate"),
            ("c", "Run: veloiq check  (health report)"),
            ("b", "Run: veloiq build  (build frontend for production)"),
            ("m", "Run: veloiq migrate  (upgrade app to current framework)"),
            ("u", "Run: veloiq db upgrade  (apply Alembic migrations)"),
            ("q", "Quit"),
        ]
        for i, (key, label) in enumerate(menu):
            is_sel = i == f.cursor
            attr   = curses.color_pair(_C_SEL) if is_sel else 0
            prefix = " ► " if is_sel else "   "
            self._w(stdscr, r, 2, f"{prefix}[{key}]  {label}", attr)
            r += 1

        self._w(stdscr, max_y - 2, 0,
                "  ↑↓ / jk  navigate    Enter  select    i  import-schema    g  generate    b  build    m  migrate    u  db-upgrade    q  quit",
                curses.color_pair(_C_WARN))

    # ── Extensions ────────────────────────────────────────────────────────────

    def _draw_extensions(self, stdscr, max_y, max_x):
        d = self.data
        f = self._f
        r = 2
        self._w(stdscr, r, 2, "Extensions  (veloiq.toml — explicit opt-in)",
                curses.color_pair(_C_TTL) | curses.A_BOLD)
        r += 1
        self._divider(stdscr, r, max_x)
        r += 1

        if not d.extensions:
            self._w(stdscr, r, 4,
                    "(no VeloIQ extensions installed in this environment)", curses.A_DIM)
            self._w(stdscr, max_y - 2, 0,
                    "  b  back    q  quit",
                    curses.color_pair(_C_WARN))
            self._w(stdscr, max_y - 1, 0,
                    "  pip install an extension, then it appears here",
                    curses.color_pair(_C_WARN))
            return

        list_start = r
        list_h = max_y - list_start - 2
        if f.cursor < f.scroll:
            f.scroll = f.cursor
        elif f.cursor >= f.scroll + list_h:
            f.scroll = f.cursor - list_h + 1

        for i in range(list_h):
            idx = f.scroll + i
            if idx >= len(d.extensions):
                break
            ext    = d.extensions[idx]
            is_sel = idx == f.cursor
            attr   = curses.color_pair(_C_SEL) if is_sel else 0
            prefix = " ► " if is_sel else "   "
            if ext.enabled and ext.installed:
                state, s_attr = "✓ enabled ", curses.color_pair(_C_OK) | curses.A_BOLD
            elif ext.installed:
                state, s_attr = "✗ disabled", curses.color_pair(_C_ERR)
            else:
                state, s_attr = "! missing ", curses.color_pair(_C_WARN)
            self._w(stdscr, list_start + i, 2, f"{prefix}{ext.name:<24}", attr)
            if not is_sel:
                self._w(stdscr, list_start + i, 2 + len(prefix) + 24, state, s_attr)

        self._w(stdscr, max_y - 2, 0,
                "  ↑↓ / jk  navigate    b  back    q  quit",
                curses.color_pair(_C_WARN))
        self._w(stdscr, max_y - 1, 0,
                "  Enter / e  toggle    g  generate",
                curses.color_pair(_C_WARN))

    # ── Module list ───────────────────────────────────────────────────────────

    def _draw_modules(self, stdscr, max_y, max_x):
        d = self.data
        f = self._f
        r = 2

        self._w(stdscr, r, 2, f"Modules ({len(d.modules)})",
                curses.color_pair(_C_TTL) | curses.A_BOLD)
        r += 1
        self._divider(stdscr, r, max_x)
        r += 1

        list_start = r
        list_h = max_y - list_start - 2

        if f.cursor < f.scroll:
            f.scroll = f.cursor
        elif f.cursor >= f.scroll + list_h:
            f.scroll = f.cursor - list_h + 1

        for i in range(list_h):
            idx = f.scroll + i
            if idx >= len(d.modules):
                break
            mod    = d.modules[idx]
            is_sel = idx == f.cursor
            attr   = curses.color_pair(_C_SEL) if is_sel else 0
            prefix = " ► " if is_sel else "   "
            dash_n = sum(1 for m in mod.models if m.in_dashboard)
            srch_n = sum(1 for m in mod.models if m.in_search)
            line = (f"{mod.name:<20}  {len(mod.models)} model(s)"
                    f"   dashboard:{dash_n}  search:{srch_n}")
            self._w(stdscr, list_start + i, 2, prefix + line, attr)

        self._w(stdscr, max_y - 2, 0,
                "  ↑↓ / jk  navigate    Enter  view    b  back    q  quit",
                curses.color_pair(_C_WARN))
        self._w(stdscr, max_y - 1, 0,
                "  m  add-model    a  add-module    g  generate",
                curses.color_pair(_C_WARN))

    # ── Module detail ─────────────────────────────────────────────────────────

    def _draw_module_detail(self, stdscr, max_y, max_x):
        d = self.data
        f = self._f
        mod: ModuleInfo = f.context
        if mod is None:
            return
        r = 2

        try:
            rel = mod.path.relative_to(d.root)
        except ValueError:
            rel = mod.path
        self._w(stdscr, r, 2, f"Module: {mod.name}", curses.color_pair(_C_TTL) | curses.A_BOLD)
        self._w(stdscr, r, 2 + 8 + len(mod.name), f"  ({rel})", curses.A_DIM)
        r += 1
        self._divider(stdscr, r, max_x)
        r += 1

        filtered = [m for m in mod.models if not f.filter_str
                    or f.filter_str in m.name.lower() or f.filter_str in m.resource.lower()]

        if f.filter_str:
            fhint = f"  Filter: \"{f.filter_str}\"  ({len(filtered)}/{len(mod.models)} models)  [/] change  [x] clear"
            self._w(stdscr, r, 2, fhint, curses.color_pair(_C_WARN))
            r += 1

        list_start = r
        list_h = max_y - list_start - 2
        f.cursor = max(0, min(f.cursor, max(0, len(filtered) - 1)))

        if f.cursor < f.scroll:
            f.scroll = f.cursor
        elif f.cursor >= f.scroll + list_h:
            f.scroll = f.cursor - list_h + 1

        if not mod.models:
            self._w(stdscr, r, 4, "(no models — run veloiq generate)", curses.A_DIM)
        elif not filtered:
            self._w(stdscr, r, 4, f'(no models match "{f.filter_str}")', curses.A_DIM)
        else:
            for i in range(list_h):
                idx = f.scroll + i
                if idx >= len(filtered):
                    break
                model  = filtered[idx]
                is_sel = idx == f.cursor
                attr   = curses.color_pair(_C_SEL) if is_sel else 0
                prefix = " ► " if is_sel else "   "
                dash_icon = "✓" if model.in_dashboard else "✗"
                srch_icon = "✓" if model.in_search    else "✗"
                nq_tag    = "  [named query]" if model.is_named_query else ""
                name_part = f"{model.name:<26}  resource: {model.resource:<22}"
                col = 2 + len(prefix) + len(name_part)
                self._w(stdscr, list_start + i, 2, prefix + name_part, attr)
                if not is_sel:
                    d_attr = curses.color_pair(_C_OK)  if model.in_dashboard else curses.color_pair(_C_ERR)
                    s_attr = curses.color_pair(_C_OK)  if model.in_search    else curses.color_pair(_C_ERR)
                    self._w(stdscr, list_start + i, col,      "dashboard:", curses.A_DIM)
                    self._w(stdscr, list_start + i, col + 10, dash_icon, d_attr)
                    self._w(stdscr, list_start + i, col + 12, "  search:", curses.A_DIM)
                    self._w(stdscr, list_start + i, col + 21, srch_icon, s_attr)
                    self._w(stdscr, list_start + i, col + 23, nq_tag, curses.A_DIM)

        filter_hint = "    [/] filter" if not f.filter_str else "    [x] clear filter"
        self._w(stdscr, max_y - 2, 0,
                f"  ↑↓ / jk  navigate    Enter  view model    b  back    q  quit{filter_hint}",
                curses.color_pair(_C_WARN))
        self._w(stdscr, max_y - 1, 0,
                "  m  add-model    g  generate",
                curses.color_pair(_C_WARN))

    # ── Model detail ──────────────────────────────────────────────────────────

    def _draw_model_detail(self, stdscr, max_y, max_x):
        f = self._f
        model: ModelInfo = f.context
        if model is None:
            return

        A    = curses.A_NORMAL
        DIM  = curses.A_DIM
        BOLD = curses.A_BOLD
        OK   = curses.color_pair(_C_OK)  | curses.A_BOLD
        ERR  = curses.color_pair(_C_ERR)
        TTL  = curses.color_pair(_C_TTL) | curses.A_BOLD

        lines: list[tuple[str, int]] = []

        lines.append((f"Model: {model.name}  ·  module: {model.module_name}  ·  resource: {model.resource}", TTL))
        if model.is_named_query:
            lines.append(("  [named query]", DIM))
        if model.models_path:
            try:
                rel = model.models_path.relative_to(self.data.root)
            except ValueError:
                rel = model.models_path
            lines.append((f"  {rel}", DIM))
        if model.description:
            lines.append((f"  {model.description}", DIM))
        lines.append(("─" * max(0, max_x - 4), DIM))

        _TS = {"created_at", "updated_at", "creation_date", "modification_date"}

        # FK reference fields shown separately in Relations; exclude them from Fields display
        fk_fields = [fld for fld in model.fields if fld.reference]
        plain_fields = [fld for fld in model.fields if not fld.reference]

        if model.fields:
            lines.append((f"Fields ({len(plain_fields)}):", BOLD))
            for fld in plain_fields:
                parts = [f"  {fld.key:<22}  {fld.type:<10}"]
                if fld.read_only:
                    parts.append("[read-only]  ")
                elif fld.required:
                    parts.append("required  ")
                if fld.key in _TS:
                    parts.append("(timestamp)")
                if fld.options:
                    parts.append(f"[{' | '.join(str(v) for v in fld.options)}]  ")
                if fld.default is not None:
                    parts.append(f"default: {json.dumps(fld.default)}  ")
                if fld.read_roles:
                    parts.append(f"read:{','.join(fld.read_roles)}")
                if fld.write_roles:
                    parts.append(f"write:{','.join(fld.write_roles)}")
                lines.append(("".join(parts), DIM if fld.key in _TS else A))
                if fld.description:
                    lines.append((f"    └ {fld.description}", DIM))
        else:
            lines.append(("Fields: (run veloiq generate to see fields)", DIM))

        lines.append(("─" * max(0, max_x - 4), DIM))

        all_rels = list(model.relations)
        total_rel_count = len(all_rels) + len(fk_fields)
        if total_rel_count > 0:
            lines.append((f"Relations ({total_rel_count}):", BOLD))
            for rel in all_rels:
                rtype = _infer_relation_type(rel)
                extra = ""
                if rtype == "self-ref":
                    extra = "  [tree]"
                elif rtype == "many-to-many" and rel.resource_path:
                    extra = f"  link: {rel.resource_path}"
                lines.append((
                    f"  {rel.label:<22}  {rtype:<14} → {rel.resource}  (via {rel.target_key}){extra}",
                    A,
                ))
            for fld in fk_fields:
                label = fld.label if fld.label != fld.key else fld.key.replace("_id", "").replace("_", " ").title()
                lines.append((
                    f"  {label:<22}  {'many-to-one':<14} → {fld.reference}  (via {fld.key})",
                    A,
                ))
        else:
            lines.append(("Relations: none", DIM))

        lines.append(("─" * max(0, max_x - 4), DIM))

        if model.referenced_by:
            lines.append((f"Referenced by ({len(model.referenced_by)}):", BOLD))
            for (mname, fkey, _mres) in model.referenced_by:
                lines.append((f"  {mname:<22}  via {fkey}", A))
        else:
            lines.append(("Referenced by: none (no FK points to this model)", DIM))

        lines.append(("─" * max(0, max_x - 4), DIM))
        lines.append(("Configuration:", BOLD))

        dash_val  = f"✓  tab \"{model.dashboard_tab}\"" if model.in_dashboard else "✗  not on dashboard"
        lines.append((f"  Dashboard    {dash_val}", OK if model.in_dashboard else ERR))
        srch_val  = "✓  enrolled" if model.in_search else "✗  not enrolled"
        lines.append((f"  Search       {srch_val}", OK if model.in_search else ERR))

        if model.title_fields:
            ttl_val = "✓  " + " + ".join(_title_field_display(t) for t in model.title_fields)
            lines.append((f"  Title        {ttl_val}", OK))
        else:
            lines.append(("  Title        auto (first text field)", DIM))

        if model.permissions:
            pstr = "  ".join(f"{role}: [{', '.join(acts)}]" for role, acts in model.permissions.items())
            lines.append((f"  Permissions  {pstr}", A))
        else:
            lines.append(("  Permissions  none (inherits global roles)", DIM))

        rebac_val = "✓  enabled" if model.has_rebac else "✗  none"
        lines.append((f"  ReBAC        {rebac_val}", OK if model.has_rebac else DIM))

        if model.custom_pages:
            ordered = [t for t in ("list", "show", "edit", "create") if t in model.custom_pages]
            lines.append((f"  Custom pages ✓  {' · '.join(ordered)}", OK))
        else:
            lines.append(("  Custom pages –  none", DIM))

        lines.append(("─" * max(0, max_x - 4), DIM))
        lines.append(("Endpoints:", BOLD))
        res = model.resource
        if model.is_named_query:
            lines.append((f"  GET    /{res}            named query (read-only)", DIM))
        else:
            _routes = [
                ("GET",    f"/{res}",         "list"),
                ("POST",   f"/{res}",         "create"),
                ("GET",    f"/{res}/{{id}}",  "show"),
                ("PATCH",  f"/{res}/{{id}}",  "update"),
                ("DELETE", f"/{res}/{{id}}",  "delete"),
            ]
            for _method, _path, _action in _routes:
                lines.append((f"  {_method:<7}  {_path:<32}  {_action}", A))
            if model.permissions:
                all_roles = sorted({r for roles in model.permissions.values() for r in roles})
                lines.append((f"  Access   restricted to: {', '.join(all_roles)}", A))
            elif self.data.auth_disabled:
                lines.append(("  Access   auth disabled — open to all", curses.color_pair(_C_ERR)))
            else:
                lines.append(("  Access   all authenticated users", DIM))

        lines.append(("─" * max(0, max_x - 4), DIM))

        # Render with scroll
        content_h = max_y - 3
        total     = len(lines)
        max_scr   = max(0, total - content_h)
        f.scroll   = max(0, min(f.scroll, max_scr))

        for i in range(content_h):
            idx = f.scroll + i
            if idx >= total:
                break
            text, attr = lines[idx]
            self._w(stdscr, 1 + i, 2, text, attr)

        self._w(stdscr, max_y - 2, 0,
                "  ↑↓ scroll    b  back    q  quit",
                curses.color_pair(_C_WARN))
        if total > content_h:
            self._w(stdscr, max_y - 2, max_x - 22, f"  ↑↓ scroll ({f.scroll+1}/{total})", DIM)

        # Build contextual action hints
        actions: list[str] = []
        if not model.is_named_query:
            actions.append("[d] add-dashboard" if not model.in_dashboard else "[D] rm-dashboard")
            actions.append("[s] add-search"    if not model.in_search    else "[S] rm-search")
        if model.custom_pages:
            ordered = [t for t in ("list", "show", "edit", "create") if t in model.custom_pages]
            scaffold_hint = f"[p] scaffold-page ({' '.join(t + ' ✓' for t in ordered)})"
        else:
            scaffold_hint = "[p] scaffold-page"
        follow_targets = [rel.resource for rel in model.relations if not rel.is_recursive]
        follow_targets += [fld.reference for fld in model.fields if fld.reference and fld.reference not in follow_targets]
        if follow_targets:
            actions.append("[f] follow →")
        if not model.is_named_query:
            actions.append("[a] add-field")
            actions.append("[r] add-relation")
            actions.append("[t] set-title")
        actions += [scaffold_hint, "[g] generate"]
        self._w(stdscr, max_y - 1, 0, "  " + "    ".join(actions), curses.color_pair(_C_WARN))

    # ── Search config ─────────────────────────────────────────────────────────

    def _draw_search(self, stdscr, max_y, max_x):
        d = self.data
        f = self._f

        A    = curses.A_NORMAL
        DIM  = curses.A_DIM
        BOLD = curses.A_BOLD
        OK   = curses.color_pair(_C_OK)  | curses.A_BOLD
        ERR  = curses.color_pair(_C_ERR)
        TTL  = curses.color_pair(_C_TTL) | curses.A_BOLD

        lines: list[tuple[str, int]] = []
        lines.append(("Search Configuration  (config/search.json)", TTL))
        lines.append(("─" * max(0, max_x - 4), DIM))

        lines.append((f"Enrolled models ({len(d.search_models)}):", BOLD))
        if d.search_models:
            for name in d.search_models:
                lines.append((f"  ✓  {name}", OK))
        else:
            lines.append(("  (none)", DIM))

        lines.append(("─" * max(0, max_x - 4), DIM))
        lines.append((f"Searchable fields ({len(d.search_fields)}):", BOLD))
        if d.search_fields:
            lines.append(("  " + "  ·  ".join(d.search_fields), A))
        else:
            lines.append(("  (none — all string fields in enrolled models will be searched)", DIM))

        lines.append(("─" * max(0, max_x - 4), DIM))
        enrolled_lower = {e.lower() for e in d.search_models}
        not_enrolled = sorted(
            m.name for m in d.all_models
            if not m.is_named_query and m.name.lower() not in enrolled_lower
        )
        lines.append((f"Not yet enrolled ({len(not_enrolled)}):", BOLD))
        if not_enrolled:
            for name in not_enrolled:
                lines.append((f"  ✗  {name}", ERR))
        else:
            lines.append(("  (all app models are enrolled)", DIM))

        lines.append(("─" * max(0, max_x - 4), DIM))

        content_h = max_y - 3
        total     = len(lines)
        max_scr   = max(0, total - content_h)
        f.scroll   = max(0, min(f.scroll, max_scr))

        for i in range(content_h):
            idx = f.scroll + i
            if idx >= total:
                break
            text, attr = lines[idx]
            self._w(stdscr, 1 + i, 2, text, attr)

        self._w(stdscr, max_y - 2, 0,
                "  ↑↓ scroll    b  back    q  quit",
                curses.color_pair(_C_WARN))
        if total > content_h:
            self._w(stdscr, max_y - 2, max_x - 22, f"  ↑↓ scroll ({f.scroll+1}/{total})", DIM)

        self._w(stdscr, max_y - 1, 0,
                "  [a] add-model    [f] add-field    [r] rm-model    [R] rm-field",
                curses.color_pair(_C_WARN))

    # ── Key handling ──────────────────────────────────────────────────────────

    def _handle(self, key, stdscr, max_y, max_x) -> Optional[str]:
        if key == ord('q'):
            return ""

        if key in (ord('b'), curses.KEY_BACKSPACE, 27):
            if len(self.nav) > 1:
                self.nav.pop()
                return None
            return ""

        screen = self._f.screen
        if screen == "home":
            return self._handle_home(key, stdscr, max_y, max_x)
        if screen == "modules":
            return self._handle_modules(key, stdscr, max_y, max_x)
        if screen == "module":
            return self._handle_module(key, stdscr, max_y, max_x)
        if screen == "model":
            return self._handle_model(key, stdscr, max_y, max_x)
        if screen == "search":
            return self._handle_search(key, stdscr, max_y, max_x)
        if screen == "extensions":
            return self._handle_extensions(key, stdscr, max_y, max_x)
        return None

    def _move_cursor(self, f: _Frame, n: int, key: int) -> None:
        if key in (curses.KEY_UP, ord('k')):
            f.cursor = max(0, f.cursor - 1)
        elif key in (curses.KEY_DOWN, ord('j')):
            f.cursor = min(max(0, n - 1), f.cursor + 1)

    def _scroll(self, f: _Frame, key: int) -> None:
        if key in (curses.KEY_UP, ord('k')):
            f.scroll = max(0, f.scroll - 1)
        elif key in (curses.KEY_DOWN, ord('j')):
            f.scroll += 1

    def _handle_home(self, key, stdscr, max_y, max_x) -> Optional[str]:
        f = self._f
        self._move_cursor(f, 9, key)

        if key in (curses.KEY_ENTER, ord('\n'), ord('\r')):
            if f.cursor == 0:
                self.nav.append(_Frame("modules"))
            elif f.cursor == 1:
                self.nav.append(_Frame("search"))
            elif f.cursor == 2:
                self.nav.append(_Frame("extensions"))
            elif f.cursor == 3:
                if self._confirm(stdscr, max_y, max_x, "veloiq import-schema"):
                    return "veloiq import-schema"
            elif f.cursor == 4:
                if self._confirm(stdscr, max_y, max_x, "veloiq generate"):
                    return "veloiq generate"
            elif f.cursor == 5:
                if self._confirm(stdscr, max_y, max_x, "veloiq check"):
                    return "veloiq check"
            elif f.cursor == 6:
                if self._confirm(stdscr, max_y, max_x, "veloiq build"):
                    return "veloiq build"
            elif f.cursor == 7:
                if self._confirm(stdscr, max_y, max_x, "veloiq migrate"):
                    return "veloiq migrate"
            elif f.cursor == 8:
                if self._confirm(stdscr, max_y, max_x, "veloiq db upgrade"):
                    return "veloiq db upgrade"
            elif f.cursor == 9:
                return ""
        elif key == ord('1'):
            self.nav.append(_Frame("modules"))
        elif key == ord('2'):
            self.nav.append(_Frame("search"))
        elif key == ord('3'):
            self.nav.append(_Frame("extensions"))
        elif key == ord('i'):
            if self._confirm(stdscr, max_y, max_x, "veloiq import-schema"):
                return "veloiq import-schema"
        elif key == ord('g'):
            if self._confirm(stdscr, max_y, max_x, "veloiq generate"):
                return "veloiq generate"
        elif key == ord('c'):
            if self._confirm(stdscr, max_y, max_x, "veloiq check"):
                return "veloiq check"
        elif key == ord('b'):
            if self._confirm(stdscr, max_y, max_x, "veloiq build"):
                return "veloiq build"
        elif key == ord('m'):
            if self._confirm(stdscr, max_y, max_x, "veloiq migrate"):
                return "veloiq migrate"
        elif key == ord('u'):
            if self._confirm(stdscr, max_y, max_x, "veloiq db upgrade"):
                return "veloiq db upgrade"
        return None

    def _handle_extensions(self, key, stdscr, max_y, max_x) -> Optional[str]:
        f = self._f
        exts = self.data.extensions
        self._move_cursor(f, len(exts), key)
        if not exts:
            return None
        ext = exts[f.cursor]

        if key in (curses.KEY_ENTER, ord('\n'), ord('\r'), ord('e')):
            if ext.enabled:
                cmd = f"veloiq remove-package {ext.name}"
            elif ext.installed:
                cmd = f"veloiq extend-package {ext.name}"
            else:
                return None  # enabled-but-not-installed: nothing to toggle on
            if self._confirm(stdscr, max_y, max_x, cmd):
                return cmd
        elif key == ord('g'):
            if self._confirm(stdscr, max_y, max_x, "veloiq generate"):
                return "veloiq generate"
        return None

    def _handle_modules(self, key, stdscr, max_y, max_x) -> Optional[str]:
        f = self._f
        mods = self.data.modules
        self._move_cursor(f, len(mods), key)

        if key in (curses.KEY_ENTER, ord('\n'), ord('\r')):
            if mods:
                self.nav.append(_Frame("module", context=mods[f.cursor]))
        elif key == ord('m'):
            model_name = self._get_input(stdscr, max_y, max_x, "New model name (PascalCase)")
            if model_name:
                cmd = f"veloiq add-model {model_name}"
                if self._confirm(stdscr, max_y, max_x, cmd):
                    return cmd
        elif key == ord('a'):
            name = self._get_input(stdscr, max_y, max_x, "New module name")
            if name and self._confirm(stdscr, max_y, max_x, f"veloiq add-module {name}"):
                return f"veloiq add-module {name}"
        elif key == ord('g'):
            if self._confirm(stdscr, max_y, max_x, "veloiq generate"):
                return "veloiq generate"
        return None

    def _handle_module(self, key, stdscr, max_y, max_x) -> Optional[str]:
        f = self._f
        mod: ModuleInfo = f.context
        if mod is None:
            return None
        filtered = [m for m in mod.models if not f.filter_str
                    or f.filter_str in m.name.lower() or f.filter_str in m.resource.lower()]
        self._move_cursor(f, len(filtered), key)

        if key in (curses.KEY_ENTER, ord('\n'), ord('\r')):
            if filtered:
                self.nav.append(_Frame("model", context=filtered[f.cursor]))
        elif key == ord('m'):
            model_name = self._get_input(stdscr, max_y, max_x, "New model name (PascalCase)")
            if model_name:
                cmd = f"veloiq add-model {model_name} --module {mod.name}"
                if self._confirm(stdscr, max_y, max_x, cmd):
                    return cmd
        elif key == ord('/'):
            q = self._get_input(stdscr, max_y, max_x, "Filter models")
            f.filter_str = q.lower()
            f.cursor = 0
        elif key == ord('x'):
            f.filter_str = ""
            f.cursor = 0
        elif key == ord('g'):
            if self._confirm(stdscr, max_y, max_x, "veloiq generate"):
                return "veloiq generate"
        return None

    def _handle_model(self, key, stdscr, max_y, max_x) -> Optional[str]:
        f = self._f
        model: ModelInfo = f.context
        if model is None:
            return None
        self._scroll(f, key)

        if key == ord('d') and not model.in_dashboard:
            cmd = f"veloiq add-dashboard {model.resource}"
            if self._confirm(stdscr, max_y, max_x, cmd):
                return cmd
        elif key == ord('D') and model.in_dashboard:
            cmd = f"veloiq add-dashboard --remove {model.resource}"
            if self._confirm(stdscr, max_y, max_x, cmd):
                return cmd
        elif key == ord('s') and not model.in_search:
            cmd = f"veloiq search add-model {model.name}"
            if self._confirm(stdscr, max_y, max_x, cmd):
                return cmd
        elif key == ord('S') and model.in_search:
            cmd = f"veloiq search remove-model {model.name}"
            if self._confirm(stdscr, max_y, max_x, cmd):
                return cmd
        elif key == ord('p'):
            page_type = self._pick_page_type(stdscr, max_y, max_x, model.custom_pages)
            if page_type:
                cmd = f"veloiq scaffold-page {model.resource} {page_type}"
                if self._confirm(stdscr, max_y, max_x, cmd):
                    return cmd
        elif key == ord('f'):
            self._follow_relation(stdscr, max_y, max_x, model)
        elif key == ord('a') and not model.is_named_query:
            field_name = self._get_input(stdscr, max_y, max_x, "New field name (snake_case)")
            if field_name:
                ftype = self._pick_field_type(stdscr, max_y, max_x)
                if ftype:
                    from veloiq_framework.cli.add_field import _VIEW_TYPE_DEFAULT
                    vtype = self._pick_view_type(
                        stdscr, max_y, max_x, _VIEW_TYPE_DEFAULT.get(ftype)
                    )
                    cmd = f"veloiq add-field {model.resource} {field_name} {ftype}"
                    if vtype:
                        cmd += f" --view-type {vtype}"
                    if self._confirm(stdscr, max_y, max_x, cmd):
                        return cmd
        elif key == ord('r') and not model.is_named_query:
            rel_type = self._pick_relation_type(stdscr, max_y, max_x)
            if rel_type:
                target = self._pick_target_model(stdscr, max_y, max_x, model)
                if target:
                    tgt_class, tgt_resource = target
                    import re as _re
                    default_attr = _re.sub(r'(.)([A-Z][a-z]+)', r'\1_\2',
                                   _re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', tgt_class)).lower()
                    default_back = model.resource + "s"
                    attr = self._get_input(stdscr, max_y, max_x, "Relation attr name", default_attr)
                    if attr:
                        back = self._get_input(stdscr, max_y, max_x, "Back attr name", default_back)
                        if back:
                            cmd = (f"veloiq add-relation {model.name} {tgt_class}"
                                   f" --type {rel_type} --attr {attr} --back-attr {back}")
                            if self._confirm(stdscr, max_y, max_x, cmd):
                                return cmd
        elif key == ord('t') and not model.is_named_query:
            selected = self._pick_title_fields(stdscr, max_y, max_x, model)
            if selected is None:
                return None  # cancelled
            if selected:
                cmd = f"veloiq set-title {model.name} --fields {','.join(selected)}"
            elif model.title_fields:
                cmd = f"veloiq set-title {model.name} --clear"
            else:
                cmd = None
            if cmd and self._confirm(stdscr, max_y, max_x, cmd):
                return cmd
        elif key == ord('g'):
            if self._confirm(stdscr, max_y, max_x, "veloiq generate"):
                return "veloiq generate"
        return None

    def _follow_relation(self, stdscr, max_y, max_x, model: "ModelInfo") -> None:
        """Prompt the user to choose a related model and navigate to it."""
        # Collect unique jump targets: relations first, then FK fields not already covered
        seen: set[str] = set()
        targets: list[tuple[str, str]] = []  # (label, resource)
        for rel in model.relations:
            if not rel.is_recursive and rel.resource not in seen:
                targets.append((rel.label, rel.resource))
                seen.add(rel.resource)
        for fld in model.fields:
            if fld.reference and fld.reference not in seen:
                targets.append((fld.label, fld.reference))
                seen.add(fld.reference)

        if not targets:
            self._w(stdscr, max_y - 1, 0,
                    "  (no related models to navigate to)  press any key",
                    curses.color_pair(_C_WARN) | curses.A_BOLD)
            stdscr.refresh()
            stdscr.getch()
            return

        if len(targets) == 1:
            chosen = targets[0][1]
        else:
            parts = "  ".join(f"[{i+1}] {lbl}" for i, (lbl, _) in enumerate(targets[:9]))
            prompt = f"  Jump to: {parts}  [Esc] cancel "
            self._w(stdscr, max_y - 1, 0, " " * (max_x - 1), curses.color_pair(_C_WARN))
            self._w(stdscr, max_y - 1, 0, prompt[: max_x - 1], curses.color_pair(_C_WARN) | curses.A_BOLD)
            stdscr.refresh()
            k = stdscr.getch()
            if k == 27:
                return
            idx = k - ord('1')
            if not (0 <= idx < len(targets)):
                return
            chosen = targets[idx][1]

        target_model = next((m for m in self.data.all_models if m.resource == chosen), None)
        if target_model:
            self.nav.append(_Frame("model", context=target_model))
        else:
            self._w(stdscr, max_y - 1, 0,
                    f"  Model '{chosen}' not found (extension or auth model?).  press any key",
                    curses.color_pair(_C_WARN) | curses.A_BOLD)
            stdscr.refresh()
            stdscr.getch()

    def _pick_title_fields(self, stdscr, max_y, max_x, model: "ModelInfo") -> Optional[list[str]]:
        """Ordered multi-select of title-field tokens (incl. the special tokens).

        Returns the selected token list (empty = clear / restore auto), or None
        if the user cancelled with Esc.
        """
        # Special tokens first, then the model's own fields.
        options: list[tuple[str, str]] = [
            ("__model_name__", "Model name"),
            ("__pk__", "Primary key"),
        ]
        for f in model.fields:
            options.append((f.key, getattr(f, "label", None) or f.key))

        def _hotkey(i: int) -> Optional[str]:
            if i < 9:
                return str(i + 1)
            j = i - 9
            return chr(ord('a') + j) if j < 26 else None

        keymap: dict[str, str] = {}
        labels: list[str] = []
        for i, (tok, lbl) in enumerate(options):
            hk = _hotkey(i)
            if hk is None:
                break
            keymap[hk] = tok
            labels.append(f"[{hk}] {lbl}")

        selected: list[str] = list(model.title_fields)

        while True:
            sel = " ".join(_title_field_display(t) for t in selected) if selected else "(auto — first text field)"
            line_sel = f"  Title: {sel}"
            line_opts = "  Pick: " + "   ".join(labels)
            line_help = "  [Enter] save   [Backspace] remove last   [Esc] cancel"
            for row, s in ((max_y - 3, line_sel), (max_y - 2, line_opts), (max_y - 1, line_help)):
                self._w(stdscr, row, 0, " " * (max_x - 1), curses.color_pair(_C_WARN))
                self._w(stdscr, row, 0, s[: max_x - 1], curses.color_pair(_C_WARN) | curses.A_BOLD)
            stdscr.refresh()

            k = stdscr.getch()
            if k == 27:                                 # Esc — cancel
                return None
            if k in (10, 13):                           # Enter — save
                return selected
            if k in (8, 127, curses.KEY_BACKSPACE):     # remove last
                if selected:
                    selected.pop()
                continue
            ch = chr(k) if 0 <= k < 256 else ""
            tok = keymap.get(ch)
            if tok and tok not in selected:
                selected.append(tok)

    def _pick_field_type(self, stdscr, max_y, max_x) -> Optional[str]:
        # Row 1 (keys 1–9): text/string display-hint types
        row1 = ["text", "textarea", "richtext", "email", "password", "url", "phone", "uuid", "color"]
        # Row 2 (keys a–l): numeric, date/time, collection, and media types
        row2 = ["integer", "decimal", "number", "boolean", "date", "datetime", "time",
                "select", "multiselect", "json", "file", "image"]

        parts1 = "  ".join(f"[{i + 1}] {t}" for i, t in enumerate(row1))
        parts2 = "  ".join(f"[{chr(ord('a') + i)}] {t}" for i, t in enumerate(row2))
        prompt1 = f"  Text:  {parts1}"
        prompt2 = f"  Other: {parts2}  [Esc] cancel"

        self._w(stdscr, max_y - 2, 0, " " * (max_x - 1), curses.color_pair(_C_WARN))
        self._w(stdscr, max_y - 1, 0, " " * (max_x - 1), curses.color_pair(_C_WARN))
        self._w(stdscr, max_y - 2, 0, prompt1[: max_x - 1], curses.color_pair(_C_WARN) | curses.A_BOLD)
        self._w(stdscr, max_y - 1, 0, prompt2[: max_x - 1], curses.color_pair(_C_WARN) | curses.A_BOLD)
        stdscr.refresh()

        k = stdscr.getch()
        if k == 27:
            return None
        if ord('1') <= k <= ord('9'):
            idx = k - ord('1')
            return row1[idx] if idx < len(row1) else None
        if ord('a') <= k <= ord('z'):
            idx = k - ord('a')
            return row2[idx] if idx < len(row2) else None
        return None

    def _pick_view_type(self, stdscr, max_y, max_x, default: Optional[str]) -> Optional[str]:
        """Ask for an optional frontend view-type override.

        Keys 1–9 → row1, a–k → row2.  Enter = keep default.  Esc = no view type.
        """
        # Row 1 (keys 1–9): most common view types
        row1 = ["textarea", "markdown", "email", "password", "url", "phone", "color", "image-url", "json"]
        # Row 2 (keys a–k): less common / specialised
        row2 = ["currency", "percentage", "progress", "rating", "duration", "code",
                "qrcode", "relative", "truncated-text"]

        parts1 = "  ".join(f"[{i + 1}] {t}" for i, t in enumerate(row1))
        parts2 = "  ".join(f"[{chr(ord('a') + i)}] {t}" for i, t in enumerate(row2))

        if default:
            enter_hint = f"Enter={default}"
        else:
            enter_hint = "Enter=none"
        prompt1 = f"  View type ({enter_hint}): {parts1}"
        prompt2 = f"  {parts2}  [Esc]=no view type"

        self._w(stdscr, max_y - 2, 0, " " * (max_x - 1), curses.color_pair(_C_WARN))
        self._w(stdscr, max_y - 1, 0, " " * (max_x - 1), curses.color_pair(_C_WARN))
        self._w(stdscr, max_y - 2, 0, prompt1[: max_x - 1], curses.color_pair(_C_WARN) | curses.A_BOLD)
        self._w(stdscr, max_y - 1, 0, prompt2[: max_x - 1], curses.color_pair(_C_WARN) | curses.A_BOLD)
        stdscr.refresh()

        k = stdscr.getch()
        if k == 27:           # Esc = explicitly no view type
            return None
        if k in (10, 13):     # Enter = accept default
            return default
        if ord('1') <= k <= ord('9'):
            idx = k - ord('1')
            return row1[idx] if idx < len(row1) else default
        if ord('a') <= k <= ord('z'):
            idx = k - ord('a')
            return row2[idx] if idx < len(row2) else default
        return default

    def _pick_page_type(self, stdscr, max_y, max_x, existing: set[str] = frozenset()) -> Optional[str]:
        def _label(key: str, name: str) -> str:
            mark = " ✓" if name in existing else ""
            return f"[{key}] {name}{mark}"
        prompt = (
            "  Scaffold page type: "
            + "  ".join([_label("1", "list"), _label("2", "show"), _label("3", "edit"), _label("4", "create")])
            + "  [Esc] cancel "
        )
        self._w(stdscr, max_y - 1, 0, " " * (max_x - 1), curses.color_pair(_C_WARN))
        self._w(stdscr, max_y - 1, 0, prompt, curses.color_pair(_C_WARN) | curses.A_BOLD)
        stdscr.refresh()
        k = stdscr.getch()
        return {ord('1'): "list", ord('2'): "show", ord('3'): "edit", ord('4'): "create"}.get(k)

    def _pick_relation_type(self, stdscr, max_y, max_x) -> Optional[str]:
        prompt = "  Relation type: [1] many-to-one (FK)  [2] many-to-many (link table)  [Esc] cancel "
        self._w(stdscr, max_y - 1, 0, " " * (max_x - 1), curses.color_pair(_C_WARN))
        self._w(stdscr, max_y - 1, 0, prompt[: max_x - 1], curses.color_pair(_C_WARN) | curses.A_BOLD)
        stdscr.refresh()
        k = stdscr.getch()
        return {ord('1'): "fk", ord('2'): "many-to-many"}.get(k)

    def _pick_target_model(self, stdscr, max_y, max_x, current: "ModelInfo") -> Optional[tuple[str, str]]:
        """Return (class_name, resource) of the chosen target, or None."""
        others = [m for m in self.data.all_models if m.resource != current.resource and not m.is_named_query]
        if not others:
            self._w(stdscr, max_y - 1, 0,
                    "  (no other models available)  press any key",
                    curses.color_pair(_C_WARN) | curses.A_BOLD)
            stdscr.refresh()
            stdscr.getch()
            return None

        if len(others) <= 9:
            parts = "  ".join(f"[{i+1}] {m.name}" for i, m in enumerate(others))
            prompt = f"  Add relation to: {parts}  [Esc] cancel "
            self._w(stdscr, max_y - 1, 0, " " * (max_x - 1), curses.color_pair(_C_WARN))
            self._w(stdscr, max_y - 1, 0, prompt[: max_x - 1], curses.color_pair(_C_WARN) | curses.A_BOLD)
            stdscr.refresh()
            k = stdscr.getch()
            if k == 27:
                return None
            idx = k - ord('1')
            if not (0 <= idx < len(others)):
                return None
            m = others[idx]
            return (m.name, m.resource)
        else:
            # Too many to list — fall back to text input
            name = self._get_input(stdscr, max_y, max_x, "Target model name")
            if not name:
                return None
            m = next((x for x in self.data.all_models if x.name.lower() == name.lower()
                      or x.resource.lower() == name.lower()), None)
            if m:
                return (m.name, m.resource)
            # Pass through whatever was typed — CLI will validate
            return (name, name.lower())

    def _handle_search(self, key, stdscr, max_y, max_x) -> Optional[str]:
        f = self._f
        self._scroll(f, key)

        if key == ord('a'):
            name = self._get_input(stdscr, max_y, max_x, "Model name to enroll in search")
            if name:
                cmd = f"veloiq search add-model {name}"
                if self._confirm(stdscr, max_y, max_x, cmd):
                    return cmd
        elif key == ord('f'):
            fname = self._get_input(stdscr, max_y, max_x, "Field name to add to search")
            if fname:
                cmd = f"veloiq search add-field {fname}"
                if self._confirm(stdscr, max_y, max_x, cmd):
                    return cmd
        elif key == ord('r'):
            name = self._get_input(stdscr, max_y, max_x, "Model name to remove from search")
            if name:
                cmd = f"veloiq search remove-model {name}"
                if self._confirm(stdscr, max_y, max_x, cmd):
                    return cmd
        elif key == ord('R'):
            fname = self._get_input(stdscr, max_y, max_x, "Field name to remove from search")
            if fname:
                cmd = f"veloiq search remove-field {fname}"
                if self._confirm(stdscr, max_y, max_x, cmd):
                    return cmd
        return None

    # ── Input / confirmation dialogs ──────────────────────────────────────────

    def _confirm(self, stdscr, max_y, max_x, cmd: str) -> bool:
        prompt = f"  Run: {cmd}  [Y/n] "
        self._w(stdscr, max_y - 1, 0, " " * (max_x - 1), curses.color_pair(_C_WARN))
        self._w(stdscr, max_y - 1, 0, prompt, curses.color_pair(_C_WARN) | curses.A_BOLD)
        stdscr.refresh()
        k = stdscr.getch()
        return k not in (ord('n'), ord('N'))

    def _get_input(self, stdscr, max_y, max_x, prompt: str, default: str = "") -> str:
        curses.echo()
        curses.curs_set(1)
        hint = f" [{default}]" if default else ""
        prompt_str = f"  {prompt}{hint}: "
        self._w(stdscr, max_y - 1, 0, " " * (max_x - 1), curses.color_pair(_C_WARN))
        self._w(stdscr, max_y - 1, 0, prompt_str, curses.color_pair(_C_WARN) | curses.A_BOLD)
        stdscr.refresh()
        try:
            raw = stdscr.getstr(max_y - 1, len(prompt_str), min(60, max(1, max_x - len(prompt_str) - 2)))
            result = raw.decode("utf-8", errors="replace").strip()
        except Exception:
            result = ""
        finally:
            curses.noecho()
            curses.curs_set(0)
        return result if result else default


# ── CLI entry point ───────────────────────────────────────────────────────────

def _create_app_interactive(stdscr) -> Optional[tuple[str, str]]:
    """Interactive TUI for creating a new VeloIQ project when no project is found."""
    curses.start_color()
    curses.use_default_colors()
    curses.init_pair(_C_HDR,  curses.COLOR_WHITE,  curses.COLOR_BLUE)
    curses.init_pair(_C_SEL,  curses.COLOR_BLACK,  curses.COLOR_CYAN)
    curses.init_pair(_C_OK,   curses.COLOR_GREEN,  -1)
    curses.init_pair(_C_WARN, curses.COLOR_YELLOW, -1)
    curses.init_pair(_C_TTL,  curses.COLOR_CYAN,   -1)
    curses.init_pair(_C_ERR,  curses.COLOR_RED,    -1)
    curses.curs_set(0)
    stdscr.keypad(True)

    max_y, max_x = stdscr.getmaxyx()

    # ── Form fields ────────────────────────────────────────────────────────────
    # `default` is the effective value `veloiq new` uses when the field is left
    # blank — it is shown as a dim hint so the user can see what they'll get.
    # `type: choice` fields are cycled with ←/→ or space; press Enter on a
    # choice field to type a custom value (any SQLAlchemy dialect string).
    # SQLite & PostgreSQL drivers ship with the framework; the others need
    # their driver installed (pymysql, pyodbc, cx_Oracle, …).
    DB_CHOICES = ["sqlite", "postgresql", "mysql", "mariadb", "mssql", "oracle",
                  "db2", "informix"]
    DB_DEFAULT_PORTS = {"postgresql": "5432", "mysql": "3306", "mariadb": "3306",
                        "mssql": "1433", "oracle": "1521", "db2": "50000",
                        "informix": "9088"}
    DB_CONN_KEYS = {"db_host", "db_port", "db_name", "db_user", "db_password"}

    fields = [
        {"key": "app_name",      "label": "App name",       "value": "", "required": True,  "default": ""},
        {"key": "title",         "label": "Title",          "value": "", "required": False, "default": "from app name"},
        {"key": "port",          "label": "Backend port",   "value": "", "required": False, "default": "8000"},
        {"key": "frontend_port", "label": "Frontend port",  "value": "", "required": False, "default": "5173"},
        {"key": "admin_username","label": "Admin username", "value": "", "required": False, "default": "admin"},
        {"key": "admin_password","label": "Admin password", "value": "", "required": False, "default": "admin"},
        {"key": "db_type",       "label": "DB type",        "value": "sqlite", "required": False,
         "type": "choice", "choices": DB_CHOICES},
        {"key": "db_host",       "label": "DB host",        "value": "", "required": False, "default": "localhost"},
        {"key": "db_port",       "label": "DB port",        "value": "", "required": False, "default": "engine default"},
        {"key": "db_name",       "label": "DB name",        "value": "", "required": False, "default": "app name"},
        {"key": "db_user",       "label": "DB user",        "value": "", "required": False, "default": "veloiq"},
        {"key": "db_password",   "label": "DB password",    "value": "", "required": False, "default": "none"},
    ]
    cursor = 0  # which field is selected
    done = False
    result: Optional[str] = None

    def _db_is_sqlite() -> bool:
        return fields[6]["value"].strip().lower() == "sqlite"

    def _field_default(fld) -> str:
        """Resolve the dim hint shown when a field has no explicit value."""
        if fld["key"] == "db_port":
            return DB_DEFAULT_PORTS.get(fields[6]["value"].strip().lower(), "—")
        if fld["key"] == "db_name":
            return fields[0]["value"].strip() or "app name"
        return fld.get("default", "")

    def _w(row, col, text, attr=0):
        if row < 0 or row >= max_y or col < 0 or col >= max_x:
            return
        try:
            stdscr.addstr(row, col, str(text)[: max_x - col], attr)
        except curses.error:
            pass

    def _draw():
        stdscr.clear()
        # Header
        hdr = "  VeloIQ  ·  Create New Project"
        _w(0, 0, hdr[:max_x], curses.color_pair(_C_HDR) | curses.A_BOLD)

        r = 2
        _w(r, 2, "No VeloIQ project found in the current directory.", curses.color_pair(_C_WARN))
        r += 1
        _w(r, 2, "Fill in the details below to create one:", curses.A_NORMAL)
        r += 2

        sqlite = _db_is_sqlite()
        for i, fld in enumerate(fields):
            is_sel = i == cursor
            is_choice = fld.get("type") == "choice"
            # DB connection fields are unused for SQLite — dim them.
            irrelevant = sqlite and fld["key"] in DB_CONN_KEYS
            prefix = " ► " if is_sel else "   "
            label  = fld["label"]
            val    = fld["value"]
            attr   = curses.color_pair(_C_SEL) if is_sel else 0
            if irrelevant and not is_sel:
                attr = curses.A_DIM
            _w(r, 2, f"{prefix}{label:<18}", attr)

            if is_choice:
                # Render selectable choice with ◄ ► markers when focused.
                opts = fld["choices"]
                if val in opts:
                    rendered = "  ".join(
                        f"[{o}]" if o == val else f" {o} " for o in opts
                    )
                else:
                    # A custom dialect the user typed — show it highlighted.
                    rendered = f"[{val}]  (custom)"
                marker = "◄ " if is_sel else "  "
                end    = " ►" if is_sel else ""
                _w(r, 24, f"{marker}{rendered}{end}",
                   curses.A_BOLD if is_sel else curses.A_NORMAL)
            elif val:
                _w(r, 24, val, curses.A_BOLD)
            elif irrelevant:
                _w(r, 24, "not used for sqlite", curses.A_DIM)
            else:
                hint = _field_default(fld)
                _w(r, 24, f"default: {hint}" if hint else "(empty)", curses.A_DIM)
            r += 1

        r += 1
        _w(r, 2, "Dim values are defaults — fields left blank use them.", curses.A_DIM)
        r += 1
        _w(r, 2, "Press 'c' to create the project, or 'q' to quit.", curses.color_pair(_C_WARN))

        # Footer
        _w(max_y - 1, 0,
           "  ↑↓/jk move   ←→/Space cycle DB type (Enter = custom)   c create   q quit",
           curses.color_pair(_C_WARN))

        stdscr.refresh()

    def _edit_field(idx: int) -> None:
        fld = fields[idx]
        curses.echo()
        curses.curs_set(1)
        prompt = f"  {fld['label']}: "
        _w(max_y - 1, 0, " " * (max_x - 1), curses.color_pair(_C_WARN))
        _w(max_y - 1, 0, prompt, curses.color_pair(_C_WARN) | curses.A_BOLD)
        stdscr.refresh()
        try:
            raw = stdscr.getstr(max_y - 1, len(prompt), min(60, max(1, max_x - len(prompt) - 2)))
            val = raw.decode("utf-8", errors="replace").strip()
            if val:
                fld["value"] = val
        except Exception:
            pass
        finally:
            curses.noecho()
            curses.curs_set(0)

    while not done:
        _draw()
        key = stdscr.getch()

        if key == ord('q'):
            return None

        cur_fld = fields[cursor]
        is_choice = cur_fld.get("type") == "choice"

        if key in (curses.KEY_UP, ord('k')):
            cursor = max(0, cursor - 1)
        elif key in (curses.KEY_DOWN, ord('j')):
            cursor = min(len(fields) - 1, cursor + 1)
        elif is_choice and key in (curses.KEY_LEFT, curses.KEY_RIGHT, ord(' ')):
            # Cycle through the common dialects (Space/→ forward, ← backward).
            opts = cur_fld["choices"]
            try:
                idx = opts.index(cur_fld["value"])
            except ValueError:
                idx = 0  # currently a custom value — re-enter the list at start
            step = -1 if key == curses.KEY_LEFT else 1
            cur_fld["value"] = opts[(idx + step) % len(opts)]
        elif key in (curses.KEY_ENTER, ord('\n'), ord('\r')):
            # Enter edits any field; on a choice field this types a custom value.
            _edit_field(cursor)
        elif key == ord('c'):
            # Validate required fields
            app_name = fields[0]["value"].strip()
            if not app_name:
                _w(max_y - 1, 0, " " * (max_x - 1), curses.color_pair(_C_ERR))
                _w(max_y - 1, 0, "  ⚠  App name is required!", curses.color_pair(_C_ERR) | curses.A_BOLD)
                stdscr.refresh()
                stdscr.getch()
                continue

            title = fields[1]["value"].strip() or None
            try:
                port = int(fields[2]["value"].strip()) if fields[2]["value"].strip() else 8000
            except ValueError:
                port = 8000
            try:
                frontend_port = int(fields[3]["value"].strip()) if fields[3]["value"].strip() else 5173
            except ValueError:
                frontend_port = 5173
            admin_username = fields[4]["value"].strip() or None
            admin_password = fields[5]["value"].strip() or None
            db_type = fields[6]["value"].strip() or "sqlite"
            db_host = fields[7]["value"].strip() or None
            db_port_str = fields[8]["value"].strip()
            db_port = int(db_port_str) if db_port_str else None
            db_name = fields[9]["value"].strip() or None
            db_user = fields[10]["value"].strip() or None
            db_password = fields[11]["value"].strip() or None

            # Build the command
            cmd_parts = [f"veloiq new {app_name}"]
            if title:
                cmd_parts.append(f'--title "{title}"')
            if port != 8000:
                cmd_parts.append(f"--port {port}")
            if frontend_port != 5173:
                cmd_parts.append(f"--frontend-port {frontend_port}")
            if admin_username:
                cmd_parts.append(f'--admin-username "{admin_username}"')
            if admin_password:
                cmd_parts.append(f'--admin-password "{admin_password}"')
            if db_type != "sqlite":
                cmd_parts.append(f"--db-type {db_type}")
            if db_host:
                cmd_parts.append(f'--db-host "{db_host}"')
            if db_port is not None:
                cmd_parts.append(f"--db-port {db_port}")
            if db_name:
                cmd_parts.append(f'--db-name "{db_name}"')
            if db_user:
                cmd_parts.append(f'--db-user "{db_user}"')
            if db_password:
                cmd_parts.append(f'--db-password "{db_password}"')
            result = " ".join(cmd_parts)
            done = True

    return (result, app_name)



def launch_explorer() -> None:
    import click

    root = _find_project_root()
    if root is None:
        # Offer an interactive "create new app" TUI instead of just erroring out
        try:
            result = curses.wrapper(_create_app_interactive)
        except KeyboardInterrupt:
            result = None

        if result:
            cmd, app_name = result
            print(f"\n  Running: {cmd}\n")
            subprocess.run(cmd, shell=True)
            # The project was created at ./<app_name> from the current directory
            root = Path.cwd().resolve() / app_name
            if not root.exists() or not (root / "backend" / "app" / "modules").exists():
                click.echo(
                    "❌  Could not find the newly created project.\n"
                    "   Try changing to the project directory and running `veloiq` again."
                )
                return
            # Fall through to launch the explorer for the new project
        else:
            return

    while True:
        data = _load_app_data(root)
        explorer = Explorer(data)
        cmd = explorer.run()
        if not cmd:
            break
        print(f"\n  Running: {cmd}\n")
        subprocess.run(cmd, shell=True, cwd=str(root))
        print()
        input("  Press Enter to return to the TUI...")
