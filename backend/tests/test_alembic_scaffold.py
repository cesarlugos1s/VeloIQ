"""The Alembic scaffold copied into host apps must import every framework module that declares tables.

Once a database has an `alembic_version` table, VeloIQ stops creating tables on startup
(see factory._alembic_owns_schema), so a framework table whose module env.py doesn't
import is never created by `veloiq db migrate` / `veloiq db upgrade` — e.g. the role
access-policy tables, which made /auth/access-policies fail with "no such table".
"""
import re
from pathlib import Path

FRAMEWORK = Path(__file__).parent.parent / "veloiq_framework"
SCAFFOLD_ENV = FRAMEWORK / "alembic_scaffold" / "env.py"


def _table_modules() -> set[str]:
    """Dotted names of the framework's models modules that declare at least one table."""
    modules = set()
    for path in FRAMEWORK.rglob("models.py"):
        if "alembic_scaffold" in path.parts or "scaffold" in path.parts:
            continue
        if re.search(r"__tablename__\s*=", path.read_text(encoding="utf-8")):
            rel = path.relative_to(FRAMEWORK.parent).with_suffix("")
            modules.add(".".join(rel.parts))
    return modules


def test_scaffold_env_imports_every_framework_table_module():
    imported = set(re.findall(r"^import (veloiq_framework\.[\w.]+)", SCAFFOLD_ENV.read_text(encoding="utf-8"), re.M))
    tables = _table_modules()
    assert "veloiq_framework.access.models" in tables
    missing = sorted(tables - imported)
    assert not missing, f"alembic_scaffold/env.py does not import: {missing}"
