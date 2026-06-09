"""create_veloiq_app() — the VeloIQ application factory.

New framework applications call this once and get back a fully-configured
FastAPI instance::

    # myapp/main.py
    from veloiq_framework import create_veloiq_app
    app = create_veloiq_app()          # DATABASE_URL read from env

    # Or with explicit config:
    from veloiq_framework import create_veloiq_app, VeloIQConfig
    app = create_veloiq_app(VeloIQConfig(
        title="Acme Admin",
        database_url="postgresql://user:pass@localhost/acme",
        modules_dir="app/modules",
    ))

The returned ``app`` is a standard FastAPI instance — you can add your own
routes, middleware, or dependencies on top.
"""
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import SQLModel

# Load .env before anything else so VeloIQConfig field defaults (which read
# os.environ at construction time) see the values from the file.  This must
# run at import time because VeloIQConfig is often constructed as a call
# argument — i.e. evaluated before create_veloiq_app() body executes.
try:
    from dotenv import load_dotenv as _load_dotenv
    _load_dotenv(dotenv_path=".env")
except ImportError:
    pass

from veloiq_framework.config import VeloIQConfig
from veloiq_framework.extensions import discover_extensions
from veloiq_framework.loader import load_factory_events, load_modules


def create_veloiq_app(
    config: VeloIQConfig | None = None,
    **kwargs,
) -> FastAPI:
    """Create and return a fully configured VeloIQ FastAPI application.

    Parameters
    ----------
    config:
        A :class:`VeloIQConfig` instance.  If omitted, one is constructed from
        environment variables and any keyword arguments passed here.
    **kwargs:
        Forwarded to :class:`VeloIQConfig` when *config* is not provided.

    Returns
    -------
    FastAPI
        A configured application ready to be served by uvicorn.

    Raises
    ------
    ValueError
        If no database URL can be determined.
    """
    cfg = config if config is not None else VeloIQConfig(**kwargs)

    if not cfg.database_url:
        raise ValueError(
            "No database URL configured. Set the DATABASE_URL environment variable "
            "or pass database_url=... to create_veloiq_app() / VeloIQConfig()."
        )

    # ── Database engine ───────────────────────────────────────────────────────
    from sqlalchemy import create_engine
    from veloiq_framework.db import _set_engine
    engine_kwargs: dict = {"echo": cfg.echo_sql}
    if cfg.database_url.startswith("sqlite"):
        engine_kwargs["connect_args"] = {"check_same_thread": False}
    engine = create_engine(cfg.database_url, **engine_kwargs)
    _set_engine(engine)

    # ── Discover extensions (explicit per-app opt-in) ─────────────────────────
    # An installed extension loads only if this app enables it — via
    # cfg.extensions, the VELOIQ_EXTENSIONS env var, or veloiq.toml. With none
    # of those configured, no extensions load (strict default).
    from veloiq_framework.extension_registry import read_enabled_extensions
    enabled_extensions = (
        cfg.extensions if cfg.extensions is not None else read_enabled_extensions()
    )
    extensions = discover_extensions(enabled_extensions)

    # ── Lifespan ──────────────────────────────────────────────────────────────
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        load_factory_events(cfg.modules_dir)
        yield

    # ── FastAPI app ───────────────────────────────────────────────────────────
    app = FastAPI(title=cfg.title, lifespan=lifespan)

    # ── Static files ──────────────────────────────────────────────────────────
    if cfg.static_dir and Path(cfg.static_dir).exists():
        app.mount("/static", StaticFiles(directory=str(cfg.static_dir)), name="static")

    # ── Extension static bundles (/ext/{name}/) ───────────────────────────────
    for ext in extensions:
        static_path = ext.resolved_static_dir()
        if static_path:
            app.mount(
                f"/ext/{ext.name}",
                StaticFiles(directory=str(static_path)),
                name=f"ext_{ext.name}",
            )
            print(f"  📦 Static: /ext/{ext.name}/ → {static_path}")

    # ── CORS ──────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["x-total-count", "content-range"],
    )

    # ── Auth middleware ───────────────────────────────────────────────────────
    if cfg.auth_enabled:
        _add_auth_middleware(app, cfg)

    # ── SQLAdmin ──────────────────────────────────────────────────────────────
    from sqladmin import Admin
    admin_kwargs: dict = {"title": cfg.admin_title or cfg.title}
    if cfg.admin_logo_url:
        admin_kwargs["logo_url"] = cfg.admin_logo_url
    if cfg.admin_templates_dir and Path(cfg.admin_templates_dir).exists():
        admin_kwargs["templates_dir"] = str(cfg.admin_templates_dir)
    admin = Admin(app, engine, **admin_kwargs)

    # ── Auth admin views ──────────────────────────────────────────────────────
    if cfg.auth_enabled:
        from veloiq_framework.auth.admin import AUTH_ADMIN_VIEWS
        for view in AUTH_ADMIN_VIEWS:
            admin.add_view(view)

    # ── Module loading ────────────────────────────────────────────────────────
    load_modules(app, admin, cfg, extensions=extensions)

    # ── Table creation & seeding (after all modules + extensions loaded) ──────
    if cfg.create_tables_on_startup:
        # Ensure auth tables are registered before create_all
        from veloiq_framework.auth import models as _auth_models  # noqa: F401
        SQLModel.metadata.create_all(engine)
    if cfg.auth_enabled:
        from veloiq_framework.auth.utils import seed_admin_user_if_needed, seed_roles
        seed_roles(engine, cfg.roles)
        seed_admin_user_if_needed(engine, cfg.admin_username, cfg.admin_password)

    # ── Core endpoints ────────────────────────────────────────────────────────
    _register_core_endpoints(app, engine, cfg)

    return app


