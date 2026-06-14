"""veloiq scaffold-page — generate a custom page component for a model."""
from __future__ import annotations

import re
from pathlib import Path
from typing import Optional

import click


# ---------------------------------------------------------------------------
# Schema parsing helpers
# ---------------------------------------------------------------------------

def _parse_gen_ts_simple(path: Path, target_resource: str) -> dict:
    """
    Parse a {module}Schema.gen.ts file and return metadata for the model
    whose resource matches *target_resource*.

    Returns a dict with keys: name, resource, pk_field, fields, relations.
    Falls back to a minimal dict if parsing fails.
    """
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return _fallback_meta(target_resource)

    # Collect model blocks: each one starts with "  {" at depth 0.
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
            block = "\n".join(lines[start:i])
            res_m = re.search(r'resource:\s*"([^"]+)"', block)
            if res_m and res_m.group(1) == target_resource:
                return _parse_model_block(block)
        else:
            i += 1

    return _fallback_meta(target_resource)


def _parse_model_block(block: str) -> dict:
    def _s(p):
        m = re.search(p, block)
        return m.group(1) if m else None

    name     = _s(r'name:\s*"([^"]+)"') or "Unknown"
    resource = _s(r'resource:\s*"([^"]+)"') or name.lower()
    label    = _s(r'label:\s*"([^"]+)"') or name
    pk_field = _s(r'pkField:\s*"([^"]+)"') or "id"

    fields: list[dict] = []
    relations: list[dict] = []
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
                lm = re.search(r'label:\s*"([^"]+)"', s)
                rm = re.search(r'reference:\s*"([^"]+)"', s)
                fields.append({
                    "key":       km.group(1),
                    "label":     lm.group(1) if lm else km.group(1),
                    "type":      tm.group(1),
                    "required":  "required: true" in s,
                    "reference": rm.group(1) if rm else None,
                })
        elif in_rel and s.startswith("{"):
            res_m = re.search(r'resource:\s*"([^"]+)"', s)
            tk_m  = re.search(r'targetKey:\s*"([^"]+)"', s)
            lm    = re.search(r'label:\s*"([^"]+)"', s)
            if res_m and tk_m:
                relations.append({
                    "resource":   res_m.group(1),
                    "target_key": tk_m.group(1),
                    "label":      lm.group(1) if lm else res_m.group(1),
                })

    return {"name": name, "label": label, "resource": resource,
            "pk_field": pk_field, "fields": fields, "relations": relations}


def _fallback_meta(resource: str) -> dict:
    return {
        "name": _to_pascal(resource),
        "label": resource.replace("_", " ").title(),
        "resource": resource,
        "pk_field": "id",
        "fields": [],
        "relations": [],
    }


# ---------------------------------------------------------------------------
# Module auto-detection
# ---------------------------------------------------------------------------

def _find_module_for_resource(root: Path, resource: str) -> Optional[tuple[str, Path]]:
    """
    Scan frontend/src/pages/*/  for a schema gen file containing the resource.
    Returns (module_name, schema_file_path) or None.
    """
    pages_dir = root / "frontend" / "src" / "pages"
    if not pages_dir.exists():
        return None

    # Match resource at model level only (4-space indent, own line).
    # This avoids false positives where the resource name appears inside
    # a relation definition on the same line as other fields.
    pattern = re.compile(r'^\s{2,6}resource:\s*"' + re.escape(resource) + r'",?\s*$', re.MULTILINE)

    for module_dir in sorted(pages_dir.iterdir()):
        if not module_dir.is_dir():
            continue
        module_name = module_dir.name
        for candidate in [
            module_dir / f"{module_name}Schema.gen.ts",
            module_dir / f"{module_name}Schema.ts",
        ]:
            if candidate.exists():
                text = candidate.read_text(encoding="utf-8")
                if pattern.search(text):
                    return module_name, candidate

    return None


# ---------------------------------------------------------------------------
# TSX scaffold templates
# ---------------------------------------------------------------------------

_DYNAMIC_IMPORT = {
    "list":   "DynamicList",
    "show":   "DynamicShow",
    "edit":   "DynamicEdit",
    "create": "DynamicCreate",
}

