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

    # ── Auth-disable guard ────────────────────────────────────────────────────
    if not cfg.auth_enabled or os.environ.get("VELOIQ_AUTH_DISABLED", "").lower() in ("1", "true"):
        raise RuntimeError(
            "VeloIQ: authentication cannot be disabled.\n"
            "Remove auth_enabled=False from VeloIQConfig and VELOIQ_AUTH_DISABLED from your .env,\n"
            "then run:  veloiq migrate"
        )

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
        # Configure i18n from app settings.
        from veloiq_framework.utils.i18n_utils import configure_i18n

        configure_i18n(
            locales_dir=str(cfg.i18n_locales_dir.resolve()),
            default_locale=cfg.i18n_default_locale,
        )
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
    _add_auth_middleware(app, cfg)

    # ── SQLAdmin ──────────────────────────────────────────────────────────────
    from sqladmin import Admin

    # Monkey-patch get_object_identifier to use ORM attribute names (Column.key)
    # instead of physical DB column names (Column.name).
    # SQLModel sa_column aliasing means physical column names like 'jm_eid'
    # differ from model attributes like 'eid'; without this patch SQLAdmin's
    # _build_url_for and list views crash with AttributeError.
    # We must patch every module that imports get_object_identifier by name,
    # because `from X import Y` creates a local binding that our helpers.py
    # patch can't reach.
    def _patched_get_object_identifier(obj):
        from sqlalchemy import inspect as _sqa_inspect
        mapper = _sqa_inspect(type(obj))
        pk_cols_physical = {c.name for c in mapper.primary_key}
        values = []
        for prop in mapper.column_attrs:
            if prop.columns[0].name in pk_cols_physical:
                values.append(str(getattr(obj, prop.key)))
        if len(values) == 1:
            return values[0]
        return ";".join(values) if values else "?"
    import sqladmin.helpers as _sqladmin_helpers
    import sqladmin.models as _sqladmin_models
    import sqladmin.application as _sqladmin_application
    import sqladmin.forms as _sqladmin_forms
    import sqladmin.fields as _sqladmin_fields
    import sqladmin.ajax as _sqladmin_ajax
    _sqladmin_helpers.get_object_identifier = _patched_get_object_identifier
    _sqladmin_models.get_object_identifier = _patched_get_object_identifier
    _sqladmin_application.get_object_identifier = _patched_get_object_identifier
    _sqladmin_forms.get_object_identifier = _patched_get_object_identifier
    _sqladmin_fields.get_object_identifier = _patched_get_object_identifier
    _sqladmin_ajax.get_object_identifier = _patched_get_object_identifier

    # Also override in template globals (Jinja2 templates use their own copy)
    _admin_get_object_identifier_patch = _patched_get_object_identifier
    from starlette.middleware.sessions import SessionMiddleware
    from veloiq_framework.auth.sqladmin_auth import VeloIQAdminAuth
    app.add_middleware(SessionMiddleware, secret_key=cfg.auth_secret)
    admin_kwargs: dict = {
        "title": cfg.admin_title or cfg.title,
        "authentication_backend": VeloIQAdminAuth(cfg),
    }
    if cfg.admin_logo_url:
        admin_kwargs["logo_url"] = cfg.admin_logo_url
    if cfg.admin_templates_dir and Path(cfg.admin_templates_dir).exists():
        admin_kwargs["templates_dir"] = str(cfg.admin_templates_dir)
    admin = Admin(app, engine, **admin_kwargs)
    # Fix template get_object_identifier to use Python attr names
    admin.templates.env.globals["get_object_identifier"] = _admin_get_object_identifier_patch

    # ── Auth admin views ──────────────────────────────────────────────────────
    from veloiq_framework.auth.admin import AUTH_ADMIN_VIEWS
    for view in AUTH_ADMIN_VIEWS:
        admin.add_view(view)

    # ── Module loading ────────────────────────────────────────────────────────
    load_modules(app, admin, cfg, extensions=extensions)

    # ── Table creation & seeding (after all modules + extensions loaded) ──────
    if cfg.create_tables_on_startup:
        # Ensure auth tables are registered before create_all
        from veloiq_framework.auth import models as _auth_models  # noqa: F401
        _create_tables_safe(engine)
        _sync_schema(engine)
    from veloiq_framework.auth.utils import seed_admin_user_if_needed, seed_roles
    seed_roles(engine, cfg.roles)
    seed_admin_user_if_needed(engine, cfg.admin_username, cfg.admin_password)

    # ── Core endpoints ────────────────────────────────────────────────────────
    _register_core_endpoints(app, engine, cfg, extensions=extensions)

    # ── VeloIQ Studio ─────────────────────────────────────────────────────────
    _mount_studio(app, cfg)

    # ── Host app frontend (production) — must be last so API routes win ───────
    _mount_frontend(app, cfg)

    return app


