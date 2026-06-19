"""Framework base model classes.

Import these in your module models::

    from veloiq_framework import FrameworkModel, TimestampedModel

    class Product(TimestampedModel, table=True):
        name: str
        price: float

Use ``FrameworkModel`` when you don't need timestamps.
Use ``TimestampedModel`` when you want automatic ``created_at`` / ``updated_at``.

For applications that need CubicWeb database compatibility (``eid`` primary key,
``cw_`` column prefixes), use ``StandardModel``::

    from veloiq_framework import StandardModel

    class Item(StandardModel, table=True):
        cw_name: str = Field(sa_column=Column("cw_name", String))
"""
from __future__ import annotations

import threading
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Callable, ClassVar, Optional

from pydantic import BaseModel, ConfigDict
from sqlalchemy import Column, Integer, String, func
from sqlalchemy.inspection import inspect
from sqlmodel import Field, Relationship, SQLModel


# ---------------------------------------------------------------------------
# Relationship wrapper with cardinality metadata
# ---------------------------------------------------------------------------

@dataclass
class RelationCardinality:
    min_items: int = 0
    max_items: int | None = None
    required: bool = False


def jm_relationship(
    *,
    min_items: int = 0,
    max_items: int | None = None,
    required: bool = False,
    **kwargs: Any,
) -> Any:
    """SQLModel Relationship wrapper that attaches cardinality metadata.

    The DynamicResource UI component reads this metadata to render
    required/optional indicators and pagination hints.

    Usage::

        tags: list["Tag"] = jm_relationship(
            min_items=0, max_items=None,
            back_populates="products",
            link_model=ProductTagLink,
        )
    """
    info = {"cardinality": RelationCardinality(min_items=min_items, max_items=max_items, required=required)}
    sa_kwargs = kwargs.pop("sa_relationship_kwargs", {})
    sa_kwargs["info"] = info
    return Relationship(sa_relationship_kwargs=sa_kwargs, **kwargs)


# ---------------------------------------------------------------------------
# PK introspection helper
# ---------------------------------------------------------------------------

def get_pk_field_name(model_cls: type) -> str:
    """Return the Python attribute name for the primary key of a mapped model."""
    try:
        mapper = inspect(model_cls)
        for col_prop in mapper.column_attrs:
            if any(col.primary_key for col in col_prop.columns):
                return col_prop.key
    except Exception:
        pass
    return "id"


# ---------------------------------------------------------------------------
# Title (dc_title / __str__) composition helper
# ---------------------------------------------------------------------------

# Special selectable tokens that may appear in __veloiq_ui__["titleFields"]
# alongside (or instead of) real field names. They resolve at render time to
# the model's display name / primary-key value and are wrapped in brackets.
TITLE_TOKEN_MODEL_NAME = "__model_name__"
TITLE_TOKEN_PK = "__pk__"
TITLE_SPECIAL_TOKENS = (TITLE_TOKEN_MODEL_NAME, TITLE_TOKEN_PK)

# Infrastructure / audit columns that must never be used as a record title.
# Housekeeping fields (e.g. the CubicWeb ``cwuri`` URI and audit timestamps);
# the first-string-field fallback skips them so it lands on a real business
# field instead of, say, a URL.
_INFRA_TITLE_FIELDS = frozenset({
    "cwuri",
    "creation_date",
    "modification_date",
    "created_at",
    "updated_at",
})

# Per-thread set of object ids currently being resolved by
# build_model_str_label. Reentrancy guard so a base-class dc_title/__str__ that
# delegates back into this function cannot recurse infinitely; on re-entry we
# fall through to the field-based rungs.
_label_resolving = threading.local()

# __str__ implementations that are NOT a real title (default object / pydantic
# repr) and therefore must never be used as a record label.
_IGNORED_STR_DEFINERS = {object, BaseModel, SQLModel}


def _title_method_definer(cls: type, name: str) -> Optional[type]:
    """Return the most-derived class in ``cls``'s MRO that defines ``name``."""
    for klass in cls.__mro__:
        if name in klass.__dict__:
            return klass
    return None


