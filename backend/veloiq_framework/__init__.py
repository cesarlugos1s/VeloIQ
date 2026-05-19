"""VeloIQ™ Framework — public API."""

from veloiq_framework._version import __version__
from veloiq_framework.config import VeloIQConfig
from veloiq_framework.factory import create_veloiq_app
from veloiq_framework.models import (
    FrameworkModel,
    TimestampedModel,
    StandardModel,
    jm_relationship,
    get_pk_field_name,
    RelationCardinality,
)
from veloiq_framework.db import get_session
from veloiq_framework.crud import create_crud_router
from veloiq_framework.auth.utils import get_current_user, require_role
from veloiq_framework.auth.permissions import (
    RoleDef,
    model_access,
    veloiq_field,
    rebac,
    rebac_subquery,
    ALL_METHODS,
    WRITE_METHODS,
    READ_METHODS,
    DEFAULT_ROLES,
)

__all__ = [
    "__version__",
    "VeloIQConfig",
    "create_veloiq_app",
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
    "veloiq_field",
    "ALL_METHODS",
    "WRITE_METHODS",
    "READ_METHODS",
    "DEFAULT_ROLES",
    # Permission primitives — ReBAC
    "rebac",
    "rebac_subquery",
]
