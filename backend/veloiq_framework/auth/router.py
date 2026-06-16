"""Auth API router: login, me, register, password management, role assignment.

Also mounts CRUD routers for User, Role, and Tenant so they appear in the
React UI sidebar alongside the application's own modules.
"""
from __future__ import annotations

import math
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from veloiq_framework.auth.models import (
    Role, Tenant, User,
    user_has_role_link,
    user_has_tenant_link,
)
from veloiq_framework.auth.utils import (
    check_rbac,
    create_access_token,
    get_current_user,
    hash_password,
    require_role,
    verify_password,
)
from veloiq_framework.crud import create_crud_router


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    email: str = ""
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role_names: Optional[List[str]] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class SetPasswordRequest(BaseModel):
    user_id: int
    new_password: str


class RoleAssignRequest(BaseModel):
    user_id: int
    role_name: str


# ---------------------------------------------------------------------------
# User/Role/Tenant CRUD — override _to_dict to exclude password_hash
# ---------------------------------------------------------------------------

def _sanitize(value):
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if isinstance(value, dict):
        return {k: _sanitize(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize(v) for v in value]
    return value


def _user_to_dict(user: User) -> dict:
    data = user.model_dump(exclude={"password_hash"})
    data["_label"] = str(user)
    data["eid"] = user.id
    try:
        data["roles"] = [r.name for r in user.roles]
    except Exception:
        data["roles"] = []
    return _sanitize(data)


def _role_to_dict(role: Role) -> dict:
    import json as _json
    from veloiq_framework.auth.permissions import methods_to_actions
    data = role.model_dump()
    data["_label"] = str(role)
    data["eid"] = role.id
    try:
        methods = set(_json.loads(role.allowed_methods or "[]"))
    except Exception:
        methods = set()
    data["allowed_actions"] = methods_to_actions(methods)
    return _sanitize(data)


def _tenant_to_dict(tenant: Tenant) -> dict:
    data = tenant.model_dump()
    data["_label"] = str(tenant)
    data["eid"] = tenant.id
    return _sanitize(data)


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def make_auth_router(cfg) -> tuple[APIRouter, APIRouter]:
    """Return ``(auth_router, crud_router)``.

    *auth_router* holds the unprefixed ``/auth/*`` endpoints (login, me,
    register, ...) called directly by the UI's authProvider. *crud_router*
    holds the User/Role/Tenant CRUD + link-table read endpoints, which the
    factory mounts under ``/api`` to match every other resource the
    frontend's generic dataProvider talks to.

    *cfg* is a :class:`~veloiq_framework.config.VeloIQConfig` instance
    injected by the factory so that JWT secret, expiry, and engine are
    accessible inside endpoint handlers.
    """
    from veloiq_framework.db import get_engine
    from veloiq_framework.auth.permissions import _MODEL_PERMISSIONS

    # Restrict User/Role/Tenant management to Admin only via the standard
    # Layer 2 mechanism so accessControlProvider hides the create/edit/delete
    # buttons for any non-Admin role without hard-coding resource names in the UI.
    for _res in ("user", "role", "tenant"):
        _MODEL_PERMISSIONS[_res] = {"Manager": [], "Viewer": []}

    router = APIRouter(tags=["auth"])

    # ── Login ────────────────────────────────────────────────────────────────

    @router.post("/auth/login")
    def login(form: LoginRequest):
        engine = get_engine()
        with Session(engine) as session:
            user = session.exec(
                select(User).where(User.username == form.username)
            ).first()
            if user is None or user.password_hash is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials",
                )
            if not verify_password(form.password, user.password_hash):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials",
                )
            if user.status != "Active":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User account is not active",
                )
            roles = [r.name for r in user.roles]
            token = create_access_token(
                data={"sub": str(user.id), "username": user.username, "roles": roles},
                secret=cfg.auth_secret,
                expires_minutes=cfg.auth_token_expire_minutes,
            )
            return {
                "access_token": token,
                "token_type": "bearer",
                "user": {
                    "eid": user.id,
                    "username": user.username,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "status": user.status,
                    "roles": roles,
                },
            }

    # ── Current user ─────────────────────────────────────────────────────────

    @router.get("/auth/me")
    def get_me(request: Request):
        engine = get_engine()
        return get_current_user(request, engine, cfg.auth_secret)

    # ── Register (Admin only) ─────────────────────────────────────────────────

    @router.post("/auth/register", status_code=201)
    def register(form: RegisterRequest, request: Request):
        engine = get_engine()
        admin = get_current_user(request, engine, cfg.auth_secret)
        if "Admin" not in admin.get("roles", []):
            raise HTTPException(status_code=403, detail="Admin role required")
        with Session(engine) as session:
            if session.exec(select(User).where(User.username == form.username)).first():
                raise HTTPException(status_code=409, detail="Username already exists")
            new_user = User(
                username=form.username,
                email=form.email,
                first_name=form.first_name,
                last_name=form.last_name,
                status="Active",
                password_hash=hash_password(form.password),
            )
            session.add(new_user)
            session.flush()
            if form.role_names:
                for role_name in form.role_names:
                    role = session.exec(select(Role).where(Role.name == role_name)).first()
                    if role:
                        session.add(user_has_role_link(user_id=new_user.id, role_id=role.id))
            session.commit()
            return {"message": "User created successfully", "user_id": new_user.id}

    # ── Change password (self) ────────────────────────────────────────────────

    @router.put("/auth/change-password")
    def change_password(form: ChangePasswordRequest, request: Request):
        engine = get_engine()
        current = get_current_user(request, engine, cfg.auth_secret)
        with Session(engine) as session:
            user = session.get(User, current["eid"])
            if user is None:
                raise HTTPException(status_code=404, detail="User not found")
            if user.password_hash is None or not verify_password(form.current_password, user.password_hash):
                raise HTTPException(status_code=400, detail="Current password is incorrect")
            user.password_hash = hash_password(form.new_password)
            session.add(user)
            session.commit()
        return {"message": "Password changed successfully"}

    # ── Set password (Admin only) ─────────────────────────────────────────────

    @router.put("/auth/set-password")
    def set_password(form: SetPasswordRequest, request: Request):
        engine = get_engine()
        admin = get_current_user(request, engine, cfg.auth_secret)
        if "Admin" not in admin.get("roles", []):
            raise HTTPException(status_code=403, detail="Admin role required")
        with Session(engine) as session:
            user = session.get(User, form.user_id)
            if user is None:
                raise HTTPException(status_code=404, detail="User not found")
            user.password_hash = hash_password(form.new_password)
            session.add(user)
            session.commit()
        return {"message": "Password set successfully"}

    # ── List roles (with allowed_actions for frontend) ────────────────────────

    @router.get("/auth/roles")
    def list_roles(request: Request):
        import json as _json
        from veloiq_framework.auth.permissions import methods_to_actions
        engine = get_engine()
        get_current_user(request, engine, cfg.auth_secret)
        with Session(engine) as session:
            roles = session.exec(select(Role)).all()
            result = []
            for r in roles:
                try:
                    methods = set(_json.loads(r.allowed_methods or "[]"))
                except Exception:
                    methods = set()
                result.append({
                    "id": r.id,
                    "name": r.name,
                    "description": r.description,
                    "allowed_methods": sorted(methods),
                    "allowed_actions": methods_to_actions(methods),
                    "is_preset": r.is_preset,
                })
            return result

    # ── Resource-level permissions (model_access exceptions) ─────────────────

    @router.get("/auth/resource-permissions")
    def get_resource_permissions(request: Request):
        engine = get_engine()
        get_current_user(request, engine, cfg.auth_secret)
        from veloiq_framework.auth.permissions import _MODEL_PERMISSIONS
        return _MODEL_PERMISSIONS

    # ── Assign / remove role ──────────────────────────────────────────────────

    @router.post("/auth/user-role")
    def assign_role(form: RoleAssignRequest, request: Request):
        engine = get_engine()
        admin = get_current_user(request, engine, cfg.auth_secret)
        if "Admin" not in admin.get("roles", []):
            raise HTTPException(status_code=403, detail="Admin role required")
        with Session(engine) as session:
            role = session.exec(select(Role).where(Role.name == form.role_name)).first()
            if role is None:
                raise HTTPException(status_code=404, detail="Role not found")
            existing = session.exec(
                select(user_has_role_link).where(
                    user_has_role_link.user_id == form.user_id,
                    user_has_role_link.role_id == role.id,
                )
            ).first()
            if not existing:
                session.add(user_has_role_link(user_id=form.user_id, role_id=role.id))
                session.commit()
        return {"message": "Role assigned"}

    @router.delete("/auth/user-role")
    def remove_role(form: RoleAssignRequest, request: Request):
        engine = get_engine()
        admin = get_current_user(request, engine, cfg.auth_secret)
        if "Admin" not in admin.get("roles", []):
            raise HTTPException(status_code=403, detail="Admin role required")
        with Session(engine) as session:
            role = session.exec(select(Role).where(Role.name == form.role_name)).first()
            if role is None:
                raise HTTPException(status_code=404, detail="Role not found")
            link = session.exec(
                select(user_has_role_link).where(
                    user_has_role_link.user_id == form.user_id,
                    user_has_role_link.role_id == role.id,
                )
            ).first()
            if link:
                session.delete(link)
                session.commit()
        return {"message": "Role removed"}

    # ── Link-table read endpoints (for UI M2M relation panels) ───────────────
    #
    # These, plus the User/Role/Tenant CRUD endpoints below, are returned as a
    # separate router (see end of function) so the factory can mount them
    # under "/api" — matching where the frontend's generic dataProvider sends
    # every resource request. The "/auth/*" endpoints above stay unprefixed
    # since the UI's authProvider calls them directly at that path.
    crud_router = APIRouter(tags=["auth"])

    @crud_router.get("/user_role", summary="List user-role links")
    def list_user_role_links(request: Request, _start: int = 0, _end: int = 100):
        engine = get_engine()
        from sqlmodel import func
        with Session(engine) as session:
            stmt = select(user_has_role_link)
            for key, value in request.query_params.items():
                if key.startswith("_") or not value:
                    continue
                if hasattr(user_has_role_link, key):
                    stmt = stmt.where(getattr(user_has_role_link, key) == value)
            total = session.exec(select(func.count()).select_from(stmt.subquery())).one()
            rows = session.exec(stmt.offset(_start).limit(max(0, _end - _start))).all()
            return JSONResponse(
                content=[{"user_id": r.user_id, "role_id": r.role_id} for r in rows],
                headers={"x-total-count": str(total)},
            )

    @crud_router.get("/user_tenant", summary="List user-tenant links")
    def list_user_tenant_links(request: Request, _start: int = 0, _end: int = 100):
        engine = get_engine()
        from sqlmodel import func
        with Session(engine) as session:
            stmt = select(user_has_tenant_link)
            for key, value in request.query_params.items():
                if key.startswith("_") or not value:
                    continue
                if hasattr(user_has_tenant_link, key):
                    stmt = stmt.where(getattr(user_has_tenant_link, key) == value)
            total = session.exec(select(func.count()).select_from(stmt.subquery())).one()
            rows = session.exec(stmt.offset(_start).limit(max(0, _end - _start))).all()
            return JSONResponse(
                content=[{"user_id": r.user_id, "tenant_id": r.tenant_id} for r in rows],
                headers={"x-total-count": str(total)},
            )

    # ── Admin-only guard ──────────────────────────────────────────────────────

    def _require_admin(request: Request) -> None:
        user = getattr(request.state, "user", None)
        if user is None or "Admin" not in user.get("roles", []):
            raise HTTPException(status_code=403, detail="Admin role required")

    # ── User CRUD (with password_hash excluded) ───────────────────────────────
    # We build a custom list/get so password_hash is never serialized.

    @crud_router.get("/user", summary="List users")
    def list_users(
        request: Request,
        _start: int = 0,
        _end: int = 25,
    ):
        engine = get_engine()
        from sqlmodel import func
        with Session(engine) as session:
            # Simple filter support for ?username=... etc.
            stmt = select(User)
            for key, value in request.query_params.items():
                if key.startswith("_") or not value:
                    continue
                if hasattr(User, key):
                    if key.endswith("__ilike"):
                        col = key[:-7]
                        if hasattr(User, col):
                            stmt = stmt.where(getattr(User, col).ilike(f"%{value}%"))
                    else:
                        stmt = stmt.where(getattr(User, key) == value)
            total_stmt = select(func.count()).select_from(stmt.subquery())
            total = session.exec(total_stmt).one()
            rows = session.exec(stmt.offset(_start).limit(max(0, _end - _start))).all()
            return JSONResponse(
                content=jsonable_encoder([_user_to_dict(r) for r in rows]),
                headers={
                    "x-total-count": str(total),
                    "content-range": f"items {_start}-{min(_end, total)}/{total}",
                },
            )

    @crud_router.get("/user/{user_id}", summary="Get user")
    def get_user(user_id: int):
        engine = get_engine()
        with Session(engine) as session:
            user = session.get(User, user_id)
            if user is None:
                raise HTTPException(status_code=404, detail="User not found")
            return _user_to_dict(user)

    @crud_router.post("/user", status_code=201, summary="Create user")
    def create_user(request: Request, payload: dict):
        _require_admin(request)
        engine = get_engine()
        payload.pop("id", None)
        payload.pop("password_hash", None)
        raw_password = payload.pop("password", None)
        with Session(engine) as session:
            user = User.model_validate(payload)
            if raw_password:
                user.password_hash = hash_password(raw_password)
            session.add(user)
            session.commit()
            session.refresh(user)
            return _user_to_dict(user)

    @crud_router.put("/user/{user_id}", summary="Update user")
    @crud_router.patch("/user/{user_id}", summary="Partial update user")
    def update_user(user_id: int, request: Request, payload: dict):
        _require_admin(request)
        engine = get_engine()
        payload.pop("id", None)
        payload.pop("password_hash", None)
        raw_password = payload.pop("password", None)
        _SKIP = {"created_at", "creation_date"}
        with Session(engine) as session:
            user = session.get(User, user_id)
            if user is None:
                raise HTTPException(status_code=404, detail="User not found")
            for key, value in payload.items():
                if key in _SKIP:
                    continue
                if hasattr(user, key):
                    setattr(user, key, value)
            if raw_password:
                user.password_hash = hash_password(raw_password)
            session.add(user)
            session.commit()
            session.refresh(user)
            return _user_to_dict(user)

    @crud_router.delete("/user/{user_id}", status_code=204, summary="Delete user")
    def delete_user(user_id: int, request: Request):
        _require_admin(request)
        engine = get_engine()
        with Session(engine) as session:
            user = session.get(User, user_id)
            if user is None:
                raise HTTPException(status_code=404, detail="User not found")
            session.delete(user)
            session.commit()

    # ── Role CRUD ─────────────────────────────────────────────────────────────

    @crud_router.get("/role", summary="List roles")
    def list_roles_crud(request: Request, _start: int = 0, _end: int = 25):
        engine = get_engine()
        from sqlmodel import func
        with Session(engine) as session:
            stmt = select(Role)
            total = session.exec(select(func.count()).select_from(Role)).one()
            rows = session.exec(stmt.offset(_start).limit(max(0, _end - _start))).all()
            return JSONResponse(
                content=jsonable_encoder([_role_to_dict(r) for r in rows]),
                headers={
                    "x-total-count": str(total),
                    "content-range": f"items {_start}-{min(_end, total)}/{total}",
                },
            )

    @crud_router.get("/role/{role_id}", summary="Get role")
    def get_role(role_id: int):
        engine = get_engine()
        with Session(engine) as session:
            role = session.get(Role, role_id)
            if role is None:
                raise HTTPException(status_code=404, detail="Role not found")
            return _role_to_dict(role)

    @crud_router.post("/role", status_code=201, summary="Create role")
    def create_role(request: Request, payload: dict):
        _require_admin(request)
        from veloiq_framework.auth.utils import _invalidate_rbac_cache
        engine = get_engine()
        payload.pop("id", None)
        with Session(engine) as session:
            role = Role.model_validate(payload)
            session.add(role)
            session.commit()
            session.refresh(role)
        _invalidate_rbac_cache()
        return _role_to_dict(role)

    @crud_router.put("/role/{role_id}", summary="Update role")
    @crud_router.patch("/role/{role_id}", summary="Partial update role")
    def update_role(role_id: int, request: Request, payload: dict):
        _require_admin(request)
        from veloiq_framework.auth.utils import _invalidate_rbac_cache
        engine = get_engine()
        payload.pop("id", None)
        with Session(engine) as session:
            role = session.get(Role, role_id)
            if role is None:
                raise HTTPException(status_code=404, detail="Role not found")
            for key, value in payload.items():
                if hasattr(role, key):
                    setattr(role, key, value)
            session.add(role)
            session.commit()
            session.refresh(role)
        _invalidate_rbac_cache()
        return _role_to_dict(role)

    @crud_router.delete("/role/{role_id}", status_code=204, summary="Delete role")
    def delete_role(role_id: int, request: Request):
        _require_admin(request)
        engine = get_engine()
        with Session(engine) as session:
            role = session.get(Role, role_id)
            if role is None:
                raise HTTPException(status_code=404, detail="Role not found")
            session.delete(role)
            session.commit()

    # ── Tenant CRUD ───────────────────────────────────────────────────────────

    @crud_router.get("/tenant", summary="List tenants")
    def list_tenants(request: Request, _start: int = 0, _end: int = 25):
        engine = get_engine()
        from sqlmodel import func
        with Session(engine) as session:
            stmt = select(Tenant)
            total = session.exec(select(func.count()).select_from(Tenant)).one()
            rows = session.exec(stmt.offset(_start).limit(max(0, _end - _start))).all()
            return JSONResponse(
                content=jsonable_encoder([_tenant_to_dict(r) for r in rows]),
                headers={
                    "x-total-count": str(total),
                    "content-range": f"items {_start}-{min(_end, total)}/{total}",
                },
            )

    @crud_router.get("/tenant/{tenant_id}", summary="Get tenant")
    def get_tenant(tenant_id: int):
        engine = get_engine()
        with Session(engine) as session:
            tenant = session.get(Tenant, tenant_id)
            if tenant is None:
                raise HTTPException(status_code=404, detail="Tenant not found")
            return _tenant_to_dict(tenant)

    @crud_router.post("/tenant", status_code=201, summary="Create tenant")
    def create_tenant(request: Request, payload: dict):
        _require_admin(request)
        engine = get_engine()
        payload.pop("id", None)
        with Session(engine) as session:
            tenant = Tenant.model_validate(payload)
            session.add(tenant)
            session.commit()
            session.refresh(tenant)
            return _tenant_to_dict(tenant)

    @crud_router.put("/tenant/{tenant_id}", summary="Update tenant")
    @crud_router.patch("/tenant/{tenant_id}", summary="Partial update tenant")
    def update_tenant(tenant_id: int, request: Request, payload: dict):
        _require_admin(request)
        engine = get_engine()
        payload.pop("id", None)
        with Session(engine) as session:
            tenant = session.get(Tenant, tenant_id)
            if tenant is None:
                raise HTTPException(status_code=404, detail="Tenant not found")
            for key, value in payload.items():
                if hasattr(tenant, key):
                    setattr(tenant, key, value)
            session.add(tenant)
            session.commit()
            session.refresh(tenant)
            return _tenant_to_dict(tenant)

    @crud_router.delete("/tenant/{tenant_id}", status_code=204, summary="Delete tenant")
    def delete_tenant(tenant_id: int, request: Request):
        _require_admin(request)
        engine = get_engine()
        with Session(engine) as session:
            tenant = session.get(Tenant, tenant_id)
            if tenant is None:
                raise HTTPException(status_code=404, detail="Tenant not found")
            session.delete(tenant)
            session.commit()

    return router, crud_router
