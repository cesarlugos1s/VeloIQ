import importlib
import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool
from sqlmodel import SQLModel
from alembic import context

# Load .env so DATABASE_URL is available before importing models
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env", override=False)
except ImportError:
    pass

# Import framework auth models so their tables are always included
import veloiq_framework.auth.models  # noqa: F401

# Auto-discover and import all app module models so autogenerate can detect them.
_modules_dir = Path(__file__).parent.parent / "app" / "modules"
if _modules_dir.exists():
    _backend_dir = str(_modules_dir.parent.parent)
    if _backend_dir not in sys.path:
        sys.path.insert(0, _backend_dir)
    for _mod_dir in sorted(_modules_dir.iterdir()):
        if (
            _mod_dir.is_dir()
            and not _mod_dir.name.startswith("__")
            and (_mod_dir / "models.py").exists()
        ):
            try:
                importlib.import_module(f"app.modules.{_mod_dir.name}.models")
            except Exception as _e:
                print(f"  ⚠️  alembic env: could not import app.modules.{_mod_dir.name}.models: {_e}")

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata

# Read DATABASE_URL from environment; fall back to SQLite for safety
_db_url = os.environ.get("DATABASE_URL", "sqlite:///./app.db")
config.set_main_option("sqlalchemy.url", _db_url)


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