# ---------------------------------------------------------------------------
# Table creation — tolerates pre-existing tables with incompatible schemas
# ---------------------------------------------------------------------------

def _create_tables_safe(engine) -> None:
    """Create all SQLModel tables, skipping tables that already exist.

    Unlike SQLModel.metadata.create_all(), this creates tables one at a time
    so that a FK constraint mismatch on a generated link table (e.g. when the
    app points to an existing database whose PKs don't follow the VeloIQ `id`
    convention) logs a warning instead of crashing the whole application.
    """
    import logging
    from sqlalchemy.exc import NoReferencedTableError
    logger = logging.getLogger("veloiq")

    try:
        tables = list(SQLModel.metadata.sorted_tables)
    except NoReferencedTableError as exc:
        logger.warning(
            "Could not sort tables by FK dependency (%s) — "
            "falling back to unsorted order. Check for dangling foreign_key references in your models.",
            exc,
        )
        tables = list(SQLModel.metadata.tables.values())

    for table in tables:
        try:
            table.create(engine, checkfirst=True)
        except Exception as exc:
            logger.warning(
                "Could not create table '%s': %s — "
                "this table may already exist with a different schema. "
                "Run `veloiq db migrate && veloiq db upgrade` to reconcile.",
                table.name, exc,
            )


# Schema synchronisation — detect & auto-fix table/model drift in dev mode
# ---------------------------------------------------------------------------

def _sync_schema(engine) -> None:
    """Detect tables whose DB columns have fallen behind their model definitions.

    After ``SQLModel.metadata.create_all()`` new tables are created perfectly,
    but existing tables are never altered — even when the developer adds a
    field to the Python model.  In dev mode (``VELOIQ_DEV=1``) this function
    auto-adds the missing columns via ``ALTER TABLE ... ADD COLUMN`` so the
    app doesn't crash with *no such column* at request time.
    """
    import os
    from sqlalchemy import inspect as sa_inspect, text

    inspector = sa_inspect(engine)

    # We only iterate over SQLModel tables (those with ``table=True``).
    # ``SQLModel.metadata.tables`` includes both framework and user tables.
    for table_name, table in SQLModel.metadata.tables.items():
        try:
            db_cols = {c["name"] for c in inspector.get_columns(table_name)}
        except Exception:
            # Table doesn't exist yet — create_all already handled it.
            continue

        model_cols = {c.name for c in table.columns}
        missing = model_cols - db_cols

        if not missing:
            continue

        # Resolve each missing column to its SQLAlchemy Column definition so
        # we can emit a correct DDL statement.
        for col_name in sorted(missing):
            sa_col = table.columns[col_name]

            # Build a minimal ADD COLUMN — type only, no constraints.
            # The ORM/handle defaults and NOT NULL at the application level.
            # Foreign-key constraints are omitted intentionally: they are
            # ORM-level metadata, and including them would complicate the
            # DDL across dialects.
            col_type = sa_col.type.compile(engine.dialect)
            ddl = f"ADD COLUMN {col_name} {col_type}"

            is_dev = os.environ.get("VELOIQ_DEV", "").lower() in ("1", "true", "yes")

            if is_dev:
                try:
                    with engine.connect() as conn:
                        conn.execute(text(f"ALTER TABLE {table_name} {ddl}"))
                        conn.commit()
                    print(f"  🔧 Auto-migrated: {table_name}.{col_name} ({col_type})")
                except Exception as exc:
                    print(f"  ⚠️  Could not auto-add column {table_name}.{col_name}: {exc}")
            else:
                print(
                    f"  ⚠️  Schema drift: {table_name}.{col_name} is in the model "
                    f"but missing from the database.\n"
                    f"      Run `veloiq db migrate -m 'add {col_name}' && veloiq db upgrade` "
                    f"to apply, or set VELOIQ_DEV=1 for automatic migration."
                )



# ---------------------------------------------------------------------------
# Auth middleware
# ---------------------------------------------------------------------------

