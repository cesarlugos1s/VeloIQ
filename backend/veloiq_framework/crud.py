"""Automatic CRUD router generation for VeloIQ modules.

The most common module pattern — a database table with standard list/get/
create/update/delete endpoints — can be expressed in two lines::

    from veloiq_framework.crud import create_crud_router
    from .models import Task

    router = create_crud_router(Task)

``create_crud_router`` returns a FastAPI ``APIRouter`` pre-configured with:

* ``GET  /``           — paginated list  (query params: ``_start``, ``_end``)
* ``GET  /{id}``       — single record
* ``POST /``           — create
* ``PUT  /{id}``       — full update
* ``DELETE /{id}``     — delete

Response headers follow the react-admin / Refine convention:
``x-total-count`` and ``content-range`` are set on list responses.

Extend or override any route after calling ``create_crud_router``::

    router = create_crud_router(Task)

    @router.post("/{id}/complete")
    def complete_task(id: int, session: Session = Depends(get_session)):
        ...
"""
import math
from typing import Any, Type, TypeVar

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlmodel import Session, SQLModel, func, select

from veloiq_framework.db import get_session
from veloiq_framework.models import get_pk_field_name

T = TypeVar("T", bound=SQLModel)


# ---------------------------------------------------------------------------
# Permission helpers
# ---------------------------------------------------------------------------

def _get_user_roles(request: Request) -> list[str]:
    """Safely extract user roles from request state (set by auth middleware)."""
    user = getattr(request.state, "user", None)
    if user is None:
        return []
    return user.get("roles", [])


def _check_model_permissions(request: Request, model_class: type, method: str) -> None:
    """Raise 403 if no role in the user's token permits *method* on *model_class*.

    Only applies when the model has ``__veloiq_permissions__`` set via
    ``@model_access()``.  Roles not listed there are unrestricted on this model.
    Access is granted when ANY role either (a) is unlisted (no exception) or
    (b) is listed and its allowed actions include the requested action.
    """
    model_perms: dict | None = getattr(model_class, "__veloiq_permissions__", None)
    if not model_perms:
        return

    user_roles = _get_user_roles(request)
    if not user_roles:
        return  # Auth middleware handles unauthenticated requests.

    from veloiq_framework.auth.permissions import HTTP_TO_REFINE
    actions = HTTP_TO_REFINE.get(method.upper(), set())

    for role in user_roles:
        if role not in model_perms:
            return  # This role has no model-level exception — Layer 1 applies.
        if actions & set(model_perms[role]):
            return  # This role's exception explicitly permits the action.

    raise HTTPException(status_code=403, detail="Access denied for this resource")


def _get_field_permissions(model_class: type) -> dict[str, dict]:
    """Return field-level permission metadata for *model_class*.

    Reads from two sources (merged, with class-level taking precedence):
    - ``veloiq_field(read_roles=…, write_roles=…)`` — stored in Pydantic FieldInfo.json_schema_extra
    - ``__veloiq_field_permissions__`` class variable — for fields that use sa_column and
      cannot use pydantic.Field with json_schema_extra (e.g. framework auth models)
    """
    perms: dict[str, dict] = {}
    model_fields = getattr(model_class, "model_fields", {})
    for field_name, field_info in model_fields.items():
        extra = getattr(field_info, "json_schema_extra", None)
        if not isinstance(extra, dict):
            continue
        entry: dict = {}
        if "veloiq_read_roles" in extra:
            entry["read_roles"] = extra["veloiq_read_roles"]
        if "veloiq_write_roles" in extra:
            entry["write_roles"] = extra["veloiq_write_roles"]
        if entry:
            perms[field_name] = entry

    # Merge class-level declarations (used by framework models with sa_column fields).
    class_perms: dict = getattr(model_class, "__veloiq_field_permissions__", {})
    for field_name, entry in class_perms.items():
        perms[field_name] = {**perms.get(field_name, {}), **entry}

    return perms


def _filter_read_fields(data: dict, model_class: type, user_roles: list[str]) -> dict:
    """Remove fields that *user_roles* cannot read per ``veloiq_field(read_roles=…)``."""
    field_perms = _get_field_permissions(model_class)
    if not field_perms:
        return data
    result = {}
    for key, value in data.items():
        fp = field_perms.get(key)
        if fp is None or "read_roles" not in fp:
            result[key] = value
        elif any(r in fp["read_roles"] for r in user_roles):
            result[key] = value
        # else: field is silently omitted for this user.
    return result


def _filter_write_payload(payload: dict, model_class: type, user_roles: list[str]) -> dict:
    """Drop write-restricted fields from *payload* (silently, to avoid UX breakage)."""
    field_perms = _get_field_permissions(model_class)
    if not field_perms:
        return payload
    result = {}
    for key, value in payload.items():
        fp = field_perms.get(key)
        if fp is None or "write_roles" not in fp:
            result[key] = value
        elif any(r in fp["write_roles"] for r in user_roles):
            result[key] = value
        # else: field is silently dropped.
    return result


