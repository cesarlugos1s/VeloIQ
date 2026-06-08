"""veloiq new — scaffold a new VeloIQ project."""
from __future__ import annotations

import re
import shutil
import subprocess
import sys
from pathlib import Path

import click

from veloiq_framework.cli.configure_db import _build_database_url


SCAFFOLD_DIR = Path(__file__).resolve().parents[1] / "scaffold"

# Token substitution applied to every text file in the scaffold.
_TEXT_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".json", ".toml", ".txt", ".md", ".mdc",
    ".ini", ".cfg", ".env", ".example", ".mako", ".html",
}


@click.command()
@click.argument("app_name")
@click.option("--title", default=None, help="Human-readable app title (default: app_name).")
@click.option("--port", default=8000, show_default=True, type=int,
              help="Backend port the frontend proxy will target.")
@click.option("--frontend-port", default=5173, show_default=True, type=int,
              help="Port for the Vite dev server (default: 5173).")
@click.option("--admin-username", default=None,
              help="Admin username for initial seed (default: admin).")
@click.option("--admin-password", default=None,
              help="Admin password for initial seed (default: admin).")
@click.option("--db-type", default="sqlite",
              type=click.Choice(["sqlite", "postgresql", "mysql", "mssql"], case_sensitive=False),
              help="Database engine type (default: sqlite).")
@click.option("--db-host", default=None, help="Database host (default: localhost).")
@click.option("--db-port", default=None, type=int, help="Database port.")
@click.option("--db-name", default=None, help="Database name (default: app_name).")
@click.option("--db-user", default=None, help="Database user (default: veloiq).")
@click.option("--db-password", default=None, help="Database password.")
@click.option("--no-npm-install", is_flag=True, default=False,
              help="Skip automatic npm install in the frontend directory.")
@click.option("--no-pip-install", is_flag=True, default=False,
              help="Skip automatic pip install of backend requirements.")
@click.option("--output-dir", default=None,
              help="Where to create the project (default: ./<app_name>).")
def new(app_name: str, title: str | None, port: int, frontend_port: int,
        admin_username: str | None, admin_password: str | None,
        db_type: str, db_host: str | None, db_port: int | None,
        db_name: str | None, db_user: str | None, db_password: str | None,
        no_npm_install: bool, no_pip_install: bool, output_dir: str | None):
    """Scaffold a new VeloIQ project.

    \b
    Example:
      veloiq new my-app
      veloiq new acme-admin --title "Acme Admin" --port 8080

    After scaffolding:
      cd my-app/backend && cp .env.example .env
      # edit .env: set DATABASE_URL
      veloiq db upgrade
      veloiq run
      # in another terminal:
      cd ../frontend && npm install && npm run dev
    """
    app_name = _slugify(app_name)
    app_title = title or app_name.replace("-", " ").replace("_", " ").title()
    dest = Path(output_dir) if output_dir else Path.cwd() / app_name

    if dest.exists():
        click.echo(f"❌ Directory already exists: {dest}", err=True)
        raise SystemExit(1)

    # Build the database URL from the --db-* options
    database_url = _build_database_url(
        db_type=db_type,
        host=db_host,
        port=db_port,
        name=db_name or app_name,
        user=db_user,
        password=db_password,
    )

    tokens = {
        "{{app_name}}": app_name,
        "{{app_title}}": app_title,
        "{{backend_port}}": str(port),
        "{{frontend_port}}": str(frontend_port),
        "{{admin_username}}": admin_username or "admin",
        "{{admin_password}}": admin_password or "admin",
        "{{database_url}}": database_url,
    }

    click.echo(f"\n🚀 Creating VeloIQ project: {app_title}")
    click.echo(f"   Directory: {dest}\n")

    _copy_scaffold(SCAFFOLD_DIR, dest, tokens)
    _copy_alembic(dest, tokens)

    click.echo(f"\n✅ Project created at {dest}")

    # ── Create .env from .env.example ──────────────────────────────────────
    env_example = dest / "backend" / ".env.example"
    env_file = dest / "backend" / ".env"
    if env_example.exists() and not env_file.exists():
        content = env_example.read_text(encoding="utf-8")
        env_file.write_text(content, encoding="utf-8")
        click.echo("   ✅ Created backend/.env from .env.example")

    # ── Automatic npm install ──────────────────────────────────────────────
    frontend_dir = dest / "frontend"
    if not no_npm_install and (frontend_dir / "package.json").exists():
        click.echo("\n📦 Installing frontend dependencies (npm install) …")
        click.echo(f"   Directory: {frontend_dir}\n")
        try:
            result = subprocess.run(
                ["npm", "install"],
                cwd=str(frontend_dir),
                capture_output=True,
                text=True,
            )
            if result.returncode == 0:
                click.echo("   ✅ Frontend dependencies installed.")
            else:
                click.echo("   ⚠️  npm install exited with a non-zero status.")
                if result.stderr:
                    for line in result.stderr.strip().splitlines():
                        click.echo(f"      {line}")
        except FileNotFoundError:
            click.echo("   ⚠️  npm not found. Install Node.js and run `npm install` manually.")
    elif no_npm_install:
        click.echo("\n   (skipped npm install — use --no-npm-install)")

    # ── Automatic pip install ───────────────────────────────────────────────
    backend_dir = dest / "backend"
    req_file = backend_dir / "requirements.txt"
    if not no_pip_install and req_file.exists():
        click.echo("\n📦 Installing backend dependencies (pip install) …")
        click.echo(f"   Directory: {backend_dir}\n")
        try:
            result = subprocess.run(
                [sys.executable, "-m", "pip", "install", "-r", "requirements.txt"],
                cwd=str(backend_dir),
                capture_output=True,
                text=True,
            )
            if result.returncode == 0:
                click.echo("   ✅ Backend dependencies installed.")
            else:
                click.echo("   ⚠️  pip install exited with a non-zero status.")
                if result.stderr:
                    for line in result.stderr.strip().splitlines():
                        click.echo(f"      {line}")
        except FileNotFoundError:
            click.echo("   ⚠️  pip not found. Install Python and run `pip install -r requirements.txt` manually.")
    elif no_pip_install:
        click.echo("\n   (skipped pip install — use --no-pip-install)")

    # ── Automatic veloiq generate ─────────────────────────────────────────────
    click.echo("\n  Running: veloiq generate\n")
    try:
        result = subprocess.run(
            [sys.executable, "-m", "veloiq_framework.cli", "generate"],
            cwd=str(backend_dir),
            capture_output=True,
            text=True,
        )
        if result.stdout:
            for line in result.stdout.strip().splitlines():
                click.echo(f"  {line}")
        if result.returncode != 0 and result.stderr:
            for line in result.stderr.strip().splitlines():
                click.echo(f"  {line}")
    except FileNotFoundError:
        click.echo("  ⚠️  Could not run veloiq generate — run it manually after adding modules.")

    click.echo("\nNext steps:")
    click.echo(f"  cd {dest}")
    click.echo("\n  # Backend")
    click.echo("  cd backend")
    if no_pip_install:
        click.echo("  pip install -r requirements.txt")
    click.echo("  veloiq run                   # tables are created automatically on first start")
    click.echo("\n  # Frontend (second terminal)")
    click.echo(f"  cd {dest}/frontend")
    if no_npm_install:
        click.echo("  npm install")
    click.echo("  npm run dev")
    click.echo("\n⭐ If VeloIQ saves you time, a star helps others find it:")
    click.echo("   https://github.com/cesarlugos1s/VeloIQ")


