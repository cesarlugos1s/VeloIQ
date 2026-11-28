"""Admin-only endpoints of the shared connection registry, under ``/api/registry``.

* ``GET /registry/choices`` (the allowed values of the choice fields)
* ``GET/POST /registry/connections``, ``GET/PUT/DELETE /registry/connections/{id}``
* ``POST /registry/connections/{id}/test`` (a REST connection: a GET to its base address with its authentication; a database: a trivial read)
* ``PUT/DELETE /registry/connections/{id}/secrets/{key}`` (a secret is written, never read back)
* ``GET/POST /registry/connections/{id}/operations``, ``GET /registry/operations`` (all, with their connection; ``?method=GET``),
  ``GET/PUT/DELETE /registry/operations/{id}`` (a read shows the connection too)
* ``POST /registry/connections/{id}/operation-imports/preview`` (an address or the content of an OpenAPI description)
* ``POST /registry/connections/{id}/operation-imports`` (record the operations the administrator chose)
* ``POST /registry/openapi-previews`` (the operations of an OpenAPI description, before a connection is chosen)
* ``POST /registry/operation-discoveries`` (work out an operation from a URL)
* ``POST /registry/operations/{id}/tests`` (send an operation; a write method needs confirmation)
* ``POST /registry/operations/{id}/response-schema-from-sample`` (learn the output from a test)
* ``GET /registry/usage-selections``, ``PUT /registry/usage-selections``

Only the Admin role may call them. Errors answer ``{"detail": "<message>"}`` with a status the caller can act on.
"""
from __future__ import annotations

