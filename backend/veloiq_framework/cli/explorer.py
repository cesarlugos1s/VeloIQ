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


@dataclass
class RelationInfo:
    resource: str
    target_key: str
    label: str
    is_recursive: bool = False


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
        data.modules.append(mod)

    return data


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
    def _s(p):
        m = re.search(p, block)
        return m.group(1) if m else None

    name = _s(r'name:\s*"([^"]+)"')
    if not name:
        return None
    resource = _s(r'resource:\s*"([^"]+)"') or name.lower()
    label    = _s(r'label:\s*"([^"]+)"') or name
    pk       = _s(r'pkField:\s*"([^"]+)"') or "id"

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
                fields.append(FieldInfo(
                    key=km.group(1),
                    label=lm.group(1) if lm else km.group(1),
                    type=tm.group(1),
                    required="required: true" in s,
                    reference=rm.group(1) if rm else None,
                    read_roles=[x.strip(' "') for x in rrm.group(1).split(",") if x.strip()] if rrm else [],
                    write_roles=[x.strip(' "') for x in wrm.group(1).split(",") if x.strip()] if wrm else [],
                ))
        elif in_rel and s.startswith("{"):
            res_m = re.search(r'resource:\s*"([^"]+)"', s)
            tk_m  = re.search(r'targetKey:\s*"([^"]+)"', s)
            lm    = re.search(r'label:\s*"([^"]+)"', s)
            if res_m and tk_m:
                relations.append(RelationInfo(
                    resource=res_m.group(1),
                    target_key=tk_m.group(1),
                    label=lm.group(1) if lm else res_m.group(1),
                    is_recursive="isRecursive: true" in s,
                ))

    return ModelInfo(
        name=name, label=label, resource=resource, pk_field=pk,
        module_name=module_name, fields=fields, relations=relations,
        is_named_query="isNamedQuery: true" in block,
        in_dashboard=resource in dashboard_models,
        dashboard_tab=dashboard_tabs.get(resource),
        in_search=name.lower() in search_set,
    )


