"""Models of the shared connection registry: connections, their secrets, REST settings, operations and usage selection.

Names and fields follow the entity definitions of the Integration Hub specification (Connection, ConnectionSecret,
RestConnectionSettings, Operation, UsageSelection). Relations are link tables named ``veloiq_registry_<relation>_relation``
with ``eid_from`` and ``eid_to``, and an attribute on each side named with the full relation name.
"""
from typing import List, Optional

from sqlalchemy import Column, ForeignKey, Text, UniqueConstraint
from sqlmodel import Field, SQLModel

from veloiq_framework import jm_relationship, veloiq_field

from .registry_choice_values import (
    DATABASE_TYPES, DEFAULT_WEBHOOK_SIGNATURE_HEADER, ENDPOINT_TYPES, INBOUND_API_AUTHENTICATIONS, OPERATION_METHODS, OPERATION_SOURCES, REST_AUTHENTICATIONS, REST_PAGING_STYLES, SECRET_KEYS,
    USAGE_SELECTION_ITEM_KINDS, USAGES, WEBHOOK_DIRECTIONS,
)
from .registry_choice_values import DEFAULT_SFTP_PORT, FILE_FORMATS, FILE_LOCATIONS

# ___________________________________________________________________________
# 1. LINK MODELS (relation tables)
# ___________________________________________________________________________


def _link_column(target_table_and_column: str) -> Column:
    """Return a primary key link column that points to an entity's ``id``."""
    return Column(ForeignKey(target_table_and_column, ondelete="NO ACTION"), primary_key=True)


class connection_has_operation(SQLModel, table=True):
    """Link: Connection has Operation."""
    __tablename__ = "veloiq_registry_connection_has_operation_relation"
    __table_args__ = {"extend_existing": True}
    eid_from: int = Field(sa_column=_link_column("veloiq_registry_connection.id"))
    eid_to: int = Field(sa_column=_link_column("veloiq_registry_operation.id"))


class connection_has_connection_secret(SQLModel, table=True):
    """Link: Connection has ConnectionSecret."""
    __tablename__ = "veloiq_registry_connection_has_connection_secret_relation"
    __table_args__ = {"extend_existing": True}
    eid_from: int = Field(sa_column=_link_column("veloiq_registry_connection.id"))
    eid_to: int = Field(sa_column=_link_column("veloiq_registry_connection_secret.id"))


class connection_has_rest_connection_settings(SQLModel, table=True):
    """Link: Connection has RestConnectionSettings."""
    # Shorter than the relation name: a table name over 63 characters is silently truncated by PostgreSQL.
    __tablename__ = "veloiq_registry_connection_has_rest_settings_relation"
    __table_args__ = {"extend_existing": True}
    eid_from: int = Field(sa_column=_link_column("veloiq_registry_connection.id"))
    eid_to: int = Field(sa_column=_link_column("veloiq_registry_rest_connection_settings.id"))


class connection_has_database_connection_settings(SQLModel, table=True):
    """Link: Connection has DatabaseConnectionSettings."""
    # Shorter than the relation name: a table name over 63 characters is silently truncated by PostgreSQL.
    __tablename__ = "veloiq_registry_connection_has_database_settings_relation"
    __table_args__ = {"extend_existing": True}
    eid_from: int = Field(sa_column=_link_column("veloiq_registry_connection.id"))
    eid_to: int = Field(sa_column=_link_column("veloiq_registry_database_connection_settings.id"))


class connection_has_file_connection_settings(SQLModel, table=True):
    """Link: Connection has FileConnectionSettings."""
    # Shorter than the relation name: a table name over 63 characters is silently truncated by PostgreSQL.
    __tablename__ = "veloiq_registry_connection_has_file_settings_relation"
    __table_args__ = {"extend_existing": True}
    eid_from: int = Field(sa_column=_link_column("veloiq_registry_connection.id"))
    eid_to: int = Field(sa_column=_link_column("veloiq_registry_file_connection_settings.id"))


class connection_has_webhook_endpoint_settings(SQLModel, table=True):
    """Link: Connection has WebhookEndpointSettings."""
    # Shorter than the relation name: a table name over 63 characters is silently truncated by PostgreSQL.
    __tablename__ = "veloiq_registry_connection_has_webhook_settings_relation"
    __table_args__ = {"extend_existing": True}
    eid_from: int = Field(sa_column=_link_column("veloiq_registry_connection.id"))
    eid_to: int = Field(sa_column=_link_column("veloiq_registry_webhook_endpoint_settings.id"))


