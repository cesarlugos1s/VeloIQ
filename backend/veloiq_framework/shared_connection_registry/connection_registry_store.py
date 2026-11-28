"""Storage and rules of the shared connection registry: connections, secrets, operations and usage selection."""
from __future__ import annotations

from typing import Any, Optional

from sqlmodel import Session, select

from veloiq_framework.utils.i18n_utils import _

from .connection_registry_models import (
    Connection, ConnectionSecret, DatabaseConnectionSettings, FileConnectionSettings, InboundApiEndpointSettings, Operation, RestConnectionSettings,
    UsageSelection, WebhookEndpointSettings,
)
from .connection_secret_encryption import encrypt_secret
from .registry_item_in_use_checks import ensure_item_is_not_in_use
from .registry_choice_values import (
    DATABASE_TYPES, DATABASE_TYPES_WITHOUT_HOST, ENDPOINT_NAME_PATTERN, FILE_FORMATS, FILE_LOCATIONS, ENDPOINT_TYPES, INBOUND_API_AUTHENTICATIONS, WEBHOOK_DIRECTIONS, MASKED_SECRET_VALUE, OPERATION_METHODS, OPERATION_SOURCES, REST_AUTHENTICATIONS_THAT_USE_OAUTH,
    SECRET_KEYS, USAGE_SELECTION_ITEM_KINDS, USAGES,
)

REST_ENDPOINT_TYPE = "rest_api"
DATABASE_ENDPOINT_TYPE = "database"
FILE_ENDPOINT_TYPE = "file"
SFTP_ENDPOINT_TYPE = "sftp_folder"
INCOMING_WEBHOOK_ENDPOINT_TYPE = "incoming_webhook"
OUTGOING_WEBHOOK_ENDPOINT_TYPE = "outgoing_webhook"
INBOUND_API_ENDPOINT_TYPE = "incoming_api_endpoint"
API_OPERATION_ITEM_KIND = "api_operation"
CONNECTION_ITEM_KIND = "connection"
REST_SETTING_FIELDS = (
    "base_url", "authentication", "oauth_token_url", "oauth_client_id", "oauth_scope", "paging",
    "timeout_seconds", "is_tls_verified", "rate_limit_per_second",
    "user_name", "api_key_header_name", "api_key_query_parameter_name",
    "page_size", "page_size_parameter", "page_parameter", "first_page_number", "cursor_parameter", "next_cursor_path", "next_link_path", "maximum_pages",
)
DATABASE_SETTING_FIELDS = (
    "database_type", "host", "port", "database_name", "username", "is_read_only", "query_timeout_seconds", "max_rows_per_run", "cursor_column",
)
FILE_SETTING_FIELDS = (
    "location", "folder_path", "file_pattern", "format", "encoding", "delimiter", "has_header", "host", "port", "username", "host_key_fingerprint",
)
ENDPOINT_TYPES_WITH_ENDPOINT_SETTINGS = (INCOMING_WEBHOOK_ENDPOINT_TYPE, OUTGOING_WEBHOOK_ENDPOINT_TYPE, INBOUND_API_ENDPOINT_TYPE)
WEBHOOK_SETTING_FIELDS = ("direction", "endpoint_name", "target_url", "signature_header", "event_types")
INBOUND_API_SETTING_FIELDS = ("endpoint_name", "authentication", "max_records_per_push")


class RegistryRuleError(Exception):
    """A value or an action the registry refuses; the message is meant for the administrator."""


def _require_allowed(value: str, allowed: tuple[str, ...], what: str) -> None:
    if value not in allowed:
        raise RegistryRuleError(_("{what} must be one of: {allowed}.").format(what=what, allowed=", ".join(allowed)))


