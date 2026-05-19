"""{{app_title}} — main entry point.

Start the development server:
    safem run

Or directly with uvicorn:
    uvicorn app.main:app --reload
"""
from safemantiq_framework import (
    create_safem_app, SafemConfig,
    RoleDef, ALL_METHODS, WRITE_METHODS, READ_METHODS,
)

app = create_safem_app(SafemConfig(
    roles=[
        RoleDef("Admin",   ALL_METHODS,   "Full administrative access",        is_preset=True),
        RoleDef("Manager", WRITE_METHODS, "Create, edit and view — no delete", is_preset=True),
        RoleDef("Viewer",  READ_METHODS,  "Read-only access",                  is_preset=True),
        # Add more roles here — they are seeded to the DB on startup and
        # appear in Access Control → Roles in the admin UI:
        # RoleDef("Auditor", READ_METHODS, "External auditor — read only", is_preset=True),
    ],
))
