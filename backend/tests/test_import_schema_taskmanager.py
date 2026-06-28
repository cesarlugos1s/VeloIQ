"""End-to-end test: `veloiq import-schema` from the task-manager sample database.

Imports the project, task, and team_member tables from the SQLite database that
ships with the VeloIQ task-manager sample application, using the non-interactive
CLI path (--url, --tables, --module, --root).  Verifies the generated models
contain correct classes, column definitions, foreign keys, and relationships, and
that they pass configure_mappers() + create_all() in a fresh interpreter.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

import pytest

SAMPLE_ROOT = Path(__file__).parent.parent.parent / "samples" / "task-manager"
_SOURCE_DB = SAMPLE_ROOT / "backend" / "taskmanager.db"
_FRAMEWORK_BACKEND = Path(__file__).parent.parent  # dev framework source
_MODULE = "imported_taskmanager"

# Tables we want to import (the three user tables; framework/auth tables excluded).
_USER_TABLES = "project,task,team_member"


def _make_project_root(tmp_path: Path) -> Path:
    """Create a minimal VeloIQ project skeleton in tmp_path.

    The importer needs a project root that contains ``backend/app/modules/``
    so the CLI can scaffold the new module -- exactly like the existing
    ``test_import_schema_relations.py`` helper.
    """
    root = tmp_path / "test_project"
    backend = root / "backend"
    app = backend / "app"
    modules = app / "modules"
    modules.mkdir(parents=True)
    (app / "__init__.py").write_text("", encoding="utf-8")
    (modules / "__init__.py").write_text("", encoding="utf-8")
    return root


def _run_import_schema(source_db: Path, project_root: Path) -> subprocess.CompletedProcess:
    """Invoke ``veloiq import-schema`` non-interactively via the dev framework."""
    db_url = f"sqlite:///{source_db}"

    # Use veloiq CLI via sys.executable so we don't need the entry-point on PATH.
    loader = (
        "import sys\n"
        f"sys.path.insert(0, {str(_FRAMEWORK_BACKEND)!r})\n"
        "from veloiq_framework.cli.main import cli\n"
        f"sys.argv = ['veloiq', 'import-schema', '--url', {db_url!r},\n"
        f"            '--tables', {_USER_TABLES!r}, '--module', {_MODULE!r},\n"
        f"            '--root', {str(project_root)!r}]\n"
        "cli()\n"
    )
    return subprocess.run(
        [sys.executable, "-c", loader],
        cwd=project_root,
        capture_output=True,
        text=True,
    )


def _models_text(project_root: Path) -> str:
    return (
        project_root / "backend" / "app" / "modules" / _MODULE / "models.py"
    ).read_text(encoding="utf-8")


def _assert_configure_mappers(project_root: Path) -> None:
    """Import the generated module and exercise configure_mappers() + create_all()
    in a completely fresh interpreter, exactly like the strong assertion in
    ``test_import_schema_relations.py``."""
    backend_dir = project_root / "backend"
    loader = (
        "import sys\n"
        "import os\n"
        f"sys.path.insert(0, {str(backend_dir)!r})\n"
        f"sys.path.insert(0, {str(_FRAMEWORK_BACKEND)!r})\n"
        f"from app.modules.{_MODULE} import models  # noqa: F401\n"
        "from sqlalchemy.orm import configure_mappers\n"
        "from sqlmodel import SQLModel, create_engine\n"
        "configure_mappers()\n"
        "eng = create_engine('sqlite://')\n"
        "SQLModel.metadata.create_all(eng)\n"
        "print('CONFIGURE_OK')\n"
    )
    proc = subprocess.run(
        [sys.executable, "-c", loader],
        capture_output=True,
        text=True,
    )
    assert proc.returncode == 0, (
        "imported models failed to configure:\n"
        f"STDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )
    assert "CONFIGURE_OK" in proc.stdout


# ── Tests ──────────────────────────────────────────────────────────────────────


def test_import_schema_exits_cleanly(tmp_path):
    """The CLI command finishes without crashing (return code 0)."""
    source_db = tmp_path / "taskmanager.db"
    shutil.copy2(_SOURCE_DB, source_db)
    project_root = _make_project_root(tmp_path)

    result = _run_import_schema(source_db, project_root)

    # import-schema itself should exit 0; the follow-up migrate/generate steps
    # are subprocess calls whose exit codes are not checked by import-schema.
    assert result.returncode == 0, (
        f"import-schema failed:\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    )


def test_models_file_exists(tmp_path):
    """Generated models.py exists and is non-empty after import."""
    source_db = tmp_path / "taskmanager.db"
    shutil.copy2(_SOURCE_DB, source_db)
    project_root = _make_project_root(tmp_path)

    _run_import_schema(source_db, project_root)

    models_py = project_root / "backend" / "app" / "modules" / _MODULE / "models.py"
    assert models_py.exists(), f"Missing models.py at {models_py}"
    content = models_py.read_text(encoding="utf-8")
    assert content.strip(), "models.py is empty"


def test_model_classes_created(tmp_path):
    """All three user-table model classes are scaffolded."""
    source_db = tmp_path / "taskmanager.db"
    shutil.copy2(_SOURCE_DB, source_db)
    project_root = _make_project_root(tmp_path)

    _run_import_schema(source_db, project_root)
    models = _models_text(project_root)

    for cls in ("Project", "Task", "TeamMember"):
        assert f"class {cls}(" in models, f"Missing class {cls}"


def test_tablenames_preserved(tmp_path):
    """Each generated model retains the original SQLite table name."""
    source_db = tmp_path / "taskmanager.db"
    shutil.copy2(_SOURCE_DB, source_db)
    project_root = _make_project_root(tmp_path)

    _run_import_schema(source_db, project_root)
    models = _models_text(project_root)

    assert '__tablename__ = "project"' in models
    assert '__tablename__ = "task"' in models
    assert '__tablename__ = "team_member"' in models


def test_primary_keys_recognised(tmp_path):
    """The source PK column (id) is declared as primary_key=True on every model."""
    source_db = tmp_path / "taskmanager.db"
    shutil.copy2(_SOURCE_DB, source_db)
    project_root = _make_project_root(tmp_path)

    _run_import_schema(source_db, project_root)
    models = _models_text(project_root)

    assert "primary_key=True" in models, (
        f"PK not found in generated models:\n{models}"
    )


def test_fk_columns_present(tmp_path):
    """Every FK column from the source schema is generated with foreign_key=."""
    source_db = tmp_path / "taskmanager.db"
    shutil.copy2(_SOURCE_DB, source_db)
    project_root = _make_project_root(tmp_path)

    _run_import_schema(source_db, project_root)
    models = _models_text(project_root)

    fk_declarations = [
        ('owner_id', 'foreign_key="team_member.id"'),
        ('project_id', 'foreign_key="project.id"'),
        ('assignee_id', 'foreign_key="team_member.id"'),
        ('parent_task_id', 'foreign_key="task.id"'),
    ]
    for col, fk_ref in fk_declarations:
        assert fk_ref in models, f"Missing FK: {col} -> {fk_ref}"

def test_plain_columns_present(tmp_path):
    """Data columns (non-PK, non-FK, non-timestamp) are scaffolded as fields."""
    source_db = tmp_path / "taskmanager.db"
    shutil.copy2(_SOURCE_DB, source_db)
    project_root = _make_project_root(tmp_path)

    _run_import_schema(source_db, project_root)
    models = _models_text(project_root)

    # Project columns
    assert "name:" in models
    assert "description:" in models
    assert "status:" in models

    # Task columns
    assert "title:" in models
    assert "priority:" in models
    assert "due_date:" in models
    assert "planned_work_hours:" in models
    assert "actual_work_hours:" in models
    assert "planned_cost:" in models
    assert "actual_cost:" in models
    assert "actual_progress:" in models
    assert "rating:" in models

    # TeamMember columns
    assert "email:" in models
    assert "role:" in models
    assert "phone:" in models
    assert "avatar_url:" in models


def test_timestamp_columns_excluded(tmp_path):
    """created_at / updated_at are recognised as innocuous and not scaffolded."""
    source_db = tmp_path / "taskmanager.db"
    shutil.copy2(_SOURCE_DB, source_db)
    project_root = _make_project_root(tmp_path)

    _run_import_schema(source_db, project_root)
    models = _models_text(project_root)

    import re
    for col in ("created_at", "updated_at"):
        assert not re.search(
            rf"^\s+{col}\s*:", models, re.MULTILINE
        ), f"Timestamp column '{col}' was scaffolded but should have been skipped"



def test_relationships_generated(tmp_path):
    """jm_relationship attributes are generated for all FK paths."""
    source_db = tmp_path / "taskmanager.db"
    shutil.copy2(_SOURCE_DB, source_db)
    project_root = _make_project_root(tmp_path)

    _run_import_schema(source_db, project_root)
    models = _models_text(project_root)

    # Project.owner -> TeamMember (FK: owner_id -> team_member.id)
    assert "owner:" in models
    assert 'back_populates' in models

    # Reverse collection on TeamMember
    assert 'projects: List["Project"]' in models

    # Task.assignee -> TeamMember
    assert "assignee:" in models

    # Task -> Project
    assert 'project: Optional["Project"]' in models

    # Self-referential: Task.parent_task / Task.tasks
    # (import-schema generates generic names from column names;
    #  the hand-written models use "subtasks" but the tool uses "tasks")
    assert "parent_task:" in models
    assert 'tasks: List["Task"]' in models


def test_configure_mappers_succeeds(tmp_path):
    """Generated models are importable and pass configure_mappers + create_all."""
    source_db = tmp_path / "taskmanager.db"
    shutil.copy2(_SOURCE_DB, source_db)
    project_root = _make_project_root(tmp_path)

    _run_import_schema(source_db, project_root)
    _assert_configure_mappers(project_root)


def test_import_is_idempotent(tmp_path):
    """Re-running import-schema on the same project does not error or duplicate."""
    source_db = tmp_path / "taskmanager.db"
    shutil.copy2(_SOURCE_DB, source_db)
    project_root = _make_project_root(tmp_path)

    r1 = _run_import_schema(source_db, project_root)
    assert r1.returncode == 0, f"First run failed:\n{r1.stderr}"

    models1 = _models_text(project_root)

    r2 = _run_import_schema(source_db, project_root)
    assert r2.returncode == 0, f"Second run failed:\n{r2.stderr}"

    models2 = _models_text(project_root)
    assert models1 == models2, "Re-running import-schema changed models.py"

    combined = r2.stdout + r2.stderr
    assert (
        "skip" in combined.lower() or "already" in combined.lower()
    ), f"Idempotent re-run did not indicate skip:\n{combined}"

