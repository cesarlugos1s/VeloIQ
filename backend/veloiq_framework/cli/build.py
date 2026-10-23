"""veloiq build — build the host app frontend for production."""
import shutil
import subprocess
from pathlib import Path

import click


@click.command()
@click.option("--frontend-dir", default=None, help="Path to frontend directory (default: auto-detected).")
def build(frontend_dir):
    """Build the frontend for production deployment.

    \b
    Runs `npm run build` in the frontend/ directory, producing frontend/dist/.
    FastAPI will serve that dist/ automatically on next startup — no separate
    Vite dev server needed.

    \b
    Examples:
      veloiq build
      veloiq build --frontend-dir /path/to/frontend
    """
    if frontend_dir:
        fdir = Path(frontend_dir).resolve()
    else:
        fdir = _detect_frontend_dir()

    if not fdir.exists():
        click.echo(f"❌ Frontend directory not found: {fdir}", err=True)
        raise SystemExit(1)

    if not (fdir / "package.json").exists():
        click.echo(f"❌ No package.json found in {fdir}", err=True)
        raise SystemExit(1)

    from veloiq_framework.cli.ui_vendor import sync_ui_vendor
    sync_ui_vendor(fdir)

    click.echo(f"🔨 Building frontend: {fdir}")
    # bare "npm" resolves to npm.cmd on Windows, which subprocess can't
    # execute without shell=True — shutil.which finds the real executable
    # (npm.cmd/npm.exe) on every platform. Confirmed via a live crash:
    # FileNotFoundError: [WinError 2] The system cannot find the file specified.
    npm = shutil.which("npm") or "npm"
    result = subprocess.run([npm, "run", "build"], cwd=str(fdir))
    if result.returncode != 0:
        raise SystemExit(result.returncode)

    dist = fdir / "dist"
    click.echo(f"✅ Frontend built → {dist}")

    # The external portals declared in veloiq.toml, served at /portals/<site>/.
    failed_portal_sites = _build_declared_portals(npm, fdir.parent)

    click.echo("   Run `veloiq run` — the app UI is now served at /")
    if failed_portal_sites:
        click.echo(f"❌ Portals not built: {', '.join(failed_portal_sites)}", err=True)
    from veloiq_framework.upsells import render_cli_advisory
    block1, block2 = render_cli_advisory()
    click.echo(click.style(block1, dim=True))
    click.echo(click.style(block2, dim=True))
    if failed_portal_sites:
        raise SystemExit(1)


def _build_declared_portals(npm: str, project_root: Path) -> list[str]:
    """Build every portal of ``veloiq.toml`` with the Vite base ``/portals/<site>/``.

    Returns the sites whose build failed (each one is reported; the others
    are still built). A portal folder without ``package.json`` is skipped.
    """
    from veloiq_framework.cli.ui_vendor import sync_ui_vendor
    from veloiq_framework.portals.read_portal_definitions import read_portal_definitions
    from veloiq_framework.portals.serve_built_portals import portal_url_path

    failed_sites: list[str] = []
    for portal in read_portal_definitions(project_root).values():
        portal_dir = (project_root / portal.folder).resolve()
        if not (portal_dir / "package.json").exists():
            click.echo(f"⏭️  Portal {portal.site}: no package.json in {portal_dir} — skipped")
            continue
        if not (portal_dir / "node_modules").is_dir():
            click.echo(f"⚠️  Portal {portal.site}: run `npm install` in {portal_dir} first")
            failed_sites.append(portal.site)
            continue
        sync_ui_vendor(portal_dir)
        click.echo(f"🔨 Building portal {portal.site}: {portal_dir}")
        result = subprocess.run(
            [npm, "run", "build", "--", "--base", f"{portal_url_path(portal.site)}/"],
            cwd=str(portal_dir),
        )
        if result.returncode != 0:
            click.echo(f"❌ Portal {portal.site}: build failed", err=True)
            failed_sites.append(portal.site)
            continue
        click.echo(f"✅ Portal {portal.site} built → served at {portal_url_path(portal.site)}/")
    return failed_sites


def _detect_frontend_dir() -> Path:
    candidates = [
        Path("frontend"),
        Path("../frontend"),
    ]
    for p in candidates:
        resolved = p.resolve()
        if resolved.exists() and (resolved / "package.json").exists():
            return resolved
    return Path("frontend").resolve()
