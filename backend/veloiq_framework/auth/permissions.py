"""Permission primitives for VeloIQ: RoleDef, model_access, veloiq_field, rebac."""
from __future__ import annotations

import json
import threading
from dataclasses import dataclass, field as dc_field
from typing import Any

# ── HTTP method constants ─────────────────────────────────────────────────────

ALL_METHODS = {"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"}
WRITE_METHODS = {"GET", "POST", "PUT", "PATCH", "OPTIONS", "HEAD"}
READ_METHODS = {"GET", "OPTIONS", "HEAD"}

# ── HTTP method → Refine action mapping ──────────────────────────────────────

HTTP_TO_REFINE: dict[str, set[str]] = {
    "DELETE":  {"delete"},
    "POST":    {"create"},
    "PUT":     {"edit"},
    "PATCH":   {"edit"},
    "GET":     {"list", "show", "field", "clone"},
    "OPTIONS": set(),
    "HEAD":    set(),
}


def methods_to_actions(methods: set[str]) -> list[str]:
    """Convert a set of HTTP methods to sorted Refine action names."""
    actions: set[str] = set()
    for method in methods:
        actions |= HTTP_TO_REFINE.get(method.upper(), set())
    return sorted(actions)


# ── RoleDef ───────────────────────────────────────────────────────────────────

@dataclass
class RoleDef:
    """Developer-defined role preset, upserted to the database on startup."""
    name: str
    methods: set[str]
    description: str = ""
    is_preset: bool = True

    def actions(self) -> list[str]:
        return methods_to_actions(self.methods)

    def methods_json(self) -> str:
        return json.dumps(sorted(self.methods))


# ── Default presets (used when VeloIQConfig.roles is not overridden) ───────────

DEFAULT_ROLES: list[RoleDef] = [
    RoleDef("Admin",   ALL_METHODS,   "Full administrative access",        is_preset=True),
    RoleDef("Manager", WRITE_METHODS, "Create, edit and view — no delete", is_preset=True),
    RoleDef("Viewer",  READ_METHODS,  "Read-only access",                  is_preset=True),
]


# ── Model-level permission registry ──────────────────────────────────────────
# Populated at import time by @model_access; read by /auth/resource-permissions.

_MODEL_PERMISSIONS: dict[str, dict[str, list[str]]] = {}


def model_access(**role_actions: list[str]):
    """Decorator: restrict which Refine actions a role may perform on this model.

    Only the listed actions are allowed for the given role — anything not listed
    is denied.  Roles *not* mentioned inherit global role permissions unchanged.
    Exceptions can only restrict (never grant beyond the role's global permissions).

    Usage::

        @model_access(Manager=["list", "show"], Viewer=["list", "show"])
        class Invoice(TimestampedModel, table=True):
            ...
    """
    def _decorator(cls):
        cls.__veloiq_permissions__ = dict(role_actions)
        tablename = getattr(cls, "__tablename__", cls.__name__.lower())
        _MODEL_PERMISSIONS[tablename] = dict(role_actions)
        return cls
    return _decorator


# ── ReBAC (row-based access control) ─────────────────────────────────────────

_REBAC_REGISTRY: dict[str, str] = {}  # tablename → model class name
_rebac_resolving = threading.local()  # per-thread cycle detection stack


def _get_rebac_pk(model_class: type):
    """Return the primary-key column attribute for *model_class*."""
    from sqlalchemy.inspection import inspect as sa_inspect
    mapper = sa_inspect(model_class)
    pk_attrs = [p for p in mapper.column_attrs if any(c.primary_key for c in p.columns)]
    if not pk_attrs:
        raise ValueError(f"{model_class.__name__} has no inspectable primary key column")
    return getattr(model_class, pk_attrs[0].key)


