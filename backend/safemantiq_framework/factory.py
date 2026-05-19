"""create_safem_app() — the SafeMantIQ application factory.

New framework applications call this once and get back a fully-configured
FastAPI instance::

    # myapp/main.py
    from safemantiq_framework import create_safem_app
    app = create_safem_app()          # DATABASE_URL read from env

    # Or with explicit config:
    from safemantiq_framework import create_safem_app, SafemConfig
    app = create_safem_app(SafemConfig(
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

from safemantiq_framework.config import SafemConfig
from safemantiq_framework.loader import load_factory_events, load_modules


def create_safem_app(
    config: SafemConfig | None = None,
    **kwargs,
) -> FastAPI:
    """Create and return a fully configured SafeMantIQ FastAPI application.

    Parameters
    ----------
    config:
        A :class:`SafemConfig` instance.  If omitted, one is constructed from
        environment variables and any keyword arguments passed here.
    **kwargs:
        Forwarded to :class:`SafemConfig` when *config* is not provided.

    Returns
    -------
    FastAPI
        A configured application ready to be served by uvicorn.

    Raises
    ------
    ValueError
        If no database URL can be determined.
    """
    # Load .env from the working directory the app is run from.
    # dotenv_path='.env' resolves relative to the process CWD (where uvicorn
    # is launched), not relative to this file — which is the application root.
    from dotenv import load_dotenv
    load_dotenv(dotenv_path='.env')

    cfg = config if config is not None else SafemConfig(**kwargs)

    if not cfg.database_url:
        raise ValueError(
            "No database URL configured. Set the DATABASE_URL environment variable "
            "or pass database_url=... to create_safem_app() / SafemConfig()."
        )

    # ── Database engine ───────────────────────────────────────────────────────
    from sqlalchemy import create_engine
    from safemantiq_framework.db import _set_engine
    engine_kwargs: dict = {"echo": cfg.echo_sql}
    if cfg.database_url.startswith("sqlite"):
        engine_kwargs["connect_args"] = {"check_same_thread": False}
    engine = create_engine(cfg.database_url, **engine_kwargs)
    _set_engine(engine)

    # ── Lifespan ──────────────────────────────────────────────────────────────
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        load_factory_events(cfg.modules_dir)
        if cfg.create_tables_on_startup:
            # Ensure auth tables are registered before create_all
            from safemantiq_framework.auth import models as _auth_models  # noqa: F401
            SQLModel.metadata.create_all(engine)
        if cfg.auth_enabled:
            from safemantiq_framework.auth.utils import seed_admin_user_if_needed, seed_roles
            seed_roles(engine, cfg.roles)
            seed_admin_user_if_needed(engine, cfg.admin_username, cfg.admin_password)
        yield

    # ── FastAPI app ───────────────────────────────────────────────────────────
    app = FastAPI(title=cfg.title, lifespan=lifespan)

    # ── Static files ──────────────────────────────────────────────────────────
    if cfg.static_dir and Path(cfg.static_dir).exists():
        app.mount("/static", StaticFiles(directory=str(cfg.static_dir)), name="static")

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
        from safemantiq_framework.auth.admin import AUTH_ADMIN_VIEWS
        for view in AUTH_ADMIN_VIEWS:
            admin.add_view(view)

    # ── Module loading ────────────────────────────────────────────────────────
    load_modules(app, admin, cfg)

    # ── Core endpoints ────────────────────────────────────────────────────────
    _register_core_endpoints(app, engine, cfg)

    return app


# ---------------------------------------------------------------------------
# Auth middleware
# ---------------------------------------------------------------------------

def _add_auth_middleware(app: FastAPI, cfg: SafemConfig) -> None:
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
            from safemantiq_framework.auth.utils import decode_access_token
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
            from safemantiq_framework.auth.utils import check_rbac
            roles = user.get("roles", [])
            if not check_rbac(roles, request.method):
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Insufficient permissions"},
                )
        return await call_next(request)


# ---------------------------------------------------------------------------
# Minimal core endpoints every SafeMantIQ app gets
# ---------------------------------------------------------------------------

def _register_core_endpoints(app: FastAPI, engine, cfg: SafemConfig) -> None:
    """Register the minimal set of framework-level REST endpoints."""
    from fastapi import Request, HTTPException
    from pydantic import BaseModel

    @app.get("/health")
    def health():
        return {"status": "ok", "framework": "SafeMantIQ"}

    # Auth endpoints (login, me, register, CRUD for user/role/tenant)
    from safemantiq_framework.auth.router import make_auth_router
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
        """Return global UI view settings. Empty dict → frontend uses its defaults."""
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
    async def view_configurations(model_name: str):
        """Return view layout configuration rows for a model. Empty list → schema-driven defaults."""
        return []

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
