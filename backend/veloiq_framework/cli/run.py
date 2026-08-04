"""veloiq run — start the VeloIQ development server."""
import os
import subprocess
import sys
from pathlib import Path

import click


@click.command()
@click.option("--host", default="0.0.0.0", show_default=True, help="Bind host.")
@click.option("--port", default=8000, show_default=True, type=int, help="Bind port.")
@click.option("--no-reload", is_flag=True, default=False, help="Disable auto-reload.")
@click.option("--app", "app_path", default=None,
              help="ASGI app path (default: auto-detected).")
@click.option("--env-file", default=".env", show_default=True,
              help="Load environment from this file before starting.")
def run(host, port, no_reload, app_path, env_file):
    """Start the development server with uvicorn.

    \b
    Examples:
      veloiq run
      veloiq run --port 8080
      veloiq run --host 0.0.0.0 --no-reload
    """
    # Load .env if present
    _load_env(env_file)

    # Determine the ASGI app path
    frontend_dist = None
    if app_path is None:
        app_path, cwd, frontend_dist = _detect_app_path()
    else:
        cwd = None

    cmd = [sys.executable, "-m", "uvicorn", app_path, f"--host={host}", f"--port={port}"]
    if not no_reload:
        cmd.extend(["--reload", "--reload-delay", "2"])

    env = os.environ.copy()
    if frontend_dist is not None:
        # `veloiq build` prints "Run `veloiq run` — the app UI is now served
        # at /" — VeloIQConfig.serve_frontend defaults from this env var, so
        # setting it here (rather than requiring every host app to wire
        # serve_frontend=... by hand) is what actually makes that promise
        # true, for both `veloiq run` and any other command that shells out
        # to uvicorn the same way.
        env["VELOIQ_SERVE_FRONTEND"] = str(frontend_dist)
        click.echo(f"  📦 Serving built frontend from {frontend_dist}")

    click.echo(f"🚀 Starting VeloIQ server: {app_path} on {host}:{port}")
    result = subprocess.run(cmd, cwd=cwd, env=env)
    raise SystemExit(result.returncode)


def _load_env(env_file: str) -> None:
    """Load variables from *env_file* into the current process environment."""
    env_path = Path(env_file)
    if not env_path.exists():
        # Try backend/ subdirectory
        env_path = Path("backend") / env_file
    if not env_path.exists():
        return
    try:
        from dotenv import load_dotenv
        load_dotenv(env_path, override=False)
        click.echo(f"  ✅ Loaded {env_path}")
    except ImportError:
        pass


def _detect_app_path() -> tuple[str, str | None, Path | None]:
    """Return (import_path, cwd, frontend_dist) for the most likely ASGI app
    in the current project. frontend_dist is the built frontend/dist/
    directory *if it exists* — i.e. `npm run build` / `veloiq build` has
    already been run — so that a build followed by `veloiq run` serves the
    production UI at / without any extra host-app wiring.
    """
    candidates = [
        ("app/main.py", "app.main:app", None, Path("../frontend/dist")),
        ("backend/app/main.py", "app.main:app", "backend", Path("frontend/dist")),
        ("main.py", "main:app", None, None),
    ]
    for file_path, import_path, cwd, dist_rel in candidates:
        if Path(file_path).exists():
            frontend_dist = None
            if dist_rel is not None:
                candidate_dist = (Path.cwd() / dist_rel).resolve()
                if candidate_dist.is_dir():
                    frontend_dist = candidate_dist
            return import_path, cwd, frontend_dist
    return "app.main:app", None, None
