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
        # RoleDef("Auditor", READ_METHODS, "External read-only auditor", is_preset=True),
    ],
))