# ---------------------------------------------------------------------------
# Scaffold copying
# ---------------------------------------------------------------------------

def _copy_scaffold(src_dir: Path, dest_dir: Path, tokens: dict[str, str]) -> None:
    """Recursively copy the scaffold directory, applying token substitution."""
    for src_path in src_dir.rglob("*"):
        if src_path.is_dir():
            continue
        # Compute relative path from scaffold root
        rel = src_path.relative_to(src_dir)
        dest_path = dest_dir / rel
        dest_path.parent.mkdir(parents=True, exist_ok=True)

        if src_path.suffix in _TEXT_EXTENSIONS or src_path.name.startswith("."):
            try:
                content = src_path.read_text(encoding="utf-8")
                for token, value in tokens.items():
                    content = content.replace(token, value)
                dest_path.write_text(content, encoding="utf-8")
            except UnicodeDecodeError:
                shutil.copy2(src_path, dest_path)
        else:
            shutil.copy2(src_path, dest_path)

        click.echo(f"  📄 {rel}")


def _copy_alembic(dest_dir: Path, tokens: dict[str, str]) -> None:
    """Copy the framework's Alembic scaffold into backend/alembic/."""
    pkg_root = Path(__file__).resolve().parents[1]  # veloiq_framework/
    alembic_src = pkg_root / "alembic_scaffold"
    if not alembic_src.exists():
        click.echo("  ⚠️  Alembic scaffold not found — skipping.")
        return

    alembic_dest = dest_dir / "backend" / "alembic"
    alembic_ini_src = pkg_root / "alembic_scaffold.ini"
    alembic_ini_dest = dest_dir / "backend" / "alembic.ini"

    for src_path in alembic_src.rglob("*"):
        if src_path.is_dir():
            continue
        rel = src_path.relative_to(alembic_src)
        dest_path = alembic_dest / rel
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            content = src_path.read_text(encoding="utf-8")
            for token, value in tokens.items():
                content = content.replace(token, value)
            dest_path.write_text(content, encoding="utf-8")
        except UnicodeDecodeError:
            shutil.copy2(src_path, dest_path)
        click.echo(f"  📄 backend/alembic/{rel}")

    if alembic_ini_src.exists():
        try:
            content = alembic_ini_src.read_text(encoding="utf-8")
            alembic_ini_dest.write_text(content, encoding="utf-8")
        except Exception:
            shutil.copy2(alembic_ini_src, alembic_ini_dest)
        click.echo("  📄 backend/alembic.ini")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _slugify(name: str) -> str:
    """Convert any string to a safe directory/package name."""
    name = name.strip().lower()
    name = re.sub(r"[^a-z0-9_-]", "-", name)
    name = re.sub(r"-+", "-", name).strip("-")
    return name or "my-app"
