"""VeloIQ Studio API router.

Mounted at /veloiq-studio/api/ by create_veloiq_app().
All endpoints require the Admin role.
Write endpoints additionally require VELOIQ_DEV=true.
"""
from __future__ import annotations

import dataclasses
import json
import os
import shlex
import subprocess
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from veloiq_framework.config import VeloIQConfig


# ── Helpers ───────────────────────────────────────────────────────────────────

def _is_dev_mode() -> bool:
    return os.environ.get("VELOIQ_DEV", "").lower() in ("1", "true", "yes")


def _make_require_admin(cfg: VeloIQConfig):
    """Returns a callable that validates the JWT and enforces the Admin role."""
    def _check(request: Request) -> dict:
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Authentication required")
        try:
            from veloiq_framework.auth.utils import decode_access_token
            payload = decode_access_token(auth[7:], cfg.auth_secret)
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        if "Admin" not in (payload.get("roles") or []):
            raise HTTPException(status_code=403, detail="Admin role required")
        return payload
    return _check


def _require_dev() -> None:
    if not _is_dev_mode():
        raise HTTPException(status_code=403, detail="VELOIQ_DEV mode is not enabled")


def _to_dict(obj: Any) -> Any:
    """Recursively convert dataclasses / Path / set objects to JSON-safe types."""
    if dataclasses.is_dataclass(obj) and not isinstance(obj, type):
        return {f.name: _to_dict(getattr(obj, f.name)) for f in dataclasses.fields(obj)}
    if isinstance(obj, Path):
        return str(obj)
    if isinstance(obj, set):
        return sorted(obj)
    if isinstance(obj, (list, tuple)):
        return [_to_dict(i) for i in obj]
    if isinstance(obj, dict):
        return {k: _to_dict(v) for k, v in obj.items()}
    return obj


def _get_root() -> Path:
    from veloiq_framework.cli.explorer import _find_project_root
    root = _find_project_root()
    if root is None:
        raise HTTPException(status_code=503, detail="Project root not found")
    return root


# ── Command whitelist ─────────────────────────────────────────────────────────

_ALLOWED_PREFIXES = (
    "veloiq add-module ",
    "veloiq add-model ",
    "veloiq add-field ",
    "veloiq add-relation ",
    "veloiq add-dashboard ",
    "veloiq search add-model ",
    "veloiq search remove-model ",
    "veloiq search add-field ",
    "veloiq search remove-field ",
    "veloiq scaffold-page ",
    "veloiq generate",
    "veloiq build",
    "veloiq check",
    "veloiq extend-package ",
    "veloiq remove-package ",
)

_SHELL_METACHARACTERS = (";", "|", "&", "`", "$", ">", "<", "\n", "\r")

_runs: dict[str, subprocess.Popen] = {}


def _is_allowed_command(cmd: str) -> bool:
    if any(c in cmd for c in _SHELL_METACHARACTERS):
        return False
    return any(cmd == p.strip() or cmd.startswith(p) for p in _ALLOWED_PREFIXES)


# ── Router factory ────────────────────────────────────────────────────────────