class connection_has_inbound_api_endpoint_settings(SQLModel, table=True):
    """Link: Connection has InboundApiEndpointSettings."""
    __tablename__ = "veloiq_registry_connection_has_inbound_api_settings_relation"
    __table_args__ = {"extend_existing": True}
    eid_from: int = Field(sa_column=_link_column("veloiq_registry_connection.id"))
    eid_to: int = Field(sa_column=_link_column("veloiq_registry_inbound_api_endpoint_settings.id"))


# ___________________________________________________________________________
# 2. ENTITIES
# ___________________________________________________________________________


class Connection(SQLModel, table=True):
    """A connection to another system, kept once and shared by the usages that are enabled for it."""
    __tablename__ = "veloiq_registry_connection"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True, description="Unique name of the connection")
    endpoint_type: str = veloiq_field(options=list(ENDPOINT_TYPES), description="Kind of endpoint")
    is_enabled: bool = Field(default=True, description="Whether flows can use it")

    connection_has_operation: List["Operation"] = jm_relationship(
        min_items=0, link_model=connection_has_operation, back_populates="connection_has_operation_reverse",
    )
    connection_has_connection_secret: List["ConnectionSecret"] = jm_relationship(
        min_items=0, link_model=connection_has_connection_secret, back_populates="connection_has_connection_secret_reverse",
    )
    connection_has_rest_connection_settings: List["RestConnectionSettings"] = jm_relationship(
        min_items=0, max_items=1, link_model=connection_has_rest_connection_settings,
        back_populates="connection_has_rest_connection_settings_reverse",
    )
    connection_has_database_connection_settings: List["DatabaseConnectionSettings"] = jm_relationship(
        min_items=0, max_items=1, link_model=connection_has_database_connection_settings,
        back_populates="connection_has_database_connection_settings_reverse",
    )
    connection_has_file_connection_settings: List["FileConnectionSettings"] = jm_relationship(
        min_items=0, max_items=1, link_model=connection_has_file_connection_settings,
        back_populates="connection_has_file_connection_settings_reverse",
    )
    connection_has_webhook_endpoint_settings: List["WebhookEndpointSettings"] = jm_relationship(
        min_items=0, max_items=1, link_model=connection_has_webhook_endpoint_settings,
        back_populates="connection_has_webhook_endpoint_settings_reverse",
    )
    connection_has_inbound_api_endpoint_settings: List["InboundApiEndpointSettings"] = jm_relationship(
        min_items=0, max_items=1, link_model=connection_has_inbound_api_endpoint_settings,
        back_populates="connection_has_inbound_api_endpoint_settings_reverse",
    )

    def __str__(self) -> str:
        return self.name or ""


class ConnectionSecret(SQLModel, table=True):
    """A credential of a connection. ``value`` holds the encrypted text; it is never returned by any API."""
    __tablename__ = "veloiq_registry_connection_secret"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = veloiq_field(options=list(SECRET_KEYS), description="What the secret is")
    value: str = Field(sa_column=Column(Text, nullable=False), description="The secret, encrypted; never shown or returned")

    connection_has_connection_secret_reverse: List["Connection"] = jm_relationship(
        min_items=1, max_items=1, required=True, link_model=connection_has_connection_secret,
        back_populates="connection_has_connection_secret",
    )