_PAGE_LABEL = {
    "list":   "List",
    "show":   "Show",
    "edit":   "Edit",
    "create": "Create",
}

_PAGE_PATH = {
    "list":   "/{resource}",
    "show":   "/{resource}/show/{id}",
    "edit":   "/{resource}/edit/{id}",
    "create": "/{resource}/create",
}


def _build_header_comment(model_meta: dict, page_type: str, module: str) -> str:
    name     = model_meta["name"]
    resource = model_meta["resource"]
    pk_field = model_meta["pk_field"]
    fields   = model_meta["fields"]
    relations = model_meta["relations"]
    page_label = _PAGE_LABEL[page_type]

    # Fields block
    _TIMESTAMP = {"created_at", "updated_at", "creation_date", "modification_date"}
    field_lines = []
    for f in fields:
        parts = [f" *   - {f['label']} ({f['key']}): {f['type']}"]
        if f.get("required"):
            parts.append("  [required]")
        if f.get("reference"):
            parts.append(f"  → {f['reference']}")
        if f["key"] in _TIMESTAMP:
            parts.append("  [auto]")
        field_lines.append("".join(parts))

    fields_block = "\n".join(field_lines) if field_lines else " *   (run `veloiq generate` first to populate field list)"

    # Forward relations: FK fields
    fwd = [f for f in fields if f.get("reference")]
    fwd_lines = [f" *   - {f['label']} ({f['key']}) → {f['reference']}" for f in fwd]
    fwd_block = "\n".join(fwd_lines) if fwd_lines else " *   (none)"

    # Backward relations: RelationDef entries
    bwd_lines = [f" *   - {r['label']}: {r['resource']} via {r['target_key']}" for r in relations]
    bwd_block = "\n".join(bwd_lines) if bwd_lines else " *   (none)"

    # Navigation examples
    if page_type == "list":
        nav_lines = [
            f" *   go({{ to: {{ resource: \"{resource}\", action: \"list\" }}, type: \"push\" }});",
            f" *   // or: navigate(\"/{resource}\");",
        ]
    elif page_type == "show":
        nav_lines = [
            f" *   go({{ to: {{ resource: \"{resource}\", action: \"show\", id }}, type: \"push\" }});",
            f" *   // or: navigate(`/{resource}/show/${{id}}`);",
        ]
    elif page_type == "edit":
        nav_lines = [
            f" *   go({{ to: {{ resource: \"{resource}\", action: \"edit\", id }}, type: \"push\" }});",
            f" *   // or: navigate(`/{resource}/edit/${{id}}`);",
        ]
    else:  # create
        nav_lines = [
            f" *   go({{ to: {{ resource: \"{resource}\", action: \"create\" }}, type: \"push\" }});",
            f" *   // or: navigate(\"/{resource}/create\");",
        ]
    nav_block = "\n".join(nav_lines)

    return f"""\
/*
 * Custom {page_label} page for {name}
 *
 * Model  : {name}  (resource: "{resource}", module: "{module}")
 * pkField: {pk_field}
 *
 * Fields:
{fields_block}
 *
 * Forward relations (FK in this model → other models):
{fwd_block}
 *
 * Backward relations (other models that reference {name}):
{bwd_block}
 *
 * How this page is the default {page_label} page:
 *   This component is registered in `frontend/src/custom_pages.ts`
 *   under the key "{resource}". App.tsx reads that registry and routes
 *   /{resource}{_PAGE_PATH[page_type].replace("/{resource}", "").replace("{resource}", "")} to this component
 *   instead of Dynamic{page_label}.
 *
 * Navigating to this page from another custom page:
 *   import {{ useGo }} from "@refinedev/core";
 *   const go = useGo();
{nav_block}
 *
 * Undo this override:
 *   Remove the "{resource}" entry from custom_pages.ts — no App.tsx edit needed.
 */"""


