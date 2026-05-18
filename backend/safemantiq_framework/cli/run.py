"""safem run — start the SafeMantIQ development server."""
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
      safem run
      safem run --port 8080
      safem run --host 0.0.0.0 --no-reload
    """
    # Load .env if present
    _load_env(env_file)

    # Determine the ASGI app path
    if app_path is None:
        app_path = _detect_app_path()

    cmd = [sys.executable, "-m", "uvicorn", app_path, f"--host={host}", f"--port={port}"]
    if not no_reload:
        cmd.append("--reload")

    click.echo(f"🚀 Starting SafeMantIQ server: {app_path} on {host}:{port}")
    result = subprocess.run(cmd)
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


def _detect_app_path() -> str:
    """Return the most likely ASGI app import path for the current project."""
    candidates = [
        ("app/main.py", "app.main:app"),
        ("backend/app/main.py", "app.main:app"),
        ("main.py", "main:app"),
    ]
    for file_path, import_path in candidates:
        if Path(file_path).exists():
            return import_path
    return "app.main:app"