def rebac(
    *,
    filter=None,  # noqa: A002 — intentional kwarg name matching the public API
    owner_field: str | None = None,
    tenant_field: str | None = None,
):
    """Class decorator: restrict row-level access for a model.

    At least one of *filter*, *owner_field*, or *tenant_field* must be given.
    Multiple options are OR-combined (a row is visible if any rule allows it).

    Parameters
    ----------
    filter:
        ``lambda user, cls, session: <SQLAlchemy clause | True | False | None>``
        Return a WHERE clause to allow matching rows, ``True`` for no restriction,
        or ``False`` to deny all rows.  May call :func:`rebac_subquery`.
    owner_field:
        Name of a column pointing to ``veloiq_user.id``.
        Shorthand for ``filter=lambda user, cls, _: cls.<field> == user["eid"]``.
    tenant_field:
        Name of a column pointing to ``veloiq_tenant.id``.
        Grants access when the tenant is one the authenticated user belongs to.

    Usage::

        @rebac(owner_field="created_by")
        class Task(TimestampedModel, table=True):
            created_by: int = Field(foreign_key="veloiq_user.id")

        @rebac(filter=lambda user, cls, session:
                   cls.folder_id.in_(rebac_subquery(Folder, user, session)))
        class Document(TimestampedModel, table=True):
            folder_id: int
    """
    builders: list = []
    if filter is not None:
        builders.append(filter)
    if owner_field is not None:
        _of = owner_field
        def _owner_fn(user, cls, _session):
            return getattr(cls, _of) == user.get("eid")
        builders.append(_owner_fn)
    if tenant_field is not None:
        _tf = tenant_field
        def _tenant_fn(user, cls, session):
            from sqlmodel import select as _sel
            from veloiq_framework.auth.models import user_has_tenant_link
            return getattr(cls, _tf).in_(
                _sel(user_has_tenant_link.tenant_id)
                .where(user_has_tenant_link.user_id == user.get("eid"))
            )
        builders.append(_tenant_fn)

    if not builders:
        raise ValueError("@rebac requires at least one of: filter, owner_field, tenant_field")

    if len(builders) == 1:
        _combined = builders[0]
    else:
        _bs = list(builders)
        def _combined(user, cls, session):
            from sqlalchemy import or_
            return or_(*[fn(user, cls, session) for fn in _bs])

    def _decorator(cls):
        cls.__rebac_filter__ = _combined
        tablename = getattr(cls, "__tablename__", cls.__name__.lower())
        _REBAC_REGISTRY[tablename] = cls.__name__
        return cls
    return _decorator


def rebac_subquery(model_class: type, user: dict, session):
    """Return a subquery of PKs of *model_class* rows the *user* may access.

    Designed to be called inside a ``@rebac(filter=…)`` lambda to express
    relationship-based access::

        @rebac(filter=lambda user, cls, session:
                   cls.folder_id.in_(rebac_subquery(Folder, user, session)))
        class Document(TimestampedModel, table=True):
            ...

    Raises
    ------
    ValueError
        If *model_class* has no ``@rebac`` decorator, or a circular dependency
        is detected.
    """
    from sqlmodel import select as _sel

    name = model_class.__name__
    if not hasattr(_rebac_resolving, "stack"):
        _rebac_resolving.stack = set()
    if name in _rebac_resolving.stack:
        raise ValueError(
            f"Circular ReBAC dependency detected involving {name}. "
            f"Stack: {_rebac_resolving.stack!r}"
        )
    filter_fn = getattr(model_class, "__rebac_filter__", None)
    if filter_fn is None:
        raise ValueError(
            f"{name} has no @rebac decorator — cannot use in rebac_subquery(). "
            f"Apply @rebac to {name} first."
        )
    pk_col = _get_rebac_pk(model_class)
    _rebac_resolving.stack.add(name)
    try:
        clause = filter_fn(user, model_class, session)
        if clause is None or clause is True:
            return _sel(pk_col).select_from(model_class)
        if clause is False:
            from sqlalchemy import false
            return _sel(pk_col).select_from(model_class).where(false())
        return _sel(pk_col).select_from(model_class).where(clause)
    finally:
        _rebac_resolving.stack.discard(name)


# ── Field-level permission helper ─────────────────────────────────────────────

def veloiq_field(
    *,
    read_roles: list[str] | None = None,
    write_roles: list[str] | None = None,
    **kwargs: Any,
) -> Any:
    """SQLModel/Pydantic field with optional per-role read/write restrictions.

    The backend CRUD router enforces these at runtime; the schema generator
    emits them into TypeScript schemas for frontend use.

    Usage::

        salary: float = veloiq_field(
            default=0.0,
            read_roles=["Admin"],           # only Admin can read this field
            write_roles=["Admin"],          # only Admin can write this field
        )
        notes: str = veloiq_field(
            default="",
            write_roles=["Admin", "Manager"],  # Viewer can read but not write
        )
    """
    # Use pydantic.Field (not sqlmodel.Field) so json_schema_extra is preserved
    # on the FieldInfo.  SQLModel classes accept both interchangeably for plain
    # data fields; only use sqlmodel.Field when you need sa_column / primary_key.
    from pydantic import Field

    extra: dict[str, Any] = {}
    if read_roles is not None:
        extra["veloiq_read_roles"] = read_roles
    if write_roles is not None:
        extra["veloiq_write_roles"] = write_roles

    if extra:
        existing = kwargs.pop("json_schema_extra", {}) or {}
        if callable(existing):
            orig = existing
            def _merged(schema: dict) -> None:
                orig(schema)
                schema.update(extra)
            kwargs["json_schema_extra"] = _merged
        else:
            kwargs["json_schema_extra"] = {**existing, **extra}

    return Field(**kwargs)
