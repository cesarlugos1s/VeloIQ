"""SafeMantIQ Framework — public API."""

from safemantiq_framework._version import __version__
from safemantiq_framework.config import SafemConfig
from safemantiq_framework.factory import create_safem_app
from safemantiq_framework.models import (
    FrameworkModel,
    TimestampedModel,
    StandardModel,
    jm_relationship,
    get_pk_field_name,
    RelationCardinality,
)
from safemantiq_framework.db import get_session
from safemantiq_framework.crud import create_crud_router
from safemantiq_framework.auth.utils import get_current_user, require_role
from safemantiq_framework.auth.permissions import (
    RoleDef,
    model_access,
    safem_field,
    rebac,
    rebac_subquery,
    ALL_METHODS,
    WRITE_METHODS,
    READ_METHODS,
    DEFAULT_ROLES,
)

__all__ = [
    "__version__",
    "SafemConfig",
    "create_safem_app",
    "FrameworkModel",
    "TimestampedModel",
    "StandardModel",
    "jm_relationship",
    "get_pk_field_name",
    "RelationCardinality",
    "get_session",
    "create_crud_router",
    "get_current_user",
    "require_role",
    # Permission primitives — RBAC
    "RoleDef",
    "model_access",
    "safem_field",
    "ALL_METHODS",
    "WRITE_METHODS",
    "READ_METHODS",
    "DEFAULT_ROLES",
    # Permission primitives — ReBAC
    "rebac",
    "rebac_subquery",
]
