"""Storage and rules of the shared connection registry: connections, secrets, operations and usage selection."""
from __future__ import annotations

from typing import Any, Optional

from sqlmodel import Session, select

from veloiq_framework.utils.i18n_utils import _

from .connection_registry_models import Connection, ConnectionSecret, Operation, RestConnectionSettings, UsageSelection
from .connection_secret_encryption import encrypt_secret
from .registry_item_in_use_checks import ensure_item_is_not_in_use
from .registry_choice_values import (
    ENDPOINT_TYPES, MASKED_SECRET_VALUE, OPERATION_METHODS, OPERATION_SOURCES, REST_AUTHENTICATIONS_THAT_USE_OAUTH,
    SECRET_KEYS, USAGE_SELECTION_ITEM_KINDS, USAGES,
)

REST_ENDPOINT_TYPE = "rest_api"
API_OPERATION_ITEM_KIND = "api_operation"
CONNECTION_ITEM_KIND = "connection"
REST_SETTING_FIELDS = (
    "base_url", "authentication", "oauth_token_url", "oauth_client_id", "oauth_scope", "paging",
    "timeout_seconds", "is_tls_verified", "rate_limit_per_second",
    "user_name", "api_key_header_name", "api_key_query_parameter_name",
    "page_size", "page_size_parameter", "page_parameter", "first_page_number", "cursor_parameter", "next_cursor_path", "next_link_path", "maximum_pages",
)


class RegistryRuleError(Exception):
    """A value or an action the registry refuses; the message is meant for the administrator."""


def _require_allowed(value: str, allowed: tuple[str, ...], what: str) -> None:
    if value not in allowed:
        raise RegistryRuleError(_("{what} must be one of: {allowed}.").format(what=what, allowed=", ".join(allowed)))


# spec: manage-connections-with-secrets-and-a-connection-test :: Connection settings
def create_connection(session: Session, name: str, endpoint_type: str, is_enabled: bool = True,
                      rest_settings: Optional[dict[str, Any]] = None) -> Connection:
    """Create a connection with its settings and one usage selection row for each usage, all disabled."""
    name = (name or "").strip()
    if not name:
        raise RegistryRuleError(_("A connection needs a name."))
    _require_allowed(endpoint_type, ENDPOINT_TYPES, _("The endpoint type"))
    if session.exec(select(Connection).where(Connection.name == name)).first() is not None:
        raise RegistryRuleError(_("A connection named {name} already exists.").format(name=name))
    connection = Connection(name=name, endpoint_type=endpoint_type, is_enabled=is_enabled)
    if endpoint_type == REST_ENDPOINT_TYPE:
        connection.connection_has_rest_connection_settings.append(_build_rest_settings(rest_settings or {}))
    session.add(connection)
    session.commit()
    for usage in USAGES:
        session.add(UsageSelection(item_kind=CONNECTION_ITEM_KIND, item_id=connection.id, usage=usage, is_enabled=False))
    session.commit()
    return connection


def _build_rest_settings(values: dict[str, Any]) -> RestConnectionSettings:
    unknown = set(values) - set(REST_SETTING_FIELDS)
    if unknown:
        raise RegistryRuleError(_("Unknown REST setting: {name}.").format(name=sorted(unknown)[0]))
    if not str(values.get("base_url") or "").strip():
        raise RegistryRuleError(_("A REST connection needs the address of the API."))
    settings = RestConnectionSettings(**values)
    _check_rest_settings(settings)
    return settings


