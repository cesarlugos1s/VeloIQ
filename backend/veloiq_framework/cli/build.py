"""veloiq build — build the host app frontend for production."""
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
    result = subprocess.run(["npm", "run", "build"], cwd=str(fdir))
    if result.returncode != 0:
        raise SystemExit(result.returncode)

    dist = fdir / "dist"
    click.echo(f"✅ Frontend built → {dist}")
    click.echo("   Run `veloiq run` — the app UI is now served at /")


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