def _add_auth_middleware(app: FastAPI, cfg: VeloIQConfig) -> None:
    """Add JWT Bearer token validation + RBAC middleware.

    Registration order matters: Starlette executes @app.middleware decorators in
    reverse registration order (last registered = outermost = runs first).
    RBAC is registered FIRST so it runs SECOND (after auth has set request.state.user).
    Auth is registered SECOND so it runs FIRST (validates JWT and sets user).
    """
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
        "/veloiq-studio",
        "/i18n/",
    )
    _rbac_exempt = ("/auth/", "/admin", "/static/", "/health", "/docs", "/openapi.json", "/redoc", "/veloiq-studio", "/api/debug/ddl-trace")

    # In production SPA mode only these prefixes require a JWT; everything else
    # (React Router paths, static assets) is served as HTML/JS and the React app
    # handles its own auth redirects.  All data APIs are under /api/ now.
    _spa_protected = ("/api/", "/auth/me", "/auth/change-password")

    # ── RBAC middleware — registered FIRST, runs SECOND (inner) ─────────────
    # auth_middleware (registered second, outermost) runs first and sets
    # request.state.user before this middleware reads it.
    @app.middleware("http")
    async def rbac_middleware(request: Request, call_next):
        method = request.method.upper()
        path = request.url.path

        # GET/OPTIONS/HEAD: no role check at middleware level.
        # GET auth is enforced by auth_middleware (outermost); model-level
        # permission exceptions are enforced at route level via _check_model_permissions.
        if method in ("GET", "OPTIONS", "HEAD"):
            return await call_next(request)
        if any(path.startswith(p) for p in _rbac_exempt):
            return await call_next(request)

        # Write methods on non-exempt paths: auth_middleware (outermost) must
        # have set user already. Explicit 401 here is defense-in-depth.
        user = getattr(request.state, "user", None)
        if user is None:
            return JSONResponse(
                status_code=401,
                content={"detail": "Authentication required"},
            )

        from veloiq_framework.auth.utils import check_rbac
        roles = user.get("roles", [])
        if not check_rbac(roles, method):
            return JSONResponse(
                status_code=403,
                content={"detail": "Insufficient permissions"},
            )
        return await call_next(request)

    # ── Auth middleware — registered SECOND, runs FIRST (outer) ─────────────
    @app.middleware("http")
    async def auth_middleware(request: Request, call_next):
        path = request.url.path
        if cfg.serve_frontend is not None:
            if not any(path.startswith(p) for p in _spa_protected):
                return await call_next(request)
        elif any(path.startswith(p) for p in _auth_exempt):
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


# ---------------------------------------------------------------------------
# Minimal core endpoints every VeloIQ app gets
# ---------------------------------------------------------------------------

