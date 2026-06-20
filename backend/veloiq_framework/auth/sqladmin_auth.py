"""SQLAdmin authentication backend for VeloIQ.

Validates credentials against the veloiq_user table and enforces the Admin role.
A signed JWT is stored in the Starlette session cookie so the admin panel remains
protected across browser requests without requiring a Bearer header.
"""
from sqladmin.authentication import AuthenticationBackend
from starlette.requests import Request


class VeloIQAdminAuth(AuthenticationBackend):
    def __init__(self, cfg):
        super().__init__(secret_key=cfg.auth_secret)
        self.cfg = cfg

    async def login(self, request: Request) -> bool:
        form = await request.form()
        username = str(form.get("username", ""))
        password = str(form.get("password", ""))
        if not username or not password:
            return False
        try:
            from sqlmodel import Session, select
            from veloiq_framework.auth.models import User
            from veloiq_framework.auth.utils import verify_password, create_access_token
            from veloiq_framework.db import get_engine

            with Session(get_engine()) as session:
                user = session.exec(select(User).where(User.username == username)).first()
                if not user or not verify_password(password, user.password_hash or ""):
                    return False
                if user.status != "Active":
                    return False
                roles = [r.name for r in user.roles]
                if "Admin" not in roles:
                    return False
                token = create_access_token(
                    data={"sub": str(user.id), "roles": roles, "username": user.username},
                    secret=self.cfg.auth_secret,
                    expires_minutes=self.cfg.auth_token_expire_minutes,
                )
                request.session["admin_token"] = token
                return True
        except Exception:
            return False

    async def logout(self, request: Request) -> bool:
        request.session.clear()
        return True

    async def authenticate(self, request: Request) -> bool:
        token = request.session.get("admin_token")
        if not token:
            return False
        try:
            from veloiq_framework.auth.utils import decode_access_token
            payload = decode_access_token(token, self.cfg.auth_secret)
            return "Admin" in (payload.get("roles") or [])
        except Exception:
            return False
