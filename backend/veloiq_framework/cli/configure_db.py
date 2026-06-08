"""veloiq configure-db — configure the database URL for a VeloIQ project."""
from __future__ import annotations

import re
from pathlib import Path

import click


@click.command("configure-db")
@click.option("--db-type", default="sqlite",
              type=click.Choice(["sqlite", "postgresql", "mysql", "mssql"], case_sensitive=False),
              help="Database engine type (default: sqlite).")
@click.option("--db-host", default=None, help="Database host (default: localhost).")
@click.option("--db-port", default=None, type=int, help="Database port.")
@click.option("--db-name", default=None, help="Database name.")
@click.option("--db-user", default=None, help="Database user.")
@click.option("--db-password", default=None, help="Database password.")
@click.option("--db-url", default=None,
              help="Full DATABASE_URL (overrides all other --db-* options).")
@click.option("--project-root", default=None,
              help="Project root directory (default: auto-detected from CWD).")
def configure_db(db_type, db_host, db_port, db_name, db_user, db_password, db_url, project_root):
    """Configure the DATABASE_URL in the project's .env file.

    \b
    Examples:
      veloiq configure-db --db-type sqlite
      veloiq configure-db --db-type postgresql --db-host localhost --db-port 5432 \\
                          --db-name myapp --db-user admin --db-password secret
      veloiq configure-db --db-url postgresql://user:pass@localhost:5432/mydb
    """
    # Locate the project root
    if project_root:
        root = Path(project_root).resolve()
    else:
        root = _find_project_root()
        if root is None:
            click.echo(
                "❌  Not inside a VeloIQ project.\n"
                "   Run from inside a project directory, or use --project-root.",
                err=True,
            )
            raise SystemExit(1)

    # Build the DATABASE_URL
    if db_url:
        database_url = db_url
    else:
        database_url = _build_database_url(db_type, db_host, db_port, db_name, db_user, db_password)

    # Locate the .env file (prefer backend/.env, then .env)
    env_path = root / "backend" / ".env"
    if not env_path.exists():
        env_path = root / ".env"

    if env_path.exists():
        # Update existing .env
        content = env_path.read_text(encoding="utf-8")
        if re.search(r'^DATABASE_URL\s*=', content, re.M):
            content = re.sub(
                r'^DATABASE_URL\s*=.*$',
                f'DATABASE_URL={database_url}',
                content,
                count=1,
                flags=re.M,
            )
            click.echo(f"  ✅ Updated DATABASE_URL in {env_path}")
        else:
            content += f"\nDATABASE_URL={database_url}\n"
            click.echo(f"  ✅ Added DATABASE_URL to {env_path}")
        env_path.write_text(content, encoding="utf-8")
    else:
        # Create .env from .env.example or from scratch
        env_example = root / "backend" / ".env.example"
        if env_example.exists():
            content = env_example.read_text(encoding="utf-8")
            content = re.sub(
                r'^DATABASE_URL\s*=.*$',
                f'DATABASE_URL={database_url}',
                content,
                count=1,
                flags=re.M,
            )
            env_path.parent.mkdir(parents=True, exist_ok=True)
            env_path.write_text(content, encoding="utf-8")
            click.echo(f"  ✅ Created {env_path} from .env.example with DATABASE_URL={database_url}")
        else:
            env_path.parent.mkdir(parents=True, exist_ok=True)
            env_path.write_text(f"DATABASE_URL={database_url}\n", encoding="utf-8")
            click.echo(f"  ✅ Created {env_path} with DATABASE_URL={database_url}")

    click.echo(f"\n   DATABASE_URL={database_url}")
    click.echo("\n   Next: veloiq db upgrade")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_database_url(db_type: str, host: str | None, port: int | None,
                        name: str | None, user: str | None, password: str | None) -> str:
    """Build a DATABASE_URL from individual components."""
    db_type = db_type.lower()

    if db_type == "sqlite":
        return f"sqlite:///./{name or 'app'}.db"

    # Defaults for non-SQLite engines
    host = host or "localhost"
    name = name or "veloiq"
    user = user or "veloiq"

    default_ports = {
        "postgresql": 5432,
        "mysql": 3306,
        "mssql": 1433,
    }
    port = port or default_ports.get(db_type, 5432)

    pw_part = f":{password}" if password else ""
    return f"{db_type}://{user}{pw_part}@{host}:{port}/{name}"


def _find_project_root() -> Path | None:
    """Find the VeloIQ project root by walking up from CWD."""
    cwd = Path.cwd().resolve()
    for directory in [cwd, *cwd.parents]:
        if (directory / "backend" / "app" / "modules").exists():
            return directory
        if (directory / "app" / "modules").exists():
            parent = directory.parent
            return parent if (parent / "backend").exists() else directory
    return None
