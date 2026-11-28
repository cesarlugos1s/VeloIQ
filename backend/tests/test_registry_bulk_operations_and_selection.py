"""Bulk operations and selection rows of the registry: repeatable, never overwriting a curator's choice, and the one-time enabling for a usage."""
import uuid

import pytest
from sqlmodel import Session, select

from veloiq_framework.db import get_engine
from veloiq_framework.shared_connection_registry import connection_registry_store as store
from veloiq_framework.shared_connection_registry.connection_registry_models import Connection, UsageSelection
from veloiq_framework.shared_connection_registry.registry_bulk_operations_and_selection import (
    APPLICATION_OWN_ROUTES_CONNECTION_NAME, ROUTE_DISCOVERY_SOURCE, enable_existing_items_for_usage_once, ensure_selection_rows,
    find_or_create_connection, read_item_ids_enabled_for_usage, read_operations_enabled_for_usage, remove_operations_not_listed, upsert_operations,
)
from veloiq_framework.shared_connection_registry.registry_item_in_use_checks import register_item_in_use_check, remove_registered_item_in_use_checks


@pytest.fixture()
def session(client):
    with Session(get_engine()) as opened:
        yield opened


def routes(count, description="a route"):
    return [{"name": f"GET__route_{n}", "method": "get", "path": f"/route_{n}", "description": description} for n in range(count)]


def usages_of(session, operation_id):
    return {row.usage: row.is_enabled for row in session.exec(select(UsageSelection).where(
        UsageSelection.item_kind == "api_operation", UsageSelection.item_id == operation_id)).all()}


def test_routes_are_recorded_once_found_again_by_method_and_path_and_updated_only_when_they_changed(session):
    connection, created = find_or_create_connection(session, f"app-{uuid.uuid4().hex[:6]}", "rest_api", {"base_url": "http://localhost:8000/api"})
    assert created
    first = upsert_operations(session, connection, routes(1200), ROUTE_DISCOVERY_SOURCE, lambda item: {"ai_agents": item["path"] != "/route_3"})
    assert len(first.created) == 1200 and first.updated == [] and len(first.operation_ids) == 1200
    again = upsert_operations(session, connection, routes(1200), ROUTE_DISCOVERY_SOURCE)
    assert again.created == [] and again.updated == [] and len(again.unchanged) == 1200
    changed = upsert_operations(session, connection, routes(1200, description="a changed route"), ROUTE_DISCOVERY_SOURCE)
    assert len(changed.updated) == 1200 and changed.created == []
    same_connection, created_again = find_or_create_connection(session, connection.name, "rest_api")
    assert not created_again and same_connection.id == connection.id
    assert usages_of(session, first.operation_ids[("GET", "/route_3")]) == {"ai_agents": False, "integration_hub": False}      # the old state of a tool carried over
    assert usages_of(session, first.operation_ids[("GET", "/route_4")]) == {"ai_agents": True, "integration_hub": False}


def test_a_selection_a_curator_made_is_not_changed_by_a_later_upsert(session):
    connection, _created = find_or_create_connection(session, f"app-{uuid.uuid4().hex[:6]}", "rest_api", {"base_url": "http://localhost:8000"})
    result = upsert_operations(session, connection, routes(2), ROUTE_DISCOVERY_SOURCE, lambda item: {"ai_agents": True})
    operation_id = result.operation_ids[("GET", "/route_0")]
    store.set_usage_selection(session, "api_operation", operation_id, "integration_hub", True)
    store.set_usage_selection(session, "api_operation", operation_id, "ai_agents", False)
    upsert_operations(session, connection, routes(2), ROUTE_DISCOVERY_SOURCE, lambda item: {"ai_agents": True})
    assert usages_of(session, operation_id) == {"ai_agents": False, "integration_hub": True}