class RestConnectionSettings(SQLModel, table=True):
    """Settings of a connection whose endpoint type is rest_api."""
    __tablename__ = "veloiq_registry_rest_connection_settings"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = Field(default=None, primary_key=True)
    base_url: str = Field(description="Address of the API")
    authentication: str = veloiq_field(default="none", options=list(REST_AUTHENTICATIONS), description="How the connection authenticates")
    oauth_token_url: Optional[str] = Field(default=None, description="Address that issues OAuth tokens")
    oauth_client_id: Optional[str] = Field(default=None, description="OAuth client identifier")
    oauth_scope: Optional[str] = Field(default=None, description="OAuth scope")
    paging: str = veloiq_field(default="none", options=list(REST_PAGING_STYLES), description="How results are paged")
    timeout_seconds: int = Field(default=30, ge=1, le=300, description="Seconds to wait for an answer")
    is_tls_verified: bool = Field(default=True, description="Check the server certificate")
    rate_limit_per_second: Optional[int] = Field(default=None, ge=1, description="Most calls per second")
    user_name: Optional[str] = Field(default=None, description="User name of basic authentication")
    api_key_header_name: Optional[str] = Field(default="X-API-Key", description="Header that carries the API key")
    api_key_query_parameter_name: Optional[str] = Field(default="api_key", description="Query parameter that carries the API key")
    login_path: Optional[str] = Field(default=None, description="Path of the login call on the base address")
    login_user_field: Optional[str] = Field(default="username", description="Field of the login body that holds the user name")
    login_password_field: Optional[str] = Field(default="password", description="Field of the login body that holds the password")
    login_token_path: Optional[str] = Field(default="access_token", description="Where the answer to the login holds the token")
    page_size: Optional[int] = Field(default=100, ge=1, description="Records asked for in each page")
    page_size_parameter: Optional[str] = Field(default=None, description="Query parameter that carries the page size")
    page_parameter: Optional[str] = Field(default=None, description="Query parameter that moves to the next page: the offset or the page number")
    first_page_number: Optional[int] = Field(default=1, ge=0, description="Number of the first page")
    cursor_parameter: Optional[str] = Field(default=None, description="Query parameter that carries the cursor")
    next_cursor_path: Optional[str] = Field(default=None, description="Where the answer holds the cursor of the next page")
    next_link_path: Optional[str] = Field(default=None, description="Where the answer holds the address of the next page")
    maximum_pages: int = Field(default=100, ge=1, le=10000, description="Most pages one read follows")

    connection_has_rest_connection_settings_reverse: List["Connection"] = jm_relationship(
        min_items=1, max_items=1, required=True, link_model=connection_has_rest_connection_settings,
        back_populates="connection_has_rest_connection_settings",
    )


class DatabaseConnectionSettings(SQLModel, table=True):
    """Settings of a connection whose endpoint type is database. The password is a secret of the connection."""
    __tablename__ = "veloiq_registry_database_connection_settings"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = Field(default=None, primary_key=True)
    database_type: str = veloiq_field(options=list(DATABASE_TYPES), description="Kind of database")
    host: Optional[str] = Field(default=None, description="Database server")
    port: Optional[int] = Field(default=None, ge=1, le=65535, description="Database port; the usual one of the database type when empty")
    database_name: str = Field(description="Database to use (the file for SQLite and DuckDB)")
    username: Optional[str] = Field(default=None, description="Database user")
    is_read_only: bool = Field(default=True, description="Only reads are allowed")
    query_timeout_seconds: int = Field(default=60, ge=1, le=600, description="Seconds before a query stops")
    max_rows_per_run: int = Field(default=100000, ge=1, description="Most rows read in one run")
    cursor_column: Optional[str] = Field(default=None, description="Column that marks new and changed rows")

    connection_has_database_connection_settings_reverse: List["Connection"] = jm_relationship(
        min_items=1, max_items=1, required=True, link_model=connection_has_database_connection_settings,
        back_populates="connection_has_database_connection_settings",
    )


class FileConnectionSettings(SQLModel, table=True):
    """Settings of a connection whose endpoint type is file (a local folder) or sftp_folder. An SFTP password or private key is a secret of the connection."""
    __tablename__ = "veloiq_registry_file_connection_settings"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = Field(default=None, primary_key=True)
    location: str = veloiq_field(default="local_folder", options=list(FILE_LOCATIONS), description="Where the files are")
    folder_path: str = Field(description="Folder that holds the files")
    file_pattern: str = Field(default="*", description="Which files are used")
    format: str = veloiq_field(default="csv", options=list(FILE_FORMATS), description="File format")
    encoding: Optional[str] = Field(default="utf-8", description="Text encoding")
    delimiter: Optional[str] = Field(default=",", max_length=1, description="Separator of a CSV file")
    has_header: bool = Field(default=True, description="First row holds column names")
    host: Optional[str] = Field(default=None, description="SFTP server")
    port: Optional[int] = Field(default=None, ge=1, le=65535, description="SFTP port; 22 when empty")
    username: Optional[str] = Field(default=None, description="SFTP user")
    host_key_fingerprint: Optional[str] = Field(default=None, description="Expected fingerprint of the SFTP server")

    connection_has_file_connection_settings_reverse: List["Connection"] = jm_relationship(
        min_items=1, max_items=1, required=True, link_model=connection_has_file_connection_settings,
        back_populates="connection_has_file_connection_settings",
    )


