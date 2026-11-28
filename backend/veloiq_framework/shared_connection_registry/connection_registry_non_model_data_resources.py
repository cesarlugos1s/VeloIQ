"""The shared registry as four non-model data resources, so it is managed with the framework's standard lists, side panels and record pages.

* ``veloiq_registry_connections``: connections with the settings of a REST connection; its record page has the operations, secrets
  and usage of the connection as relation tabs.
* ``veloiq_registry_operations``: the operations of every connection.
* ``veloiq_registry_secrets``: the secrets of every connection; the value is written, never shown (the list shows it masked).
* ``veloiq_registry_usage``: which usages may use each connection and each operation, with a switch for each.

The rows are read and written through the registry store, so the rules of the registry (unique names, allowed values, encrypted
secrets, usage rows) are the same as through ``/api/registry``. Only an administrator may use them.
"""
from __future__ import annotations

from typing import Any, Callable

from fastapi import HTTPException
from sqlmodel import Session, select

from veloiq_framework.utils.i18n_utils import _
from veloiq_framework.non_model_data_resources import (
    DataSourceRequestContext, NonModelDataField, NonModelDataRelation, NonModelDataResource, PythonFunctionsDataSource, decode_eid, encode_eid,
)

from . import connection_registry_store as store
from .connection_registry_models import Connection, ConnectionSecret, Operation, UsageSelection
from .connection_secret_encryption import SecretCannotBeDecryptedError, SecretKeyNotConfiguredError
from .registry_choice_values import (
    ENDPOINT_TYPES, MASKED_SECRET_VALUE, OPERATION_METHODS, OPERATION_SOURCES, REST_AUTHENTICATIONS, REST_PAGING_STYLES, SECRET_KEYS, USAGES,
)

CONNECTIONS_RESOURCE_NAME = "veloiq_registry_connections"
OPERATIONS_RESOURCE_NAME = "veloiq_registry_operations"
SECRETS_RESOURCE_NAME = "veloiq_registry_secrets"
USAGE_RESOURCE_NAME = "veloiq_registry_usage"
REGISTRY_MODULE_NAME = "veloiq_registry"


def _session() -> Session:
    from veloiq_framework.db import get_engine
    return Session(get_engine())


def _require_admin(request: Any, action: str) -> None:
    """Only an administrator may read or change the registry (the user is the one the authentication middleware found for the request)."""
    import os
    from veloiq_framework.access.decision import ADMIN_ROLE

    if os.environ.get("VELOIQ_AUTH_DISABLED", "") in ("1", "true", "True"):
        return
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail=_("Authentication required"))
    if ADMIN_ROLE not in ((user.get("roles") or []) if isinstance(user, dict) else []):
        raise HTTPException(status_code=403, detail=_("You do not have permission to perform this action."))


def _refused(problem: Exception, status_code: int = 422) -> HTTPException:
    return HTTPException(status_code=status_code, detail=str(problem))


def _guarded(action: Callable[[], Any]) -> Any:
    """Run an action on the store, turning a refusal of the registry into an answer the caller can show."""
    try:
        return action()
    except store.RegistryRuleError as refusal:
        raise _refused(refusal)
    except (SecretKeyNotConfiguredError, SecretCannotBeDecryptedError) as no_key:
        raise _refused(no_key, 409)


# ---------------------------------------------------------------------------------------------------------------------
# Connections
# ---------------------------------------------------------------------------------------------------------------------

def _connection_row(connection: Connection) -> dict[str, Any]:
    rest = connection.connection_has_rest_connection_settings
    row: dict[str, Any] = {"id": connection.id, "name": connection.name, "endpoint_type": connection.endpoint_type, "is_enabled": connection.is_enabled}
    row.update({field: (getattr(rest[0], field) if rest else None) for field in store.REST_SETTING_FIELDS})
    return row


def _rest_settings_of_row(row: dict) -> dict[str, Any]:
    """The REST settings a row holds (the ones that have a value), as the store takes them."""
    return {field: row[field] for field in store.REST_SETTING_FIELDS if row.get(field) not in (None, "")}


def _load_connections(_context: DataSourceRequestContext) -> list[dict]:
    with _session() as session:
        return [_connection_row(connection) for connection in session.exec(select(Connection).order_by(Connection.name)).all()]


