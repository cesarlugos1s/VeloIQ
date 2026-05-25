import os
import sys
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

SAMPLE_BACKEND = Path(__file__).parent.parent.parent / "samples" / "task-manager" / "backend"

# Module-level temp dir so the DB file persists for the session lifetime
_tmp_dir = tempfile.mkdtemp(prefix="veloiq_test_")
TEST_DB_URL = f"sqlite:///{_tmp_dir}/test.db"


@pytest.fixture(scope="session")
def app():
    sys.path.insert(0, str(SAMPLE_BACKEND))
    original_cwd = os.getcwd()
    os.chdir(SAMPLE_BACKEND)

    from veloiq_framework import VeloIQConfig, create_veloiq_app

    cfg = VeloIQConfig(
        database_url=TEST_DB_URL,
        modules_dir="app/modules",
        auth_secret="test-secret",
        create_tables_on_startup=True,
    )
    application = create_veloiq_app(cfg)

    yield application

    os.chdir(original_cwd)


@pytest.fixture(scope="session")
def client(app):
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def admin_token(client):
    resp = client.post("/auth/login", json={"username": "admin", "password": "admin"})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="session")
def auth(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ---------------------------------------------------------------------------
# Terminal summary — lets any test register extra paths to display at the end
# ---------------------------------------------------------------------------

_summary_paths: list[str] = []


@pytest.fixture
def register_summary_path():
    def _add(label: str, path: str):
        _summary_paths.append((label, path))
    return _add


def pytest_terminal_summary(terminalreporter, exitstatus, config):
    for label, path in _summary_paths:
        terminalreporter.write_line(f"- {label}: {path} -")
