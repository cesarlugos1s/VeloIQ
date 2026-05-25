"""CLI smoke test: veloiq new + veloiq add-module produce a runnable app. Marked slow."""
import os
import subprocess
import sys
from pathlib import Path

import pytest


def _run(cmd: list[str], cwd: Path, **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, **kwargs)


@pytest.mark.slow
def test_veloiq_new_creates_runnable_app(tmp_path):
    # Create new app
    result = _run(["veloiq", "new", "smoke-app"], tmp_path)
    assert result.returncode == 0, f"veloiq new failed:\n{result.stderr}"

    app_dir = tmp_path / "smoke-app"
    assert app_dir.exists()

    backend_dir = app_dir / "backend"
    assert backend_dir.exists()

    # Install dependencies into the same venv that's running tests
    pip = Path(sys.executable).parent / "pip"
    _run([str(pip), "install", "-r", "requirements.txt"], backend_dir)
    _run([str(pip), "install", "-e", str(Path(__file__).parent.parent.parent / "backend")], backend_dir)

    # Add a module
    result = _run(["veloiq", "add-module", "items"], app_dir)
    assert result.returncode == 0, f"veloiq add-module failed:\n{result.stderr}"

    # Generate schema files
    result = _run(["veloiq", "generate"], backend_dir)
    assert result.returncode == 0, f"veloiq generate failed:\n{result.stderr}"

    # Verify the app can be imported and started with TestClient
    sys.path.insert(0, str(backend_dir))
    original_cwd = os.getcwd()
    os.chdir(backend_dir)
    try:
        from fastapi.testclient import TestClient
        from veloiq_framework import VeloIQConfig, create_veloiq_app

        cfg = VeloIQConfig(
            database_url="sqlite://",
            modules_dir="app/modules",
            auth_secret="smoke-secret",
            create_tables_on_startup=True,
        )
        smoke_app = create_veloiq_app(cfg)
        with TestClient(smoke_app) as c:
            resp = c.get("/health")
            assert resp.status_code == 200

            resp = c.post("/auth/login", json={"username": "admin", "password": "admin"})
            assert resp.status_code == 200
            token = resp.json()["access_token"]

            resp = c.get("/item", headers={"Authorization": f"Bearer {token}"})
            assert resp.status_code == 200
    finally:
        os.chdir(original_cwd)
        sys.path.remove(str(backend_dir))