def _check_rest_settings(settings: RestConnectionSettings) -> None:
    from .registry_choice_values import REST_AUTHENTICATIONS, REST_PAGING_STYLES
    _require_allowed(settings.authentication, REST_AUTHENTICATIONS, _("The authentication"))
    _require_allowed(settings.paging, REST_PAGING_STYLES, _("The paging"))
    if settings.authentication in REST_AUTHENTICATIONS_THAT_USE_OAUTH and not (settings.oauth_token_url and settings.oauth_client_id):
        raise RegistryRuleError(_("OAuth needs the token address and the client identifier."))
    if not 1 <= settings.timeout_seconds <= 300:
        raise RegistryRuleError(_("The timeout is between 1 and 300 seconds."))
    if settings.authentication == "user_name_and_password" and not settings.user_name:
        raise RegistryRuleError(_("Basic authentication needs the user name."))
    if settings.authentication == "api_key_header" and not settings.api_key_header_name:
        raise RegistryRuleError(_("An API key sent in a header needs the name of the header."))
    if settings.authentication == "api_key_query" and not settings.api_key_query_parameter_name:
        raise RegistryRuleError(_("An API key sent in the query needs the name of the parameter."))
    paging_needs = {"offset": ("page_parameter",), "page_number": ("page_parameter",), "cursor": ("cursor_parameter", "next_cursor_path"),
                    "json_link": ("next_link_path",)}
    for needed in paging_needs.get(settings.paging, ()):
        if not getattr(settings, needed):
            raise RegistryRuleError(_("Paging by {paging} needs the setting {setting}.").format(paging=settings.paging, setting=needed))


def update_connection(session: Session, connection: Connection, values: dict[str, Any]) -> Connection:
    """Change the name, the enabled state or the REST settings of a connection (the endpoint type does not change)."""
    if "name" in values and values["name"] != connection.name:
        new_name = str(values["name"]).strip()
        if not new_name:
            raise RegistryRuleError(_("A connection needs a name."))
        if session.exec(select(Connection).where(Connection.name == new_name)).first() is not None:
            raise RegistryRuleError(_("A connection named {name} already exists.").format(name=new_name))
        connection.name = new_name
    if "is_enabled" in values:
        connection.is_enabled = bool(values["is_enabled"])
    if values.get("rest_settings") is not None:
        if connection.endpoint_type != REST_ENDPOINT_TYPE:
            raise RegistryRuleError(_("Only a REST connection has REST settings."))
        current = connection.connection_has_rest_connection_settings[0]
        for field_name, value in values["rest_settings"].items():
            if field_name not in REST_SETTING_FIELDS:
                raise RegistryRuleError(_("Unknown REST setting: {name}.").format(name=field_name))
            setattr(current, field_name, value)
        _check_rest_settings(current)
        session.add(current)
    session.add(connection)
    session.commit()
    return connection


def delete_connection(session: Session, connection: Connection) -> None:
    """Delete a connection with its secrets, settings, operations and usage selections.

    :raises RegistryRuleError: When a flow step uses the connection or one of its operations.
    """
    ensure_item_is_not_in_use(CONNECTION_ITEM_KIND, connection.id, connection.name)
    for operation in connection.connection_has_operation:
        ensure_item_is_not_in_use(API_OPERATION_ITEM_KIND, operation.id, operation.name)
    for operation in list(connection.connection_has_operation):
        _delete_operation_rows(session, operation)
    for child in (*connection.connection_has_connection_secret, *connection.connection_has_rest_connection_settings):
        session.delete(child)
    for selection in session.exec(select(UsageSelection).where(
            UsageSelection.item_kind == CONNECTION_ITEM_KIND, UsageSelection.item_id == connection.id)).all():
        session.delete(selection)
    session.delete(connection)
    session.commit()


# spec: manage-connections-with-secrets-and-a-connection-test :: Secrets handling
def set_connection_secret(session: Session, connection: Connection, key: str, plain_value: str) -> None:
    """Store a secret of a connection encrypted, replacing the one with the same key.

    :raises SecretKeyNotConfiguredError: When no encryption key is configured (nothing is stored).
    """
    _require_allowed(key, SECRET_KEYS, _("The secret key"))
    if not plain_value:
        raise RegistryRuleError(_("A secret needs a value."))
    encrypted_value = encrypt_secret(plain_value)
    existing = next((secret for secret in connection.connection_has_connection_secret if secret.key == key), None)
    if existing is not None:
        existing.value = encrypted_value
        session.add(existing)
    else:
        connection.connection_has_connection_secret.append(ConnectionSecret(key=key, value=encrypted_value))
        session.add(connection)
    session.commit()


def delete_connection_secret(session: Session, connection: Connection, key: str) -> bool:
    """Remove a secret of a connection; False when it has none with that key."""
    existing = next((secret for secret in connection.connection_has_connection_secret if secret.key == key), None)
    if existing is None:
        return False
    session.delete(existing)
    session.commit()
    return True