# ---------------------------------------------------------------------------
# Auth middleware
# ---------------------------------------------------------------------------

def _add_auth_middleware(app: FastAPI, cfg: VeloIQConfig) -> None:
    """Add JWT Bearer token validation + RBAC middleware."""
    from fastapi import Request
    from starlette.responses import JSONResponse

    _auth_exempt = (
        "/auth/login",
        "/docs",
        "/openapi.json",
        "/redoc",
        "/static/",
        "/admin",
        "/favicon.ico",
        "/health",
    )
    _rbac_exempt = ("/auth/", "/admin", "/static/", "/health", "/docs", "/openapi.json", "/redoc")

    @app.middleware("http")
    async def auth_middleware(request: Request, call_next):
        path = request.url.path
        if any(path.startswith(p) for p in _auth_exempt):
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Authentication required"},
            )
        token = auth_header[7:]
        try:
            from veloiq_framework.auth.utils import decode_access_token
            payload = decode_access_token(token, cfg.auth_secret)
            payload["eid"] = int(payload.get("sub", 0) or 0)
            request.state.user = payload
        except Exception:
            return JSONResponse(
                status_code=401,
                content={"detail": "Invalid or expired token"},
            )
        return await call_next(request)

    @app.middleware("http")
    async def rbac_middleware(request: Request, call_next):
        if request.method.upper() in ("GET", "OPTIONS", "HEAD"):
            return await call_next(request)
        path = request.url.path
        if any(path.startswith(p) for p in _rbac_exempt):
            return await call_next(request)
        user = getattr(request.state, "user", None)
        if user is not None:
            from veloiq_framework.auth.utils import check_rbac
            roles = user.get("roles", [])
            if not check_rbac(roles, request.method):
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Insufficient permissions"},
                )
        return await call_next(request)


# ---------------------------------------------------------------------------
# Minimal core endpoints every VeloIQ app gets
# ---------------------------------------------------------------------------