def _scan_models_minimal(mod_dir, module_name, search_set, dashboard_models, dashboard_tabs):
    text = (mod_dir / "models.py").read_text(encoding="utf-8")
    models = []
    for m in re.finditer(r'^class\s+(\w+)\s*\([^)]*table\s*=\s*True', text, re.M):
        name = m.group(1)
        after = text[m.start(): m.start() + 300]
        tn = re.search(r'__tablename__\s*=\s*["\']([^"\']+)["\']', after)
        resource = tn.group(1) if tn else name.lower()
        models.append(ModelInfo(
            name=name,
            label=re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', name),
            resource=resource, pk_field="id", module_name=module_name,
            in_dashboard=resource in dashboard_models,
            dashboard_tab=dashboard_tabs.get(resource),
            in_search=name.lower() in search_set,
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
            ("g", "Run: veloiq generate"),
            ("q", "Quit"),
        ]
        for i, (key, label) in enumerate(menu):
            is_sel = i == f.cursor
            attr   = curses.color_pair(_C_SEL) if is_sel else 0
            prefix = " ► " if is_sel else "   "
            self._w(stdscr, r, 2, f"{prefix}[{key}]  {label}", attr)
            r += 1

        self._w(stdscr, max_y - 1, 0,
                "  ↑↓ / jk  navigate    Enter  select    q  quit",
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
            self._w(stdscr, max_y - 1, 0,
                    "  pip install an extension, then it appears here    b  back    q  quit",
                    curses.color_pair(_C_WARN))
            return

        list_start = r
        list_h = max_y - list_start - 1
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

        self._w(stdscr, max_y - 1, 0,
                "  ↑↓ / jk  navigate    Enter/e  toggle    g  generate    b  back    q  quit",
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
        list_h = max_y - list_start - 1

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

        self._w(stdscr, max_y - 1, 0,
                "  ↑↓ / jk  navigate    Enter  view    a  add-module    g  generate    b  back    q  quit",
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

        list_start = r
        list_h = max_y - list_start - 1

        if f.cursor < f.scroll:
            f.scroll = f.cursor
        elif f.cursor >= f.scroll + list_h:
            f.scroll = f.cursor - list_h + 1

        if not mod.models:
            self._w(stdscr, r, 4, "(no models — run veloiq generate)", curses.A_DIM)
        else:
            for i in range(list_h):
                idx = f.scroll + i
                if idx >= len(mod.models):
                    break
                model  = mod.models[idx]
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

        self._w(stdscr, max_y - 1, 0,
                "  ↑↓ / jk  navigate    Enter  view model    g  generate    b  back    q  quit",
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
        lines.append(("─" * max(0, max_x - 4), DIM))

        _TS = {"created_at", "updated_at", "creation_date", "modification_date"}

        if model.fields:
            lines.append((f"Fields ({len(model.fields)}):", BOLD))
            for fld in model.fields:
                parts = [f"  {fld.key:<22}  {fld.type:<10}"]
                if fld.required:
                    parts.append("required  ")
                if fld.reference:
                    parts.append(f"→ {fld.reference}  ")
                if fld.key in _TS:
                    parts.append("(timestamp)")
                if fld.read_roles:
                    parts.append(f"read:{','.join(fld.read_roles)}")
                if fld.write_roles:
                    parts.append(f"write:{','.join(fld.write_roles)}")
                lines.append(("".join(parts), DIM if fld.key in _TS else A))
        else:
            lines.append(("Fields: (run veloiq generate to see fields)", DIM))

        lines.append(("", A))

        if model.relations:
            lines.append((f"Relations ({len(model.relations)}):", BOLD))
            for rel in model.relations:
                tag = "  [recursive tree]" if rel.is_recursive else ""
                lines.append((f"  {rel.label:<24}  resource: {rel.resource}  ← {rel.target_key}{tag}", A))
        else:
            lines.append(("Relations: none", DIM))

        lines.append(("", A))
        lines.append(("Configuration:", BOLD))

        dash_val  = f"✓  tab \"{model.dashboard_tab}\"" if model.in_dashboard else "✗  not on dashboard"
        lines.append((f"  Dashboard    {dash_val}", OK if model.in_dashboard else ERR))
        srch_val  = "✓  enrolled" if model.in_search else "✗  not enrolled"
        lines.append((f"  Search       {srch_val}", OK if model.in_search else ERR))

        if model.permissions:
            pstr = "  ".join(f"{role}: [{', '.join(acts)}]" for role, acts in model.permissions.items())
            lines.append((f"  Permissions  {pstr}", A))
        else:
            lines.append(("  Permissions  none (inherits global roles)", DIM))

        rebac_val = "✓  enabled" if model.has_rebac else "✗  none"
        lines.append((f"  ReBAC        {rebac_val}", OK if model.has_rebac else DIM))

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

        if total > content_h:
            self._w(stdscr, max_y - 2, max_x - 22, f"  ↑↓ scroll ({f.scroll+1}/{total})", DIM)

        # Build contextual action hints
        actions: list[str] = []
        if not model.is_named_query:
            actions.append("[d] add-dashboard" if not model.in_dashboard else "[D] rm-dashboard")
            actions.append("[s] add-search"    if not model.in_search    else "[S] rm-search")
        actions += ["[p] scaffold-page", "[g] generate (all modules)", "[b] back", "[q] quit"]
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

        lines.append(("", A))
        lines.append((f"Searchable fields ({len(d.search_fields)}):", BOLD))
        if d.search_fields:
            lines.append(("  " + "  ·  ".join(d.search_fields), A))
        else:
            lines.append(("  (none — all string fields in enrolled models will be searched)", DIM))

        lines.append(("", A))
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

        if total > content_h:
            self._w(stdscr, max_y - 2, max_x - 22, f"  ↑↓ scroll ({f.scroll+1}/{total})", DIM)

        self._w(stdscr, max_y - 1, 0,
                "  [a] add-model    [f] add-field    [r] rm-model    [R] rm-field"
                "    ↑↓ scroll    [b] back    [q] quit",
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
        self._move_cursor(f, 5, key)

        if key in (curses.KEY_ENTER, ord('\n'), ord('\r')):
            if f.cursor == 0:
                self.nav.append(_Frame("modules"))
            elif f.cursor == 1:
                self.nav.append(_Frame("search"))
            elif f.cursor == 2:
                self.nav.append(_Frame("extensions"))
            elif f.cursor == 3:
                if self._confirm(stdscr, max_y, max_x, "veloiq generate"):
                    return "veloiq generate"
            elif f.cursor == 4:
                return ""
        elif key == ord('1'):
            self.nav.append(_Frame("modules"))
        elif key == ord('2'):
            self.nav.append(_Frame("search"))
        elif key == ord('3'):
            self.nav.append(_Frame("extensions"))
        elif key == ord('g'):
            if self._confirm(stdscr, max_y, max_x, "veloiq generate"):
                return "veloiq generate"
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
        self._move_cursor(f, len(mod.models), key)

        if key in (curses.KEY_ENTER, ord('\n'), ord('\r')):
            if mod.models:
                self.nav.append(_Frame("model", context=mod.models[f.cursor]))
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
            page_type = self._pick_page_type(stdscr, max_y, max_x)
            if page_type:
                cmd = f"veloiq scaffold-page {model.resource} {page_type}"
                if self._confirm(stdscr, max_y, max_x, cmd):
                    return cmd
        elif key == ord('g'):
            if self._confirm(stdscr, max_y, max_x, "veloiq generate"):
                return "veloiq generate"
        return None

    def _pick_page_type(self, stdscr, max_y, max_x) -> Optional[str]:
        prompt = "  Scaffold page type: [1] list  [2] show  [3] edit  [4] create  [Esc] cancel "
        self._w(stdscr, max_y - 1, 0, " " * (max_x - 1), curses.color_pair(_C_WARN))
        self._w(stdscr, max_y - 1, 0, prompt, curses.color_pair(_C_WARN) | curses.A_BOLD)
        stdscr.refresh()
        k = stdscr.getch()
        return {ord('1'): "list", ord('2'): "show", ord('3'): "edit", ord('4'): "create"}.get(k)

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
        prompt = f"  Run: {cmd}  [y/N] "
        self._w(stdscr, max_y - 1, 0, " " * (max_x - 1), curses.color_pair(_C_WARN))
        self._w(stdscr, max_y - 1, 0, prompt, curses.color_pair(_C_WARN) | curses.A_BOLD)
        stdscr.refresh()
        k = stdscr.getch()
        return k in (ord('y'), ord('Y'))

    def _get_input(self, stdscr, max_y, max_x, prompt: str) -> str:
        curses.echo()
        curses.curs_set(1)
        prompt_str = f"  {prompt}: "
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
        return result


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

    data = _load_app_data(root)
    explorer = Explorer(data)
    cmd = explorer.run()

    if cmd:
        print(f"\n  Running: {cmd}\n")
        subprocess.run(cmd, shell=True, cwd=str(root))
        print()
