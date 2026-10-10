"""Keep a host app's vendored copy of @juicemantics/veloiq-ui in step with the framework.

Some host apps depend on the UI package through a ``file:`` link to a copy kept
inside the app (e.g. ``"file:./.veloiq-ui-vendor"``) instead of the npm registry.
Nothing refreshed that copy when the framework moved on, so `veloiq generate`
could emit App.tsx code importing an export the stale copy lacked — e.g.
``"helpSystemModels" is not exported by ".veloiq-ui-vendor/dist/index.mjs"``
at `veloiq build` time.

When the framework is a source checkout (editable install), its built
``packages/ui`` sits next to the backend; this module mirrors that build into
the app's linked copy.  Registry specs, and links that already point at
``packages/ui`` itself, are left alone.
"""
import filecmp
import json
import shutil
from pathlib import Path
from typing import Optional

import click

_UI_PACKAGE = "@juicemantics/veloiq-ui"


def _framework_ui_package() -> Optional[Path]:
    """packages/ui of the framework source checkout, or None for a wheel install."""
    import veloiq_framework
    ui = Path(veloiq_framework.__file__).resolve().parents[2] / "packages" / "ui"
    return ui if (ui / "dist").is_dir() and (ui / "package.json").is_file() else None


def _linked_ui_dir(frontend_dir: Path) -> Optional[Path]:
    """Directory the app's ``file:`` dependency on the UI package points at."""
    try:
        pkg = json.loads((frontend_dir / "package.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    spec = str((pkg.get("dependencies") or {}).get(_UI_PACKAGE, ""))
    if not spec.startswith("file:"):
        return None
    return (frontend_dir / spec[len("file:"):]).resolve()


def _read_pkg(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _dist_is_stale(ui: Path) -> bool:
    """True when packages/ui/src has files newer than its dist build."""
    dist_mtime = min((f.stat().st_mtime for f in (ui / "dist").iterdir() if f.is_file()), default=0)
    src = ui / "src"
    return src.is_dir() and any(
        f.stat().st_mtime > dist_mtime for f in src.rglob("*") if f.is_file()
    )


def sync_ui_vendor(frontend_dir: Path) -> bool:
    """Mirror the framework's packages/ui build into the app's vendored copy.

    Returns True when files were updated.  Never raises: a failed sync only
    prints a warning so generate/build can carry on.
    """
    try:
        return _sync(frontend_dir)
    except OSError as exc:
        click.echo(f"  ⚠️  Could not sync vendored {_UI_PACKAGE}: {exc}", err=True)
        return False


def _sync(frontend_dir: Path) -> bool:
    target = _linked_ui_dir(frontend_dir)
    source = _framework_ui_package()
    if target is None or source is None or not target.is_dir() or target == source.resolve():
        return False

    try:
        rel = target.relative_to(frontend_dir.resolve())
    except ValueError:
        rel = target

    if _dist_is_stale(source):
        click.echo(
            f"  ⚠️  {source}/dist is older than its src/ — run `npm run build` there "
            f"so {rel} gets the latest UI code."
        )

    src_dist, dst_dist = source / "dist", target / "dist"
    src_files = {f.name for f in src_dist.iterdir() if f.is_file()}
    dst_files = {f.name for f in dst_dist.iterdir() if f.is_file()} if dst_dist.is_dir() else set()
    changed = sorted(
        name for name in src_files
        if name not in dst_files or not filecmp.cmp(src_dist / name, dst_dist / name, shallow=False)
    )
    removed = sorted(dst_files - src_files)
    pkg_changed = not filecmp.cmp(source / "package.json", target / "package.json", shallow=False) \
        if (target / "package.json").exists() else True
    if not (changed or removed or pkg_changed):
        return False

    old_pkg, new_pkg = _read_pkg(target / "package.json"), _read_pkg(source / "package.json")

    dst_dist.mkdir(exist_ok=True)
    for name in changed:
        shutil.copy2(src_dist / name, dst_dist / name)
    for name in removed:
        (dst_dist / name).unlink()
    if pkg_changed:
        shutil.copy2(source / "package.json", target / "package.json")

    click.echo(
        f"  🔄 {rel}: synced {_UI_PACKAGE} "
        f"{old_pkg.get('version', '?')} → {new_pkg.get('version', '?')} from {source}"
    )

    installed = frontend_dir / "node_modules" / _UI_PACKAGE
    needs_install = old_pkg.get("dependencies") != new_pkg.get("dependencies") or (
        installed.exists() and installed.resolve() != target
    )
    if needs_install:
        click.echo("      run `npm install` in frontend/ to pick up the updated package")
    return True