def _build_tsx(model_meta: dict, page_type: str, module: str) -> str:
    name       = model_meta["name"]
    resource   = model_meta["resource"]
    dynamic    = _DYNAMIC_IMPORT[page_type]
    page_label = _PAGE_LABEL[page_type]
    comp_name  = f"Custom{name}{page_label}"
    header     = _build_header_comment(model_meta, page_type, module)

    # Extra props hint per page type (16-space indent to align with JSX attributes)
    if page_type == "show":
        extra_props = "                // Customize: add idOverride, embedded={true}, etc."
    elif page_type == "edit":
        extra_props = "                // Customize: add idOverride, topContent={...}, extraHeaderButtons={...}, etc."
    elif page_type == "create":
        extra_props = "                // Customize: add injectedValues={{ field: value }}, etc."
    else:  # list
        extra_props = '                // Customize: add filter={{}}, listViewType="gallery", extraHeaderButtons={...}, etc.'

    # Subtle dev badge — delete the <div> block below to remove the indicator.
    badge_label = f"Custom {name} {page_label}"
    badge = f"""\
            {{/* ── Scaffold indicator — delete this <div> once you no longer need it. ──────────
                 This badge marks the page as a registered custom scaffold. It appears in the
                 bottom-right corner so you know this component (not the Dynamic default) is
                 active. To remove it: delete from here... */}}
            <div style={{{{
                position: "fixed", bottom: 10, right: 10,
                background: "rgba(99,102,241,0.08)",
                border: "1px dashed rgba(99,102,241,0.45)",
                borderRadius: 5,
                padding: "2px 10px",
                fontSize: 11,
                fontFamily: "monospace",
                color: "rgba(99,102,241,0.7)",
                zIndex: 9999,
                pointerEvents: "none",
                userSelect: "none",
            }}}}>⚙ {badge_label}</div>
            {{/* ...to here. */}}"""

    return f"""\
{header}

import React from "react";
import {{ {dynamic} }} from "@juicemantics/veloiq-ui";
import {{ allSystemModels }} from "../../allModels.gen";
import {{ authSystemModels }} from "@juicemantics/veloiq-ui";
import type {{ ModelDef }} from "@juicemantics/veloiq-ui";

// All models needed for cross-model lookups (FK labels, relation tabs, etc.)
const allModels: ModelDef[] = [...allSystemModels, ...authSystemModels];

// The {name} model definition from the generated schema
const model = allModels.find(m => (m as any).resource === "{resource}")!;

export const {comp_name}: React.FC = () => {{
    return (
        <>
{badge}
            <{dynamic}
                model={{model}}
                allModels={{allModels}}
{extra_props}
            />
        </>
    );
}};
"""


# ---------------------------------------------------------------------------
# custom_pages.ts registry helpers
# ---------------------------------------------------------------------------

_CUSTOM_PAGES_HEADER = """\
// Custom page overrides — managed by `veloiq scaffold-page`. Safe to edit manually.
// Add a component here to replace the default Dynamic page for any resource.
import React from "react";
import type { ModelDef } from "@juicemantics/veloiq-ui";
"""

_CUSTOM_PAGES_MAPS = """\

export const customListComponents:   Record<string, React.ComponentType<{ model: ModelDef; allModels: ModelDef[] }>> = {ENTRIES_LIST};
export const customShowComponents:   Record<string, React.ComponentType> = {ENTRIES_SHOW};
export const customEditComponents:   Record<string, React.ComponentType<{ model: ModelDef; allModels: ModelDef[] }>> = {ENTRIES_EDIT};
export const customCreateComponents: Record<string, React.ComponentType<{ model: ModelDef; allModels: ModelDef[] }>> = {ENTRIES_CREATE};
"""

_MAP_KEY = {"list": "ENTRIES_LIST", "show": "ENTRIES_SHOW", "edit": "ENTRIES_EDIT", "create": "ENTRIES_CREATE"}


def _create_custom_pages_ts(path: Path, resource: str, comp_name: str, import_path: str, page_type: str) -> None:
    """Create custom_pages.ts from scratch with the first entry."""
    entries = {"list": {}, "show": {}, "edit": {}, "create": {}}
    entries[page_type][resource] = comp_name

    import_line = f'import {{ {comp_name} }} from "{import_path}";'
    content = _CUSTOM_PAGES_HEADER + "\n" + import_line + "\n"
    content += _render_maps(entries)
    path.write_text(content, encoding="utf-8")


