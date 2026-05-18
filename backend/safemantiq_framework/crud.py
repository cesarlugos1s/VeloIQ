"""Automatic CRUD router generation for SafeMantIQ modules.

The most common module pattern — a database table with standard list/get/
create/update/delete endpoints — can be expressed in two lines::

    from safemantiq_framework.crud import create_crud_router
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

from safemantiq_framework.db import get_session
from safemantiq_framework.models import get_pk_field_name

T = TypeVar("T", bound=SQLModel)


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

    # ── List ─────────────────────────────────────────────────────────────────

    @router.get("", summary=f"List {tablename}")
    def list_items(
        request: Request,
        _start: int = Query(0, alias="_start"),
        _end: int = Query(25, alias="_end"),
        session: Session = Depends(get_session),
    ):
        where_clauses = _build_where_clauses(model_class, request.query_params)
        count_stmt = select(func.count()).select_from(model_class)
        list_stmt = select(model_class)
        for clause in where_clauses:
            count_stmt = count_stmt.where(clause)
            list_stmt = list_stmt.where(clause)
        total = session.exec(count_stmt).one()
        rows = session.exec(list_stmt.offset(_start).limit(max(0, _end - _start))).all()
        return JSONResponse(
            content=jsonable_encoder([_to_dict(r) for r in rows]),
            headers={
                "x-total-count": str(total),
                "content-range": f"items {_start}-{min(_end, total)}/{total}",
            },
        )

    # ── Get one ───────────────────────────────────────────────────────────────

    @router.get("/{record_id}", summary=f"Get {tablename}")
    def get_item(record_id: pk_type, session: Session = Depends(get_session)):  # type: ignore[valid-type]
        row = session.get(model_class, record_id)
        if row is None:
            raise HTTPException(status_code=404, detail=f"{tablename} {record_id} not found")
        return _to_dict(row)

    # ── Create ────────────────────────────────────────────────────────────────

    @router.post("", status_code=201, summary=f"Create {tablename}")
    def create_item(payload: dict, session: Session = Depends(get_session)):
        payload.pop(pk_field, None)
        coerced = {k: _coerce_value(k, v) for k, v in payload.items()}
        row = model_class.model_validate(coerced)
        session.add(row)
        session.commit()
        session.refresh(row)
        return _to_dict(row)

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

    def _apply_update(record_id, payload, session):
        row = session.get(model_class, record_id)
        if row is None:
            raise HTTPException(status_code=404, detail=f"{tablename} {record_id} not found")
        payload.pop(pk_field, None)
        for key, value in payload.items():
            if key in _READONLY_FIELDS:
                continue
            if hasattr(row, key):
                setattr(row, key, _coerce_value(key, value))
        session.add(row)
        session.commit()
        session.refresh(row)
        return _to_dict(row)

    @router.put("/{record_id}", summary=f"Update {tablename}")
    def update_item(
        record_id: pk_type,  # type: ignore[valid-type]
        payload: dict,
        session: Session = Depends(get_session),
    ):
        return _apply_update(record_id, payload, session)

    @router.patch("/{record_id}", summary=f"Partial update {tablename}")
    def partial_update_item(
        record_id: pk_type,  # type: ignore[valid-type]
        payload: dict,
        session: Session = Depends(get_session),
    ):
        return _apply_update(record_id, payload, session)

    # ── Delete ────────────────────────────────────────────────────────────────

    @router.delete("/{record_id}", status_code=204, summary=f"Delete {tablename}")
    def delete_item(record_id: pk_type, session: Session = Depends(get_session)):  # type: ignore[valid-type]
        row = session.get(model_class, record_id)
        if row is None:
            raise HTTPException(status_code=404, detail=f"{tablename} {record_id} not found")
        session.delete(row)
        session.commit()

    return router
