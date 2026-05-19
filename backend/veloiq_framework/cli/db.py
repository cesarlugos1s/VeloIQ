"""veloiq db — Alembic migration wrappers."""
import os
import subprocess
import sys
from pathlib import Path

import click


@click.group()
def db():
    """Database migration commands (powered by Alembic).

    \b
    Common workflow:
      veloiq db upgrade          Apply all pending migrations
      veloiq db migrate -m "..."  Auto-generate a new migration
      veloiq db stamp             Mark current DB schema as up-to-date
      veloiq db downgrade -1      Roll back one migration
    """


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
            "❌ Could not find alembic.ini. Run from your project root or backend/ directory.",
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


def _load_env(env_file: str) -> None:
    for candidate in [Path(env_file), Path("backend") / env_file, Path(".") / env_file]:
        if candidate.exists():
            try:
                from dotenv import load_dotenv
                load_dotenv(candidate, override=False)
            except ImportError:
                pass
            return