def _register_core_endpoints(app: FastAPI, engine, cfg: VeloIQConfig, *, extensions: list | None = None) -> None:
    """Register the minimal set of framework-level REST endpoints."""
    from fastapi import APIRouter as _APIRouter, Request, HTTPException
    from pydantic import BaseModel

    # Public endpoints served at root — not behind /api prefix.
    @app.get("/health")
    def health():
        return {"status": "ok", "framework": "VeloIQ"}

    @app.get("/i18n/{locale}.json")
    def i18n_catalog(locale: str):
        """Serve the translation catalogue for *locale* as a JSON dict."""
        from fastapi.responses import JSONResponse
        from veloiq_framework.utils.i18n_utils import (
            _resolve_po_file,
            _load_po_catalog_cached,
        )
        po_file = _resolve_po_file(locale)
        if po_file is None:
            return JSONResponse({})
        mtime = int(po_file.stat().st_mtime_ns)
        catalog = _load_po_catalog_cached(str(po_file), mtime)
        return JSONResponse(catalog)

    # Auth endpoints (login, me, register, CRUD for user/role/tenant). The
    # "/auth/*" router stays unprefixed (the UI's authProvider calls it
    # directly); the User/Role/Tenant CRUD router is mounted under "/api"
    # since the frontend's generic dataProvider talks to every resource
    # there.
    from veloiq_framework.auth.router import make_auth_router
    _auth_router, _auth_crud_router = make_auth_router(cfg)
    app.include_router(_auth_router)
    app.include_router(_auth_crud_router, prefix="/api")

    # All data API endpoints live under /api so the frontend's API_URL="/api"
    # works in production without any Vite proxy path-rewriting.
    core_api = _APIRouter()

    # --- UI configuration stubs ---
    # The frontend reads these endpoints on every page load.  When not configured
    # by the application, return safe empty defaults so the frontend uses its
    # built-in defaults rather than logging repeated 404s.

    @core_api.get("/config/search")
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

    @core_api.get("/config/views")
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

    @core_api.get("/views/preferences")
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

    @core_api.post("/views/preferences")
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

    @core_api.post("/views/preferences/view")
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

    @core_api.get("/views/preferences/color-mode")
    async def get_color_mode():
        data = _load_prefs()
        mode = data.get(_COLOR_MODE_KEY, {}).get("colorMode")
        if mode in ("light", "dark"):
            return {"colorMode": mode}
        return {}

    @core_api.post("/views/preferences/color-mode")
    async def save_color_mode(request: Request):
        body = await request.json()
        mode = body.get("colorMode")
        if mode not in ("light", "dark"):
            return {"status": "ignored"}
        data = _load_prefs()
        data[_COLOR_MODE_KEY] = {"colorMode": mode}
        _save_prefs(data)
        return {"status": "ok"}

    @core_api.get("/views/configurations/{model_name}")
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
                        "section_css_class": s.get("css_class"),
                        "section_html_snippet": s.get("html_snippet"),
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

        for vt, form in (("show", "show"), ("edit", "edit"), ("list", "list"), ("create", "create")):
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

    @core_api.get("/dashboard/config")
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

    @core_api.put("/dashboard/config")
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

    @core_api.get("/dashboard/pinned-records/check")
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

    @core_api.post("/dashboard/pinned-records")
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

    @core_api.delete("/dashboard/pinned-records/{resource}/{record_id}")
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

    @core_api.get("/dashboard/pinned-records")
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

    @core_api.get("/dashboard/recent-activity")
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

    @core_api.post("/views/model_graph")
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

    @core_api.post("/_meta/bulk-read")
    async def meta_bulk_read(request: Request):
        """Fetch multiple records by ID from any registered resource in one round-trip.

        Body: { "resource": "<table_name>", "ids": [1, 2, 3, ...] }
        Response: { "items": [ ... ] }
        """
        from sqlalchemy.orm import Session as _SASession
        from sqlalchemy import select as _sa_select
        from sqlalchemy.inspection import inspect as _sa_inspect
        from datetime import datetime as _dt, date as _date

        from veloiq_framework.crud import _to_dict, _sanitize
        from veloiq_framework.models import get_pk_field_name
        from veloiq_framework.query_def import _model_by_tablename

        body = await request.json()
        resource: str = body.get("resource", "")
        ids: list = body.get("ids", [])

        if not resource or not ids:
            return {"items": []}

        # Strip leading slash if present (frontend may include it)
        resource = resource.lstrip("/")

        def _to_json(v: object) -> object:
            if isinstance(v, (_dt, _date)):
                return v.isoformat()
            return v

        # ── Preferred path: resolve the mapped ORM model for this resource ──────
        # Serializing through the same ``_to_dict`` the CRUD/list routes use keeps
        # the response shape identical to every other endpoint: clean attribute
        # names (no physical column prefixes such as ``cw_``), a ``_label``, and
        # the primary-key value surfaced under the conventional ``eid`` alias the
        # frontend keys related records by.  The primary key is located by
        # introspection (``get_pk_field_name``) so this works for ANY pk name
        # (``id``, ``eid``, ``model_id``, …) — never assume a hard-coded column.
        model_cls = _model_by_tablename(resource)
        if model_cls is not None:
            pk_field = get_pk_field_name(model_cls)
            pk_attr = getattr(model_cls, pk_field, None)
            if pk_attr is None:
                raise HTTPException(status_code=400, detail=f"No primary key on {resource}")

            # Coerce incoming ids to the pk column's python type where possible.
            try:
                pk_col = _sa_inspect(model_cls).columns.get(pk_field)
                py_type = pk_col.type.python_type if pk_col is not None else None
                typed_ids = [py_type(i) for i in ids] if py_type is not None else list(ids)
            except Exception:
                typed_ids = list(ids)

            with _SASession(engine) as session:
                objs = session.execute(
                    _sa_select(model_cls).where(pk_attr.in_(typed_ids))
                ).scalars().all()

            items = []
            for obj in objs:
                data = _to_dict(obj)
                # Expose the primary-key value under the conventional ``eid`` alias
                # so the frontend can correlate related records regardless of how
                # the developer named the primary key.
                if data.get("eid") is None:
                    data["eid"] = getattr(obj, pk_field, None)
                items.append(data)
            return {"items": items}

        # ── Fallback: raw Core table (e.g. unmapped link/junction tables) ──────
        table = SQLModel.metadata.tables.get(resource)
        if table is None:
            raise HTTPException(status_code=404, detail=f"Unknown resource: {resource}")

        # First declared primary-key column — name-agnostic, never hard-coded.
        pk_cols = [c for c in table.c if c.primary_key]
        if not pk_cols:
            raise HTTPException(status_code=400, detail=f"No primary key on {resource}")
        pk_col = pk_cols[0]

        try:
            typed_ids = [pk_col.type.python_type(i) for i in ids]
        except Exception:
            typed_ids = ids

        with _SASession(engine) as session:
            rows = session.execute(
                _sa_select(table).where(pk_col.in_(typed_ids))
            ).mappings().all()

        items = []
        for row in rows:
            data = _sanitize({k: _to_json(v) for k, v in dict(row).items()})
            if data.get("eid") is None:
                data["eid"] = data.get(pk_col.name)
            items.append(data)
        return {"items": items}

    # --- Dev trace sink (Data Detail Level diagnostics) ---
    # Accepts POSTed trace lines from the frontend and appends them to
    # /tmp/veloiq_ddl_trace.log so they can be inspected without a browser.
    _TRACE_FILE = _Path("/tmp/veloiq_ddl_trace.log")

    @core_api.post("/debug/ddl-trace")
    async def ddl_trace(request: Request):
        from datetime import datetime as _dt
        try:
            body = await request.json()
        except Exception:
            body = {}
        lines = body.get("lines") if isinstance(body, dict) else None
        ts = _dt.now().strftime("%H:%M:%S.%f")[:-3]
        with _TRACE_FILE.open("a", encoding="utf-8") as fh:
            if isinstance(lines, list):
                for ln in lines:
                    fh.write(f"[{ts}] {ln}\n")
            else:
                fh.write(f"[{ts}] {body}\n")
        return {"ok": True}

    @core_api.delete("/debug/ddl-trace")
    async def ddl_trace_clear():
        try:
            _TRACE_FILE.write_text("", encoding="utf-8")
        except Exception:
            pass
        return {"ok": True}

    # ── Licensing status (aggregates host app + all extensions) ─────────────
    @core_api.get("/licensing/status")
    async def licensing_status():
        """Return the combined license pool from the host app and all installed extensions.

        Each extension that follows the ``{pkg}.license.license_registry`` convention
        contributes its ``licensed_modules``, ``write_allowed_modules``, module group
        statuses and definitions. The frontend consumes this endpoint to filter the
        navigation menu to only show licensed modules.
        """
        all_licensed_modules: list[str] = []
        all_write_allowed_modules: list[str] = []
        all_group_statuses: dict[str, str] = {}
        all_module_groups: dict[str, list[str]] = {}
        all_warnings: list[dict] = []
        installation_id: str | None = None
        from datetime import date as _date

        # ── Host app license registry (if exists) ──────────────────────────
        try:
            import app.modules.license.license_registry as host_reg  # type: ignore[import]

            all_licensed_modules.extend(host_reg.get_licensed_modules())
            all_write_allowed_modules.extend(host_reg.get_write_allowed_modules())
            all_group_statuses.update(getattr(host_reg, "_group_statuses", {}))
            all_module_groups.update(getattr(host_reg, "MODULE_GROUPS", {}))

            # Try to get the host installation ID for admin display.
            get_id_fn = getattr(host_reg, "get_installation_id", None)
            if callable(get_id_fn):
                try:
                    installation_id = get_id_fn()
                except Exception:
                    pass

            # Collect warnings from host registry (admin-visible only).
            today = _date.today()
            governing = getattr(host_reg, "_governing_keys", {})
            for group, key_data in governing.items():
                status = all_group_statuses.get(group, "blocked")
                end_date = key_data.get("end_date") if isinstance(key_data, dict) else getattr(key_data, "end_date", None)
                if status == "grace_period":
                    days_left = max(0, 30 - (today - end_date).days) if end_date else 0
                    all_warnings.append({
                        "type": "grace_period",
                        "group": group,
                        "days_remaining": days_left,
                    })
                elif status == "active" and end_date and (end_date - today).days <= 30:
                    all_warnings.append({
                        "type": "expiry_approaching",
                        "group": group,
                        "days_remaining": (end_date - today).days,
                    })
        except ImportError:
            pass  # Host app has no license module — no host modules to gate.

        # ── Extension license registries ────────────────────────────────────
        if extensions:
            for ext in extensions:
                try:
                    # The license_registry lives under the extension's modules_package.
                    pkg = ext.modules_package
                    lic_mod = __import__(f"{pkg}.license.license_registry", fromlist=["license_registry"])
                    ext_licensed = getattr(lic_mod, "get_licensed_modules", lambda: [])()
                    ext_write_allowed = getattr(lic_mod, "get_write_allowed_modules", lambda: [])()
                    ext_statuses = getattr(lic_mod, "_group_statuses", {})
                    ext_groups = getattr(lic_mod, "MODULE_GROUPS", {})

                    all_licensed_modules.extend(ext_licensed)
                    all_write_allowed_modules.extend(ext_write_allowed)
                    all_group_statuses.update(ext_statuses)
                    all_module_groups.update(ext_groups)

                    # Collect warnings from extension registry.
                    today = _date.today()
                    governing = getattr(lic_mod, "_governing_keys", {})
                    for group, key in governing.items():
                        status = ext_statuses.get(group, "blocked")
                        end_date = key.end_date if hasattr(key, "end_date") else key.get("end_date")
                        if status == "grace_period":
                            days_left = max(0, 30 - (today - end_date).days) if end_date else 0
                            all_warnings.append({
                                "type": "grace_period",
                                "group": group,
                                "days_remaining": days_left,
                            })
                        elif status == "active" and end_date and (end_date - today).days <= 30:
                            all_warnings.append({
                                "type": "expiry_approaching",
                                "group": group,
                                "days_remaining": (end_date - today).days,
                            })
                except ImportError:
                    continue  # Extension has no license module — skip.
                except Exception:
                    continue  # Graceful degradation for any other error.

        # Deduplicate while preserving order.
        seen_mods: set[str] = set()
        deduped_licensed: list[str] = []
        for m in all_licensed_modules:
            if m not in seen_mods:
                seen_mods.add(m)
                deduped_licensed.append(m)

        seen_wmods: set[str] = set()
        deduped_write_allowed: list[str] = []
        for m in all_write_allowed_modules:
            if m not in seen_wmods:
                seen_wmods.add(m)
                deduped_write_allowed.append(m)

        return {
            "installation_id": installation_id,
            "licensed_modules": deduped_licensed,
            "write_allowed_modules": deduped_write_allowed,
            "group_statuses": all_group_statuses,
            "module_groups": all_module_groups,
            "warnings": all_warnings,
        }

    # Mount all core data API endpoints under /api so they match API_URL="/api"
    # used by the frontend (both dev proxy and production same-origin).
    app.include_router(core_api, prefix="/api")


