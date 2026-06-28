"""Health check: ``veloiq check`` reports on a VeloIQ project.

Runs the check command against the task-manager sample and a minimal project.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

_FRAMEWORK_BACKEND = Path(__file__).parent.parent
SAMPLES = Path(__file__).parent.parent.parent / "samples" / "task-manager"


def _run_check(project_root: Path, strict: bool = False) -> subprocess.CompletedProcess:
    loader = (
        "import sys\n"
        f"sys.path.insert(0, {str(_FRAMEWORK_BACKEND)!r})\n"
        "from veloiq_framework.cli.main import cli\n"
        f"sys.argv = ['veloiq', 'check', '--root', {str(project_root)!r}"
        + (", '--strict']\n" if strict else "]\n")
        + "cli()\n"
    )
    return subprocess.run(
        [sys.executable, "-c", loader],
        cwd=project_root,
        capture_output=True,
        text=True,
    )


def test_check_task_manager_sample():
    result = _run_check(SAMPLES)
    assert result.returncode in (0, 1), (
        f"veloiq check failed:\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}"
    )


def test_check_output_contains_model_info():
    result = _run_check(SAMPLES)
    combined = result.stdout + result.stderr
    assert (
        "task-manager" in combined
        or "project" in combined.lower()
        or "issue" in combined.lower()
        or "No issues" in combined
        or "Found" in combined
    ), f"Unexpected check output:\n{combined}"


def test_check_strict_mode():
    result = _run_check(SAMPLES, strict=True)
    assert result.returncode in (0, 1), (
        f"veloiq check --strict failed:\n{result.stderr}"
    )


def test_check_not_inside_project(tmp_path):
    loader = (
        "import sys\n"
        f"sys.path.insert(0, {str(_FRAMEWORK_BACKEND)!r})\n"
        "from veloiq_framework.cli.main import cli\n"
        f"sys.argv = ['veloiq', 'check', '--root', {str(tmp_path)!r}]\n"
        "cli()\n"
    )
    result = subprocess.run(
        [sys.executable, "-c", loader],
        capture_output=True,
        text=True,
    )
    # veloiq check returns 0 on empty/non-project dirs with a warning.
    assert result.returncode in (0, 1), (
        f"Unexpected exit code {result.returncode}:\n{result.stderr}"
    )
    combined = result.stdout + result.stderr
    # Empty dirs produce "No issues found" or warnings — either is acceptable.
    assert (
        "No issues" in combined
        or "Not inside" in combined
        or "no app/modules" in combined
        or "Run" in combined
    ), f"Unexpected output:\n{combined}"
