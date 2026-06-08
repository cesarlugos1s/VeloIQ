"""Auth utilities: JWT helpers, password hashing, FastAPI dependencies, seeding.

Adapted from the JuiceMantics ``auth_utils.py`` but self-contained — no
dependency on JuiceMantics utilities or database engine singletons.
"""
from __future__ import annotations

import json
import time
import uuid
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, List

from fastapi import HTTPException, Request, status

if TYPE_CHECKING:
    from sqlalchemy import Engine

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    import bcrypt
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    import bcrypt
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def create_access_token(data: dict, secret: str, expires_minutes: int = 480) -> str:
    """Return a signed HS256 JWT containing *data* plus an expiry claim."""
    from jose import jwt
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=expires_minutes)
    return jwt.encode(payload, secret, algorithm="HS256")


def decode_access_token(token: str, secret: str) -> dict:
    """Decode and validate *token*; raise 401 on failure."""
    from jose import JWTError, jwt
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        if payload.get("sub") is None:
            raise HTTPException(status_code=401, detail="Invalid authentication token")
        return payload
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ---------------------------------------------------------------------------
# FastAPI dependencies
# ---------------------------------------------------------------------------

def get_current_user(request: Request, engine, secret: str) -> dict:
    """Extract the Bearer token, load the User from DB, return a user-info dict.

    The returned dict contains::

        {
            "eid": int,        # same as user.id — kept as "eid" for frontend compat
            "username": str,
            "email": str,
            "first_name": str | None,
            "last_name": str | None,
            "status": str,
            "roles": [str, ...],
        }
    """
    from sqlmodel import Session, select
    from veloiq_framework.auth.models import User

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = auth_header[7:]
    payload = decode_access_token(token, secret)
    user_id = payload.get("sub")

    with Session(engine) as session:
        user = session.get(User, int(user_id))
        if user is None or user.status != "Active":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive",
            )
        roles = [r.name for r in user.roles]
        user_info = {
            "eid": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "status": user.status,
            "roles": roles,
        }

    request.state.user = user_info
    return user_info


def require_role(*allowed_roles: str):
    """Return a FastAPI dependency that verifies the user holds at least one role."""
    def _dependency(request: Request) -> dict:
        user = getattr(request.state, "user", None)
        if user is None:
            raise HTTPException(status_code=401, detail="Not authenticated")
        if not any(r in user.get("roles", []) for r in allowed_roles):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return _dependency


# ---------------------------------------------------------------------------
# RBAC helper — DB-backed with in-process cache
# ---------------------------------------------------------------------------

# role_name → (allowed_methods: set, expires_at: float)
_rbac_cache: dict[str, tuple[set[str], float]] = {}
_RBAC_CACHE_TTL = 30.0  # seconds


def _invalidate_rbac_cache() -> None:
    """Clear the RBAC method cache (call after roles are modified)."""
    _rbac_cache.clear()


def _get_role_methods(engine, role_name: str) -> set[str]:
    """Return the set of allowed HTTP methods for *role_name* (cached 30 s)."""
    now = time.monotonic()
    cached = _rbac_cache.get(role_name)
    if cached and now < cached[1]:
        return cached[0]

    from sqlmodel import Session, select
    from veloiq_framework.auth.models import Role

    with Session(engine) as session:
        role = session.exec(select(Role).where(Role.name == role_name)).first()
        if role is None:
            methods: set[str] = set()
        else:
            try:
                methods = set(json.loads(role.allowed_methods or "[]"))
            except Exception:
                methods = set()

    _rbac_cache[role_name] = (methods, now + _RBAC_CACHE_TTL)
    return methods


def check_rbac(roles: List[str], method: str, engine=None) -> bool:
    """Return True when at least one role permits *method*.

    Reads permissions from the DB (with a 30 s in-process cache).
    Falls back to a hard-coded legacy table when the DB is unavailable.
    """
    method = method.upper()
    _engine = engine
    if _engine is None:
        try:
            from veloiq_framework.db import get_engine
            _engine = get_engine()
        except Exception:
            pass

    if _engine is not None:
        return any(method in _get_role_methods(_engine, r) for r in roles)

    # Fallback — should only happen before the engine is initialised.
    _legacy: dict[str, set[str]] = {
        "Admin":   {"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"},
        "Manager": {"GET", "POST", "PUT", "PATCH", "OPTIONS", "HEAD"},
        "Viewer":  {"GET", "OPTIONS", "HEAD"},
    }
    return any(method in _legacy.get(r, set()) for r in roles)