# ---------------------------------------------------------------------------
# VeloIQ Studio
# ---------------------------------------------------------------------------

class _SPAFiles(StaticFiles):
    """StaticFiles with SPA fallback: serves index.html for unmatched paths."""
    async def get_response(self, path: str, scope):
        from starlette.exceptions import HTTPException as _StarletteHTTPException
        try:
            return await super().get_response(path, scope)
        except _StarletteHTTPException as ex:
            if ex.status_code == 404:
                return await super().get_response("index.html", scope)
            raise


def _mount_frontend(app: FastAPI, cfg: VeloIQConfig) -> None:
    """Serve the host app's built frontend dist/ at / for production deployments.

    Uses Starlette's ``default`` router fallback so that explicit mounts like
    ``/admin`` and ``/veloiq-studio`` take precedence over the SPA catch-all.
    """
    if cfg.serve_frontend is None:
        return
    dist = Path(cfg.serve_frontend)
    if not dist.exists():
        return
    # Serve static assets (JS/CSS/...) at /assets/ and / (SPA fallback).
    # Assets must be served by a regular mount so they're direct files.
    assets_dir = dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="frontend_assets")
    # The SPA fallback only kicks in when no explicit route or mount matches.
    app.router.default = _SPAFiles(directory=str(dist), html=True)
    print(f"  🌐 Frontend: / → {dist}")


def _mount_studio(app: FastAPI, cfg: VeloIQConfig) -> None:
    """Mount the Studio API router and serve the pre-built frontend."""
    from veloiq_framework.studio import make_studio_router
    app.include_router(make_studio_router(cfg))

    static_dir = Path(__file__).parent / "studio" / "static"
    if static_dir.exists():
        app.mount(
            "/veloiq-studio",
            StaticFiles(directory=str(static_dir), html=True),
            name="veloiq_studio",
        )
        print("  🔬 VeloIQ Studio: /veloiq-studio/")
