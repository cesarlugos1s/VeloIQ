"""veloiq i18n — manage translation catalogs.

VeloIQ and each extension ship one ``messages.po`` per locale under their
``locales/`` directory, holding both their backend and frontend UI strings.
A host app's own catalog (``backend/config/internationalization/locales``)
sits on top and overrides any of them (see ``utils/i18n_utils.py``).

  veloiq i18n extract <package_dir>   add a package's new _() strings to its catalogs
  veloiq i18n migrate                 reduce a host app's catalogs to its own strings and overrides
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Dict, List, Optional

import click

from veloiq_framework.utils import i18n_utils
from veloiq_framework.utils.po_catalog import (
    append_entries,
    extract_msgids,
    locale_po_path,
    read_po,
)


@click.group()
def i18n() -> None:
    """Manage translation catalogs (VeloIQ, extensions and the host app)."""


# ---------------------------------------------------------------------------
# extract
# ---------------------------------------------------------------------------

@i18n.command("extract")
@click.argument("package_dir", type=click.Path(exists=True, file_okay=False, path_type=Path))
@click.option("--source", "sources", multiple=True, type=click.Path(exists=True, file_okay=False, path_type=Path),
              help="Extra directory to scan for _() strings (repeatable), e.g. a separate UI package. "
                   "PACKAGE_DIR itself is always scanned.")
@click.option("--locale", "locales", multiple=True,
              help="Locale to update (repeatable). Default: every locale PACKAGE_DIR/locales has, plus en.")
@click.option("--check", is_flag=True,
              help="Change nothing; exit 1 when a catalog is missing strings or has untranslated ones.")
def extract(package_dir: Path, sources: tuple, locales: tuple, check: bool) -> None:
    """Add PACKAGE_DIR's new _() strings to its catalogs.

    Scans PACKAGE_DIR (and any --source) for _("...") calls in .py, .ts and
    .tsx files, then appends every string a locale's
    PACKAGE_DIR/locales/<locale>/LC_MESSAGES/messages.po doesn't have yet,
    untranslated. Existing entries are never changed or removed, since
    some are looked up by computed keys (model and field names).

    \b
    Examples:
      veloiq i18n extract backend/veloiq_framework --source packages/ui/src
      veloiq i18n extract backend/iqvigilant
    """
    locales_dir = package_dir / "locales"
    msgids: List[str] = []
    for root in (package_dir, *sources):
        for msgid in extract_msgids(root):
            if msgid not in msgids:
                msgids.append(msgid)

    targets = list(locales) or sorted(
        {d.name for d in locales_dir.iterdir() if d.is_dir()} | {"en"} if locales_dir.is_dir() else {"en"}
    )
    problems = 0
    for locale in targets:
        po = locale_po_path(locales_dir, locale)
        existing = read_po(po)
        missing = [m for m in msgids if m not in existing]
        untranslated = [m for m, s in existing.items() if not s] if locale != "en" else []
        if check:
            if missing or untranslated:
                problems += 1
            click.echo(f"  {locale}: {len(missing)} missing, {len(untranslated) + len(missing) if locale != 'en' else 0} untranslated")
            continue
        added = append_entries(po, locale, [(m, "") for m in missing],
                               comment="Added by veloiq i18n extract")
        still = (len(untranslated) + added) if locale != "en" else 0
        click.echo(f"  {locale}: {added} added, {still} untranslated  ({po})")
    if check and problems:
        raise SystemExit(1)


# ---------------------------------------------------------------------------
# migrate
# ---------------------------------------------------------------------------

def _find_project_root() -> Optional[Path]:
    """Walk up from CWD looking for backend/app/modules/."""
    cwd = Path.cwd().resolve()
    for directory in [cwd, *cwd.parents]:
        if (directory / "backend" / "app" / "modules").exists():
            return directory
        if (directory / "app" / "modules").exists():
            return directory.parent if (directory.parent / "backend").exists() else directory
    return None


def _package_layers(root: Path) -> List[Path]:
    """VeloIQ's catalogs dir, then each enabled extension's, lowest priority first."""
    from veloiq_framework.extension_registry import read_enabled_extensions
    from veloiq_framework.extensions import discover_extensions

    enabled = read_enabled_extensions(root)
    extensions = sorted(
        discover_extensions(enabled),
        key=lambda ext: enabled.index(ext.name) if ext.name in enabled else len(enabled),
    )
    dirs = [i18n_utils.FRAMEWORK_LOCALES_DIR]
    dirs += [d for d in (ext.resolved_locales_dir() for ext in extensions) if d is not None]
    return dirs


def _packages_catalog(layers: List[Path], locale: str) -> Dict[str, str]:
    """The packages' merged translations for ``locale`` (no host layer)."""
    canonical = i18n_utils._canonicalize_locale(locale)
    merged: Dict[str, str] = {}
    for layer in layers:
        for po in i18n_utils._layer_po_files(layer, canonical):
            merged.update({k: v for k, v in read_po(po).items() if v})
    return merged