def _update_custom_pages_ts(path: Path, resource: str, comp_name: str, import_path: str, page_type: str) -> None:
    """Add a new entry to an existing custom_pages.ts."""
    content = path.read_text(encoding="utf-8")

    import_line = f'import {{ {comp_name} }} from "{import_path}";'
    if import_line not in content:
        last_import = max(
            (i for i, ln in enumerate(content.splitlines()) if ln.startswith("import ")),
            default=-1,
        )
        lines = content.splitlines()
        lines.insert(last_import + 1, import_line)
        content = "\n".join(lines) + "\n"

    map_var = {
        "list":   "customListComponents",
        "show":   "customShowComponents",
        "edit":   "customEditComponents",
        "create": "customCreateComponents",
    }[page_type]

    entry_line = f'    "{resource}": {comp_name},\n'
    if f'"{resource}": {comp_name}' not in content:
        # Match the map's `= { ... }` block and insert the new entry before the closing `}`
        m = re.search(
            r'(export const ' + re.escape(map_var) + r'[^=]+=\s*\{)([^}]*)\}',
            content,
        )
        if m:
            inner = m.group(2)
            # Ensure the inner block ends with a newline before the new entry
            if inner and not inner.endswith("\n"):
                inner += "\n"
            elif not inner:
                inner = "\n"
            content = content[:m.start(1)] + m.group(1) + inner + entry_line + "}" + content[m.end():]

    path.write_text(content, encoding="utf-8")


def _render_maps(entries: dict) -> str:
    def _fmt(d: dict) -> str:
        if not d:
            return "{}"
        inner = "\n" + "".join(f'    "{k}": {v},\n' for k, v in d.items())
        return "{" + inner + "}"

    return (
        "\n"
        f"export const customListComponents:   Record<string, React.ComponentType<{{ model: ModelDef; allModels: ModelDef[] }}>> = {_fmt(entries['list'])};\n"
        f"export const customShowComponents:   Record<string, React.ComponentType> = {_fmt(entries['show'])};\n"
        f"export const customEditComponents:   Record<string, React.ComponentType<{{ model: ModelDef; allModels: ModelDef[] }}>> = {_fmt(entries['edit'])};\n"
        f"export const customCreateComponents: Record<string, React.ComponentType<{{ model: ModelDef; allModels: ModelDef[] }}>> = {_fmt(entries['create'])};\n"
    )


# ---------------------------------------------------------------------------
# App.tsx patching
# ---------------------------------------------------------------------------

