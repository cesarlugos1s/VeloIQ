"""Full CLI lifecycle E2E test.

Walks the exact developer workflow documented in CLAUDE.md — veloiq new,
add-module/add-model, add-field, add-relation, add-dashboard, search
add-model, generate, db upgrade, build, run — using only `veloiq` CLI
subcommands (no hand-written models.py). Model/field/relation choices are a
subset of the task-manager sample's Project <-> Task pair.

Unlike test_task_manager_cli_smoke.py (which builds the app in-process via
create_veloiq_app(VeloIQConfig(...)) and therefore never loads backend/.env
or spawns uvicorn), this test launches `veloiq run` as a real subprocess —
the same code path a developer hits at the terminal — and verifies the app
actually serves a page a real browser can render.

A second test below, test_new_rejects_uninstalled_driver_with_actionable_error,
is the regression guard for a bug this file's main test originally caught:
`veloiq new --db-type informix` used to silently write an `informix://`
DATABASE_URL with no driver installed or even verified importable, so the
app looked scaffolded correctly and only failed much later, at `veloiq db
upgrade` / `veloiq run` time, with an opaque NoSuchModuleError. `veloiq new`
and `veloiq configure-db` now call `_check_driver_installed()` right after
building the URL and abort immediately with an actionable message instead.

Marked `e2e`. Requires the venv's `veloiq` to install cleanly with `pip
install -r requirements.txt`, and `playwright install chromium` to have been
run once for this venv.

If step 7 (`veloiq run` health check) times out with the server confirmed
listening (`ss -ltnp` shows it bound) but never responding, check UFW: a
default-deny-incoming policy with only a fixed list of ports allowed will
silently drop loopback connections to `_free_port()`'s random port. UFW's own
built-in `iifname "lo" accept` rule (present by default, before any custom
rules) does NOT reliably match under WSL2 — confirmed by testing: `sudo ufw
allow in on lo` changed nothing, but the address-based equivalent did. Fix
once with:
    sudo ufw allow from 127.0.0.1
    sudo ufw reload
"""
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
import pytest

FRAMEWORK_BACKEND = Path(__file__).parent.parent