def _build_rebac_clause(model_class: type, user: dict | None, session):
    """Return a SQLAlchemy WHERE clause for the model's ReBAC filter, or None.

    Returns None when the model has no ``@rebac`` decorator or when auth is
    disabled (user is None/empty).  Returns a falsy ``false()`` clause when the
    filter explicitly denies all rows.
    """
    if not user:
        return None
    filter_fn = getattr(model_class, "__rebac_filter__", None)
    if filter_fn is None:
        return None
    clause = filter_fn(user, model_class, session)
    if clause is None or clause is True:
        return None
    if clause is False:
        from sqlalchemy import false
        return false()
    return clause


def _coerce_filter_value(value: str, col_type: Any) -> Any:
    """Cast a query-string value to the Python type expected by the column."""
    from sqlalchemy import types
    if isinstance(col_type, (types.Integer, types.BigInteger, types.SmallInteger)):
        try:
            return int(value)
        except (ValueError, TypeError):
            return value
    if isinstance(col_type, types.Boolean):
        return value.lower() in ("true", "1", "yes")
    if isinstance(col_type, (types.Float, types.Numeric)):
        try:
            return float(value)
        except (ValueError, TypeError):
            return value
    return value


def _build_where_clauses(model_class: type, query_params) -> list:
    """Return SQLAlchemy WHERE clauses for any query params that match column names.

    Supports two forms:
    - ``?field=value``        → exact equality (``WHERE field = value``)
    - ``?field__ilike=value`` → case-insensitive contains (``WHERE field ILIKE '%value%'``)
    """
    from sqlalchemy.inspection import inspect as sa_inspect
    try:
        mapper = sa_inspect(model_class)
    except Exception:
        return []
    # Build attr-key → (model_attr, col_type) mapping; also index by physical column name.
    filter_map: dict = {}
    for col_attr in mapper.column_attrs:
        col = col_attr.columns[0]
        entry = (col_attr.key, col.type)
        filter_map[col_attr.key] = entry
        if col.name != col_attr.key:
            filter_map[col.name] = entry

    clauses = []
    for key, value in query_params.items():
        if key.startswith("_") or value is None or value == "":
            continue
        if key.endswith("__ilike"):
            base = key[:-7]
            if base in filter_map:
                attr_key, _ = filter_map[base]
                clauses.append(getattr(model_class, attr_key).ilike(f"%{value}%"))
            continue
        if key not in filter_map:
            continue
        attr_key, col_type = filter_map[key]
        coerced = _coerce_filter_value(value, col_type)
        clauses.append(getattr(model_class, attr_key) == coerced)
    return clauses


