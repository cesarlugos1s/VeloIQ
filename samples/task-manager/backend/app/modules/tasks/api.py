# AUTO-GENERATED — do not edit. Run `safem generate` to update.
"""Standard CRUD API for the tasks module."""
from safemantiq_framework.crud import create_crud_router
from .models import Task

router = create_crud_router(Task)