def _host_locales_dir(root: Path) -> Path:
    backend = root / "backend"
    configured = os.getenv("VELOIQ_I18N_LOCALES_DIR")
    if configured:
        path = Path(configured)
        return path if path.is_absolute() else backend / path
    return backend / "config" / "internationalization" / "locales"


@i18n.command("migrate")
@click.option("--dry-run", is_flag=True, help="Report what would move; change nothing.")
@click.option("--keep-json", is_flag=True,
              help="Keep frontend/public/i18n/*.json after moving their entries (default: delete them).")
def migrate(dry_run: bool, keep_json: bool) -> None:
    """Reduce this host app's translations to its own strings and overrides.

    VeloIQ and the enabled extensions now ship their own catalogs, so a host
    app no longer needs copies of their translations. For each
    frontend/public/i18n/<locale>.json this keeps only the entries the
    packages don't provide, or translate differently, and moves them into
    the host app's backend/config/internationalization/locales/<locale>/
    LC_MESSAGES/messages.po, which serves both the backend and the UI.
    Entries already in that catalog are left as they are.
    """
    root = _find_project_root()
    if root is None:
        raise click.ClickException("Run this inside a VeloIQ app (no backend/app/modules found).")

    json_dir = root / "frontend" / "public" / "i18n"
    json_files = sorted(json_dir.glob("*.json")) if json_dir.is_dir() else []
    if not json_files:
        click.echo("No frontend/public/i18n/*.json catalogs to migrate.")
        return

    layers = _package_layers(root)
    host_dir = _host_locales_dir(root)
    click.echo("Package catalogs: " + ", ".join(str(p) for p in layers))
    click.echo(f"Host catalog:     {host_dir}")

    for json_file in json_files:
        locale = json_file.stem
        try:
            data = json.loads(json_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            click.echo(f"  {json_file.name}: skipped, can't be read ({exc})")
            continue
        if not isinstance(data, dict):
            click.echo(f"  {json_file.name}: skipped, not a JSON object")
            continue

        packages = _packages_catalog(layers, locale)
        host_po = locale_po_path(host_dir, locale)
        host_existing = read_po(host_po)

        dropped_copy = dropped_identity = already = 0
        keep_override: List[tuple] = []
        keep_own: List[tuple] = []
        for key, value in data.items():
            if not isinstance(value, str) or not value or value == key:
                dropped_identity += 1
            elif key in host_existing:
                already += 1
            elif key not in packages:
                keep_own.append((key, value))
            elif packages[key] == value:
                dropped_copy += 1
            else:
                keep_override.append((key, value))

        click.echo(
            f"  {json_file.name}: {len(data)} entries -> "
            f"{len(keep_own)} app strings + {len(keep_override)} overrides move to the host catalog; "
            f"{dropped_copy} copies of package translations and {dropped_identity} untranslated dropped; "
            f"{already} already in the host catalog"
        )
        if dry_run:
            for key, value in keep_override[:20]:
                click.echo(f"      override: {key!r}: {packages[key]!r} -> {value!r}")
            continue

        if keep_own:
            append_entries(host_po, locale, keep_own,
                           comment=f"App strings moved from frontend/public/i18n/{json_file.name} by veloiq i18n migrate")
        if keep_override:
            append_entries(host_po, locale, keep_override,
                           comment="Overrides of VeloIQ/extension translations moved from "
                                   f"frontend/public/i18n/{json_file.name} by veloiq i18n migrate")
        if not keep_json:
            json_file.unlink()
            built = root / "frontend" / "dist" / "i18n" / json_file.name
            if built.is_file():
                built.unlink()

    vite_config = next((p for p in (root / "frontend").glob("vite.config.*")), None)
    if vite_config is not None and '"/i18n"' not in vite_config.read_text(encoding="utf-8"):
        click.echo(
            f"\nWarning: {vite_config.relative_to(root)} has no \"/i18n\" proxy. In development the UI "
            "loads its catalog from the backend's /i18n/<locale>.json, so add one next to \"/api\"."
        )
    if dry_run:
        click.echo("\nDry run: nothing changed.")
