"""Writing many operations and usage selection rows at once, for the packages that move or discover items in bulk.

IQVigilant records the 4,758 routes of an application as the operations of one connection and the Integration Hub asks which items are enabled
for it; both need functions that work on a list in a few commits, are repeatable, and never overwrite what a curator chose.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Iterable, Optional

from sqlmodel import Session, select

from .connection_registry_models import Connection, Operation, UsageSelection
from .connection_registry_store import (
    API_OPERATION_ITEM_KIND, CONNECTION_ITEM_KIND, USAGES, RegistryRuleError, create_connection, delete_operation,
)
from .registry_item_in_use_checks import names_of_what_uses_the_item

BATCH_SIZE = 500
APPLICATION_OWN_ROUTES_CONNECTION_NAME = "This application"
ROUTE_DISCOVERY_SOURCE = "route_discovery"


@dataclass
class OperationUpsertResult:
    """What an upsert of operations did: the operations by (method, path) and which were created, updated or found unchanged."""
    operation_ids: dict[tuple[str, str], int] = field(default_factory=dict)
    created: list[tuple[str, str]] = field(default_factory=list)
    updated: list[tuple[str, str]] = field(default_factory=list)
    unchanged: list[tuple[str, str]] = field(default_factory=list)


def find_or_create_connection(session: Session, name: str, endpoint_type: str, rest_settings: Optional[dict[str, Any]] = None,
                              database_settings: Optional[dict[str, Any]] = None) -> tuple[Connection, bool]:
    """The connection with that name, or a new one (disabled for every usage); the second value says whether it was created."""
    existing = session.exec(select(Connection).where(Connection.name == name)).first()
    if existing is not None:
        return existing, False
    return create_connection(session, name, endpoint_type, True, rest_settings, database_settings), True


# spec: migrate-iqvigilant-api-tools-into-the-registry :: The application's own routes are one connection
def upsert_operations(session: Session, connection: Connection, items: Iterable[dict[str, Any]], source: str,
                      enabled_usages_of_new: Callable[[dict[str, Any]], dict[str, bool]] | None = None) -> OperationUpsertResult:
    """Record operations under a connection, found again by method and path: a new one is added, one that changed is updated, one that did not is left.

    Each item has ``name``, ``method``, ``path`` and may have ``description``, ``parameters_schema`` and ``response_schema``. A new operation gets one
    selection row for each usage, enabled as ``enabled_usages_of_new(item)`` says (disabled for a usage it does not name); the rows of an operation
    that already exists are never touched. Changes are committed in batches.
    """
    existing_by_key = {(operation.method, operation.path): operation for operation in connection.connection_has_operation}
    names_in_use = {operation.name for operation in connection.connection_has_operation}
    result = OperationUpsertResult()
    pending = 0
    for item in items:
        method, path = str(item.get("method") or "GET").upper(), str(item.get("path") or "").strip()
        if not path:
            raise RegistryRuleError("An operation needs a path.")
        key = (method, path)
        operation = existing_by_key.get(key)
        new_values = {"description": item.get("description"), "parameters_schema": item.get("parameters_schema"), "response_schema": item.get("response_schema")}
        if operation is None:
            name = str(item.get("name") or f"{method} {path}")
            if name in names_in_use:
                raise RegistryRuleError(f"The connection already has an operation named {name}.")
            operation = Operation(name=name, method=method, path=path, source=source, **new_values)
            connection.connection_has_operation.append(operation)
            session.add(operation)
            names_in_use.add(name)
            existing_by_key[key] = operation
            result.created.append(key)
            pending += 1
            session.flush()
            enabled = enabled_usages_of_new(item) if enabled_usages_of_new else {}
            for usage in USAGES:
                session.add(UsageSelection(item_kind=API_OPERATION_ITEM_KIND, item_id=operation.id, usage=usage, is_enabled=bool(enabled.get(usage, False))))
        else:
            changed = False
            for field_name, value in new_values.items():
                if value is not None and getattr(operation, field_name) != value:
                    setattr(operation, field_name, value)
                    changed = True
            (result.updated if changed else result.unchanged).append(key)
            pending += 1 if changed else 0
        result.operation_ids[key] = operation.id
        if pending >= BATCH_SIZE:
            session.commit()
            pending = 0
    session.commit()
    return result


def remove_operations_not_listed(session: Session, connection: Connection, keys_to_keep: set[tuple[str, str]]) -> tuple[list[tuple[str, str]], list[tuple[str, str]]]:
    """Remove the operations of a connection that are not in ``keys_to_keep`` (method, path), except the ones something uses.

    :return: The keys removed and the keys kept because a flow or another user of the registry still uses them.
    """
    removed: list[tuple[str, str]] = []
    kept_in_use: list[tuple[str, str]] = []
    for operation in list(connection.connection_has_operation):
        key = (operation.method, operation.path)
        if key in keys_to_keep:
            continue
        if names_of_what_uses_the_item(API_OPERATION_ITEM_KIND, operation.id):
            kept_in_use.append(key)
            continue
        delete_operation(session, operation)
        removed.append(key)
    return removed, kept_in_use


# spec: select-shared-items-per-usage :: Selection rows of other items start disabled
def ensure_selection_rows(session: Session, item_kind: str, item_ids: Iterable[int], enabled_usages: dict[str, bool] | None = None) -> int:
    """Write a selection row for each item and usage that does not have one (disabled unless ``enabled_usages`` says so); existing rows are never changed.

    :return: How many rows were written.
    """
    item_ids = list(item_ids)
    if not item_ids:
        return 0
    existing = {(row.item_id, row.usage) for row in session.exec(select(UsageSelection).where(UsageSelection.item_kind == item_kind, UsageSelection.item_id.in_(item_ids))).all()}
    written = 0
    for item_id in item_ids:
        for usage in USAGES:
            if (item_id, usage) not in existing:
                session.add(UsageSelection(item_kind=item_kind, item_id=item_id, usage=usage, is_enabled=bool((enabled_usages or {}).get(usage, False))))
                written += 1
    session.commit()
    return written


def read_item_ids_enabled_for_usage(session: Session, item_kind: str, usage: str) -> set[int]:
    """The numbers of the items of a kind that are enabled for a usage."""
    return {row.item_id for row in session.exec(select(UsageSelection).where(
        UsageSelection.item_kind == item_kind, UsageSelection.usage == usage, UsageSelection.is_enabled == True)).all()}  # noqa: E712 (SQL comparison)


def read_operations_enabled_for_usage(session: Session, usage: str) -> list[Operation]:
    """The operations enabled for a usage whose connection is enabled too, with their connection loaded."""
    operation_ids = read_item_ids_enabled_for_usage(session, API_OPERATION_ITEM_KIND, usage)
    if not operation_ids:
        return []
    return [operation for operation in session.exec(select(Operation).where(Operation.id.in_(operation_ids)).order_by(Operation.id)).all()
            if operation.connection_has_operation_reverse and operation.connection_has_operation_reverse[0].is_enabled]


# spec: select-shared-items-per-usage :: The hub offers only what is enabled for it
def enable_existing_items_for_usage_once(session: Session, usage: str, marker_item_id: int = 0) -> int:
    """Enable for a usage, once, the connections and operations that exist and that nobody has enabled for anything yet.

    Items an application moved in for agents (operations found by route discovery, the connection of the application's own routes, and anything
    already enabled for another usage) are left alone. A marker row (a selection row for item number ``marker_item_id`` of the connection kind) says
    the step was done, so it runs once.

    :return: How many items were enabled (0 when it had run already).
    """
    marker = session.exec(select(UsageSelection).where(
        UsageSelection.item_kind == CONNECTION_ITEM_KIND, UsageSelection.item_id == marker_item_id, UsageSelection.usage == usage)).first()
    if marker is not None:
        return 0
    enabled_anywhere = {(row.item_kind, row.item_id) for row in session.exec(select(UsageSelection).where(UsageSelection.is_enabled == True)).all()}  # noqa: E712
    enabled = 0
    for connection in session.exec(select(Connection)).all():
        if connection.name == APPLICATION_OWN_ROUTES_CONNECTION_NAME or (CONNECTION_ITEM_KIND, connection.id) in enabled_anywhere:
            continue
        enabled += _enable(session, CONNECTION_ITEM_KIND, connection.id, usage)
        for operation in connection.connection_has_operation:
            if operation.source != ROUTE_DISCOVERY_SOURCE and (API_OPERATION_ITEM_KIND, operation.id) not in enabled_anywhere:
                enabled += _enable(session, API_OPERATION_ITEM_KIND, operation.id, usage)
    session.add(UsageSelection(item_kind=CONNECTION_ITEM_KIND, item_id=marker_item_id, usage=usage, is_enabled=True))
    session.commit()
    return enabled


def _enable(session: Session, item_kind: str, item_id: int, usage: str) -> int:
    row = session.exec(select(UsageSelection).where(UsageSelection.item_kind == item_kind, UsageSelection.item_id == item_id, UsageSelection.usage == usage)).first()
    if row is None:
        session.add(UsageSelection(item_kind=item_kind, item_id=item_id, usage=usage, is_enabled=True))
        return 1
    if not row.is_enabled:
        row.is_enabled = True
        session.add(row)
        return 1
    return 0