def _create_connection(_context: DataSourceRequestContext, row: dict) -> dict:
    with _session() as session:
        connection = _guarded(lambda: store.create_connection(session, row.get("name"), row.get("endpoint_type"), row.get("is_enabled", True),
                                                              _rest_settings_of_row(row) if row.get("endpoint_type") == store.REST_ENDPOINT_TYPE else None))
        return _connection_row(connection)


def _update_connection(_context: DataSourceRequestContext, eid: str, row: dict) -> dict:
    with _session() as session:
        connection = session.get(Connection, int(eid))
        if connection is None:
            raise HTTPException(status_code=404, detail=_("There is no connection with that identifier."))
        if row.get("endpoint_type") and row["endpoint_type"] != connection.endpoint_type:
            raise HTTPException(status_code=422, detail=_("The endpoint type of a connection does not change."))
        values: dict[str, Any] = {"name": row.get("name"), "is_enabled": row.get("is_enabled", connection.is_enabled)}
        if connection.endpoint_type == store.REST_ENDPOINT_TYPE:
            values["rest_settings"] = {field: (row.get(field) if row.get(field) != "" else None) for field in store.REST_SETTING_FIELDS if field in row}
        return _connection_row(_guarded(lambda: store.update_connection(session, connection, values)))


def _delete_connection(_context: DataSourceRequestContext, eid: str) -> None:
    with _session() as session:
        connection = session.get(Connection, int(eid))
        if connection is not None:
            store.delete_connection(session, connection)


def build_connections_non_model_data_resource() -> NonModelDataResource:
    """The connections of the registry, with the settings of a REST connection."""
    return NonModelDataResource(
        name=CONNECTIONS_RESOURCE_NAME, label="Connections", module=REGISTRY_MODULE_NAME, pk_fields=["id"], title_fields=["name"], source_generates_keys=True,
        description="Connections to other systems, shared by AI agents and the Integration Hub.",
        fields=[
            NonModelDataField(key="id", label="ID", type="number", read_only=True, show_in_list=False),
            NonModelDataField(key="name", label="Name", required=True),
            NonModelDataField(key="endpoint_type", label="Endpoint Type", required=True, options=list(ENDPOINT_TYPES), default="rest_api"),
            NonModelDataField(key="is_enabled", label="Enabled", type="boolean", default=True),
            NonModelDataField(key="base_url", label="Base URL", description=_("Address of the API (a REST connection).")),
            NonModelDataField(key="authentication", label="Authentication", options=list(REST_AUTHENTICATIONS), default="none"),
            NonModelDataField(key="oauth_token_url", label="OAuth Token URL", show_in_list=False),
            NonModelDataField(key="oauth_client_id", label="OAuth Client ID", show_in_list=False),
            NonModelDataField(key="oauth_scope", label="OAuth Scope", show_in_list=False),
            NonModelDataField(key="paging", label="Paging", options=list(REST_PAGING_STYLES), default="none", show_in_list=False),
            NonModelDataField(key="timeout_seconds", label="Timeout (seconds)", type="number", integer=True, default=30, show_in_list=False),
            NonModelDataField(key="is_tls_verified", label="Verify TLS Certificate", type="boolean", default=True, show_in_list=False),
            NonModelDataField(key="rate_limit_per_second", label="Rate Limit (per second)", type="number", integer=True, show_in_list=False),
        ],
        relations=[
            NonModelDataRelation(OPERATIONS_RESOURCE_NAME, "connection_id", "Operations"),
            NonModelDataRelation(SECRETS_RESOURCE_NAME, "connection_id", "Secrets"),
            NonModelDataRelation(USAGE_RESOURCE_NAME, "connection_id", "Usage"),
        ],
        data_source=PythonFunctionsDataSource(_load_connections, create_row_function=_create_connection,
                                              update_row_function=_update_connection, delete_row_function=_delete_connection),
        access_check=_require_admin,
    )


# ---------------------------------------------------------------------------------------------------------------------
# Operations
# ---------------------------------------------------------------------------------------------------------------------

def _operation_row(operation: Operation) -> dict[str, Any]:
    return {"id": operation.id, "connection_id": operation.connection_has_operation_reverse[0].id, **{
        field: getattr(operation, field) for field in ("name", "method", "path", "description", "source", "parameters_schema", "response_schema")}}


