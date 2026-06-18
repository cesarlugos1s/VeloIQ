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
    if app_path is None:
        app_path, cwd = _detect_app_path()
    else:
        cwd = None

    cmd = [sys.executable, "-m", "uvicorn", app_path, f"--host={host}", f"--port={port}"]
    if not no_reload:
        cmd.extend(["--reload", "--reload-delay", "2"])

    click.echo(f"🚀 Starting VeloIQ server: {app_path} on {host}:{port}")
    result = subprocess.run(cmd, cwd=cwd)
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


def _detect_app_path() -> tuple[str, str | None]:
    """Return (import_path, cwd) for the most likely ASGI app in the current project."""
    candidates = [
        ("app/main.py", "app.main:app", None),
        ("backend/app/main.py", "app.main:app", "backend"),
        ("main.py", "main:app", None),
    ]
    for file_path, import_path, cwd in candidates:
        if Path(file_path).exists():
            return import_path, cwd
    return "app.main:app", None