def _run(cmd: list[str], cwd: Path, env: dict) -> subprocess.CompletedProcess:
    result = subprocess.run(
        cmd, cwd=cwd, capture_output=True, text=True, timeout=120, env=env,
    )
    assert result.returncode == 0, (
        f"$ {' '.join(cmd)}  (cwd={cwd})\n"
        f"--- stdout ---\n{result.stdout}\n--- stderr ---\n{result.stderr}"
    )
    return result


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.mark.e2e
def test_full_cli_lifecycle_app_boots_in_browser(tmp_path, register_summary_path):
    app_name = "lifecycle-app"
    app_dir = tmp_path / app_name
    backend_dir = app_dir / "backend"
    frontend_dir = app_dir / "frontend"

    env = os.environ.copy()
    env["PYTHONPATH"] = str(FRAMEWORK_BACKEND) + (
        ":" + env["PYTHONPATH"] if env.get("PYTHONPATH") else ""
    )

    # 1. veloiq new (default db-type: sqlite — needs no external driver)
    _run(["veloiq", "new", app_name], tmp_path, env)

    pip = Path(sys.executable).parent / "pip"
    _run([str(pip), "install", "-r", "requirements.txt"], backend_dir, env)
    _run([str(pip), "install", "-e", str(FRAMEWORK_BACKEND)], backend_dir, env)

    # 2. Two models, subset of the task-manager sample's Project <-> Task pair
    _run(["veloiq", "add-module", "projects"], app_dir, env)
    _run(["veloiq", "add-module", "tasks"], app_dir, env)
    _run(["veloiq", "add-model", "Project", "--module", "projects", "--no-migrate"], app_dir, env)
    _run(["veloiq", "add-model", "Task", "--module", "tasks", "--no-migrate"], app_dir, env)

    # 3. Two fields per model, values lifted straight from the sample
    _run(["veloiq", "add-field", "Project", "status", "str",
          "--default", "active",
          "--options", "planning,active,on_hold,completed,archived",
          "--no-migrate"], app_dir, env)
    _run(["veloiq", "add-field", "Project", "description", "str",
          "--optional", "--no-migrate"], app_dir, env)
    _run(["veloiq", "add-field", "Task", "status", "str",
          "--default", "todo",
          "--options", "todo,in_progress,done,cancelled",
          "--no-migrate"], app_dir, env)
    _run(["veloiq", "add-field", "Task", "priority", "str",
          "--default", "medium",
          "--options", "low,medium,high,critical",
          "--no-migrate"], app_dir, env)

    # 4. Relation: Task.project -> Project (same FK/back_populates the sample uses)
    _run(["veloiq", "add-relation", "Task", "Project",
          "--attr", "project", "--back-attr", "tasks",
          "--no-migrate"], app_dir, env)

    # 5. Dashboard + search wiring
    _run(["veloiq", "add-dashboard", "Project", "Task"], app_dir, env)
    _run(["veloiq", "search", "add-model", "project", "--fields", "name,status"], app_dir, env)
    _run(["veloiq", "search", "add-model", "task", "--fields", "title,status"], app_dir, env)

    # 6. generate -> db migrate (autogenerate) -> db upgrade -> build.
    #    The add-model/add-field/add-relation calls above all used
    #    --no-migrate to skip their interactive "run migration now? [Y/n]"
    #    prompt, so no revision file exists yet — it must be generated
    #    explicitly here before `db upgrade` has anything to apply.
    _run(["veloiq", "generate"], backend_dir, env)
    _run(["veloiq", "db", "migrate", "-m", "add project and task models"], backend_dir, env)
    _run(["veloiq", "db", "upgrade"], backend_dir, env)
    _run(["veloiq", "build"], app_dir, env)
    assert (frontend_dir / "dist" / "index.html").exists()

    # 7. Real `veloiq run` subprocess, reading backend/.env exactly as a
    #    developer runs it. This is the step the in-process smoke test skips.
    port = _free_port()
    proc = subprocess.Popen(
        ["veloiq", "run", "--port", str(port), "--no-reload"],
        cwd=app_dir, env=env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    try:
        base_url = f"http://127.0.0.1:{port}"
        deadline = time.time() + 30
        last_error = None
        healthy = False
        while time.time() < deadline:
            if proc.poll() is not None:
                output = proc.stdout.read()
                pytest.fail(
                    f"`veloiq run` exited early (code {proc.returncode}) "
                    f"before serving any request:\n{output}"
                )
            try:
                resp = httpx.get(f"{base_url}/health", timeout=1)
                if resp.status_code == 200:
                    healthy = True
                    break
            except httpx.TransportError as exc:
                last_error = exc
            time.sleep(0.5)
        assert healthy, f"Server never became healthy: {last_error}"

        # 8. Load it in a real browser — catches build/serving issues a bare
        #    HTTP GET would miss, and matches "starts successfully in the
        #    browser" from the bug report.
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            console_errors: list[str] = []
            page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda exc: console_errors.append(str(exc)))

            page.goto(base_url, wait_until="networkidle", timeout=15000)
            page.wait_for_selector("#root :is(form, nav, [class*='layout'])", timeout=10000)
            # A 401 here is expected: the SPA probes an authenticated endpoint
            # before the user has logged in. Only unexpected errors should fail.
            unexpected = [e for e in console_errors if "401" not in e]
            assert not unexpected, f"Browser console errors on load: {unexpected}"

            browser.close()

        # 9. Confirm the two new models are actually live through the real API
        resp = httpx.post(f"{base_url}/auth/login",
                           json={"username": "admin", "password": "admin"})
        assert resp.status_code == 200, resp.text
        headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}

        assert httpx.get(f"{base_url}/project", headers=headers).status_code == 200
        assert httpx.get(f"{base_url}/task", headers=headers).status_code == 200

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()

    register_summary_path("full-lifecycle CLI app", str(app_dir))


@pytest.mark.e2e
def test_new_rejects_uninstalled_driver_with_actionable_error(tmp_path):
    """Regression test: `veloiq new --db-type informix` must fail immediately
    with an actionable message, not silently scaffold an app whose
    DATABASE_URL only breaks later at `db upgrade` / `run` time (the bug
    that originally shipped an `informix://` DATABASE_URL nobody could use).
    """
    env = os.environ.copy()
    env["PYTHONPATH"] = str(FRAMEWORK_BACKEND) + (
        ":" + env["PYTHONPATH"] if env.get("PYTHONPATH") else ""
    )

    result = subprocess.run(
        ["veloiq", "new", "informix-app", "--db-type", "informix"],
        cwd=tmp_path, capture_output=True, text=True, timeout=60, env=env,
    )

    assert result.returncode != 0, "veloiq new should refuse a dialect with no driver installed"
    assert "IfxAlchemy" in result.stderr, f"Error should name the missing package:\n{result.stderr}"
    assert not (tmp_path / "informix-app").exists(), (
        "No project directory should be created when the driver check fails"
    )
