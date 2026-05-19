# AUTO-GENERATED — do not edit. Run `veloiq generate` to update.
"""Standard CRUD API for the team module."""
from veloiq_framework.crud import create_crud_router
from .models import TeamMember

router = create_crud_router(TeamMember)