def _sanitize(value: Any) -> Any:
    """Replace NaN/Inf with None so JSON serialization never fails."""
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if isinstance(value, dict):
        return {k: _sanitize(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize(v) for v in value]
    return value


def _to_dict(obj: SQLModel) -> dict:
    data = obj.model_dump()
    data["_label"] = str(obj)
    return _sanitize(data)


def create_crud_router(
    model_class: Type[T],
    *,
    prefix: str | None = None,
    tags: list[str] | None = None,
    pk_type: type = int,
) -> APIRouter:
    """Return an APIRouter with standard CRUD endpoints for *model_class*.

    Parameters
    ----------
    model_class:
        A SQLModel table class.
    prefix:
        URL prefix for all routes.  Defaults to ``/<tablename>``.
    tags:
        OpenAPI tags.  Defaults to ``[<tablename>]``.
    pk_type:
        Python type of the primary key (default ``int``).
    """
    tablename = getattr(model_class, "__tablename__", model_class.__name__.lower())
    _prefix = prefix if prefix is not None else f"/{tablename}"
    _tags = tags or [tablename]
    pk_field = get_pk_field_name(model_class)

    router = APIRouter(prefix=_prefix, tags=_tags)

    # ── ReBAC helper (closure over model_class and pk_field) ──────────────────

    def _get_rebac_record(record_id, session, user: dict | None):
        """Fetch a record by PK while enforcing the model's ReBAC filter.

        Returns None both when the record does not exist AND when it exists but
        is inaccessible to *user* — callers raise 404 in both cases to avoid
        leaking record existence.
        """
        if not user:
            return session.get(model_class, record_id)
        filter_fn = getattr(model_class, "__rebac_filter__", None)
        if filter_fn is None:
            return session.get(model_class, record_id)
        clause = filter_fn(user, model_class, session)
        if clause is None or clause is True:
            return session.get(model_class, record_id)
        if clause is False:
            return None
        pk_col = getattr(model_class, pk_field)
        stmt = select(model_class).where(pk_col == record_id).where(clause)
        return session.exec(stmt).first()

    # ── List ─────────────────────────────────────────────────────────────────

    @router.get("", summary=f"List {tablename}")
    def list_items(
        request: Request,
        _start: int = Query(0, alias="_start"),
        _end: int = Query(25, alias="_end"),
        session: Session = Depends(get_session),
    ):
        _check_model_permissions(request, model_class, "GET")
        user = getattr(request.state, "user", None) or {}
        where_clauses = _build_where_clauses(model_class, request.query_params)
        rebac_clause = _build_rebac_clause(model_class, user, session)
        count_stmt = select(func.count()).select_from(model_class)
        list_stmt = select(model_class)
        for clause in where_clauses:
            count_stmt = count_stmt.where(clause)
            list_stmt = list_stmt.where(clause)
        if rebac_clause is not None:
            count_stmt = count_stmt.where(rebac_clause)
            list_stmt = list_stmt.where(rebac_clause)
        total = session.exec(count_stmt).one()
        rows = session.exec(list_stmt.offset(_start).limit(max(0, _end - _start))).all()
        user_roles = user.get("roles", [])
        content = [_filter_read_fields(_to_dict(r), model_class, user_roles) for r in rows]
        return JSONResponse(
            content=jsonable_encoder(content),
            headers={
                "x-total-count": str(total),
                "content-range": f"items {_start}-{min(_end, total)}/{total}",
            },
        )

    # ── Get one ───────────────────────────────────────────────────────────────

    @router.get("/{record_id}", summary=f"Get {tablename}")
    def get_item(record_id: pk_type, request: Request, session: Session = Depends(get_session)):  # type: ignore[valid-type]
        _check_model_permissions(request, model_class, "GET")
        user = getattr(request.state, "user", None) or {}
        row = _get_rebac_record(record_id, session, user)
        if row is None:
            raise HTTPException(status_code=404, detail=f"{tablename} {record_id} not found")
        return _filter_read_fields(_to_dict(row), model_class, user.get("roles", []))

    # ── Create ────────────────────────────────────────────────────────────────

    @router.post("", status_code=201, summary=f"Create {tablename}")
    def create_item(payload: dict, request: Request, session: Session = Depends(get_session)):
        _check_model_permissions(request, model_class, "POST")
        user = getattr(request.state, "user", None) or {}
        user_roles = user.get("roles", [])
        payload.pop(pk_field, None)
        filtered = _filter_write_payload(payload, model_class, user_roles)
        coerced = {k: _coerce_value(k, v) for k, v in filtered.items()}
        row = model_class.model_validate(coerced)
        session.add(row)
        session.commit()
        session.refresh(row)
        return _filter_read_fields(_to_dict(row), model_class, user_roles)

    # ── Update ────────────────────────────────────────────────────────────────

    def _coerce_value(key: str, value):
        """Coerce string values to the Python type expected by the column."""
        if not isinstance(value, str):
            return value
        import datetime as _dt
        from sqlalchemy import inspect as _sa_inspect
        from sqlalchemy import DateTime as _DateTime, Date as _Date
        try:
            mapper = _sa_inspect(model_class)
            col = mapper.columns.get(key)
            if col is None:
                return value
            if isinstance(col.type, _DateTime):
                return _dt.datetime.fromisoformat(value)
            if isinstance(col.type, _Date):
                return _dt.date.fromisoformat(value)
        except Exception:
            pass
        return value

    # Fields that must never be overwritten by a client update.
    _READONLY_FIELDS = {"created_at", "creation_date"}

    def _apply_update(record_id, payload, session, user: dict):
        user_roles = user.get("roles", []) if user else []
        row = _get_rebac_record(record_id, session, user)
        if row is None:
            raise HTTPException(status_code=404, detail=f"{tablename} {record_id} not found")
        payload.pop(pk_field, None)
        filtered = _filter_write_payload(payload, model_class, user_roles)
        for key, value in filtered.items():
            if key in _READONLY_FIELDS:
                continue
            if hasattr(row, key):
                setattr(row, key, _coerce_value(key, value))
        session.add(row)
        session.commit()
        session.refresh(row)
        return _filter_read_fields(_to_dict(row), model_class, user_roles)

    @router.put("/{record_id}", summary=f"Update {tablename}")
    def update_item(
        record_id: pk_type,  # type: ignore[valid-type]
        payload: dict,
        request: Request,
        session: Session = Depends(get_session),
    ):
        _check_model_permissions(request, model_class, "PUT")
        return _apply_update(record_id, payload, session, getattr(request.state, "user", None) or {})

    @router.patch("/{record_id}", summary=f"Partial update {tablename}")
    def partial_update_item(
        record_id: pk_type,  # type: ignore[valid-type]
        payload: dict,
        request: Request,
        session: Session = Depends(get_session),
    ):
        _check_model_permissions(request, model_class, "PATCH")
        return _apply_update(record_id, payload, session, getattr(request.state, "user", None) or {})

    # ── Delete ────────────────────────────────────────────────────────────────

    @router.delete("/{record_id}", status_code=204, summary=f"Delete {tablename}")
    def delete_item(record_id: pk_type, request: Request, session: Session = Depends(get_session)):  # type: ignore[valid-type]
        _check_model_permissions(request, model_class, "DELETE")
        user = getattr(request.state, "user", None) or {}
        row = _get_rebac_record(record_id, session, user)
        if row is None:
            raise HTTPException(status_code=404, detail=f"{tablename} {record_id} not found")
        session.delete(row)
        session.commit()

    return router
