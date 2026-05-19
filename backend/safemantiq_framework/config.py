"""SafemConfig — configuration dataclass for create_safem_app()."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from safemantiq_framework.auth.permissions import RoleDef


@dataclass
class SafemConfig:
    """All configuration that create_safem_app() accepts.

    Every value defaults to its environment-variable equivalent so apps can be
    configured entirely through env vars (12-factor style).

    Minimal usage::

        from safemantiq_framework import create_safem_app
        app = create_safem_app()          # reads DATABASE_URL from env

    Explicit usage::

        from safemantiq_framework import create_safem_app, SafemConfig
        app = create_safem_app(SafemConfig(
            title="My App",
            database_url="postgresql://user:pass@localhost/mydb",
        ))
    """

    # ── Identity ──────────────────────────────────────────────────────────────
    title: str = "SafeMantIQ App"

    # ── Database ──────────────────────────────────────────────────────────────
    database_url: str = field(
        default_factory=lambda: os.environ.get("DATABASE_URL", "")
    )
    echo_sql: bool = field(
        default_factory=lambda: os.environ.get("SAFEM_ECHO_SQL", "").lower() in ("1", "true")
    )
    create_tables_on_startup: bool = True

    # ── Module discovery ──────────────────────────────────────────────────────
    # Absolute path or relative to CWD. Points to the directory that contains
    # individual module sub-folders (each with models.py, api.py, etc.).
    modules_dir: Path = field(
        default_factory=lambda: Path(
            os.environ.get("SAFEM_MODULES_DIR", "app/modules")
        )
    )

    # ── CORS ──────────────────────────────────────────────────────────────────
    cors_origins: list[str] = field(
        default_factory=lambda: (
            [o.strip() for o in os.environ["CORS_ORIGINS"].split(",") if o.strip()]
            if os.environ.get("CORS_ORIGINS")
            else [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:3000",
                "http://127.0.0.1:3000",
            ]
        )
    )

    # ── Auth ──────────────────────────────────────────────────────────────────
    auth_enabled: bool = field(
        default_factory=lambda: os.environ.get("SAFEM_AUTH_DISABLED", "").lower()
        not in ("1", "true")
    )
    auth_secret: str = field(
        default_factory=lambda: os.environ.get("AUTH_SECRET", "safemantiq-dev-secret-change-me")
    )
    auth_algorithm: str = "HS256"
    auth_token_expire_minutes: int = field(
        default_factory=lambda: int(os.environ.get("AUTH_TOKEN_EXPIRE_MINUTES", "480"))
    )

    # ── Initial admin seed credentials ───────────────────────────────────────
    # Used only during first startup to seed the default admin user.
    # Once the user exists in the database, changing these has no effect.
    admin_username: str = field(
        default_factory=lambda: os.environ.get("SAFEM_ADMIN_USERNAME", "admin")
    )
    admin_password: str = field(
        default_factory=lambda: os.environ.get("SAFEM_ADMIN_PASSWORD", "admin")
    )

    # ── SQLAdmin ──────────────────────────────────────────────────────────────
    admin_title: str | None = None        # defaults to `title`
    admin_logo_url: str | None = None
    admin_templates_dir: Path | None = None

    # ── Static files ──────────────────────────────────────────────────────────
    static_dir: Path | None = None        # None = no static mount

    # ── Role presets ──────────────────────────────────────────────────────────
    # Developer-defined roles seeded to the DB on startup.  Defaults to the
    # three built-in presets (Admin / Manager / Viewer).  Add or replace entries
    # to introduce app-specific roles.
    roles: list = field(
        default_factory=lambda: list(__import__(
            "safemantiq_framework.auth.permissions", fromlist=["DEFAULT_ROLES"]
        ).DEFAULT_ROLES)
    )

    # ── ReBAC (row-level filtering) ───────────────────────────────────────────
    rebac_enabled: bool = field(
        default_factory=lambda: os.environ.get("SAFEM_REBAC_ENABLED", "").lower()
        in ("1", "true")
    )

    def __post_init__(self) -> None:
        self.modules_dir = Path(self.modules_dir)
        if self.static_dir is not None:
            self.static_dir = Path(self.static_dir)
        if self.admin_templates_dir is not None:
            self.admin_templates_dir = Path(self.admin_templates_dir)
        if self.admin_title is None:
            self.admin_title = self.title