def test_operations_that_are_gone_are_removed_unless_something_uses_them(session):
    connection, _created = find_or_create_connection(session, f"app-{uuid.uuid4().hex[:6]}", "rest_api", {"base_url": "http://localhost:8000"})
    result = upsert_operations(session, connection, routes(4), ROUTE_DISCOVERY_SOURCE)
    used_id = result.operation_ids[("GET", "/route_1")]
    register_item_in_use_check(lambda kind, item_id: ["Orders"] if (kind, item_id) == ("api_operation", used_id) else [])
    try:
        removed, kept = remove_operations_not_listed(session, connection, {("GET", "/route_0")})
    finally:
        remove_registered_item_in_use_checks()
    assert sorted(removed) == [("GET", "/route_2"), ("GET", "/route_3")] and kept == [("GET", "/route_1")]
    session.refresh(connection)
    assert sorted(operation.path for operation in connection.connection_has_operation) == ["/route_0", "/route_1"]


def test_selection_rows_are_written_for_the_items_that_lack_them_and_existing_rows_stay_as_they_are(session):
    ids = [900000 + n for n in range(3)]
    assert ensure_selection_rows(session, "job_type", ids) == 6                       # three items, two usages, all disabled
    store.set_usage_selection(session, "job_type", ids[0], "integration_hub", True)
    assert ensure_selection_rows(session, "job_type", ids + [900003]) == 2           # only the new item
    assert read_item_ids_enabled_for_usage(session, "job_type", "integration_hub") == {ids[0]}


def test_the_hub_upgrade_enables_what_nobody_has_enabled_once_and_leaves_moved_in_items_alone(session):
    hub_connection = store.create_connection(session, f"hub-{uuid.uuid4().hex[:6]}", "rest_api", True, {"base_url": "https://api.example.com"})
    hub_operation = store.add_operation(session, hub_connection, {"name": "list", "path": "/items"})
    own, _created = find_or_create_connection(session, APPLICATION_OWN_ROUTES_CONNECTION_NAME, "rest_api", {"base_url": "http://localhost:8000/api"})
    moved = upsert_operations(session, own, routes(2), ROUTE_DISCOVERY_SOURCE)
    for_agents = store.create_connection(session, f"agents-{uuid.uuid4().hex[:6]}", "rest_api", True, {"base_url": "https://agents.example.com"})
    store.set_usage_selection(session, "connection", for_agents.id, "ai_agents", True)
    enable_existing_items_for_usage_once(session, "integration_hub", marker_item_id=-1)
    hub_ids = read_item_ids_enabled_for_usage(session, "api_operation", "integration_hub")
    connection_ids = read_item_ids_enabled_for_usage(session, "connection", "integration_hub")
    assert hub_operation.id in hub_ids and hub_connection.id in connection_ids
    assert not (set(moved.operation_ids.values()) & hub_ids) and own.id not in connection_ids and for_agents.id not in connection_ids
    assert enable_existing_items_for_usage_once(session, "integration_hub", marker_item_id=-1) == 0                    # it runs once
    later = store.create_connection(session, f"later-{uuid.uuid4().hex[:6]}", "rest_api", True, {"base_url": "https://later.example.com"})
    enable_existing_items_for_usage_once(session, "integration_hub", marker_item_id=-1)
    assert later.id not in read_item_ids_enabled_for_usage(session, "connection", "integration_hub")


def test_the_lists_can_be_limited_to_what_is_enabled_for_a_usage(client, auth, session):
    connection = store.create_connection(session, f"lists-{uuid.uuid4().hex[:6]}", "rest_api", True, {"base_url": "https://api.example.com"})
    on = store.add_operation(session, connection, {"name": "on", "path": "/on"})
    store.add_operation(session, connection, {"name": "off", "path": "/off"})
    store.set_usage_selection(session, "connection", connection.id, "integration_hub", True)
    store.set_usage_selection(session, "api_operation", on.id, "integration_hub", True)
    offered = client.get("/api/registry/operations?usage=integration_hub", headers=auth).json()
    assert [row["name"] for row in offered if row["connection"]["id"] == connection.id] == ["on"]
    assert connection.id in {row["id"] for row in client.get("/api/registry/connections?usage=integration_hub", headers=auth).json()}
    assert connection.id not in {row["id"] for row in client.get("/api/registry/connections?usage=ai_agents", headers=auth).json()}
    assert [operation.name for operation in read_operations_enabled_for_usage(session, "integration_hub") if operation.connection_has_operation_reverse[0].id == connection.id] == ["on"]
