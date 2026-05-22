"""FastAPI router factory for NamedQuery endpoints.

Each NamedQuery gets a router with:

* ``GET  /``        — paginated, filterable, sortable list
* ``GET  /{id}``    — single record
* ``PUT  /{id}``    — update primary-model fields only
* ``PATCH /{id}``   — partial update of primary-model fields only

Responses follow the same Refine/react-admin conventions used by the regular
CRUD router (``x-total-count``, ``content-range``, ``eid`` alias).
"""
from __future__ import annotations

import math
from typing import TYPE_CHECKING, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from sqlmodel import Session, func, select

from veloiq_framework.crud import (
    _check_model_permissions,
    _coerce_filter_value,
    _filter_write_payload,
    _get_user_roles,
    _sanitize,
)
from veloiq_framework.db import get_session
from veloiq_framework.models import get_pk_field_name

if TYPE_CHECKING:
    from veloiq_framework.queries import NamedQuery


def create_query_router(named_query: "NamedQuery") -> APIRouter:
    """Return an APIRouter with list/get/update endpoints for *named_query*.

    Parameters
    ----------
    named_query:
        A fully configured :class:`~veloiq_framework.queries.NamedQuery` instance.
    """
    q = named_query
    pk_field = get_pk_field_name(q.primary_model)
    primary_tablename = getattr(q.primary_model, "__tablename__", q.primary_model.__name__.lower())

    router = APIRouter(prefix=f"/{q.name}", tags=[q.name])

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _rbac_check(request: Request) -> None:
        """Raise 403 if any participating model denies the GET action."""
        for model_cls in q.participating_models:
            _check_model_permissions(request, model_cls, "GET")

    def _build_query_filters(query_params) -> list:
        """Return WHERE clauses matching query params to named-query fields."""
        clauses: list = []
        for key, value in query_params.items():
            if key.startswith("_") or value is None or value == "":
                continue
            field_def = next((f for f in q.fields if f.key == key), None)
            if field_def is None:
                # Also allow filtering by the PK field directly (for relation tab scoping).
                if key == pk_field:
                    pk_col = getattr(q.primary_model, pk_field, None)
                    if pk_col is not None:
                        from sqlalchemy import types as sa_types
                        try:
                            coerced = int(value)
                        except (ValueError, TypeError):
                            coerced = value
                        clauses.append(pk_col == coerced)
                continue
            src = field_def.source_model or q.primary_model
            attr_name = field_def.source_attr or field_def.key
            col = getattr(src, attr_name, None)
            if col is None:
                continue
            # Infer column type for coercion.
            try:
                from sqlalchemy.inspection import inspect as sa_inspect
                mapper = sa_inspect(src)
                sa_col = mapper.columns.get(attr_name)
                col_type = sa_col.type if sa_col is not None else None
            except Exception:
                col_type = None
            coerced = _coerce_filter_value(value, col_type) if col_type is not None else value
            src_col = getattr(src, attr_name)
            clauses.append(src_col == coerced)
        return clauses

    def _apply_sort(stmt, sort_field: str | None, sort_order: str | None):
        """Apply ORDER BY from query params, falling back to default_sort."""
        field_key = sort_field
        order = (sort_order or "asc").lower()
        if not field_key and q.default_sort:
            field_key, order = q.default_sort
        if not field_key:
            return stmt
        field_def = next((f for f in q.fields if f.key == field_key), None)
        if field_def is None:
            if field_key == pk_field:
                col = getattr(q.primary_model, pk_field, None)
                if col is not None:
                    return stmt.order_by(col.desc() if order == "desc" else col.asc())
            return stmt
        src = field_def.source_model or q.primary_model
        attr_name = field_def.source_attr or field_def.key
        col = getattr(src, attr_name, None)
        if col is None:
            return stmt
        return stmt.order_by(col.desc() if order == "desc" else col.asc())

    def _row_to_dict(row) -> dict:
        """Convert a SQLAlchemy Row to a plain dict including eid."""
        if hasattr(row, "_mapping"):
            data = dict(row._mapping)
        elif hasattr(row, "__dict__"):
            data = {k: v for k, v in row.__dict__.items() if not k.startswith("_")}
        else:
            data = dict(row)
        data = _sanitize(data)
        # eid is the primary model's PK value for this row.
        data["eid"] = data.get("id") or data.get(pk_field)
        return data

    # ------------------------------------------------------------------
    # GET / — list
    # ------------------------------------------------------------------

    @router.get("", summary=f"List {q.name}")
    def list_items(
        request: Request,
        _start: int = Query(0, alias="_start"),
        _end: int = Query(25, alias="_end"),
        _sort: str | None = Query(None, alias="_sort"),
        _order: str | None = Query(None, alias="_order"),
        session: Session = Depends(get_session),
    ):
        _rbac_check(request)
        user = getattr(request.state, "user", None) or {}

        base_stmt = q.query_factory(session, user)
        filter_clauses = _build_query_filters(request.query_params)
        for clause in filter_clauses:
            base_stmt = base_stmt.where(clause)

        # Count total matching rows via a subquery.
        try:
            subq = base_stmt.subquery()
            total = session.execute(select(func.count()).select_from(subq)).scalar_one()
        except Exception:
            # Fallback: fetch all and count in Python (less efficient but always works).
            total = len(session.execute(base_stmt).all())

        list_stmt = _apply_sort(base_stmt, _sort, _order)
        list_stmt = list_stmt.offset(_start).limit(max(0, _end - _start))
        rows = session.execute(list_stmt).all()
        content = [_row_to_dict(r) for r in rows]
        return JSONResponse(
            content=jsonable_encoder(content),
            headers={
                "x-total-count": str(total),
                "content-range": f"items {_start}-{min(_end, total)}/{total}",
            },
        )

    # ------------------------------------------------------------------
    # GET /{id} — single record
    # ------------------------------------------------------------------

    @router.get("/{record_id}", summary=f"Get {q.name}")
    def get_item(record_id: int, request: Request, session: Session = Depends(get_session)):
        _rbac_check(request)
        user = getattr(request.state, "user", None) or {}

        pk_col = getattr(q.primary_model, pk_field)
        stmt = q.query_factory(session, user).where(pk_col == record_id)
        row = session.execute(stmt).first()
        if row is None:
            raise HTTPException(status_code=404, detail=f"{q.name} {record_id} not found")
        return _row_to_dict(row)

    # ------------------------------------------------------------------
    # PUT / PATCH /{id} — update primary model only
    # ------------------------------------------------------------------

    def _apply_update(record_id: int, payload: dict, session: Session, user: dict):
        user_roles = user.get("roles", []) if user else []
        row = session.get(q.primary_model, record_id)
        if row is None:
            raise HTTPException(status_code=404, detail=f"{q.name} {record_id} not found")

        # Only pass through fields that belong to the primary model.
        primary_keys = {
            f.source_attr or f.key
            for f in q.fields
            if f.source_model is q.primary_model and not f.read_only
        }
        # Also map result-column key → source_attr for primary model fields.
        key_to_attr: dict[str, str] = {
            f.key: (f.source_attr or f.key)
            for f in q.fields
            if f.source_model is q.primary_model and not f.read_only
        }
        filtered: dict[str, Any] = {}
        for result_key, value in payload.items():
            attr_name = key_to_attr.get(result_key)
            if attr_name is None:
                continue
            filtered[attr_name] = value

        filtered.pop(pk_field, None)
        filtered = _filter_write_payload(filtered, q.primary_model, user_roles)

        _READONLY_FIELDS = {"created_at", "creation_date"}
        for attr_name, value in filtered.items():
            if attr_name in _READONLY_FIELDS:
                continue
            if hasattr(row, attr_name):
                setattr(row, attr_name, value)

        session.add(row)
        session.commit()
        session.refresh(row)

        # Re-run the named query to return the enriched row.
        pk_col = getattr(q.primary_model, pk_field)
        stmt = q.query_factory(session, user).where(pk_col == record_id)
        refreshed = session.execute(stmt).first()
        if refreshed is None:
            return _row_to_dict(row)
        return _row_to_dict(refreshed)

    @router.put("/{record_id}", summary=f"Update {q.name}")
    def update_item(
        record_id: int,
        payload: dict,
        request: Request,
        session: Session = Depends(get_session),
    ):
        for model_cls in q.participating_models:
            _check_model_permissions(request, model_cls, "PUT")
        return _apply_update(record_id, payload, session, getattr(request.state, "user", None) or {})

    @router.patch("/{record_id}", summary=f"Partial update {q.name}")
    def partial_update_item(
        record_id: int,
        payload: dict,
        request: Request,
        session: Session = Depends(get_session),
    ):
        for model_cls in q.participating_models:
            _check_model_permissions(request, model_cls, "PATCH")
        return _apply_update(record_id, payload, session, getattr(request.state, "user", None) or {})

    return router