# ---------------------------------------------------------------------------
# Startup seeding
# ---------------------------------------------------------------------------

def _ensure_role_columns(engine) -> None:
    """Add allowed_methods / is_preset columns to veloiq_role if missing.

    Enables zero-downtime upgrades from the old schema: the columns are added
    transparently on first startup after the framework update.
    """
    from sqlalchemy import inspect as sa_inspect, text

    inspector = sa_inspect(engine)
    if "veloiq_role" not in inspector.get_table_names():
        return  # Table will be created with the full schema by create_all().

    existing = {c["name"] for c in inspector.get_columns("veloiq_role")}
    with engine.connect() as conn:
        if "allowed_methods" not in existing:
            try:
                conn.execute(text("ALTER TABLE veloiq_role ADD COLUMN allowed_methods TEXT DEFAULT '[]'"))
                conn.commit()
            except Exception:
                pass
        if "is_preset" not in existing:
            try:
                conn.execute(text("ALTER TABLE veloiq_role ADD COLUMN is_preset BOOLEAN DEFAULT FALSE"))
                conn.commit()
            except Exception:
                pass


def seed_roles(engine, roles: list) -> None:
    """Upsert developer-defined role presets into the database.

    Creates each role that doesn't exist yet; updates ``allowed_methods``,
    ``description``, and ``is_preset`` for roles that already exist.
    Never deletes roles — roles created via the admin UI are preserved.
    """
    from sqlmodel import Session, select
    from veloiq_framework.auth.models import Role

    _ensure_role_columns(engine)

    with Session(engine) as session:
        for role_def in roles:
            methods_json = json.dumps(sorted(role_def.methods))
            existing = session.exec(select(Role).where(Role.name == role_def.name)).first()
            if existing is None:
                session.add(Role(
                    name=role_def.name,
                    description=role_def.description,
                    allowed_methods=methods_json,
                    is_preset=role_def.is_preset,
                ))
            else:
                if role_def.description:
                    existing.description = role_def.description
                existing.allowed_methods = methods_json
                existing.is_preset = role_def.is_preset
                session.add(existing)
        session.commit()

    _invalidate_rbac_cache()


def seed_default_roles(engine) -> None:
    """Backward-compatible alias — seeds the three built-in preset roles."""
    from veloiq_framework.auth.permissions import DEFAULT_ROLES
    seed_roles(engine, DEFAULT_ROLES)


def seed_admin_user_if_needed(engine, username: str = "admin", password: str = "admin") -> None:
    """Create or update the default admin user.

    If the user does not exist yet, it is created with the given credentials.
    If the user already exists, the password is updated to match the configured
    value (so that changing VELOIQ_ADMIN_PASSWORD in .env takes effect even
    after the initial seed).
    """
    from sqlmodel import Session, select
    from veloiq_framework.auth.models import Role, User, user_has_role_link

    with Session(engine) as session:
        admin_role = session.exec(select(Role).where(Role.name == "Admin")).first()
        if admin_role is None:
            admin_role = Role(name="Admin", description="Full administrative access")
            session.add(admin_role)
            session.flush()

        existing = session.exec(select(User).where(User.username == username)).first()
        if existing is not None:
            if existing.password_hash and verify_password(password, existing.password_hash):
                print(f"[VeloIQ] Admin user '{username}' already exists.")
            else:
                existing.password_hash = hash_password(password)
                session.add(existing)
                session.commit()
                print(f"\033[32m[VeloIQ] Password updated for '{username}' user.\033[0m")
            return

        new_user = User(
            username=username,
            email=f"{username}@localhost",
            first_name="System",
            last_name="Admin",
            status="Active",
            password_hash=hash_password(password),
        )
        session.add(new_user)
        session.flush()
        session.add(user_has_role_link(user_id=new_user.id, role_id=admin_role.id))
        session.commit()
        print(
            f"\033[32m[VeloIQ] Default admin user created "
            f"(username: {username}, password: {password}).\033[0m"
        )
