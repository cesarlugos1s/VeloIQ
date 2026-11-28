"""Admin-only endpoints of the shared connection registry, under ``/api/registry``.

* ``GET/POST /registry/connections``, ``GET/PUT/DELETE /registry/connections/{id}``
* ``PUT/DELETE /registry/connections/{id}/secrets/{key}`` (a secret is written, never read back)
* ``GET/POST /registry/connections/{id}/operations``, ``PUT/DELETE /registry/operations/{id}``
* ``POST /registry/connections/{id}/operation-imports/preview`` (an address or the content of an OpenAPI description)
* ``POST /registry/connections/{id}/operation-imports`` (record the operations the administrator chose)
* ``GET /registry/usage-selections``, ``PUT /registry/usage-selections``

Only the Admin role may call them. Errors answer ``{"detail": "<message>"}`` with a status the caller can act on.
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Body, HTTPException, Request

from veloiq_framework.utils.i18n_utils import _


def make_connection_registry_router(cfg) -> APIRouter:
    """Return the registry router (mounted under ``/api``)."""
    from sqlmodel import Session, select

    from veloiq_framework.access.decision import ADMIN_ROLE
    from veloiq_framework.auth.utils import get_current_user
    from veloiq_framework.db import get_engine

    from . import connection_registry_store as store
    from .connection_registry_models import Connection, Operation, UsageSelection
    from .connection_secret_encryption import SecretKeyNotConfiguredError
    from .openapi_operation_import import OpenApiDescriptionError, fetch_openapi_description, list_operations_of_description

    router = APIRouter(tags=["connection-registry"])

    def _require_admin(request: Request) -> None:
        user = get_current_user(request, get_engine(), cfg.auth_secret)
        if ADMIN_ROLE not in (user.get("roles") or []):
            raise HTTPException(status_code=403, detail=_("You do not have permission to perform this action."))

    def _connection_or_404(session: Session, connection_id: int) -> Connection:
        connection = session.get(Connection, connection_id)
        if connection is None:
            raise HTTPException(status_code=404, detail=_("There is no connection with that identifier."))
        return connection

    def _operation_or_404(session: Session, operation_id: int) -> Operation:
        operation = session.get(Operation, operation_id)
        if operation is None:
            raise HTTPException(status_code=404, detail=_("There is no operation with that identifier."))
        return operation

    def _refuse(problem: Exception, status_code: int = 422):
        raise HTTPException(status_code=status_code, detail=str(problem))

    @router.get("/registry/connections")
    def list_connections(request: Request):
        _require_admin(request)
        with Session(get_engine()) as session:
            return [store.connection_to_dict(connection) for connection in session.exec(select(Connection).order_by(Connection.name)).all()]

    @router.post("/registry/connections", status_code=201)
    def create_connection(request: Request, body: dict[str, Any] = Body(...)):
        _require_admin(request)
        with Session(get_engine()) as session:
            try:
                connection = store.create_connection(session, body.get("name"), body.get("endpoint_type"),
                                                     body.get("is_enabled", True), body.get("rest_settings"))
            except store.RegistryRuleError as refusal:
                _refuse(refusal)
            return store.connection_to_dict(connection)

    @router.get("/registry/connections/{connection_id}")
    def read_connection(connection_id: int, request: Request):
        _require_admin(request)
        with Session(get_engine()) as session:
            return store.connection_to_dict(_connection_or_404(session, connection_id))

    @router.put("/registry/connections/{connection_id}")
    def update_connection(connection_id: int, request: Request, body: dict[str, Any] = Body(...)):
        _require_admin(request)
        with Session(get_engine()) as session:
            try:
                return store.connection_to_dict(store.update_connection(session, _connection_or_404(session, connection_id), body))
            except store.RegistryRuleError as refusal:
                _refuse(refusal)

    @router.delete("/registry/connections/{connection_id}", status_code=204)
    def delete_connection(connection_id: int, request: Request):
        _require_admin(request)
        with Session(get_engine()) as session:
            store.delete_connection(session, _connection_or_404(session, connection_id))

    @router.put("/registry/connections/{connection_id}/secrets/{key}", status_code=204)
    def write_secret(connection_id: int, key: str, request: Request, body: dict[str, Any] = Body(...)):
        _require_admin(request)
        with Session(get_engine()) as session:
            try:
                store.set_connection_secret(session, _connection_or_404(session, connection_id), key, str(body.get("value") or ""))
            except store.RegistryRuleError as refusal:
                _refuse(refusal)
            except SecretKeyNotConfiguredError as no_key:
                _refuse(no_key, 409)

    @router.delete("/registry/connections/{connection_id}/secrets/{key}", status_code=204)
    def remove_secret(connection_id: int, key: str, request: Request):
        _require_admin(request)
        with Session(get_engine()) as session:
            if not store.delete_connection_secret(session, _connection_or_404(session, connection_id), key):
                raise HTTPException(status_code=404, detail=_("The connection has no secret with that key."))

    @router.get("/registry/connections/{connection_id}/operations")
    def list_operations(connection_id: int, request: Request):
        _require_admin(request)
        with Session(get_engine()) as session:
            return [store.operation_to_dict(operation) for operation in _connection_or_404(session, connection_id).connection_has_operation]

    @router.post("/registry/connections/{connection_id}/operations", status_code=201)
    def create_operation(connection_id: int, request: Request, body: dict[str, Any] = Body(...)):
        _require_admin(request)
        with Session(get_engine()) as session:
            try:
                return store.operation_to_dict(store.add_operation(session, _connection_or_404(session, connection_id), body))
            except store.RegistryRuleError as refusal:
                _refuse(refusal)

    @router.put("/registry/operations/{operation_id}")
    def update_operation(operation_id: int, request: Request, body: dict[str, Any] = Body(...)):
        _require_admin(request)
        with Session(get_engine()) as session:
            try:
                return store.operation_to_dict(store.update_operation(session, _operation_or_404(session, operation_id), body))
            except store.RegistryRuleError as refusal:
                _refuse(refusal)

    @router.delete("/registry/operations/{operation_id}", status_code=204)
    def delete_operation(operation_id: int, request: Request):
        _require_admin(request)
        with Session(get_engine()) as session:
            store.delete_operation(session, _operation_or_404(session, operation_id))

    # spec: import-api-operations-through-a-guided-wizard :: Import wizard
    # spec: import-api-operations-through-a-guided-wizard :: Unreachable address
    @router.post("/registry/connections/{connection_id}/operation-imports/preview")
    def preview_operation_import(connection_id: int, request: Request, body: dict[str, Any] = Body(...)):
        """List the operations of an OpenAPI description given as an address or as its content; nothing is recorded."""
        _require_admin(request)
        with Session(get_engine()) as session:
            _connection_or_404(session, connection_id)
        try:
            content = body.get("content") or fetch_openapi_description(str(body.get("address") or ""))
            return {"operations": list_operations_of_description(content)}
        except OpenApiDescriptionError as unreadable:
            _refuse(unreadable)

    @router.post("/registry/connections/{connection_id}/operation-imports", status_code=201)
    def record_imported_operations(connection_id: int, request: Request, body: dict[str, Any] = Body(...)):
        """Record the operations the administrator chose; one already recorded under that name is reported and skipped."""
        _require_admin(request)
        recorded, skipped = [], []
        with Session(get_engine()) as session:
            connection = _connection_or_404(session, connection_id)
            for chosen in body.get("operations") or []:
                try:
                    recorded.append(store.operation_to_dict(store.add_operation(session, connection, chosen)))
                except store.RegistryRuleError as refusal:
                    skipped.append({"name": chosen.get("name"), "reason": str(refusal)})
        return {"recorded": recorded, "skipped": skipped}

    @router.get("/registry/usage-selections")
    def list_usage_selections(request: Request, item_kind: Optional[str] = None, item_id: Optional[int] = None):
        _require_admin(request)
        with Session(get_engine()) as session:
            query = select(UsageSelection)
            if item_kind:
                query = query.where(UsageSelection.item_kind == item_kind)
            if item_id is not None:
                query = query.where(UsageSelection.item_id == item_id)
            return [{"id": row.id, "item_kind": row.item_kind, "item_id": row.item_id, "usage": row.usage, "is_enabled": row.is_enabled}
                    for row in session.exec(query).all()]

    @router.put("/registry/usage-selections")
    def write_usage_selection(request: Request, body: dict[str, Any] = Body(...)):
        _require_admin(request)
        with Session(get_engine()) as session:
            try:
                row = store.set_usage_selection(session, body.get("item_kind"), int(body.get("item_id") or 0), body.get("usage"), bool(body.get("is_enabled")))
            except store.RegistryRuleError as refusal:
                _refuse(refusal)
            return {"id": row.id, "item_kind": row.item_kind, "item_id": row.item_id, "usage": row.usage, "is_enabled": row.is_enabled}

    return router