def _load_operations(_context: DataSourceRequestContext) -> list[dict]:
    with _session() as session:
        return [_operation_row(operation) for operation in session.exec(select(Operation).order_by(Operation.id)).all()]


def _create_operation(_context: DataSourceRequestContext, row: dict) -> dict:
    with _session() as session:
        connection = session.get(Connection, int(row.get("connection_id") or 0))
        if connection is None:
            raise HTTPException(status_code=422, detail=_("An operation needs a connection."))
        return _operation_row(_guarded(lambda: store.add_operation(session, connection, row)))


def _update_operation(_context: DataSourceRequestContext, eid: str, row: dict) -> dict:
    with _session() as session:
        operation = session.get(Operation, int(eid))
        if operation is None:
            raise HTTPException(status_code=404, detail=_("There is no operation with that identifier."))
        values = {field: row[field] for field in ("name", "method", "path", "description", "parameters_schema", "response_schema") if field in row}
        return _operation_row(_guarded(lambda: store.update_operation(session, operation, values)))


def _delete_operation(_context: DataSourceRequestContext, eid: str) -> None:
    with _session() as session:
        operation = session.get(Operation, int(eid))
        if operation is not None:
            store.delete_operation(session, operation)


def build_operations_non_model_data_resource() -> NonModelDataResource:
    """The operations of every connection."""
    return NonModelDataResource(
        name=OPERATIONS_RESOURCE_NAME, label="Operations", module=REGISTRY_MODULE_NAME, pk_fields=["id"], title_fields=["method", "path"], source_generates_keys=True,
        description="The calls a connection offers.",
        fields=[
            NonModelDataField(key="id", label="ID", type="number", read_only=True, show_in_list=False),
            NonModelDataField(key="connection_id", label="Connection", type="number", integer=True, required=True, reference=CONNECTIONS_RESOURCE_NAME),
            NonModelDataField(key="name", label="Name", required=True),
            NonModelDataField(key="method", label="Method", required=True, options=list(OPERATION_METHODS), default="GET"),
            NonModelDataField(key="path", label="Path", required=True),
            # Written when an operation is recorded (an import or a discovery sets it); a change of an operation leaves it as it is.
            NonModelDataField(key="source", label="Source", options=list(OPERATION_SOURCES), default="by_hand"),
            NonModelDataField(key="description", label="Description", show_in_list=False),
            NonModelDataField(key="parameters_schema", label="Parameters", show_in_list=False),
            NonModelDataField(key="response_schema", label="Output", show_in_list=False),
        ],
        data_source=PythonFunctionsDataSource(_load_operations, create_row_function=_create_operation,
                                              update_row_function=_update_operation, delete_row_function=_delete_operation),
        access_check=_require_admin,
    )


# ---------------------------------------------------------------------------------------------------------------------
# Secrets
# ---------------------------------------------------------------------------------------------------------------------

def _secret_row(connection_id: int, secret: ConnectionSecret) -> dict[str, Any]:
    """A secret as a row: its value is always the mask, so nothing that is stored is ever shown."""
    return {"connection_id": connection_id, "key": secret.key, "value": MASKED_SECRET_VALUE}


def _load_secrets(_context: DataSourceRequestContext) -> list[dict]:
    with _session() as session:
        return [_secret_row(connection.id, secret) for connection in session.exec(select(Connection).order_by(Connection.name)).all()
                for secret in connection.connection_has_connection_secret]


def _write_secret(session: Session, row: dict) -> dict:
    connection = session.get(Connection, int(row.get("connection_id") or 0))
    if connection is None:
        raise HTTPException(status_code=422, detail=_("A secret needs a connection."))
    value = str(row.get("value") or "")
    if value in ("", MASKED_SECRET_VALUE):
        raise HTTPException(status_code=422, detail=_("A secret needs a value."))
    _guarded(lambda: store.set_connection_secret(session, connection, row.get("key"), value))
    return {"connection_id": connection.id, "key": row["key"], "value": MASKED_SECRET_VALUE}


def _create_secret(_context: DataSourceRequestContext, row: dict) -> dict:
    with _session() as session:
        return _write_secret(session, row)


def _update_secret(_context: DataSourceRequestContext, eid: str, row: dict) -> dict:
    connection_id, key = decode_eid(eid, 2)
    with _session() as session:
        return _write_secret(session, {**row, "connection_id": int(connection_id), "key": key})


