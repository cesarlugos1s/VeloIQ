# AUTO-GENERATED — do not edit. Run `veloiq generate` to update.
"""Standard CRUD API for the tasks module."""
from veloiq_framework.crud import create_crud_router
from .models import Task

router = create_crud_router(Task)
