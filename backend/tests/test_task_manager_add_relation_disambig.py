"""`veloiq add-relation` multi-FK disambiguation on a copy of the task-manager sample.

When a model gets a second FK to the same target, add-relation adds explicit
`foreign_keys` to the relationships between those two models. It must only touch
the relationships of the two models involved: other classes in the same
models.py that also point at the target (here Task.assignee -> TeamMember, next
to the new TimeEntry in tasks/models.py) must keep their own FK column.
"""
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

SAMPLE = Path(__file__).parent.parent.parent / "samples" / "task-manager"


def _run(cmd: list[str], cwd: Path) -> subprocess.CompletedProcess:
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    assert result.returncode == 0, f"{' '.join(cmd)} failed:\n{result.stdout}\n{result.stderr}"
    return result


def _relationship(text: str, attr: str) -> str:
    """Source of the `attr: ... = jm_relationship(...)` declaration (single- or multi-line)."""
    m = re.search(rf"^    {attr}\s*:.*?jm_relationship\(", text, re.M)
    assert m, f"relationship '{attr}' not found"
    depth, i = 0, m.end() - 1
    while True:
        depth += {"(": 1, ")": -1}.get(text[i], 0)
        if depth == 0:
            return text[m.start():i + 1]
        i += 1


@pytest.fixture(scope="module")
def project(tmp_path_factory) -> Path:
    """A copy of the task-manager sample with TimeEntry (tasks module) holding two FKs to TeamMember and two to Task."""
    root = tmp_path_factory.mktemp("disambig") / "task-manager"
    shutil.copytree(SAMPLE, root, ignore=shutil.ignore_patterns("node_modules", "dist", "__pycache__", "*.db"))
    _run(["veloiq", "add-model", "TimeEntry", "--module", "tasks", "-d", "Time logged on a task", "--no-migrate", "-C", str(root)], root)
    _run(["veloiq", "add-relation", "TimeEntry", "TeamMember", "--attr", "logged_by",
          "--back-attr", "logged_time_entries", "--no-migrate", "-C", str(root)], root)
    _run(["veloiq", "add-relation", "TimeEntry", "TeamMember", "--attr", "approved_by",
          "--back-attr", "approved_time_entries", "--no-migrate", "-C", str(root)], root)
    # Same-file pair: two FKs from TimeEntry to Task (both in tasks/models.py).
    _run(["veloiq", "add-relation", "TimeEntry", "Task", "--attr", "task",
          "--back-attr", "time_entries", "--no-migrate", "-C", str(root)], root)
    _run(["veloiq", "add-relation", "TimeEntry", "Task", "--attr", "billed_task",
          "--back-attr", "billed_time_entries", "--no-migrate", "-C", str(root)], root)
    return root


def test_other_class_in_same_file_keeps_its_own_fk(project):
    """Task.assignee (same file as TimeEntry, same target) is not pointed at a TimeEntry column."""
    tasks = (project / "backend/app/modules/tasks/models.py").read_text()
    assignee = _relationship(tasks, "assignee")
    assert "TimeEntry" not in assignee, assignee


def test_both_fk_paths_are_disambiguated(project):
    """Each side of the two TimeEntry <-> TeamMember paths names its own FK column."""
    tasks = (project / "backend/app/modules/tasks/models.py").read_text()
    team = (project / "backend/app/modules/team/models.py").read_text()
    assert '"[TimeEntry.logged_by_id]"' in _relationship(tasks, "logged_by")
    assert '"[TimeEntry.approved_by_id]"' in _relationship(tasks, "approved_by")
    assert '"[TimeEntry.logged_by_id]"' in _relationship(team, "logged_time_entries")
    assert '"[TimeEntry.approved_by_id]"' in _relationship(team, "approved_time_entries")


def test_same_file_fk_paths_are_disambiguated(project):
    """Both TimeEntry -> Task paths (same models.py) name their own column; Task's self-reference is unchanged."""
    original = (SAMPLE / "backend/app/modules/tasks/models.py").read_text()
    tasks = (project / "backend/app/modules/tasks/models.py").read_text()
    assert '"[TimeEntry.task_id]"' in _relationship(tasks, "task")
    assert '"[TimeEntry.billed_task_id]"' in _relationship(tasks, "billed_task")
    assert '"[TimeEntry.task_id]"' in _relationship(tasks, "time_entries")
    assert '"[TimeEntry.billed_task_id]"' in _relationship(tasks, "billed_time_entries")
    for attr in ("subtasks", "parent_task", "project"):
        assert _relationship(tasks, attr) == _relationship(original, attr)


def test_mappers_configure(project):
    """The edited models import and every SQLAlchemy mapper configures (in a fresh interpreter)."""
    code = ("import app.modules.team.models, app.modules.projects.models, app.modules.tasks.models\n"
            "from sqlalchemy.orm import configure_mappers\n"
            "configure_mappers()\n")
    _run([sys.executable, "-c", code], project / "backend")