def _delete_secret(_context: DataSourceRequestContext, eid: str) -> None:
    connection_id, key = decode_eid(eid, 2)
    with _session() as session:
        connection = session.get(Connection, int(connection_id))
        if connection is not None:
            store.delete_connection_secret(session, connection, key)


def build_secrets_non_model_data_resource() -> NonModelDataResource:
    """The secrets of every connection; the value is written, never shown."""
    return NonModelDataResource(
        name=SECRETS_RESOURCE_NAME, label="Secrets", module=REGISTRY_MODULE_NAME, pk_fields=["connection_id", "key"], title_fields=["key"],
        description="The credentials of a connection. A value is stored encrypted and never shown again.",
        fields=[
            NonModelDataField(key="connection_id", label="Connection", type="number", integer=True, required=True, reference=CONNECTIONS_RESOURCE_NAME,
                              reference_key="id"),
            NonModelDataField(key="key", label="Key", required=True, options=list(SECRET_KEYS)),
            NonModelDataField(key="value", label="Value", required=True, description=_("Written only; a stored value is never shown.")),
        ],
        data_source=PythonFunctionsDataSource(_load_secrets, create_row_function=_create_secret,
                                              update_row_function=_update_secret, delete_row_function=_delete_secret),
        access_check=_require_admin,
    )


# ---------------------------------------------------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------------------------------------------------

def _load_usage(_context: DataSourceRequestContext) -> list[dict]:
    """A row for each connection and each operation and each usage, whether or not its selection row exists yet (a missing one is off)."""
    with _session() as session:
        enabled = {(row.item_kind, row.item_id, row.usage): row.is_enabled for row in session.exec(select(UsageSelection)).all()}
        rows: list[dict] = []
        for connection in session.exec(select(Connection).order_by(Connection.name)).all():
            items = [(store.CONNECTION_ITEM_KIND, connection.id, connection.name)] + [
                (store.API_OPERATION_ITEM_KIND, operation.id, f"{operation.method} {operation.path}") for operation in connection.connection_has_operation]
            for kind, item_id, label in items:
                for usage in USAGES:
                    rows.append({"item_kind": kind, "item_id": item_id, "usage": usage, "connection_id": connection.id, "item": label,
                                 "is_enabled": enabled.get((kind, item_id, usage), False)})
        return rows


def _update_usage(_context: DataSourceRequestContext, eid: str, row: dict) -> dict:
    item_kind, item_id, usage = decode_eid(eid, 3)
    with _session() as session:
        selection = _guarded(lambda: store.set_usage_selection(session, item_kind, int(item_id), usage, bool(row.get("is_enabled"))))
        return {**row, "item_kind": selection.item_kind, "item_id": selection.item_id, "usage": selection.usage, "is_enabled": selection.is_enabled}


def build_usage_non_model_data_resource() -> NonModelDataResource:
    """Which usages may use each connection and each operation."""
    return NonModelDataResource(
        name=USAGE_RESOURCE_NAME, label="Usage", module=REGISTRY_MODULE_NAME, pk_fields=["item_kind", "item_id", "usage"], title_fields=["item", "usage"],
        description="Who may use each connection and each operation: AI agents, the Integration Hub, or both.",
        fields=[
            NonModelDataField(key="item_kind", label="Kind", read_only=True, options=["connection", "api_operation"]),
            NonModelDataField(key="item_id", label="Item ID", type="number", integer=True, read_only=True, show_in_list=False),
            NonModelDataField(key="item", label="Item", read_only=True),
            NonModelDataField(key="usage", label="Usage", read_only=True, options=list(USAGES)),
            NonModelDataField(key="connection_id", label="Connection", type="number", integer=True, read_only=True, reference=CONNECTIONS_RESOURCE_NAME),
            NonModelDataField(key="is_enabled", label="Enabled", type="boolean"),
        ],
        data_source=PythonFunctionsDataSource(_load_usage, update_row_function=_update_usage),
        access_check=_require_admin,
        default_sort=("item", "asc"),
    )


def build_registry_non_model_data_resources() -> list[NonModelDataResource]:
    """Every non-model data resource of the registry, in the order they are mounted."""
    return [build_connections_non_model_data_resource(), build_operations_non_model_data_resource(),
            build_secrets_non_model_data_resource(), build_usage_non_model_data_resource()]
