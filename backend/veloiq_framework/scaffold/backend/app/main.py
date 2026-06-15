"""{{app_title}} — main entry point.

Start the development server:
    veloiq run

Or directly with uvicorn:
    uvicorn app.main:app --reload

Production (after `veloiq build`):
    veloiq run          # serves frontend + API on the same port
"""
from pathlib import Path
from veloiq_framework import (
    create_veloiq_app, VeloIQConfig,
    RoleDef, ALL_METHODS, WRITE_METHODS, READ_METHODS,
)

# frontend/dist/ is produced by `veloiq build`.  When it exists FastAPI serves
# the React app at / — no separate Vite dev server needed in production.
_frontend_dist = Path(__file__).parent.parent.parent / "frontend" / "dist"

app = create_veloiq_app(VeloIQConfig(
    roles=[
        RoleDef("Admin",   ALL_METHODS,   "Full administrative access",        is_preset=True),
        RoleDef("Manager", WRITE_METHODS, "Create, edit and view — no delete", is_preset=True),
        RoleDef("Viewer",  READ_METHODS,  "Read-only access",                  is_preset=True),
        # Add more roles here — they are seeded to the DB on startup and
        # appear in Access Control → Roles in the admin UI:
        # RoleDef("Auditor", READ_METHODS, "External auditor — read only", is_preset=True),
    ],
    serve_frontend=_frontend_dist if _frontend_dist.exists() else None,
))
