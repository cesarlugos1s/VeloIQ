"""Generator: veloiq generate produces correct file structure; manual files survive re-runs."""
import os
import shutil
import subprocess
import sys
from pathlib import Path

SAMPLE = Path(__file__).parent.parent.parent / "samples" / "task-manager"
# Absolute path to the local framework source (backend/) so the subprocess always
# uses the development version rather than whatever is installed in the active venv.
_FRAMEWORK_BACKEND = Path(__file__).parent.parent

# Directories to skip when copying the sample to a temp location.
_SAMPLE_IGNORE = shutil.ignore_patterns(
    "__pycache__", "*.pyc", ".venv", "node_modules", ".vite", "dist",
)


def _copy_sample(tmp_path: Path) -> tuple[Path, Path]:
    """Copy the task-manager sample to *tmp_path* and return (backend, frontend) dirs.

    Tests operate on a temp copy so they never dirty the committed source tree.
    """
    dest = tmp_path / "task-manager"
    shutil.copytree(SAMPLE, dest, ignore=_SAMPLE_IGNORE)
    return dest / "backend", dest / "frontend"


def _run_generate(cwd: Path) -> subprocess.CompletedProcess:
    env = os.environ.copy()
    env["PYTHONPATH"] = str(_FRAMEWORK_BACKEND) + (":" + env["PYTHONPATH"] if env.get("PYTHONPATH") else "")
    return subprocess.run(
        [sys.executable, "api_schema_gen.py"],
        cwd=cwd,
        capture_output=True,
        text=True,
        env=env,
    )


def test_generate_exits_cleanly(tmp_path):
    backend, _ = _copy_sample(tmp_path)
    result = _run_generate(backend)
    assert result.returncode == 0, result.stderr


def test_veloiq_generate_cli_exits_cleanly(tmp_path):
    # Verify the 'veloiq generate' CLI route works end-to-end (CLI dispatch →
    # run_api_schema_gen → script detection → _run_builtin).  Uses PYTHONPATH
    # so the installed venv binary picks up the local development framework.
    backend, _ = _copy_sample(tmp_path)
    env = os.environ.copy()
    env["PYTHONPATH"] = str(_FRAMEWORK_BACKEND) + (":" + env["PYTHONPATH"] if env.get("PYTHONPATH") else "")
    result = subprocess.run(
        ["veloiq", "generate"],
        cwd=backend,
        capture_output=True,
        text=True,
        env=env,
    )
    assert result.returncode == 0, result.stderr


def test_generate_creates_gen_file(tmp_path):
    backend, frontend = _copy_sample(tmp_path)
    _run_generate(backend)
    gen = frontend / "src" / "pages" / "projects" / "projectsSchema.gen.ts"
    assert gen.exists(), f"Missing: {gen}"
    content = gen.read_text()
    assert "projectsModelsGen" in content


def test_generate_creates_merged_schema(tmp_path):
    backend, frontend = _copy_sample(tmp_path)
    _run_generate(backend)
    merged = frontend / "src" / "pages" / "projects" / "projectsSchema.ts"
    assert merged.exists(), f"Missing: {merged}"
    content = merged.read_text()
    assert "projectsModelsGen" in content
    assert "projectsManualOverrides" in content
    assert "projectsModels" in content


def test_manual_schema_created_on_first_run(tmp_path):
    # Copy sample to tmp, delete manual file, re-run generate — it must be recreated
    backend, frontend = _copy_sample(tmp_path)
    manual = frontend / "src" / "pages" / "projects" / "projectsSchema.manual.ts"
    manual.unlink()
    assert not manual.exists(), "manual file should be deleted before generate"

    result = _run_generate(backend)
    assert result.returncode == 0, result.stderr
    assert manual.exists(), f"manual file was not recreated: {manual}"


def test_manual_schema_not_overwritten(tmp_path):
    backend, frontend = _copy_sample(tmp_path)
    manual = frontend / "src" / "pages" / "projects" / "projectsSchema.manual.ts"
    sentinel = "// sentinel-do-not-overwrite"

    original = manual.read_text()
    manual.write_text(original + f"\n{sentinel}\n")
    _run_generate(backend)
    content = manual.read_text()
    assert sentinel in content, "generate overwrote the manual schema file"


def test_allmodels_imports_merged_schema(tmp_path):
    backend, frontend = _copy_sample(tmp_path)
    _run_generate(backend)
    all_models = frontend / "src" / "allModels.gen.ts"
    assert all_models.exists()
    content = all_models.read_text()
    # Must import from merged schema, not the gen file directly
    assert "Schema.gen" not in content
    assert "projectsSchema" in content


def test_generate_produces_api_py(tmp_path):
    backend, _ = _copy_sample(tmp_path)
    _run_generate(backend)
    api = backend / "app" / "modules" / "projects" / "api.py"
    assert api.exists()
    content = api.read_text()
    assert "create_crud_router" in content
    assert "Project" in content
