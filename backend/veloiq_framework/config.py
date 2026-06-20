"""VeloIQConfig — configuration dataclass for create_veloiq_app()."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from veloiq_framework.auth.permissions import RoleDef


@dataclass
class VeloIQConfig:
    """All configuration that create_veloiq_app() accepts.

    Every value defaults to its environment-variable equivalent so apps can be
    configured entirely through env vars (12-factor style).

    Minimal usage::

        from veloiq_framework import create_veloiq_app
        app = create_veloiq_app()          # reads DATABASE_URL from env

    Explicit usage::

        from veloiq_framework import create_veloiq_app, VeloIQConfig
        app = create_veloiq_app(VeloIQConfig(
            title="My App",
            database_url="postgresql://user:pass@localhost/mydb",
        ))
    """

    # ── Identity ──────────────────────────────────────────────────────────────
    title: str = "VeloIQ App"

    # ── Database ──────────────────────────────────────────────────────────────
    database_url: str = field(
        default_factory=lambda: os.environ.get("DATABASE_URL", "")
    )
    echo_sql: bool = field(
        default_factory=lambda: os.environ.get("VELOIQ_ECHO_SQL", "").lower() in ("1", "true")
    )
    create_tables_on_startup: bool = True

    # ── Module discovery ──────────────────────────────────────────────────────
    # Absolute path or relative to CWD. Points to the directory that contains
    # individual module sub-folders (each with models.py, api.py, etc.).
    modules_dir: Path = field(
        default_factory=lambda: Path(
            os.environ.get("VELOIQ_MODULES_DIR", "app/modules")
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
    # Kept for backwards-compat with existing VeloIQConfig(auth_enabled=False) calls;
    # create_veloiq_app() raises RuntimeError if this is False.
    auth_enabled: bool = field(default_factory=lambda: True)
    auth_secret: str = field(
        default_factory=lambda: os.environ.get("AUTH_SECRET", "veloiq-dev-secret-change-me")
    )
    auth_algorithm: str = "HS256"
    auth_token_expire_minutes: int = field(
        default_factory=lambda: int(os.environ.get("AUTH_TOKEN_EXPIRE_MINUTES", "480"))
    )

    # ── Initial admin seed credentials ───────────────────────────────────────
    # Used only during first startup to seed the default admin user.
    # Once the user exists in the database, changing these has no effect.
    admin_username: str = field(
        default_factory=lambda: os.environ.get("VELOIQ_ADMIN_USERNAME", "admin")
    )
    admin_password: str = field(
        default_factory=lambda: os.environ.get("VELOIQ_ADMIN_PASSWORD", "admin")
    )

    # ── SQLAdmin ──────────────────────────────────────────────────────────────
    admin_title: str | None = None        # defaults to `title`
    admin_logo_url: str | None = None
    admin_templates_dir: Path | None = None

    # ── Static files ──────────────────────────────────────────────────────────
    static_dir: Path | None = None        # None = no static mount

    # ── Frontend (production) ─────────────────────────────────────────────────
    # Path to the built frontend dist/ directory (e.g. Path("../frontend/dist")).
    # When set and the directory exists, FastAPI serves it at / — no separate
    # Vite dev server needed.  Leave None during development (use npm run dev).
    serve_frontend: Path | None = None

    # ── Role presets ──────────────────────────────────────────────────────────
    # Developer-defined roles seeded to the DB on startup.  Defaults to the
    # three built-in presets (Admin / Manager / Viewer).  Add or replace entries
    # to introduce app-specific roles.
    roles: list = field(
        default_factory=lambda: list(__import__(
            "veloiq_framework.auth.permissions", fromlist=["DEFAULT_ROLES"]
        ).DEFAULT_ROLES)
    )

    # ── Dashboard ─────────────────────────────────────────────────────────────
    dashboard_recent_activity_days: int = field(
        default_factory=lambda: int(os.environ.get("VELOIQ_DASHBOARD_RECENT_DAYS", "30"))
    )

    # ── Internationalization (i18n) ──────────────────────────────────────────
    i18n_locales_dir: Path = field(
        default_factory=lambda: Path(
            os.environ.get(
                "VELOIQ_I18N_LOCALES_DIR",
                str(Path("config") / "internationalization" / "locales"),
            )
        )
    )
    i18n_default_locale: str = field(
        default_factory=lambda: os.environ.get("VELOIQ_I18N_DEFAULT_LOCALE", "en")
    )

    # ── ReBAC (row-level filtering) ───────────────────────────────────────────
    rebac_enabled: bool = field(
        default_factory=lambda: os.environ.get("VELOIQ_REBAC_ENABLED", "").lower()
        in ("1", "true")
    )

    # ── Extensions (explicit per-app opt-in) ──────────────────────────────────
    # Allowlist of extension (entry-point) names this app loads. ``None`` means
    # "resolve from the environment": the ``VELOIQ_EXTENSIONS`` env var, else the
    # ``[extensions].enabled`` list in the project's ``veloiq.toml``, else none.
    # Pass an explicit list (including ``[]``) to override that resolution.
    extensions: list[str] | None = None

    def __post_init__(self) -> None:
        self.modules_dir = Path(self.modules_dir)
        if self.static_dir is not None:
            self.static_dir = Path(self.static_dir)
        if self.serve_frontend is not None:
            self.serve_frontend = Path(self.serve_frontend)
        if self.admin_templates_dir is not None:
            self.admin_templates_dir = Path(self.admin_templates_dir)
        if self.admin_title is None:
            self.admin_title = self.title
