"""``veloiq generate`` for external portals: each portal's page schemas and menu.

For every ``[portals.<site>]`` of ``veloiq.toml`` whose folder exists, and every
app module with models the portal's roles can read (see
``portal_role_read_access``), this writes into ``<folder>/src/``:

- ``pages/<module>/<module>Schema.gen.ts``: the module's models with only the
  fields and relations the roles can read — regenerated every time;
- ``pages/<module>/<module>Schema.manual.ts``: the portal's own overrides
  (labels, field order, view types, ``omit``…) — created once, never overwritten;
- ``pages/<module>/<module>Schema.ts``: the two merged by ``mergeUiModelSchemas``;
- ``portalModels.gen.ts``: the modules for ``VeloIQPortalApp``'s ``moduleRegistrations``;
- ``navigation.<site>.config.json``: the portal's menu — created once with the
  readable modules and models, then never touched, so the site's own menu
  (entries removed, reordered, ``page`` entries added) is kept.

The same generator as the app's own schemas is used (``_build_ts_schema_lines``,
``_write_manual_schema_if_missing``, ``_write_merged_schema``), with the
portal's roles as the one extra input.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from veloiq_framework.portals.portal_role_read_access import model_readable_by_roles
from veloiq_framework.portals.read_portal_definitions import PortalDefinition, read_portal_definitions


def portal_navigation_config_file_name(site: str) -> str:
    """Return the file name of the portal *site*'s menu (``navigation.<site>.config.json``)."""
    return f"navigation.{site}.config.json"


def _portal_generated_header(portal: PortalDefinition) -> str:
    """First line of the portal's generated files."""
    return (f"// AUTO-GENERATED for the portal \"{portal.site}\" (roles: {', '.join(portal.roles)}) "
            f"— do not edit. Run `veloiq generate` to update.")


def _write_portal_module_schema(portal: PortalDefinition, module_name: str, readable_models: list,
                                portal_pages_dir: Path) -> None:
    """Write the three schema files of *module_name* for *portal*."""
    from veloiq_framework.api_schema_gen import (
        _build_ts_schema_lines,
        _write_manual_schema_if_missing,
        _write_merged_schema,
    )

    out_dir = portal_pages_dir / module_name
    out_dir.mkdir(parents=True, exist_ok=True)
    schema_lines = _build_ts_schema_lines(
        module_name, readable_models,
        portal_roles=portal.roles, generated_header=_portal_generated_header(portal),
    )
    schema_lines += ["];", "", f"export default {module_name}ModelsGen;", ""]
    (out_dir / f"{module_name}Schema.gen.ts").write_text("\n".join(schema_lines))
    _write_manual_schema_if_missing(module_name, out_dir)
    _write_merged_schema(module_name, out_dir)


def _write_portal_model_registrations(portal: PortalDefinition, module_names: list[str], portal_src: Path) -> None:
    """Write ``portalModels.gen.ts``: the portal's modules for ``VeloIQPortalApp``."""
    lines = [
        _portal_generated_header(portal),
        "import type { PortalModuleRegistration } from '@juicemantics/veloiq-ui';",
        *[f'import {{ {module}Models }} from "./pages/{module}/{module}Schema";' for module in module_names],
        "",
        "export const portalModuleRegistrations: PortalModuleRegistration[] = [",
        *[f'  {{ moduleName: "{module}", models: {module}Models ?? [] }},' for module in module_names],
        "];",
        "",
    ]
    (portal_src / "portalModels.gen.ts").write_text("\n".join(lines))


def _write_portal_navigation_config_if_missing(portal: PortalDefinition, readable_models_by_module: dict[str, list],
                                                portal_src: Path) -> None:
    """Create the portal's menu with its readable modules and models, unless it already exists."""
    from veloiq_framework.api_schema_gen import _guess_icon_py

    navigation_file = portal_src / portal_navigation_config_file_name(portal.site)
    if navigation_file.exists():
        return
    entries: list[dict] = []
    for module_sequence, (module_name, models) in enumerate(readable_models_by_module.items(), start=1):
        module_label = module_name.replace("_", " ").title()
        entries.append({
            "key": f"module:{module_name}",
            "label": module_label,
            "icon": _guess_icon_py(module_label, is_module=True),
            "sequence": module_sequence * 10,
            "type": "module",
        })
        for model_sequence, model_class in enumerate(models, start=1):
            model_label = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", model_class.__name__)
            entries.append({
                "key": getattr(model_class, "__tablename__", None) or model_class.__name__.lower(),
                "label": model_label,
                "icon": _guess_icon_py(model_label, is_module=False),
                "sequence": module_sequence * 10 + model_sequence,
                "type": "model",
            })
    navigation_file.write_text(json.dumps(entries, indent=2))
    print(f"  📐 {portal.site}: {navigation_file.name} (created)")


def generate_portal_page_schemas(project_root: Path, module_entity_models: dict[str, list]) -> None:
    """Write every declared portal's page schemas and (first time) menu.

    :param project_root: The host app's root (holds ``veloiq.toml``).
    :param module_entity_models: The app's entity models by module, as generated
        for the app's own pages.
    """
    portal_definitions = read_portal_definitions(project_root)
    for portal in portal_definitions.values():
        portal_folder = project_root / portal.folder
        if not portal_folder.is_dir():
            print(f"  ⏭️  portal {portal.site}: folder {portal.folder} not found — skipped")
            continue
        if not portal.roles:
            print(f"  ⏭️  portal {portal.site}: no roles declared — skipped")
            continue
        portal_src = portal_folder / "src"
        portal_pages_dir = portal_src / "pages"
        readable_models_by_module: dict[str, list] = {}
        for module_name, models in module_entity_models.items():
            readable_models = [model for model in models if model_readable_by_roles(model, portal.roles)]
            if readable_models:
                readable_models_by_module[module_name] = readable_models
        for module_name, readable_models in readable_models_by_module.items():
            _write_portal_module_schema(portal, module_name, readable_models, portal_pages_dir)
        _write_portal_model_registrations(portal, list(readable_models_by_module), portal_src)
        _write_portal_navigation_config_if_missing(portal, readable_models_by_module, portal_src)
        model_count = sum(len(models) for models in readable_models_by_module.values())
        print(f"📦 portal {portal.site}: {len(readable_models_by_module)} module(s), {model_count} model(s) "
              f"readable by {', '.join(portal.roles)}")