def _title_methods_in_priority(cls: type) -> list:
    """Order ('dc_title', '__str__') by which the developer actually customized.

    The method declared on the most-derived class wins (so a model that only
    overrides ``__str__`` still beats an inherited generic ``dc_title``);
    ``dc_title`` breaks ties. A default/repr ``__str__`` (object / pydantic
    ``BaseModel`` / ``SQLModel``) is not treated as a title source.
    """
    mro = cls.__mro__
    cands = []
    dc_def = _title_method_definer(cls, "dc_title")
    if dc_def is not None:
        cands.append((mro.index(dc_def), 0, "dc_title"))
    str_def = _title_method_definer(cls, "__str__")
    if str_def is not None and str_def not in _IGNORED_STR_DEFINERS:
        cands.append((mro.index(str_def), 1, "__str__"))
    cands.sort()
    return [name for _, _, name in cands]


def model_field_label(instance: Any) -> str:
    """First non-empty string field (skipping PK + infra/audit), else "[<Class> <pk>]".

    The field-scan/fallback rungs (3 and 4) of :func:`build_model_str_label`,
    factored out so base classes can reuse the exact same logic without
    re-entering the dc_title/__str__ dispatch (which would double-apply an emoji
    prefix). Treats a falsy primary key as ``?``.
    """
    if instance is None:
        return ""
    cls = type(instance)
    try:
        pk_name = get_pk_field_name(cls)
    except Exception:
        pk_name = None
    for attr in getattr(cls, "model_fields", {}):
        if attr == pk_name or attr in _INFRA_TITLE_FIELDS:
            continue
        val = getattr(instance, attr, None)
        if isinstance(val, str) and val:
            return val
    pk_val = getattr(instance, pk_name, None) if pk_name else None
    return f"[{cls.__name__} {pk_val if pk_val else '?'}]"


def _humanize_model_name(name: str) -> str:
    """'FilmActor' -> 'Film Actor', 'Language' -> 'Language'."""
    out: list[str] = []
    for i, ch in enumerate(name):
        if i > 0 and ch.isupper() and not name[i - 1].isupper():
            out.append(" ")
        out.append(ch)
    return "".join(out)


def _composed_title(instance: Any) -> Optional[str]:
    """Build a record title from the model's configured ``titleFields``.

    A developer can declare which fields compose the human-readable title via::

        class Contact(TimestampedModel, table=True):
            __veloiq_ui__: ClassVar[Dict] = {"titleFields": ["first_name", "last_name"]}
            first_name: str
            last_name: str

    The title is the string concatenation of those field values, separated by a
    single blank space, skipping any that are ``None`` / empty.  Returns ``None``
    when no ``titleFields`` are configured (or none of them yield a value), so the
    caller can fall back to the automatic single-field behaviour.
    """
    ui_meta = getattr(type(instance), "__veloiq_ui__", None) or {}
    title_fields = ui_meta.get("titleFields") if isinstance(ui_meta, dict) else None
    if not title_fields:
        return None
    parts: list[str] = []
    for field_name in title_fields:
        if field_name == TITLE_TOKEN_MODEL_NAME:
            parts.append(f"[{_humanize_model_name(type(instance).__name__)}]")
            continue
        if field_name == TITLE_TOKEN_PK:
            try:
                pk_name = get_pk_field_name(type(instance))
            except Exception:
                pk_name = None
            pk_val = getattr(instance, pk_name, None) if pk_name else None
            if pk_val is None and hasattr(instance, "pk_value"):
                pk_val = instance.pk_value()
            if pk_val is not None:
                parts.append(f"[{pk_val}]")
            continue
        val = getattr(instance, field_name, None)
        if val is None:
            continue
        text = str(val).strip()
        if text:
            parts.append(text)
    return " ".join(parts) if parts else None


def build_model_str_label(instance: Any) -> str:
    """Canonical human-readable title for *any* model record.

    Single source of truth for a record's title, working for VeloIQ base models
    **and** plain ``SQLModel`` classes (e.g. tables produced by
    ``veloiq import-schema``). Resolution order:

    1. ``__veloiq_ui__["titleFields"]`` when configured (explicit developer choice).
    2. The model's customized ``dc_title()`` / ``__str__`` — whichever is
       declared on the most-derived class (``dc_title`` breaks ties), so a model
       that only overrides ``__str__`` still wins over an inherited generic
       ``dc_title``. A per-instance reentrancy guard lets the framework base
       methods (which delegate back here) fall through to the field rungs,
       keeping output identical for pre-existing apps.
    3. The first non-empty string field, skipping the primary key and
       infrastructure/audit columns (see ``_INFRA_TITLE_FIELDS``).
    4. ``"[<Class> <pk>]"`` (e.g. ``[Inventory 245]``).
    """
    if instance is None:
        return ""
    cls = type(instance)

    # 1. Developer-configured title fields — honoured regardless of base class.
    composed = _composed_title(instance)
    if composed:
        return composed

    # 2. Model-provided title method (dc_title / __str__). Whichever the
    #    developer customized on the most-derived class wins over the field
    #    fallback; dc_title breaks ties. The reentrancy guard lets the framework
    #    base dc_title/__str__ (which delegate back here) fall through safely.
    active = getattr(_label_resolving, "ids", None)
    if active is None:
        active = set()
        _label_resolving.ids = active
    if id(instance) not in active:
        active.add(id(instance))
        try:
            for meth_name in _title_methods_in_priority(cls):
                meth = getattr(instance, meth_name, None)
                if not callable(meth):
                    continue
                try:
                    value = meth()
                except Exception:
                    continue
                if isinstance(value, str) and value.strip():
                    return value
        finally:
            active.discard(id(instance))

    # 3 + 4. First string field (skipping PK + infra), else "[<Class> <pk>]".
    return model_field_label(instance)