class WebhookEndpointSettings(SQLModel, table=True):
    """Settings of a connection whose endpoint type is incoming_webhook or outgoing_webhook. The shared secret is the connection's ``signing_secret``."""
    __tablename__ = "veloiq_registry_webhook_endpoint_settings"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = Field(default=None, primary_key=True)
    direction: str = veloiq_field(default="incoming", options=list(WEBHOOK_DIRECTIONS), description="Whether the hub receives or sends")
    endpoint_name: Optional[str] = Field(default=None, unique=True, index=True, regex=r"^[a-z0-9-]+$", description="Name used in the address of an incoming webhook")
    target_url: Optional[str] = Field(default=None, description="Where an outgoing webhook is sent")
    signature_header: str = Field(default=DEFAULT_WEBHOOK_SIGNATURE_HEADER, description="Header that carries the signature")
    event_types: Optional[str] = Field(default="all", description="Events an outgoing webhook sends")

    connection_has_webhook_endpoint_settings_reverse: List["Connection"] = jm_relationship(
        min_items=1, max_items=1, required=True, link_model=connection_has_webhook_endpoint_settings,
        back_populates="connection_has_webhook_endpoint_settings",
    )


class InboundApiEndpointSettings(SQLModel, table=True):
    """Settings of a connection whose endpoint type is incoming_api_endpoint. An API key is the connection's ``api_key`` secret."""
    __tablename__ = "veloiq_registry_inbound_api_endpoint_settings"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = Field(default=None, primary_key=True)
    endpoint_name: str = Field(unique=True, index=True, regex=r"^[a-z0-9-]+$", description="Name used in the address")
    authentication: str = veloiq_field(default="hub_token", options=list(INBOUND_API_AUTHENTICATIONS), description="How senders authenticate")
    max_records_per_push: int = Field(default=1000, ge=1, le=1000, description="Most records in one push")

    connection_has_inbound_api_endpoint_settings_reverse: List["Connection"] = jm_relationship(
        min_items=1, max_items=1, required=True, link_model=connection_has_inbound_api_endpoint_settings,
        back_populates="connection_has_inbound_api_endpoint_settings",
    )


class Operation(SQLModel, table=True):
    """One call a connection offers."""
    __tablename__ = "veloiq_registry_operation"
    __table_args__ = {"extend_existing": True}

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(description="Name of the operation")
    method: str = veloiq_field(default="GET", options=list(OPERATION_METHODS), description="HTTP method")
    path: str = Field(description="Path of the call")
    parameters_schema: Optional[str] = Field(default=None, sa_column=Column(Text), description="Parameters the call takes")
    response_schema: Optional[str] = Field(default=None, sa_column=Column(Text), description="What the call returns")
    source: str = veloiq_field(default="by_hand", options=list(OPERATION_SOURCES), description="How the operation was recorded")
    description: Optional[str] = Field(default=None, sa_column=Column(Text), description="What the operation does")

    connection_has_operation_reverse: List["Connection"] = jm_relationship(
        min_items=1, max_items=1, required=True, link_model=connection_has_operation, back_populates="connection_has_operation",
    )

    def __str__(self) -> str:
        return f"{self.method} {self.path}"


class UsageSelection(SQLModel, table=True):
    """Whether a usage (AI agents, the Integration Hub) may use a shared item; one row for each item and usage."""
    __tablename__ = "veloiq_registry_usage_selection"
    __table_args__ = (UniqueConstraint("item_kind", "item_id", "usage", name="uq_registry_usage_selection"), {"extend_existing": True})

    id: Optional[int] = Field(default=None, primary_key=True)
    item_kind: str = veloiq_field(options=list(USAGE_SELECTION_ITEM_KINDS), description="Kind of shared item")
    item_id: int = Field(description="The shared item")
    usage: str = veloiq_field(options=list(USAGES), description="Who may use the item")
    is_enabled: bool = Field(default=False, description="Whether the usage may use the item")
