"""veloiq configure-db — configure the database URL for a VeloIQ project."""
from __future__ import annotations

import re
from pathlib import Path

import click


@click.command("configure-db")
@click.option("--db-type", default="sqlite",
              help="Database engine / SQLAlchemy dialect (default: sqlite). "
                   "Common: sqlite, postgresql, mysql, mariadb, mssql, oracle, "
                   "snowflake, duckdb, clickhouse, bigquery, db2, informix. "
                   "Use any dialect+driver form, e.g. cockroachdb+psycopg2. "
                   "(the matching driver must be installed; sqlite & postgresql "
                   "ship by default, mysql/mariadb need pymysql, mssql needs pyodbc, "
                   "oracle needs oracledb, db2 needs ibm-db-sa, informix needs IfxAlchemy).")
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

    _check_driver_installed(database_url, db_type)

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

# Map base dialect → default SQLAlchemy dialect+driver form.
# SQLite & PostgreSQL drivers ship with the framework; every other engine needs
# its driver installed (pymysql, pyodbc, oracledb, ibm-db-sa, IfxAlchemy).
_DIALECT_DRIVER_MAP = {
    "postgresql": "postgresql+psycopg2",
    "mysql":      "mysql+pymysql",
    "mariadb":    "mariadb+pymysql",
    "mssql":      "mssql+pyodbc",
    "oracle":     "oracle+oracledb",
    "snowflake":  "snowflake",
    "duckdb":     "duckdb",
    "clickhouse": "clickhouse",
    "bigquery":   "bigquery",
}


# Friendly pip package name for the driver each non-built-in dialect needs.
# sqlite & postgresql (via psycopg2) ship with the framework's own
# dependencies, so they're never in this map.
_DRIVER_PACKAGE_HINTS = {
    "mysql": "pymysql",
    "mariadb": "pymysql",
    "mssql": "pyodbc",
    "oracle": "oracledb",
    "db2": "ibm-db-sa",
    "informix": "IfxAlchemy",
    "snowflake": "snowflake-sqlalchemy",
    "duckdb": "duckdb-engine",
    "clickhouse": "clickhouse-sqlalchemy",
    "bigquery": "sqlalchemy-bigquery",
}


def _check_driver_installed(database_url: str, db_type: str) -> None:
    """Fail fast if the SQLAlchemy dialect/driver for *database_url* isn't installed.

    Without this, a URL like ``informix://...`` looks like a normal, valid
    DATABASE_URL right up until ``veloiq db upgrade`` or ``veloiq run``
    actually tries to connect — sometimes minutes or commits later — and
    fails with an opaque ``NoSuchModuleError`` deep in a stack trace instead
    of a clear message at the point the dialect was chosen.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.exc import NoSuchModuleError

    try:
        create_engine(database_url)
    except (NoSuchModuleError, ModuleNotFoundError, ImportError) as exc:
        base_dialect = db_type.lower().split("+", 1)[0]
        package = _DRIVER_PACKAGE_HINTS.get(base_dialect)
        click.echo(
            f"❌  Can't load the SQLAlchemy driver for '{db_type}': {exc}\n"
            + (f"    Install it first:  pip install {package}\n" if package else
               "    Install the matching driver package first.\n")
            + "    Then re-run this command.",
            err=True,
        )
        raise SystemExit(1)


def _resolve_dialect_driver(db_type: str) -> str:
    """Expand a bare dialect name to its default dialect+driver form.

    ``postgresql`` → ``postgresql+psycopg2``, ``oracle`` → ``oracle+oracledb``, etc.
    Already-qualified forms (e.g. ``postgresql+asyncpg``) are returned unchanged.
    """
    db_type = db_type.lower()
    if "+" in db_type:
        return db_type
    return _DIALECT_DRIVER_MAP.get(db_type, db_type)


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
        "mariadb": 3306,
        "mssql": 1433,
        "oracle": 1521,
        "snowflake": 443,
        "clickhouse": 8123,
        "db2": 50000,
        "informix": 9088,
    }
    # `db_type` may be a "dialect+driver" form (e.g. postgresql+asyncpg);
    # match the default port on the base dialect before the "+".
    base_dialect = db_type.split("+", 1)[0]
    port = port or default_ports.get(base_dialect, 5432)

    # Resolve bare dialect names to their default dialect+driver form
    # so that `--db-type oracle` produces `oracle+oracledb://...` etc.
    resolved = _resolve_dialect_driver(db_type)

    pw_part = f":{password}" if password else ""
    url = f"{resolved}://{user}{pw_part}@{host}:{port}/{name}"

    # MSSQL needs the ODBC driver query parameter
    if resolved.startswith("mssql"):
        url += "?driver=ODBC+Driver+17+for+SQL+Server"

    return url


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