def _patch_app_tsx(root: Path) -> bool:
    """
    Patch App.tsx to import custom_pages and use the override registries.
    Returns True if a patch was applied, False if already up to date.
    """
    app_tsx = root / "frontend" / "src" / "App.tsx"
    if not app_tsx.exists():
        return False

    content = app_tsx.read_text(encoding="utf-8")

    if "custom_pages" in content:
        return False  # already patched

    # ── Patch A: add import ──────────────────────────────────────────────────
    custom_import = 'import { customListComponents, customShowComponents, customEditComponents, customCreateComponents } from "./custom_pages";'

    inserted = False
    for pat in [
        r'(import \{ allModuleRegistrations[^\n]+\n)',
        r'(import navConfigData from "\./navigation\.config\.json";\n)',
        r'(import \{ extensionRoutes[^\n]+\n)',
    ]:
        m = re.search(pat, content)
        if m:
            content = content[:m.end()] + custom_import + "\n" + content[m.end():]
            inserted = True
            break
    if not inserted:
        m = re.search(r'\nconst ', content)
        if m:
            content = content[:m.start()] + "\n" + custom_import + content[m.start():]

    # ── Patch B: update PrimaryShowRenderer ─────────────────────────────────
    # Variant 1 — simple expression body (original scaffold template)
    old_renderer_v1 = (
        'const PrimaryShowRenderer = ({ model, id, allModels }: PrimaryShowRendererProps) => (\n'
        '    <DynamicShow model={model} allModels={allModels} idOverride={String(id)} />\n'
        ');'
    )
    new_renderer_v1 = (
        'const PrimaryShowRenderer = ({ model, id, allModels }: PrimaryShowRendererProps) => {\n'
        '    const resource = (model as any).resource || model.name;\n'
        '    const AppOverride = customShowComponents[resource];\n'
        '    if (AppOverride) return <AppOverride />;\n'
        '    return <DynamicShow model={model} allModels={allModels} idOverride={String(id)} />;\n'
        '};'
    )
    # Variant 2 — block body with extensionShowComponents (projects that have extensions)
    old_renderer_v2 = (
        'const PrimaryShowRenderer = ({ model, id, allModels }: PrimaryShowRendererProps) => {\n'
        '    const Override = extensionShowComponents[(model as any).resource || model.name];\n'
        '    return Override\n'
        '        ? createElement(Override, { idOverride: String(id) })\n'
        '        : <DynamicShow model={model} allModels={allModels} idOverride={String(id)} />;\n'
        '};'
    )
    new_renderer_v2 = (
        'const PrimaryShowRenderer = ({ model, id, allModels }: PrimaryShowRendererProps) => {\n'
        '    const resource = (model as any).resource || model.name;\n'
        '    const AppOverride = customShowComponents[resource];\n'
        '    if (AppOverride) return <AppOverride />;\n'
        '    const ExtOverride = extensionShowComponents[resource];\n'
        '    return ExtOverride\n'
        '        ? createElement(ExtOverride, { idOverride: String(id) })\n'
        '        : <DynamicShow model={model} allModels={allModels} idOverride={String(id)} />;\n'
        '};'
    )
    if old_renderer_v1 in content:
        content = content.replace(old_renderer_v1, new_renderer_v1)
    elif old_renderer_v2 in content:
        content = content.replace(old_renderer_v2, new_renderer_v2)

    # ── Patch D (BEFORE C): update allSystemModels.map loop ─────────────────
    # Must run before Patch C so the helpers' DynamicCreate/DynamicEdit strings
    # are not accidentally targeted by the map-body replacements below.

    map_m = re.search(r'^( *)\{allSystemModels\.map\(\(model\) => \(', content, re.MULTILINE)
    if map_m:
        base  = map_m.group(1)   # actual leading whitespace, e.g. 24 spaces
        inner = base + "    "    # one level deeper

        # D1: Convert arrow expression to block body
        content = content.replace(
            f"{base}{{allSystemModels.map((model) => (\n",
            f"{base}{{allSystemModels.map((model) => {{\n"
            f"{inner}const resource = (model as any).resource || model.name;\n"
            f"{inner}return (\n",
            1,
        )

        # D2: Simplify path prop (unique `(model as any)` form only in allSystemModels.map)
        content = content.replace(
            'path={`/${(model as any).resource || model.name}`}',
            'path={`/${resource}`}',
            1,
        )

        # D3: Replace DynamicList (count=1 → only the allSystemModels.map occurrence)
        content = content.replace(
            '<DynamicList key={(model as any).resource || model.name} model={model} allModels={allModels} />',
            '{_renderList(resource, model, allModels)}',
            1,
        )

        # D4: Replace DynamicCreate — no {} wrapper; attribute already provides element={...}
        content = content.replace(
            '<DynamicCreate model={model} allModels={allModels} />',
            '_renderCreate(resource, model, allModels)',
            1,
        )

        # D5: Replace DynamicEdit — same: no {} wrapper
        content = content.replace(
            '<DynamicEdit model={model} allModels={allModels} />',
            '_renderEdit(resource, model, allModels)',
            1,
        )

        # D6: Replace the show route in allSystemModels.map only.
        # Scope replacement to before authSystemModels.map to avoid hitting auth routes
        # where `resource` is not in scope.
        # Two patterns:
        #   old format: {renderShow(model, allModels)}
        #   new format: <DynamicShow model={model} allModels={allModels} />
        _auth_marker = 'authSystemModels.map'
        if _auth_marker in content:
            _split = content.index(_auth_marker)
            _before, _after = content[:_split], content[_split:]
            if '{renderShow(model, allModels)}' in _before:
                _before = _before.replace(
                    '{renderShow(model, allModels)}',
                    '{_renderShow(resource, model, allModels)}',
                    1,
                )
            elif '<DynamicShow model={model} allModels={allModels} />' in _before:
                _before = _before.replace(
                    '<DynamicShow model={model} allModels={allModels} />',
                    '{_renderShow(resource, model, allModels)}',
                    1,
                )
            content = _before + _after
        else:
            # No authSystemModels.map — safe to replace first occurrence
            if '{renderShow(model, allModels)}' in content:
                content = content.replace(
                    '{renderShow(model, allModels)}',
                    '{_renderShow(resource, model, allModels)}',
                    1,
                )
            else:
                content = content.replace(
                    '<DynamicShow model={model} allModels={allModels} />',
                    '{_renderShow(resource, model, allModels)}',
                    1,
                )

        # D7: Fix map closing: `))}` → `    );\n})}`, detecting actual indentation.
        # The allSystemModels.map closing looks like:
        #   {inner}</Route>
        #   {base}))}
        # After the block-body conversion it must become:
        #   {inner}</Route>
        #   {inner});
        #   {base}})}
        content = re.sub(
            r'( +)</Route>\n( +)\)\)\}',
            lambda m: m.group(1) + '</Route>\n' + m.group(1) + ');\n' + m.group(2) + '})}',
            content,
            count=1,
        )

    # ── Patch C: insert render helpers before `const queryClient` ────────────
    render_helpers = (
        "const _renderList   = (resource: string, model: any, allModels: any[]) => { const C = customListComponents[resource];   return C ? <C model={model} allModels={allModels} /> : <DynamicList key={resource} model={model} allModels={allModels} />; };\n"
        "const _renderShow   = (resource: string, model: any, allModels: any[]) => { const C = customShowComponents[resource];   return C ? <C /> : <DynamicShow model={model} allModels={allModels} />; };\n"
        "const _renderCreate = (resource: string, model: any, allModels: any[]) => { const C = customCreateComponents[resource]; return C ? <C model={model} allModels={allModels} /> : <DynamicCreate model={model} allModels={allModels} />; };\n"
        "const _renderEdit   = (resource: string, model: any, allModels: any[]) => { const C = customEditComponents[resource];   return C ? <C model={model} allModels={allModels} /> : <DynamicEdit model={model} allModels={allModels} />; };\n"
        "\n"
    )
    content = content.replace("const queryClient", render_helpers + "const queryClient", 1)

    app_tsx.write_text(content, encoding="utf-8")
    return True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_pascal(name: str) -> str:
    return "".join(part.capitalize() for part in re.sub(r"[^a-z0-9]", "_", name.lower()).split("_") if part)


