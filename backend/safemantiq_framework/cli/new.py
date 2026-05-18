"""safem new — scaffold a new SafeMantIQ project."""
from __future__ import annotations

import re
import shutil
from pathlib import Path

import click


SCAFFOLD_DIR = Path(__file__).resolve().parents[1] / "scaffold"

# Token substitution applied to every text file in the scaffold.
_TEXT_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".json", ".toml", ".txt", ".md",
    ".ini", ".cfg", ".env", ".example", ".mako", ".html",
}


@click.command()
@click.argument("app_name")
@click.option("--title", default=None, help="Human-readable app title (default: app_name).")
@click.option("--port", default=8000, show_default=True, type=int,
              help="Backend port the frontend proxy will target.")
@click.option("--output-dir", default=None,
              help="Where to create the project (default: ./<app_name>).")
def new(app_name: str, title: str | None, port: int, output_dir: str | None):
    """Scaffold a new SafeMantIQ project.

    \b
    Example:
      safem new my-app
      safem new acme-admin --title "Acme Admin" --port 8080

    After scaffolding:
      cd my-app/backend && cp .env.example .env
      # edit .env: set DATABASE_URL
      safem db upgrade
      safem run
      # in another terminal:
      cd ../frontend && npm install && npm run dev
    """
    app_name = _slugify(app_name)
    app_title = title or app_name.replace("-", " ").replace("_", " ").title()
    dest = Path(output_dir) if output_dir else Path.cwd() / app_name

    if dest.exists():
        click.echo(f"❌ Directory already exists: {dest}", err=True)
        raise SystemExit(1)

    # Resolve the local @safemantiq/ui package path so the scaffold
    # package.json can reference it with a file: specifier instead of the
    # npm registry (the package is not published yet).
    package_root = Path(__file__).resolve().parents[2]  # backend/
    ui_pkg_path = (package_root.parent / "packages" / "ui").resolve()
    ui_src_path = ui_pkg_path / "src" / "index.ts"

    tokens = {
        "{{app_name}}": app_name,
        "{{app_title}}": app_title,
        "{{backend_port}}": str(port),
        "{{ui_package_path}}": str(ui_pkg_path),
        "{{ui_src_path}}": str(ui_src_path),
    }

    click.echo(f"\n🚀 Creating SafeMantIQ project: {app_title}")
    click.echo(f"   Directory: {dest}\n")

    _copy_scaffold(SCAFFOLD_DIR, dest, tokens)
    _copy_alembic(dest, tokens)

    click.echo(f"\n✅ Project created at {dest}")
    click.echo("\nNext steps:")
    click.echo(f"  cd {dest}")
    click.echo("\n  # Backend")
    click.echo("  cd backend")
    click.echo("  cp .env.example .env        # then set DATABASE_URL")
    click.echo("  pip install -r requirements.txt")
    click.echo("  safem run                   # tables are created automatically on first start")
    click.echo("\n  # Frontend (second terminal)")
    click.echo(f"  cd {dest}/frontend")
    click.echo("  npm install")
    click.echo("  npm run dev")


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
    # The alembic scaffold lives in the installed package at
    # safemantiq_framework/../alembic/ (backend/alembic/ in the repo).
    package_root = Path(__file__).resolve().parents[2]  # backend/
    alembic_src = package_root / "alembic"
    if not alembic_src.exists():
        click.echo("  ⚠️  Alembic scaffold not found — skipping.")
        return

    alembic_dest = dest_dir / "backend" / "alembic"
    alembic_ini_src = package_root / "alembic.ini"
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