# spec: manage-connections-with-secrets-and-a-connection-test :: Connection settings
def create_connection(session: Session, name: str, endpoint_type: str, is_enabled: bool = True,
                      rest_settings: Optional[dict[str, Any]] = None, database_settings: Optional[dict[str, Any]] = None,
                      endpoint_settings: Optional[dict[str, Any]] = None, file_settings: Optional[dict[str, Any]] = None) -> Connection:
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
    if endpoint_type == DATABASE_ENDPOINT_TYPE:
        connection.connection_has_database_connection_settings.append(_build_database_settings(database_settings or {}))
    if endpoint_type in (FILE_ENDPOINT_TYPE, SFTP_ENDPOINT_TYPE):
        connection.connection_has_file_connection_settings.append(_build_file_settings(endpoint_type, file_settings or {}))
    if endpoint_type in (INCOMING_WEBHOOK_ENDPOINT_TYPE, OUTGOING_WEBHOOK_ENDPOINT_TYPE):
        connection.connection_has_webhook_endpoint_settings.append(_build_webhook_settings(session, endpoint_type, endpoint_settings or {}))
    if endpoint_type == INBOUND_API_ENDPOINT_TYPE:
        connection.connection_has_inbound_api_endpoint_settings.append(_build_inbound_api_settings(session, endpoint_settings or {}))
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


def _build_database_settings(values: dict[str, Any]) -> DatabaseConnectionSettings:
    unknown = set(values) - set(DATABASE_SETTING_FIELDS)
    if unknown:
        raise RegistryRuleError(_("Unknown database setting: {name}.").format(name=sorted(unknown)[0]))
    settings = DatabaseConnectionSettings(**values)
    _check_database_settings(settings)
    return settings


# spec: read-from-databases-with-read-only-limits :: Supported databases
def _check_database_settings(settings: DatabaseConnectionSettings) -> None:
    """Refuse database settings that are missing something the database type needs or are outside their limits."""
    _require_allowed(settings.database_type, DATABASE_TYPES, _("The database type"))
    if not str(settings.database_name or "").strip():
        raise RegistryRuleError(_("A database connection needs the name of the database."))
    if settings.database_type not in DATABASE_TYPES_WITHOUT_HOST and not str(settings.host or "").strip():
        raise RegistryRuleError(_("A database connection needs the database server."))
    if settings.port is not None and not 1 <= settings.port <= 65535:
        raise RegistryRuleError(_("The port is between 1 and 65535."))
    if not 1 <= settings.query_timeout_seconds <= 600:
        raise RegistryRuleError(_("The query timeout is between 1 and 600 seconds."))
    if settings.max_rows_per_run < 1:
        raise RegistryRuleError(_("The most rows in one run is 1 or more."))


def _build_file_settings(endpoint_type: str, values: dict[str, Any]) -> FileConnectionSettings:
    unknown = set(values) - set(FILE_SETTING_FIELDS)
    if unknown:
        raise RegistryRuleError(_("Unknown file setting: {name}.").format(name=sorted(unknown)[0]))
    settings = FileConnectionSettings(**{"location": "sftp_folder" if endpoint_type == SFTP_ENDPOINT_TYPE else "local_folder", **values})
    _check_file_settings(endpoint_type, settings)
    return settings


# spec: read-and-write-files-and-sftp :: File formats and locations
def _check_file_settings(endpoint_type: str, settings: FileConnectionSettings) -> None:
    """Refuse file settings with an unknown format or location, a location that does not match the endpoint type, or what SFTP needs missing."""
    _require_allowed(settings.location, FILE_LOCATIONS, _("The location"))
    _require_allowed(settings.format, FILE_FORMATS, _("The file format"))
    if (settings.location == "sftp_folder") != (endpoint_type == SFTP_ENDPOINT_TYPE):
        raise RegistryRuleError(_("The location of the files does not match the endpoint type."))
    if not str(settings.folder_path or "").strip():
        raise RegistryRuleError(_("A file connection needs the folder that holds the files."))
    if not str(settings.file_pattern or "").strip():
        raise RegistryRuleError(_("A file connection needs a file name pattern."))
    if settings.format == "csv" and len(settings.delimiter or "") != 1:
        raise RegistryRuleError(_("The delimiter of a CSV file is one character."))
    if settings.port is not None and not 1 <= settings.port <= 65535:
        raise RegistryRuleError(_("The port is between 1 and 65535."))
    if settings.location == "sftp_folder":
        for needed, label in (("host", _("the SFTP server")), ("username", _("the SFTP user")), ("host_key_fingerprint", _("the fingerprint of the SFTP server"))):
            if not str(getattr(settings, needed) or "").strip():
                raise RegistryRuleError(_("An SFTP connection needs {what}.").format(what=label))


