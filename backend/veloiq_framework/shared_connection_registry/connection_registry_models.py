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
    ENDPOINT_TYPES, OPERATION_METHODS, OPERATION_SOURCES, REST_AUTHENTICATIONS, REST_PAGING_STYLES, SECRET_KEYS,
    USAGE_SELECTION_ITEM_KINDS, USAGES,
)

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
    __tablename__ = "veloiq_registry_connection_has_rest_connection_settings_relation"
    __table_args__ = {"extend_existing": True}
    eid_from: int = Field(sa_column=_link_column("veloiq_registry_connection.id"))
    eid_to: int = Field(sa_column=_link_column("veloiq_registry_rest_connection_settings.id"))


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

    connection_has_rest_connection_settings_reverse: List["Connection"] = jm_relationship(
        min_items=1, max_items=1, required=True, link_model=connection_has_rest_connection_settings,
        back_populates="connection_has_rest_connection_settings",
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