def _find_project_root() -> Optional[Path]:
    cwd = Path.cwd().resolve()
    for directory in [cwd, *cwd.parents]:
        if (directory / "backend" / "app" / "modules").exists():
            return directory
        if (directory / "app" / "modules").exists():
            parent = directory.parent
            return parent if (parent / "backend").exists() else directory
    return None


# ---------------------------------------------------------------------------
# Command
# ---------------------------------------------------------------------------

@click.command("scaffold-page")
@click.argument("resource")
@click.argument("page_type", type=click.Choice(["list", "show", "edit", "create"]))
@click.option("--module", "module_name", default=None,
              help="Module name (auto-detected from frontend/src/pages/ if omitted).")
@click.option("--project-root", default=None,
              help="Project root directory (default: auto-detected from CWD).")
def scaffold_page(resource: str, page_type: str, module_name: Optional[str], project_root: Optional[str]):
    """Scaffold a custom page component for a model resource.

    \b
    Generates a ready-to-customize React component that wraps the Dynamic
    page for the given resource/page-type pair, then registers it as the
    default page in App.tsx.

    \b
    Examples:
      veloiq scaffold-page task show
      veloiq scaffold-page project list
      veloiq scaffold-page team_member edit
      veloiq scaffold-page invoice create
    """
    resource = resource.strip().lower().replace("-", "_")

    root = Path(project_root).resolve() if project_root else _find_project_root()
    if root is None:
        click.echo(
            "❌  Could not locate a VeloIQ project from the current directory.\n"
            "   Run this command from inside a project, or pass --project-root.",
            err=True,
        )
        raise SystemExit(1)

    # ── Detect module ──────────────────────────────────────────────────────
    schema_path: Optional[Path] = None
    if module_name:
        module_slug = module_name.strip().lower()
        # Try to find the schema file for the provided module
        for candidate in [
            root / "frontend" / "src" / "pages" / module_slug / f"{module_slug}Schema.gen.ts",
            root / "frontend" / "src" / "pages" / module_slug / f"{module_slug}Schema.ts",
        ]:
            if candidate.exists():
                schema_path = candidate
                break
    else:
        result = _find_module_for_resource(root, resource)
        if result:
            module_slug, schema_path = result
        else:
            # Could not auto-detect; default to resource name as module
            module_slug = resource
            click.echo(
                f"⚠️  Could not auto-detect module for resource '{resource}' "
                f"(run `veloiq generate` first, or pass --module).\n"
                f"   Using '{module_slug}' as the module name.",
            )

    # ── Parse model metadata ───────────────────────────────────────────────
    if schema_path:
        model_meta = _parse_gen_ts_simple(schema_path, resource)
    else:
        model_meta = _fallback_meta(resource)

    name       = model_meta["name"]
    page_label = _PAGE_LABEL[page_type]
    comp_name  = f"Custom{name}{page_label}"

    click.echo(f"\n📄 Scaffolding custom {page_label} page for {name}  (resource: {resource})")
    click.echo(f"   Module: {module_slug}\n")

    # ── Generate TSX file ──────────────────────────────────────────────────
    pages_dir = root / "frontend" / "src" / "pages" / module_slug
    tsx_path  = pages_dir / f"{comp_name}.tsx"

    if tsx_path.exists():
        click.echo(f"  ⚠️  {_rel(root, tsx_path)} already exists — skipping (delete it to regenerate).")
    else:
        tsx_content = _build_tsx(model_meta, page_type, module_slug)
        pages_dir.mkdir(parents=True, exist_ok=True)
        tsx_path.write_text(tsx_content, encoding="utf-8")
        click.echo(f"  📄 {_rel(root, tsx_path)}")

    # ── Import path for custom_pages.ts  (relative to frontend/src/) ──────
    import_path = f"./pages/{module_slug}/{comp_name}"

    # ── Create or update custom_pages.ts ──────────────────────────────────
    custom_pages_path = root / "frontend" / "src" / "custom_pages.ts"
    if not custom_pages_path.exists():
        _create_custom_pages_ts(custom_pages_path, resource, comp_name, import_path, page_type)
        click.echo(f"  📄 {_rel(root, custom_pages_path)}  (created)")
    else:
        # Check if this entry already exists
        existing = custom_pages_path.read_text(encoding="utf-8")
        if f'"{resource}": {comp_name}' in existing:
            click.echo(f"  ⚠️  {_rel(root, custom_pages_path)} already contains '{resource}' for {page_type} — skipping.")
        else:
            _update_custom_pages_ts(custom_pages_path, resource, comp_name, import_path, page_type)
            click.echo(f"  ✏️  {_rel(root, custom_pages_path)}  (updated)")

    # ── Patch App.tsx ──────────────────────────────────────────────────────
    patched = _patch_app_tsx(root)
    app_rel = _rel(root, root / "frontend" / "src" / "App.tsx")
    if patched:
        click.echo(f"  ✏️  {app_rel}  (patched: imports + render helpers + map loop)")
    else:
        click.echo(f"  ✅ {app_rel}  (already supports custom_pages — no changes)")

    click.echo(f"\n✅  Custom {page_label} page scaffolded for '{resource}'.")
    click.echo("\nNext steps:")
    click.echo(f"  1. Customize  frontend/src/pages/{module_slug}/{comp_name}.tsx")
    click.echo("  2. Run        cd frontend && npm run dev  to test in the browser")
    click.echo(f"  3. To revert: remove the \"{resource}\" entry from custom_pages.ts")


def _rel(root: Path, path: Path) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)