def _require_endpoint_name_that_is_free(session: Session, model: type, current: Any, endpoint_name: Optional[str]) -> None:
    """Refuse an endpoint name that is not lowercase letters, digits and hyphens, or that another endpoint of the same kind already has."""
    import re
    if not endpoint_name or not re.fullmatch(ENDPOINT_NAME_PATTERN, endpoint_name):
        raise RegistryRuleError(_("The endpoint name is lowercase letters, digits and hyphens."))
    other = session.exec(select(model).where(model.endpoint_name == endpoint_name)).first()
    if other is not None and other is not current:
        raise RegistryRuleError(_("An endpoint named {name} already exists.").format(name=endpoint_name))


def _build_webhook_settings(session: Session, endpoint_type: str, values: dict[str, Any]) -> WebhookEndpointSettings:
    unknown = set(values) - set(WEBHOOK_SETTING_FIELDS)
    if unknown:
        raise RegistryRuleError(_("Unknown webhook setting: {name}.").format(name=sorted(unknown)[0]))
    settings = WebhookEndpointSettings(**{"direction": "incoming" if endpoint_type == INCOMING_WEBHOOK_ENDPOINT_TYPE else "outgoing", **values})
    _check_webhook_settings(session, endpoint_type, settings)
    return settings


# spec: receive-inbound-webhooks :: Signed inbound webhook
def _check_webhook_settings(session: Session, endpoint_type: str, settings: WebhookEndpointSettings) -> None:
    """Refuse webhook settings that do not match the endpoint type or lack what their direction needs."""
    _require_allowed(settings.direction, WEBHOOK_DIRECTIONS, _("The direction"))
    if (settings.direction == "incoming") != (endpoint_type == INCOMING_WEBHOOK_ENDPOINT_TYPE):
        raise RegistryRuleError(_("The direction of the webhook does not match its endpoint type."))
    if not str(settings.signature_header or "").strip():
        raise RegistryRuleError(_("A webhook needs the header that carries the signature."))
    if settings.direction == "incoming":
        _require_endpoint_name_that_is_free(session, WebhookEndpointSettings, settings, settings.endpoint_name)
    elif not str(settings.target_url or "").strip():
        raise RegistryRuleError(_("An outgoing webhook needs the address it is sent to."))


def _build_inbound_api_settings(session: Session, values: dict[str, Any]) -> InboundApiEndpointSettings:
    unknown = set(values) - set(INBOUND_API_SETTING_FIELDS)
    if unknown:
        raise RegistryRuleError(_("Unknown inbound API setting: {name}.").format(name=sorted(unknown)[0]))
    settings = InboundApiEndpointSettings(**values)
    _check_inbound_api_settings(session, settings)
    return settings