# ---------------------------------------------------------------------------
# Base model classes
# ---------------------------------------------------------------------------

class FrameworkModel(SQLModel):
    """Minimal base model for VeloIQ™ framework apps.

    Provides a standard auto-increment integer PK named ``id``.
    No audit columns, no JuiceMantics EID allocation, no cwuri.

    Use ``TimestampedModel`` if you want automatic ``created_at`` /
    ``updated_at`` columns.
    """

    model_config = ConfigDict(protected_namespaces=())

    id: Optional[int] = Field(default=None, primary_key=True)

    _pk_allocator: ClassVar[Optional[Callable]] = None

    def build_model_str_label(self) -> str:
        """Human-readable label for this record (used in relation selectors).

        Delegates to the module-level :func:`build_model_str_label` so the title
        logic (``__veloiq_ui__["titleFields"]`` then first string field) lives in
        one place.
        """
        return build_model_str_label(self)

    def dc_title(self) -> str:
        """Canonical record title — same value as ``str(self)``.

        Kept as an explicit method so display layers can detect title support via
        ``hasattr(obj, "dc_title")`` and so the title stays configurable through
        ``__veloiq_ui__["titleFields"]``.
        """
        return self.build_model_str_label()

    def __str__(self) -> str:
        return self.build_model_str_label()


class StandardModel(SQLModel):
    """CubicWeb-compatible base model for applications that require ``eid`` as
    the primary key and ``cw_`` column naming conventions.

    Use this when migrating from CubicWeb or when maintaining compatibility
    with an existing CubicWeb database schema.  New greenfield applications
    should use ``FrameworkModel`` or ``TimestampedModel`` instead.

    The ``eid`` attribute maps to the ``cw_eid`` physical column so that
    SQLAlchemy and the VeloIQ™ framework both use the Python name ``eid``
    while the database column stays ``cw_eid``.
    """

    model_config = ConfigDict(protected_namespaces=())

    eid: Optional[int] = Field(
        default=None,
        sa_column=Column("cw_eid", Integer, primary_key=True, autoincrement=True),
    )

    creation_date: Optional[datetime] = Field(
        default_factory=datetime.utcnow,
        sa_column_kwargs={"server_default": func.now()},
    )
    modification_date: Optional[datetime] = Field(
        default_factory=datetime.utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )

    def pk_value(self) -> Optional[int]:
        """Return the primary key value regardless of whether it is named ``id`` or ``eid``."""
        for attr in ("id", "eid"):
            val = getattr(self, attr, None)
            if val is not None:
                return val
        return None

    def build_model_str_label(self) -> str:
        """Delegates to the module-level :func:`build_model_str_label`."""
        return build_model_str_label(self)

    def dc_title(self) -> str:
        """Canonical record title — same value as ``str(self)`` (see ``FrameworkModel``)."""
        return self.build_model_str_label()

    def __str__(self) -> str:
        return self.build_model_str_label()


class TimestampedModel(FrameworkModel):
    """``FrameworkModel`` with automatic ``created_at`` / ``updated_at`` columns.

    Usage::

        class Order(TimestampedModel, table=True):
            customer_id: Optional[int] = Field(default=None, foreign_key="customer.id")
            total: float
    """

    created_at: Optional[datetime] = Field(
        default_factory=datetime.utcnow,
        sa_column_kwargs={"server_default": func.now()},
    )
    updated_at: Optional[datetime] = Field(
        default_factory=datetime.utcnow,
        sa_column_kwargs={"server_default": func.now(), "onupdate": func.now()},
    )
