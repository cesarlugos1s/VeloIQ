"""Admin-only endpoints for role access policies, under ``/auth/access-policies``.

* ``GET    /auth/access-policies/resources`` — modules and models a policy can name
* ``GET    /auth/access-policies``           — every role with its policy
* ``GET    /auth/access-policies/audit``     — change history (``?role_id=`` optional)
* ``GET    /auth/access-policies/{role_id}`` — one role's policy
* ``PUT    /auth/access-policies/{role_id}`` — create or replace a role's policy
* ``DELETE /auth/access-policies/{role_id}`` — remove a role's policy

Only the Admin role may call them (AC-A1). The user is read from the Bearer
token on each call, like the other ``/auth/*`` endpoints, because ``/auth/``
paths sit outside the RBAC middleware.

:func:`build_effective_permissions` builds what ``/auth/resource-permissions``
returns to the signed-in user.
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Body, HTTPException, Request

from veloiq_framework.access.decision import (
    ACTIONS,
    ADMIN_ROLE,
    build_context,
    evaluate_access,
)
from veloiq_framework.utils.i18n_utils import _


def _resources_payload() -> dict:
    """Return the resource picker's data: installed, non-system modules and their models."""
    from veloiq_framework.access.registry import get_modules

    modules = []
    for key, info in sorted(get_modules().items()):
        modules.append({
            "key": key,
            "source": info.source,
            "name": info.name,
            "models": [{"key": m} for m in sorted(info.models)],
        })
    return {"modules": modules, "actions": list(ACTIONS)}


def _policy_with_status(policy: dict | None) -> dict | None:
    """Add an ``active`` flag to each entry: inactive when its module isn't installed (AC-B8)."""
    from veloiq_framework.access.registry import is_registered_module

    if policy is None:
        return None
    return {
        **policy,
        "entries": [
            {**e, "active": is_registered_module(e["module_key"])} for e in policy["entries"]
        ],
    }


def build_effective_permissions(user: dict) -> dict:
    """Return the signed-in user's access context and effective permissions.

    ``context`` holds the inputs the frontend's ``evaluateAccess`` needs
    (roles, role methods, the user's own roles' policies, ``@model_access``,
    the license pool and the module/model registry). ``effective`` lists, for
    every registered module and every model the backend knows rules for, the
    CRUD actions the shared decision function allows.
    """
    from veloiq_framework.access.registry import registry_snapshot

    ctx = build_context(user)
    ctx["registry"] = registry_snapshot()
    effective_modules = {
        key: {a: evaluate_access(ctx, key, None, a).allowed for a in ACTIONS}
        for key in ctx["registry"]["modules"]
    }
    model_keys = set(ctx["registry"]["models"]) | set(ctx["model_access"])
    effective_models = {
        key: {a: evaluate_access(ctx, None, key, a).allowed for a in ACTIONS}
        for key in sorted(model_keys)
    }
    return {
        "context": ctx,
        "effective": {"modules": effective_modules, "models": effective_models},
    }


def make_access_policy_router(cfg) -> APIRouter:
    """Return the ``/auth/access-policies`` router (mounted unprefixed by the auth router)."""
    from sqlmodel import Session, select

    from veloiq_framework.access import store
    from veloiq_framework.auth.models import Role
    from veloiq_framework.auth.utils import get_current_user
    from veloiq_framework.db import get_engine

    router = APIRouter(tags=["access-policies"])

    def _require_admin(request: Request) -> dict:
        user = get_current_user(request, get_engine(), cfg.auth_secret)
        if ADMIN_ROLE not in (user.get("roles") or []):
            raise HTTPException(status_code=403, detail=_("You do not have permission to perform this action."))
        return user

    def _role_or_404(session, role_id: int) -> Role:
        role = session.get(Role, role_id)
        if role is None:
            raise HTTPException(status_code=404, detail=_("Role not found"))
        return role

    def _role_row(session, role: Role) -> dict:
        policy, entries = store._load_policy(session, role.id)
        return {
            "role_id": role.id,
            "role_name": role.name,
            "is_admin": role.name == ADMIN_ROLE,
            "policy": _policy_with_status(store.policy_to_dict(policy, entries)),
        }

    @router.get("/auth/access-policies/resources")
    def list_policy_resources(request: Request):
        _require_admin(request)
        return _resources_payload()

    @router.get("/auth/access-policies")
    def list_access_policies(request: Request):
        _require_admin(request)
        with Session(get_engine()) as session:
            roles = session.exec(select(Role).order_by(Role.name)).all()
            return [_role_row(session, r) for r in roles]

    @router.get("/auth/access-policies/audit")
    def list_access_policy_audit(request: Request, role_id: Optional[int] = None, limit: int = 200):
        _require_admin(request)
        return store.list_audit(get_engine(), role_id=role_id, limit=max(1, min(limit, 1000)))

    @router.get("/auth/access-policies/{role_id}")
    def get_access_policy(role_id: int, request: Request):
        _require_admin(request)
        with Session(get_engine()) as session:
            return _role_row(session, _role_or_404(session, role_id))

    @router.put("/auth/access-policies/{role_id}")
    def put_access_policy(role_id: int, request: Request, payload: Any = Body(...)):
        actor = _require_admin(request)
        engine = get_engine()
        store.save_policy(engine, role_id, payload, actor)
        with Session(engine) as session:
            return _role_row(session, _role_or_404(session, role_id))

    @router.delete("/auth/access-policies/{role_id}", status_code=204)
    def delete_access_policy(role_id: int, request: Request):
        actor = _require_admin(request)
        engine = get_engine()
        with Session(engine) as session:
            _role_or_404(session, role_id)
        store.delete_policy(engine, role_id, actor)

    return router