# spec: receive-pushed-data-through-inbound-api-endpoints :: Inbound API endpoint
def _check_inbound_api_settings(session: Session, settings: InboundApiEndpointSettings) -> None:
    """Refuse inbound API settings with an invalid name, an unknown authentication or a push size outside 1 to 1000."""
    _require_endpoint_name_that_is_free(session, InboundApiEndpointSettings, settings, settings.endpoint_name)
    _require_allowed(settings.authentication, INBOUND_API_AUTHENTICATIONS, _("The authentication"))
    if not 1 <= settings.max_records_per_push <= 1000:
        raise RegistryRuleError(_("The most records in one push is between 1 and 1000."))


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
    if values.get("database_settings") is not None:
        if connection.endpoint_type != DATABASE_ENDPOINT_TYPE:
            raise RegistryRuleError(_("Only a database connection has database settings."))
        current_database = connection.connection_has_database_connection_settings[0]
        for field_name, value in values["database_settings"].items():
            if field_name not in DATABASE_SETTING_FIELDS:
                raise RegistryRuleError(_("Unknown database setting: {name}.").format(name=field_name))
            setattr(current_database, field_name, value)
        _check_database_settings(current_database)
        session.add(current_database)
    if values.get("file_settings") is not None:
        if connection.endpoint_type not in (FILE_ENDPOINT_TYPE, SFTP_ENDPOINT_TYPE):
            raise RegistryRuleError(_("Only a file or SFTP connection has file settings."))
        current_file = connection.connection_has_file_connection_settings[0]
        for field_name, value in values["file_settings"].items():
            if field_name not in FILE_SETTING_FIELDS:
                raise RegistryRuleError(_("Unknown file setting: {name}.").format(name=field_name))
            setattr(current_file, field_name, value)
        _check_file_settings(connection.endpoint_type, current_file)
        session.add(current_file)
    if values.get("endpoint_settings") is not None:
        if connection.endpoint_type in (INCOMING_WEBHOOK_ENDPOINT_TYPE, OUTGOING_WEBHOOK_ENDPOINT_TYPE):
            current_webhook = connection.connection_has_webhook_endpoint_settings[0]
            for field_name, value in values["endpoint_settings"].items():
                if field_name not in WEBHOOK_SETTING_FIELDS:
                    raise RegistryRuleError(_("Unknown webhook setting: {name}.").format(name=field_name))
                setattr(current_webhook, field_name, value)
            _check_webhook_settings(session, connection.endpoint_type, current_webhook)
            session.add(current_webhook)
        elif connection.endpoint_type == INBOUND_API_ENDPOINT_TYPE:
            current_inbound = connection.connection_has_inbound_api_endpoint_settings[0]
            for field_name, value in values["endpoint_settings"].items():
                if field_name not in INBOUND_API_SETTING_FIELDS:
                    raise RegistryRuleError(_("Unknown inbound API setting: {name}.").format(name=field_name))
                setattr(current_inbound, field_name, value)
            _check_inbound_api_settings(session, current_inbound)
            session.add(current_inbound)
        else:
            raise RegistryRuleError(_("Only a webhook or an inbound API connection has endpoint settings."))
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
    for child in (*connection.connection_has_connection_secret, *connection.connection_has_rest_connection_settings,
                  *connection.connection_has_database_connection_settings, *connection.connection_has_webhook_endpoint_settings,
                  *connection.connection_has_inbound_api_endpoint_settings, *connection.connection_has_file_connection_settings):
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
    database = connection.connection_has_database_connection_settings
    webhook = connection.connection_has_webhook_endpoint_settings
    inbound = connection.connection_has_inbound_api_endpoint_settings
    file_settings = connection.connection_has_file_connection_settings
    return {
        "id": connection.id,
        "name": connection.name,
        "endpoint_type": connection.endpoint_type,
        "is_enabled": connection.is_enabled,
        "rest_settings": {name: getattr(rest[0], name) for name in REST_SETTING_FIELDS} if rest else None,
        "database_settings": {name: getattr(database[0], name) for name in DATABASE_SETTING_FIELDS} if database else None,
        "file_settings": {name: getattr(file_settings[0], name) for name in FILE_SETTING_FIELDS} if file_settings else None,
        "endpoint_settings": ({name: getattr(webhook[0], name) for name in WEBHOOK_SETTING_FIELDS} if webhook
                              else {name: getattr(inbound[0], name) for name in INBOUND_API_SETTING_FIELDS} if inbound else None),
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


# spec: receive-inbound-webhooks :: Signed inbound webhook
def find_enabled_incoming_endpoint(session: Session, endpoint_type: str, endpoint_name: str) -> Optional[Connection]:
    """The enabled connection of an incoming webhook or an inbound API endpoint with that name; None when there is none."""
    if endpoint_type == INCOMING_WEBHOOK_ENDPOINT_TYPE:
        settings = session.exec(select(WebhookEndpointSettings).where(
            WebhookEndpointSettings.endpoint_name == endpoint_name, WebhookEndpointSettings.direction == "incoming")).first()
        connections = settings.connection_has_webhook_endpoint_settings_reverse if settings else []
    else:
        inbound = session.exec(select(InboundApiEndpointSettings).where(InboundApiEndpointSettings.endpoint_name == endpoint_name)).first()
        connections = inbound.connection_has_inbound_api_endpoint_settings_reverse if inbound else []
    return connections[0] if connections and connections[0].is_enabled else None