import json
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
    from .connection_secret_encryption import SecretCannotBeDecryptedError, SecretKeyNotConfiguredError
    from .connection_test_call import test_rest_connection
    from .database_connection_access import test_database_connection
    from .json_schema_from_sample import infer_json_schema
    from .operation_discovery_from_url import discover_operation_from_url
    from .operation_test_call import run_operation_test
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

    @router.get("/registry/choices")
    def read_allowed_values(request: Request):
        """The allowed values of the registry's choice fields (endpoint types, methods, authentications, paging styles, secret keys, usages)."""
        _require_admin(request)
        from . import registry_choice_values as values
        return {"endpoint_types": list(values.ENDPOINT_TYPES), "operation_methods": list(values.OPERATION_METHODS),
                "operation_sources": list(values.OPERATION_SOURCES), "secret_keys": list(values.SECRET_KEYS),
                "rest_authentications": list(values.REST_AUTHENTICATIONS), "rest_paging_styles": list(values.REST_PAGING_STYLES),
                "usages": list(values.USAGES), "database_types": list(values.DATABASE_TYPES),
                "database_usual_ports": values.DATABASE_USUAL_PORTS, "database_types_without_host": list(values.DATABASE_TYPES_WITHOUT_HOST),
                "oauth_authentications": list(values.REST_AUTHENTICATIONS_THAT_USE_OAUTH)}

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
                                                     body.get("is_enabled", True), body.get("rest_settings"), body.get("database_settings"))
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
            try:
                store.delete_connection(session, _connection_or_404(session, connection_id))
            except store.RegistryRuleError as in_use:
                _refuse(in_use, 409)

    # spec: manage-connections-with-secrets-and-a-connection-test :: Test a REST connection
    @router.post("/registry/connections/{connection_id}/test")
    def test_connection(connection_id: int, request: Request):
        """Test a connection: a GET to the base address of a REST connection, or a trivial read on a database; nothing is changed."""
        _require_admin(request)
        with Session(get_engine()) as session:
            try:
                connection = _connection_or_404(session, connection_id)
                if connection.endpoint_type == store.DATABASE_ENDPOINT_TYPE:
                    return test_database_connection(connection)
                return test_rest_connection(connection)
            except (store.RegistryRuleError, SecretKeyNotConfiguredError, SecretCannotBeDecryptedError) as refusal:
                _refuse(refusal)

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

    def _operation_with_connection(operation) -> dict[str, Any]:
        connection = operation.connection_has_operation_reverse[0]
        rest = connection.connection_has_rest_connection_settings
        return {**store.operation_to_dict(operation), "connection": {
            "id": connection.id, "name": connection.name, "endpoint_type": connection.endpoint_type,
            "is_enabled": connection.is_enabled, "base_url": rest[0].base_url if rest else None}}

    @router.get("/registry/operations")
    def list_all_operations(request: Request, method: Optional[str] = None):
        """Every operation of every connection, each with its connection (for a list to choose from); ``method`` keeps one HTTP method."""
        _require_admin(request)
        with Session(get_engine()) as session:
            query = select(Operation).order_by(Operation.id)
            if method:
                query = query.where(Operation.method == method.upper())
            return [_operation_with_connection(operation) for operation in session.exec(query).all()]

    @router.get("/registry/operations/{operation_id}")
    def read_operation(operation_id: int, request: Request):
        """One operation with the connection it belongs to (its name and, for a REST connection, the address of the API)."""
        _require_admin(request)
        with Session(get_engine()) as session:
            return _operation_with_connection(_operation_or_404(session, operation_id))

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
            try:
                store.delete_operation(session, _operation_or_404(session, operation_id))
            except store.RegistryRuleError as in_use:
                _refuse(in_use, 409)

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

    # spec: import-api-operations-through-a-guided-wizard :: Import wizard
    # spec: import-api-operations-through-a-guided-wizard :: Unreachable address
    @router.post("/registry/openapi-previews")
    def preview_openapi_description(request: Request, body: dict[str, Any] = Body(...)):
        """List the operations of an OpenAPI description (address or content) before a connection is chosen; nothing is recorded."""
        _require_admin(request)
        try:
            content = body.get("content") or fetch_openapi_description(str(body.get("address") or ""))
            return {"operations": list_operations_of_description(content)}
        except OpenApiDescriptionError as unreadable:
            _refuse(unreadable)

    # spec: discover-an-operation-from-a-url :: Discovery from a URL
    # spec: discover-an-operation-from-a-url :: Unreachable URL
    @router.post("/registry/operation-discoveries")
    def discover_operation(request: Request, body: dict[str, Any] = Body(...)):
        """Work out an operation from a URL (and an optional method); nothing is recorded until the administrator confirms."""
        _require_admin(request)
        try:
            return discover_operation_from_url(str(body.get("url") or ""), str(body.get("method") or "GET"))
        except ValueError as refusal:
            _refuse(refusal, 400)

    # spec: test-an-operation-from-the-registry :: Operation test
    # spec: test-an-operation-from-the-registry :: Confirmation for write operations
    @router.post("/registry/operations/{operation_id}/tests")
    def test_operation(operation_id: int, request: Request, body: dict[str, Any] = Body(default_factory=dict)):
        """Send an operation with the connection's authentication; a write method needs ``confirm_mutation``."""
        _require_admin(request)
        with Session(get_engine()) as session:
            operation = _operation_or_404(session, operation_id)
            try:
                return run_operation_test(operation.connection_has_operation_reverse[0], operation,
                                          body.get("sample_values") or {}, bool(body.get("confirm_mutation")))
            except (store.RegistryRuleError, SecretKeyNotConfiguredError, SecretCannotBeDecryptedError) as refusal:
                _refuse(refusal)

    # spec: test-an-operation-from-the-registry :: Learn the output from a test
    @router.post("/registry/operations/{operation_id}/response-schema-from-sample")
    def record_response_schema(operation_id: int, request: Request, body: dict[str, Any] = Body(...)):
        """Record the structure of a sample response (for example the body of a test) as the output schema of the operation."""
        _require_admin(request)
        if "sample" not in body:
            raise HTTPException(status_code=400, detail=_("Send the sample response as sample."))
        with Session(get_engine()) as session:
            operation = _operation_or_404(session, operation_id)
            return store.operation_to_dict(store.update_operation(
                session, operation, {"response_schema": json.dumps(infer_json_schema(body["sample"]), ensure_ascii=False)}))

    return router
