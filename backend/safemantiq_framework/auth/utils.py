"""Auth utilities: JWT helpers, password hashing, FastAPI dependencies, seeding.

Adapted from the JuiceMantics ``auth_utils.py`` but self-contained — no
dependency on JuiceMantics utilities or database engine singletons.
"""
from __future__ import annotations

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
    from safemantiq_framework.auth.models import User

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
# RBAC helper
# ---------------------------------------------------------------------------

_ROLE_METHODS: dict = {
    "Admin":   {"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"},
    "Manager": {"GET", "POST", "PUT", "PATCH", "OPTIONS", "HEAD"},
    "Viewer":  {"GET", "OPTIONS", "HEAD"},
}


def check_rbac(roles: List[str], method: str) -> bool:
    """Return True when at least one role permits *method*."""
    method = method.upper()
    return any(method in _ROLE_METHODS.get(r, set()) for r in roles)


# ---------------------------------------------------------------------------
# Startup seeding
# ---------------------------------------------------------------------------

_DEFAULT_ROLES = [
    ("Admin",   "Full administrative access"),
    ("Manager", "Create, edit and view — no delete"),
    ("Viewer",  "Read-only access"),
]


def seed_default_roles(engine) -> None:
    """Ensure Admin, Manager, and Viewer roles exist in the database."""
    from sqlmodel import Session, select
    from safemantiq_framework.auth.models import Role

    with Session(engine) as session:
        for name, description in _DEFAULT_ROLES:
            if not session.exec(select(Role).where(Role.name == name)).first():
                session.add(Role(name=name, description=description))
        session.commit()


def seed_admin_user_if_needed(engine, username: str = "admin", password: str = "admin") -> None:
    """Create the default admin user when no admin user exists yet.

    This function is idempotent — if the user already exists it is left
    unchanged (except that a missing password_hash is back-filled).
    """
    from sqlmodel import Session, select
    from safemantiq_framework.auth.models import Role, User, user_has_role_link

    with Session(engine) as session:
        admin_role = session.exec(select(Role).where(Role.name == "Admin")).first()
        if admin_role is None:
            admin_role = Role(name="Admin", description="Full administrative access")
            session.add(admin_role)
            session.flush()

        existing = session.exec(select(User).where(User.username == username)).first()
        if existing is not None:
            if not existing.password_hash:
                existing.password_hash = hash_password(password)
                session.add(existing)
                session.commit()
                print(f"\033[32m[SafeMantIQ] Password set on existing '{username}' user.\033[0m")
            else:
                print(f"[SafeMantIQ] Admin user '{username}' already exists.")
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
            f"\033[32m[SafeMantIQ] Default admin user created "
            f"(username: {username}, password: {password}).\033[0m"
        )