def make_studio_router(cfg: VeloIQConfig) -> APIRouter:
    router = APIRouter(prefix="/veloiq-studio/api")
    _admin = _make_require_admin(cfg)

    @router.get("/info")
    def info(request: Request):
        _admin(request)
        try:
            from veloiq_framework._version import __version__ as fv
        except Exception:
            fv = "unknown"
        return {
            "app_name": cfg.title,
            "framework_version": fv,
            "dev_mode": _is_dev_mode(),
        }

    @router.get("/schema")
    def schema(request: Request):
        _admin(request)
        from veloiq_framework.cli.explorer import _load_app_data
        return _to_dict(_load_app_data(_get_root()))

    @router.get("/config/dashboard")
    def config_dashboard(request: Request):
        _admin(request)
        from veloiq_framework.cli.explorer import _load_app_data
        data = _load_app_data(_get_root())
        return {
            "models": [
                {
                    "name": m.name,
                    "label": m.label,
                    "resource": m.resource,
                    "tab": m.dashboard_tab,
                    "module": m.module_name,
                }
                for mod in data.modules
                for m in mod.models
                if m.in_dashboard
            ]
        }

    @router.get("/config/search")
    def config_search(request: Request):
        _admin(request)
        from veloiq_framework.cli.explorer import _load_app_data
        data = _load_app_data(_get_root())
        return {"models": data.search_models, "fields": data.search_fields}

    @router.get("/extensions")
    def extensions(request: Request):
        _admin(request)
        from veloiq_framework.cli.explorer import _load_app_data
        data = _load_app_data(_get_root())
        return {
            "extensions": [
                {"name": e.name, "installed": e.installed, "enabled": e.enabled}
                for e in data.extensions
            ]
        }

    @router.get("/health")
    def health(request: Request):
        _admin(request)
        _require_dev()
        result = subprocess.run(
            ["veloiq", "check"], capture_output=True, text=True, timeout=30
        )
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
        }

    @router.post("/commands/run")
    async def commands_run(request: Request):
        _admin(request)
        _require_dev()
        body = await request.json()
        cmd = (body.get("command") or "").strip()
        if not _is_allowed_command(cmd):
            raise HTTPException(status_code=400, detail=f"Command not allowed: {cmd!r}")
        run_id = str(uuid.uuid4())
        _runs[run_id] = subprocess.Popen(
            shlex.split(cmd),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            start_new_session=True,  # survive uvicorn --reload worker restarts
        )
        return {"run_id": run_id}

    @router.get("/commands/stream/{run_id}")
    def commands_stream(run_id: str, request: Request):
        _admin(request)
        _require_dev()
        proc = _runs.get(run_id)
        if proc is None:
            raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")

        def _generate():
            try:
                for line in proc.stdout:  # type: ignore[union-attr]
                    yield f"data: {json.dumps({'line': line.rstrip()})}\n\n"
            finally:
                proc.wait()
                _runs.pop(run_id, None)
                yield f"data: {json.dumps({'done': True, 'returncode': proc.returncode})}\n\n"

        return StreamingResponse(_generate(), media_type="text/event-stream")

    # ── Named query CRUD ──────────────────────────────────────────────────────

    def _nq_path(module: str) -> Path:
        return _get_root() / "backend" / "app" / "modules" / module / "named_queries.json"

    def _all_module_names() -> list[str]:
        modules_dir = _get_root() / "backend" / "app" / "modules"
        if not modules_dir.exists():
            return []
        return sorted(
            d.name for d in modules_dir.iterdir()
            if d.is_dir() and not d.name.startswith("__")
        )

    @router.get("/named-queries")
    def named_queries_list(request: Request):
        _admin(request)
        from veloiq_framework.query_def import load_defs, _def_to_dict
        result = []
        for module in _all_module_names():
            for qdef in load_defs(_nq_path(module)):
                d = _def_to_dict(qdef)
                d["module"] = module
                result.append(d)
        return {"named_queries": result}

    @router.post("/named-queries")
    async def named_queries_create(request: Request):
        _admin(request)
        _require_dev()
        from veloiq_framework.query_def import load_defs, save_defs, _parse_one
        body = await request.json()
        module = body.get("module", "")
        if not module:
            raise HTTPException(status_code=400, detail="module is required")
        path = _nq_path(module)
        if not path.parent.exists():
            raise HTTPException(status_code=404, detail=f"Module '{module}' not found")
        body["module"] = module
        try:
            new_def = _parse_one(body)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        defs = load_defs(path)
        if any(d.name == new_def.name for d in defs):
            raise HTTPException(status_code=409, detail=f"Named query '{new_def.name}' already exists")
        defs.append(new_def)
        save_defs(path, defs)
        return {"ok": True, "name": new_def.name}

    @router.put("/named-queries/{module}/{name}")
    async def named_queries_update(module: str, name: str, request: Request):
        _admin(request)
        _require_dev()
        from veloiq_framework.query_def import load_defs, save_defs, _parse_one
        path = _nq_path(module)
        body = await request.json()
        body["module"] = module
        try:
            updated = _parse_one(body)
        except Exception as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        defs = load_defs(path)
        idx = next((i for i, d in enumerate(defs) if d.name == name), None)
        if idx is None:
            raise HTTPException(status_code=404, detail=f"Named query '{name}' not found")
        defs[idx] = updated
        save_defs(path, defs)
        return {"ok": True}

    @router.delete("/named-queries/{module}/{name}")
    def named_queries_delete(module: str, name: str, request: Request):
        _admin(request)
        _require_dev()
        from veloiq_framework.query_def import load_defs, save_defs
        path = _nq_path(module)
        defs = load_defs(path)
        new_defs = [d for d in defs if d.name != name]
        if len(new_defs) == len(defs):
            raise HTTPException(status_code=404, detail=f"Named query '{name}' not found")
        save_defs(path, new_defs)
        return {"ok": True}

    return router
