"""veloiq db — Alembic migration wrappers."""
import shutil
import subprocess
import sys
from pathlib import Path

import click


@click.group()
def db():
    """Database migration commands (powered by Alembic).

    \b
    Common workflow:
      veloiq db init             Set up Alembic in an existing project
      veloiq db upgrade          Apply all pending migrations
      veloiq db migrate -m "..."  Auto-generate a new migration
      veloiq db stamp             Mark current DB schema as up-to-date
      veloiq db downgrade -1      Roll back one migration
    """


@db.command("init")
@click.option("--project-root", default=None,
              help="Project root directory (default: auto-detected from CWD).")
def init(project_root: str | None):
    """Set up Alembic migrations in an existing VeloIQ project.

    Run this once after creating a project with `veloiq add-module` (i.e. without
    using `veloiq new`), or any time alembic.ini is missing from backend/.

    \b
    Example:
      cd my-app
      veloiq db init
      veloiq db upgrade
    """
    package_root = Path(__file__).resolve().parents[2]  # backend/ in the framework
    alembic_src = package_root / "alembic"
    alembic_ini_src = package_root / "alembic.ini"

    if not alembic_src.exists():
        click.echo("❌ Alembic scaffold not found in the installed framework package.", err=True)
        raise SystemExit(1)

    # Locate the project's backend/ directory
    if project_root:
        backend_dir = Path(project_root).resolve() / "backend"
    else:
        backend_dir = _find_backend_dir()
        if backend_dir is None:
            click.echo(
                "❌ Could not locate a VeloIQ project from the current directory.\n"
                "   Run from inside a project or pass --project-root.",
                err=True,
            )
            raise SystemExit(1)

    alembic_dest = backend_dir / "alembic"
    alembic_ini_dest = backend_dir / "alembic.ini"

    if alembic_ini_dest.exists():
        click.echo(f"⚠️  alembic.ini already exists at {alembic_ini_dest} — nothing to do.")
        return

    alembic_dest.mkdir(parents=True, exist_ok=True)

    for src_path in alembic_src.rglob("*"):
        if src_path.is_dir():
            continue
        rel = src_path.relative_to(alembic_src)
        dest_path = alembic_dest / rel
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            dest_path.write_text(src_path.read_text(encoding="utf-8"), encoding="utf-8")
        except UnicodeDecodeError:
            shutil.copy2(src_path, dest_path)
        click.echo(f"  📄 backend/alembic/{rel}")

    if alembic_ini_src.exists():
        try:
            alembic_ini_dest.write_text(alembic_ini_src.read_text(encoding="utf-8"), encoding="utf-8")
        except Exception:
            shutil.copy2(alembic_ini_src, alembic_ini_dest)
        click.echo("  📄 backend/alembic.ini")

    click.echo(f"\n✅ Alembic initialised at {backend_dir}")
    click.echo("   Next: veloiq db upgrade")


@db.command()
@click.option("--env-file", default=".env", help="Environment file to load.")
def upgrade(env_file):
    """Apply all pending migrations (alembic upgrade head)."""
    _run_alembic(["upgrade", "head"], env_file=env_file)


@db.command()
@click.option("-m", "--message", required=True, help="Migration description.")
@click.option("--env-file", default=".env", help="Environment file to load.")
def migrate(message, env_file):
    """Auto-generate a migration from model changes (alembic revision --autogenerate)."""
    _run_alembic(["revision", "--autogenerate", "-m", message], env_file=env_file)


@db.command()
@click.option("--revision", default="head", show_default=True,
              help="Revision to stamp (default: head).")
@click.option("--env-file", default=".env", help="Environment file to load.")
def stamp(revision, env_file):
    """Mark the database as being at *revision* without running migrations.

    Use this for existing databases that predate Alembic tracking:

    \b
      veloiq db stamp        # marks current schema as 'head'
    """
    _run_alembic(["stamp", revision], env_file=env_file)


@db.command()
@click.argument("revision")
@click.option("--env-file", default=".env", help="Environment file to load.")
def downgrade(revision, env_file):
    """Revert to an earlier revision.

    \b
    Examples:
      veloiq db downgrade -1       Roll back one step
      veloiq db downgrade base     Roll back everything
    """
    _run_alembic(["downgrade", revision], env_file=env_file)


@db.command()
@click.option("--env-file", default=".env", help="Environment file to load.")
def history(env_file):
    """Show migration history."""
    _run_alembic(["history", "--verbose"], env_file=env_file)


@db.command()
@click.option("--env-file", default=".env", help="Environment file to load.")
def current(env_file):
    """Show the current database revision."""
    _run_alembic(["current", "--verbose"], env_file=env_file)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _run_alembic(args: list[str], env_file: str = ".env") -> None:
    """Run an alembic command in the correct directory with env vars loaded."""
    _load_env(env_file)

    alembic_dir = _find_alembic_dir()
    if alembic_dir is None:
        click.echo(
            "❌ Could not find alembic.ini.\n"
            "   If this project was built without `veloiq new`, run:\n"
            "     veloiq db init\n"
            "   Otherwise, run from your project root or backend/ directory.",
            err=True,
        )
        raise SystemExit(1)

    cmd = [sys.executable, "-m", "alembic", *args]
    click.echo(f"  $ {' '.join(cmd)}  (in {alembic_dir})")
    result = subprocess.run(cmd, cwd=str(alembic_dir))
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def _find_alembic_dir() -> Path | None:
    """Find the directory containing alembic.ini, searching upward from CWD."""
    candidates = [
        Path.cwd(),
        Path.cwd() / "backend",
        Path.cwd().parent,
        Path.cwd().parent / "backend",
    ]
    for path in candidates:
        if (path / "alembic.ini").exists():
            return path
    return None


def _find_backend_dir() -> Path | None:
    """Find the project's backend/ directory by walking up from CWD."""
    cwd = Path.cwd().resolve()
    for directory in [cwd, *cwd.parents]:
        if (directory / "backend" / "app" / "modules").exists():
            return directory / "backend"
        if (directory / "app" / "modules").exists():
            return directory
    return None


def _load_env(env_file: str) -> None:
    for candidate in [Path(env_file), Path("backend") / env_file, Path(".") / env_file]:
        if candidate.exists():
            try:
                from dotenv import load_dotenv
                load_dotenv(candidate, override=False)
            except ImportError:
                pass
            return