def _register_core_endpoints(app: FastAPI, engine, cfg: VeloIQConfig) -> None:
    """Register the minimal set of framework-level REST endpoints."""
    from fastapi import Request, HTTPException
    from pydantic import BaseModel

    @app.get("/health")
    def health():
        return {"status": "ok", "framework": "VeloIQ"}

    # Auth endpoints (login, me, register, CRUD for user/role/tenant)
    from veloiq_framework.auth.router import make_auth_router
    app.include_router(make_auth_router(cfg))

    # --- UI configuration stubs ---
    # The frontend reads these endpoints on every page load.  When not configured
    # by the application, return safe empty defaults so the frontend uses its
    # built-in defaults rather than logging repeated 404s.

    @app.get("/config/search")
    async def config_search():
        """Return which entity/attribute types are globally searchable.
        Reads config/search.json if present; empty lists disable backend search."""
        import json as _json
        candidates = [
            _Path("config") / "search.json",
            _Path("..") / "config" / "search.json",
        ]
        for candidate in candidates:
            if candidate.exists():
                try:
                    data = _json.loads(candidate.read_text(encoding="utf-8"))
                    return {
                        "entity_types": data.get("models", []),
                        "attribute_types": data.get("fields", []),
                    }
                except Exception:
                    break
        return {"entity_types": [], "attribute_types": []}

    @app.get("/config/views")
    async def config_views():
        """Return global UI view settings from the ``[views]`` table of the
        project's ``veloiq.toml``. Keys absent from the file are omitted so the
        frontend falls back to its built-in defaults. Empty dict → all defaults."""
        from veloiq_framework.extension_registry import read_views_config
        try:
            return read_views_config()
        except Exception:
            return {}

    # --- View preferences (file-backed persistence) ---
    import json as _json
    from pathlib import Path as _Path
    from pydantic import Field as _Field

    _PREFS_FILE = _Path("views_preferences.json")
    _USER_KEY = "user:all"

    def _load_prefs() -> dict:
        if not _PREFS_FILE.exists():
            return {}
        try:
            return _json.loads(_PREFS_FILE.read_text(encoding="utf-8")) or {}
        except Exception:
            return {}

    def _save_prefs(data: dict) -> None:
        tmp = _PREFS_FILE.with_suffix(".json.tmp")
        tmp.write_text(_json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        tmp.replace(_PREFS_FILE)

    def _default_view_name() -> str:
        return "default view"

    def _normalize_bucket(bucket: dict) -> dict:
        if "views" in bucket or "current_view_name" in bucket or "current_view_names" in bucket:
            bucket.setdefault("views", {})
            names = bucket.get("current_view_names")
            if isinstance(names, list) and names:
                bucket["current_view_names"] = [str(n).strip() for n in names if str(n).strip()]
            else:
                legacy = bucket.get("current_view_name") or _default_view_name()
                bucket["current_view_names"] = [str(legacy).strip() or _default_view_name()]
            if not bucket.get("current_view_name"):
                bucket["current_view_name"] = bucket["current_view_names"][0]
            return bucket
        existing = {k: v for k, v in bucket.items() if isinstance(v, dict)}
        default = bucket.get("current_view_name", _default_view_name())
        return {
            "current_view_name": default,
            "current_view_names": [default],
            "views": {default: {**existing}},
        }

    class _PrefsPayload(BaseModel):
        resource: str
        preferences: dict
        preference_type: str = _Field("Analyze", alias="preferenceType")
        custom_view_name: str | None = None
        model_config = {"populate_by_name": True}

    class _ManageViewPayload(BaseModel):
        resource: str
        action: str
        view_name: str
        view_names: list[str] | None = None
        new_name: str | None = None

    @app.get("/views/preferences")
    async def get_view_preferences(resource: str, preference_type: str = "Analyze", custom_view_name: str | None = None):
        data = _load_prefs()
        bucket = data.get(_USER_KEY, {}).get(resource, {})
        if not isinstance(bucket, dict):
            return {"preferences": {}}
        nb = _normalize_bucket(bucket)
        if preference_type.lower() in {"__all__", "all"}:
            return {"preferences": nb}
        names = nb.get("current_view_names") or [nb.get("current_view_name") or _default_view_name()]
        current = custom_view_name or names[0] or _default_view_name()
        views = nb.get("views", {})
        if isinstance(views, dict) and current in views:
            entry = views[current]
            if preference_type in entry:
                return {"preferences": entry[preference_type]}
        if preference_type in bucket:
            return {"preferences": bucket[preference_type]}
        return {"preferences": {}}

    @app.post("/views/preferences")
    async def save_view_preferences(payload: _PrefsPayload):
        data = _load_prefs()
        data.setdefault(_USER_KEY, {})
        bucket = data[_USER_KEY].setdefault(payload.resource, {})
        nb = _normalize_bucket(bucket)
        data[_USER_KEY][payload.resource] = nb
        view_name = (
            payload.custom_view_name
            or (payload.preferences or {}).get("custom_view_name")
            or nb.get("current_view_name")
            or _default_view_name()
        ).strip() or _default_view_name()
        views = nb.setdefault("views", {})
        entry = views.setdefault(view_name, {})
        prefs = dict(payload.preferences or {})
        prefs["custom_view_name"] = view_name
        entry[payload.preference_type] = prefs
        if not nb.get("current_view_names"):
            nb["current_view_names"] = [view_name]
        if not nb.get("current_view_name"):
            nb["current_view_name"] = view_name
        _save_prefs(data)
        return {"status": "ok"}

    @app.post("/views/preferences/view")
    async def manage_view(payload: _ManageViewPayload):
        data = _load_prefs()
        data.setdefault(_USER_KEY, {})
        bucket = data[_USER_KEY].setdefault(payload.resource, {})
        nb = _normalize_bucket(bucket)
        data[_USER_KEY][payload.resource] = nb
        views = nb.setdefault("views", {})
        action = payload.action.lower()
        view_name = payload.view_name.strip()
        if action == "set_current":
            nb["current_view_name"] = view_name
            nb["current_view_names"] = [n.strip() for n in (payload.view_names or [view_name]) if n.strip()]
        elif action == "rename" and payload.new_name:
            new = payload.new_name.strip()
            if view_name in views:
                views[new] = views.pop(view_name)
            if nb.get("current_view_name") == view_name:
                nb["current_view_name"] = new
            nb["current_view_names"] = [new if n == view_name else n for n in nb.get("current_view_names", [])]
        elif action == "delete":
            views.pop(view_name, None)
            remaining = [n for n in nb.get("current_view_names", []) if n != view_name]
            nb["current_view_names"] = remaining or [_default_view_name()]
            nb["current_view_name"] = nb["current_view_names"][0]
        _save_prefs(data)
        return {"status": "ok"}

    _COLOR_MODE_KEY = "__color_mode__"

    @app.get("/views/preferences/color-mode")
    async def get_color_mode():
        data = _load_prefs()
        mode = data.get(_COLOR_MODE_KEY, {}).get("colorMode")
        if mode in ("light", "dark"):
            return {"colorMode": mode}
        return {}

    @app.post("/views/preferences/color-mode")
    async def save_color_mode(request: Request):
        body = await request.json()
        mode = body.get("colorMode")
        if mode not in ("light", "dark"):
            return {"status": "ignored"}
        data = _load_prefs()
        data[_COLOR_MODE_KEY] = {"colorMode": mode}
        _save_prefs(data)
        return {"status": "ok"}

    @app.get("/views/configurations/{model_name}")
    async def view_configurations(model_name: str, view_type: str = ""):
        """Return view layout configuration rows for a model.

        Reads ``config/page_configs.json`` (written by a page-configuration tool,
        e.g. the IQVigilant extension) and converts the stored sections/tabs/entries
        into the ViewConfigRow shape the frontend consumes. Returns both the show
        and edit layouts (the frontend filters by ``form_type``). Empty list →
        the frontend falls back to its schema-driven default layout.
        """
        candidates = [
            _Path("config") / "page_configs.json",
            _Path("..") / "config" / "page_configs.json",
        ]
        data = None
        for candidate in candidates:
            if candidate.exists():
                try:
                    data = _json.loads(candidate.read_text(encoding="utf-8"))
                    break
                except Exception:
                    return []
        if not data:
            return []

        configs = data.get("configs", {})
        rows: list[dict] = []

        def _emit(sections: list, form: str, tab_name):
            for s in sections or []:
                for e in s.get("entries", []) or []:
                    kind = e.get("kind", "field")
                    art = "attribute" if kind == "field" else kind
                    vt_val = e.get("view_type")
                    key = e.get("key", "")
                    rows.append({
                        "view_type": "PrimaryView",
                        "subject_name": model_name,
                        "relation_name": key if kind == "relation" else "",
                        "object_name": key,
                        "form_type": form,
                        "section": s.get("name", ""),
                        "section_id": s.get("id"),
                        "section_grid_row": s.get("grid_row", 1),
                        "section_grid_col": s.get("grid_col", 1),
                        "tab_name": tab_name,
                        "vid": vt_val,
                        "show_vid": vt_val if form == "show" else None,
                        "edit_vid": vt_val if form == "edit" else None,
                        "limit": e.get("limit"),
                        "row": e.get("row", 1),
                        "column": e.get("column", 1),
                        "show_label": e.get("show_label", True),
                        "attribute_or_relation_type": art,
                        "nl_sentence_eid": int(key) if kind == "nlsentence" and str(key).isdigit() else None,
                        "nl_sentence_title": e.get("label") if kind == "nlsentence" else None,
                        "name": key,
                    })

        for vt, form in (("show", "show"), ("edit", "edit")):
            cfg = configs.get(f"{model_name}:{vt}")
            if not cfg:
                continue
            _emit(cfg.get("sections", []), form, None)
            for tab in cfg.get("tabs", []) or []:
                _emit(tab.get("sections", []), form, tab.get("name"))

        return rows

    # --- Dashboard configuration (config/views_configuration.json) ---
    _VIEWS_CONFIG_FILE = _Path("config") / "views_configuration.json"
    _DASHBOARD_KEY = "__dashboard__"

    def _load_views_config() -> dict:
        if not _VIEWS_CONFIG_FILE.exists():
            return {"schema_version": "1.0", "user:all": {}}
        try:
            return _json.loads(_VIEWS_CONFIG_FILE.read_text(encoding="utf-8")) or {}
        except Exception:
            return {"schema_version": "1.0", "user:all": {}}

    def _save_views_config(data: dict) -> None:
        _VIEWS_CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
        tmp = _VIEWS_CONFIG_FILE.with_suffix(".json.tmp")
        tmp.write_text(_json.dumps(data, indent=2) + "\n", encoding="utf-8")
        tmp.replace(_VIEWS_CONFIG_FILE)

    @app.get("/dashboard/config")
    async def get_dashboard_config():
        """Return the __dashboard__ section.

        Checks views_preferences.json first (unified format), then falls back
        to config/views_configuration.json (legacy separate file).
        """
        # Primary: views_preferences.json
        prefs = _load_prefs()
        dashboard = prefs.get(_USER_KEY, {}).get(_DASHBOARD_KEY)
        if dashboard is not None:
            return {"enabled": True, "dashboard": dashboard}
        # Fallback: config/views_configuration.json
        legacy = _load_views_config()
        dashboard = legacy.get(_USER_KEY, {}).get(_DASHBOARD_KEY)
        if dashboard is None:
            return {"enabled": False}
        return {"enabled": True, "dashboard": dashboard}

    @app.put("/dashboard/config")
    async def save_dashboard_config(request: Request):
        """Persist the __dashboard__ section to views_preferences.json."""
        from fastapi import HTTPException as _HTTPException
        body = await request.json()
        dashboard = body.get("dashboard")
        if not isinstance(dashboard, dict):
            raise _HTTPException(status_code=400, detail="Invalid dashboard config")
        prefs = _load_prefs()
        prefs.setdefault(_USER_KEY, {})[_DASHBOARD_KEY] = dashboard
        _save_prefs(prefs)
        return {"status": "ok"}

    # --- Pinned records ---

    def _get_user_id(request: Request) -> int:
        """Return the authenticated user's id, or 0 when auth is disabled."""
        user = getattr(request.state, "user", None)
        if user and isinstance(user, dict):
            return int(user.get("id", 0) or user.get("sub", 0) or 0)
        return 0

    def _resolve_record_label(table, row: dict) -> str:
        for key in ("name", "title", "label", "email", "username", "description", "subject"):
            if key in row and row[key]:
                return str(row[key])
        for k, v in row.items():
            if k in ("id", "eid", "created_at", "updated_at") or k.endswith("_id"):
                continue
            if isinstance(v, str) and v:
                return v
        return str(row.get("id", ""))

    @app.get("/dashboard/pinned-records/check")
    async def check_pinned_record(request: Request, resource: str, record_id: str):
        from sqlmodel import Session as _SMSession, select as _sm_select
        from veloiq_framework.auth.models import VeloIQPinnedRecord as _Pin
        user_id = _get_user_id(request)
        with _SMSession(engine) as session:
            pin = session.exec(
                _sm_select(_Pin).where(
                    _Pin.user_id == user_id,
                    _Pin.resource == resource,
                    _Pin.record_id == record_id,
                )
            ).first()
        return {"pinned": pin is not None, "pin_id": pin.id if pin else None}

    @app.post("/dashboard/pinned-records")
    async def pin_record(request: Request):
        from sqlmodel import Session as _SMSession, select as _sm_select
        from veloiq_framework.auth.models import VeloIQPinnedRecord as _Pin
        body = await request.json()
        resource = body.get("resource", "")
        record_id = str(body.get("record_id", ""))
        if not resource or not record_id:
            from fastapi import HTTPException as _HTTPEx
            raise _HTTPEx(status_code=400, detail="resource and record_id are required")
        user_id = _get_user_id(request)
        with _SMSession(engine) as session:
            existing = session.exec(
                _sm_select(_Pin).where(
                    _Pin.user_id == user_id,
                    _Pin.resource == resource,
                    _Pin.record_id == record_id,
                )
            ).first()
            if existing:
                return {"pinned": True, "pin_id": existing.id}
            pin = _Pin(user_id=user_id, resource=resource, record_id=record_id)
            session.add(pin)
            session.commit()
            session.refresh(pin)
        return {"pinned": True, "pin_id": pin.id}

    @app.delete("/dashboard/pinned-records/{resource}/{record_id}")
    async def unpin_record(request: Request, resource: str, record_id: str):
        from sqlmodel import Session as _SMSession, select as _sm_select
        from veloiq_framework.auth.models import VeloIQPinnedRecord as _Pin
        user_id = _get_user_id(request)
        with _SMSession(engine) as session:
            pin = session.exec(
                _sm_select(_Pin).where(
                    _Pin.user_id == user_id,
                    _Pin.resource == resource,
                    _Pin.record_id == record_id,
                )
            ).first()
            if pin:
                session.delete(pin)
                session.commit()
        return {"pinned": False}

    @app.get("/dashboard/pinned-records")
    async def get_pinned_records(request: Request):
        from datetime import datetime as _dt
        from sqlmodel import Session as _SMSession, select as _sm_select
        from sqlalchemy import select as _sa_select, text as _sa_text
        from veloiq_framework.auth.models import VeloIQPinnedRecord as _Pin
        user_id = _get_user_id(request)

        with _SMSession(engine) as session:
            pins = session.exec(
                _sm_select(_Pin).where(_Pin.user_id == user_id).order_by(_Pin.created_at.desc())
            ).all()

        if not pins:
            return {"groups": []}

        # Group pins by resource and resolve labels from the DB.
        from collections import defaultdict as _dd
        by_resource: dict = _dd(list)
        for pin in pins:
            by_resource[pin.resource].append(pin)

        groups = []
        with _SMSession(engine) as session:
            for resource, resource_pins in by_resource.items():
                table = SQLModel.metadata.tables.get(resource)
                if table is None:
                    continue
                record_ids = [p.record_id for p in resource_pins]
                try:
                    rows = session.execute(
                        _sa_select(table).where(
                            table.c.id.in_([_try_int(rid) for rid in record_ids])
                        )
                    ).mappings().all()
                except Exception:
                    continue

                row_map = {str(r["id"]): dict(r) for r in rows}
                records = []
                for pin in resource_pins:
                    row = row_map.get(pin.record_id)
                    if row is None:
                        continue  # deleted record — silently skip
                    rec = {
                        k: (v.isoformat() if isinstance(v, _dt) else str(v) if v is not None else "")
                        for k, v in row.items()
                    }
                    rec["_label"] = _resolve_record_label(table, row)
                    rec["_pin_id"] = pin.id
                    records.append(rec)

                if records:
                    display_name = resource.replace("_", " ").title()
                    groups.append({"model_name": display_name, "resource": resource, "records": records})

        return {"groups": groups}

    def _try_int(val: str):
        try:
            return int(val)
        except (ValueError, TypeError):
            return val

    @app.get("/dashboard/recent-activity")
    async def get_dashboard_recent_activity(days: int | None = None):
        """Return records modified within the last N days, grouped by model."""
        from datetime import datetime, timedelta, timezone
        from sqlalchemy.orm import Session as _SASession
        from sqlalchemy import select as _sa_select, or_ as _sa_or, func as _sa_func, inspect as _sa_inspect

        _SKIP_PREFIXES = ("veloiq_", "alembic_")

        effective_days = days if days is not None else cfg.dashboard_recent_activity_days
        cutoff = datetime.now(tz=timezone.utc) - timedelta(days=effective_days)

        def _to_str(v: object) -> str:
            if isinstance(v, datetime):
                return v.isoformat()
            return str(v) if v is not None else ""

        def _display_label(rec: dict) -> str:
            """Pick the best human-readable field from a raw record dict."""
            for key in ("name", "title", "label", "email", "username", "description", "subject"):
                if key in rec and rec[key]:
                    return str(rec[key])
            # Fallback: first non-id non-timestamp non-FK string value
            for k, v in rec.items():
                if k in ("id", "eid", "created_at", "updated_at") or k.endswith("_id"):
                    continue
                if isinstance(v, str) and v:
                    return v
            return str(rec.get("id", ""))

        def _table_display_name(table_name: str) -> str:
            return table_name.replace("_", " ").title()

        groups = []

        with _SASession(engine) as session:
            for table_name, table in SQLModel.metadata.tables.items():
                if any(table_name.startswith(p) for p in _SKIP_PREFIXES):
                    continue
                if "created_at" not in table.c or "updated_at" not in table.c:
                    continue

                try:
                    stmt = (
                        _sa_select(table)
                        .where(
                            _sa_or(
                                table.c.updated_at >= cutoff,
                                table.c.created_at >= cutoff,
                            )
                        )
                        .order_by(
                            _sa_func.coalesce(table.c.updated_at, table.c.created_at).desc()
                        )
                        .limit(20)
                    )
                    rows = session.execute(stmt).mappings().all()
                except Exception:
                    continue

                if not rows:
                    continue

                records = []
                for row in rows:
                    rec = {k: _to_str(v) for k, v in dict(row).items()}
                    rec["_label"] = _display_label({k: v for k, v in dict(row).items()})
                    records.append(rec)

                groups.append({
                    "model_name": _table_display_name(table_name),
                    "resource": table_name,
                    "records": records,
                })

        # Sort groups by most-recent record first
        def _group_sort_key(g: dict) -> str:
            recs = g["records"]
            return recs[0].get("updated_at") or recs[0].get("created_at") or "" if recs else ""

        groups.sort(key=_group_sort_key, reverse=True)

        return {"groups": groups, "days": effective_days}

    @app.post("/views/model_graph")
    async def model_graph(request: Request):
        """Return an SVG knowledge-graph diagram for a model and its relations."""
        import math as _math
        body = await request.json()
        model_name = body.get("model_name", "")
        model_label = body.get("model_label", model_name)
        relations = body.get("relations", [])

        # Layout constants
        cx, cy = 400, 250          # centre node position
        r_node = 38                # centre node radius
        r_rel = 30                 # satellite node radius
        orbit = 180                # orbit radius for satellites

        def _color(is_reverse: bool) -> str:
            return "#64748b" if is_reverse else "#1677ff"

        def _text_lines(label: str, max_chars: int = 12) -> list:
            """Split label into up to 2 lines."""
            words = label.replace("_", " ").split()
            lines: list = []
            current = ""
            for w in words:
                if len(current) + len(w) + (1 if current else 0) <= max_chars:
                    current = (current + " " + w).strip()
                else:
                    if current:
                        lines.append(current)
                    current = w
            if current:
                lines.append(current)
            return lines[:2]

        nodes_svg = []
        edges_svg = []

        # Centre node
        centre_lines = _text_lines(model_label)
        centre_texts = "".join(
            f"<tspan x='{cx}' dy='{0 if i == 0 else 14}'>{line}</tspan>"
            for i, line in enumerate(centre_lines)
        )
        centre_y0 = cy - (len(centre_lines) - 1) * 7
        nodes_svg.append(
            f"<circle cx='{cx}' cy='{cy}' r='{r_node}' fill='#1677ff' stroke='#0958d9' stroke-width='2'/>"
            f"<text x='{cx}' y='{centre_y0}' text-anchor='middle' dominant-baseline='middle' "
            f"fill='white' font-size='11' font-weight='bold' font-family='sans-serif'>"
            f"{centre_texts}</text>"
        )

        n = len(relations)
        for i, rel in enumerate(relations):
            angle = (2 * _math.pi * i / n) - _math.pi / 2 if n > 0 else 0
            rx = cx + int(orbit * _math.cos(angle))
            ry = cy + int(orbit * _math.sin(angle))
            color = _color(rel.get("is_reverse", False))
            other_label = rel.get("other_label") or rel.get("other_resource", "?")
            rel_label = rel.get("relation_label") or rel.get("relation_name", "?")
            nav_url = rel.get("nav_url", "")

            # Edge line
            # Shorten line so it starts/ends at circle boundaries
            dx = rx - cx; dy = ry - cy
            dist = _math.hypot(dx, dy) or 1
            x1 = cx + dx / dist * r_node
            y1 = cy + dy / dist * r_node
            x2 = rx - dx / dist * r_rel
            y2 = ry - dy / dist * r_rel
            mid_x = (x1 + x2) / 2
            mid_y = (y1 + y2) / 2
            edges_svg.append(
                f"<line x1='{x1:.1f}' y1='{y1:.1f}' x2='{x2:.1f}' y2='{y2:.1f}' "
                f"stroke='{color}' stroke-width='1.5' stroke-dasharray='{'4 2' if rel.get('is_reverse') else 'none'}'/>"
                f"<text x='{mid_x:.1f}' y='{mid_y:.1f}' text-anchor='middle' "
                f"fill='{color}' font-size='9' font-family='sans-serif'>{rel_label}</text>"
            )

            # Satellite node (clickable if nav_url exists)
            sat_lines = _text_lines(other_label)
            sat_texts = "".join(
                f"<tspan x='{rx}' dy='{0 if j == 0 else 13}'>{line}</tspan>"
                for j, line in enumerate(sat_lines)
            )
            sat_y0 = ry - (len(sat_lines) - 1) * 6
            node_html = (
                f"<circle cx='{rx}' cy='{ry}' r='{r_rel}' fill='{color}' opacity='0.85' "
                f"stroke='{color}' stroke-width='1.5' style='cursor:{'pointer' if nav_url else 'default'}'/>"
                f"<text x='{rx}' y='{sat_y0}' text-anchor='middle' dominant-baseline='middle' "
                f"fill='white' font-size='10' font-family='sans-serif'>{sat_texts}</text>"
            )
            if nav_url:
                node_html = (
                    f"<a href='javascript:void(0)' "
                    f"onclick=\"window.parent.postMessage({{action:'metadata_graph_navigate',url:'{nav_url}'}},\"*\")\">"
                    f"{node_html}</a>"
                )
            nodes_svg.append(node_html)

        w, h = 800, 500
        svg = (
            f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {w} {h}' "
            f"style='width:100%;height:auto;min-height:320px;font-family:sans-serif'>"
            f"{''.join(edges_svg)}{''.join(nodes_svg)}"
            f"</svg>"
        )
        if not relations:
            svg = (
                f"<div style='padding:24px;color:#888;text-align:center'>"
                f"No relations defined for <strong>{model_label}</strong>.</div>"
            )
        return {"html": svg}