# spec: manage-connections-with-secrets-and-a-connection-test :: Secrets handling
def connection_to_dict(connection: Connection) -> dict[str, Any]:
    """A connection as the API returns it. A secret is shown as present and masked, never with its value."""
    rest = connection.connection_has_rest_connection_settings
    return {
        "id": connection.id,
        "name": connection.name,
        "endpoint_type": connection.endpoint_type,
        "is_enabled": connection.is_enabled,
        "rest_settings": {name: getattr(rest[0], name) for name in REST_SETTING_FIELDS} if rest else None,
        "secrets": [{"key": secret.key, "value": MASKED_SECRET_VALUE} for secret in connection.connection_has_connection_secret],
    }


def operation_to_dict(operation: Operation) -> dict[str, Any]:
    """An operation as the API returns it."""
    return {name: getattr(operation, name) for name in ("id", "name", "method", "path", "parameters_schema", "response_schema", "source", "description")}


# spec: import-and-record-api-operations :: Operation import
def add_operation(session: Session, connection: Connection, values: dict[str, Any]) -> Operation:
    """Record an operation under a connection, with one usage selection row for each usage, all disabled."""
    name = str(values.get("name") or "").strip()
    path = str(values.get("path") or "").strip()
    if not name or not path:
        raise RegistryRuleError(_("An operation needs a name and a path."))
    method = str(values.get("method") or "GET").upper()
    source = values.get("source") or "by_hand"
    _require_allowed(method, OPERATION_METHODS, _("The method"))
    _require_allowed(source, OPERATION_SOURCES, _("The source"))
    if any(existing.name == name for existing in connection.connection_has_operation):
        raise RegistryRuleError(_("The connection already has an operation named {name}.").format(name=name))
    operation = Operation(name=name, method=method, path=path, source=source, description=values.get("description"),
                          parameters_schema=values.get("parameters_schema"), response_schema=values.get("response_schema"))
    connection.connection_has_operation.append(operation)
    session.add(connection)
    session.commit()
    for usage in USAGES:
        session.add(UsageSelection(item_kind=API_OPERATION_ITEM_KIND, item_id=operation.id, usage=usage, is_enabled=False))
    session.commit()
    return operation


def update_operation(session: Session, operation: Operation, values: dict[str, Any]) -> Operation:
    """Change the fields of an operation."""
    if "method" in values:
        values = {**values, "method": str(values["method"]).upper()}
        _require_allowed(values["method"], OPERATION_METHODS, _("The method"))
    for field_name in ("name", "method", "path", "parameters_schema", "response_schema", "description"):
        if field_name in values:
            setattr(operation, field_name, values[field_name])
    session.add(operation)
    session.commit()
    return operation


def _delete_operation_rows(session: Session, operation: Operation) -> None:
    for selection in session.exec(select(UsageSelection).where(
            UsageSelection.item_kind == API_OPERATION_ITEM_KIND, UsageSelection.item_id == operation.id)).all():
        session.delete(selection)
    session.delete(operation)


def delete_operation(session: Session, operation: Operation) -> None:
    """Delete an operation with its usage selections.

    :raises RegistryRuleError: When a flow step uses the operation.
    """
    ensure_item_is_not_in_use(API_OPERATION_ITEM_KIND, operation.id, operation.name)
    _delete_operation_rows(session, operation)
    session.commit()


# spec: select-shared-items-per-usage :: Usage selection
def set_usage_selection(session: Session, item_kind: str, item_id: int, usage: str, is_enabled: bool) -> UsageSelection:
    """Enable or disable a usage for a shared item: one row for each item and usage, created when missing."""
    _require_allowed(item_kind, USAGE_SELECTION_ITEM_KINDS, _("The kind of item"))
    _require_allowed(usage, USAGES, _("The usage"))
    selection = session.exec(select(UsageSelection).where(
        UsageSelection.item_kind == item_kind, UsageSelection.item_id == item_id, UsageSelection.usage == usage)).first()
    if selection is None:
        selection = UsageSelection(item_kind=item_kind, item_id=item_id, usage=usage)
    selection.is_enabled = bool(is_enabled)
    session.add(selection)
    session.commit()
    return selection
