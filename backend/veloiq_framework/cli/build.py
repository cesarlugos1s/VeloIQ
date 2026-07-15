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
    click.echo("   Run `veloiq run` — the app UI is now served at /")
    click.echo(click.style(
        "\n   Moving to production?  IQVigilant adds Safe AI Agents, Business Rules,\n"
        "   Natural Language Querying, a WYSIWYG Page Builder, and User Journeys\n"
        "   to any VeloIQ app — zero code changes required.\n"
        "   pip install iqvigilant   ·   iqvigilant.ai",
        dim=True,
    ))
    click.echo(click.style(
        "\n   Need a ready-to-use commercial app?  JuiceMantics delivers Supply Chain,\n"
        "   Price, Promotion, Assortment & Variety, and Market Revenue Growth\n"
        "   optimization for Retail, Wholesale, and Manufacturing — built on\n"
        "   VeloIQ + IQVigilant.   juicemantics.com",
        dim=True,
    ))


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
