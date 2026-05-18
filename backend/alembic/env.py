import os
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
import safemantiq_framework.auth.models  # noqa: F401

# Import your app's models here so autogenerate can detect changes.
# Uncomment and extend as you add modules:
#
# from app.modules.team.models import TeamMember       # noqa: F401
# from app.modules.projects.models import Project      # noqa: F401
# from app.modules.tasks.models import Task            # noqa: F401

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
