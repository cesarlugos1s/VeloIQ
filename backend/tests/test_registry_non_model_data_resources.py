"""The registry as non-model data resources: lists, record pages, relation tabs and writes, over the registry store."""
import uuid

import pytest
from cryptography.fernet import Fernet

from veloiq_framework.shared_connection_registry.connection_secret_encryption import REGISTRY_SECRET_KEY_ENVIRONMENT_VARIABLE
from veloiq_framework.non_model_data_resources import encode_eid

CONNECTIONS = "/api/veloiq_registry_connections"
EVERY_ROW = "_start=0&_end=5000"      # a list answers one page; other tests have already added rows, so ask for them all


@pytest.fixture()
def secret_key(monkeypatch):
    monkeypatch.setenv(REGISTRY_SECRET_KEY_ENVIRONMENT_VARIABLE, Fernet.generate_key().decode())


def _connection(client, auth, **values):
    response = client.post(CONNECTIONS, headers=auth, json={"name": f"c-{uuid.uuid4().hex[:8]}", "endpoint_type": "rest_api", "base_url": "https://api.example.com", **values})
    assert response.status_code in (200, 201), response.text
    return response.json()


def test_a_rest_connection_is_created_listed_changed_and_deleted_with_its_settings(client, auth):
    created = _connection(client, auth, authentication="bearer_token", timeout_seconds=15)
    assert created["base_url"] == "https://api.example.com" and created["authentication"] == "bearer_token" and created["timeout_seconds"] == 15
    listed = client.get(f"{CONNECTIONS}?{EVERY_ROW}", headers=auth)
    assert created["name"] in [row["name"] for row in listed.json()]
    shown = client.get(f"{CONNECTIONS}/{created['id']}", headers=auth).json()
    assert shown["is_enabled"] is True and shown["paging"] == "none" and shown["is_tls_verified"] is True
    changed = client.put(f"{CONNECTIONS}/{created['id']}", headers=auth, json={**shown, "name": created["name"] + "-x", "is_enabled": False, "timeout_seconds": 20})
    assert changed.status_code == 200 and changed.json()["name"].endswith("-x") and changed.json()["is_enabled"] is False and changed.json()["timeout_seconds"] == 20
    assert client.delete(f"{CONNECTIONS}/{created['id']}", headers=auth).status_code in (200, 204)
    assert client.get(f"{CONNECTIONS}/{created['id']}", headers=auth).status_code == 404


def test_what_the_registry_refuses_is_refused_with_its_message(client, auth):
    refused = client.post(CONNECTIONS, headers=auth, json={"name": "x", "endpoint_type": "rest_api"})
    assert refused.status_code == 422 and "needs the address" in str(refused.json())
    created = _connection(client, auth)
    duplicate = client.post(CONNECTIONS, headers=auth, json={"name": created["name"], "endpoint_type": "rest_api", "base_url": "https://x"})
    assert duplicate.status_code == 422 and "already exists" in str(duplicate.json())
    other_type = client.put(f"{CONNECTIONS}/{created['id']}", headers=auth, json={**created, "endpoint_type": "file"})
    assert other_type.status_code == 422 and "does not change" in str(other_type.json())


def test_operations_are_listed_for_every_connection_and_written_through_the_store(client, auth):
    connection = _connection(client, auth)
    operation = client.post("/api/veloiq_registry_operations", headers=auth, json={"connection_id": connection["id"], "name": "list", "method": "GET", "path": "/orders"}).json()
    assert operation["connection_id"] == connection["id"] and operation["source"] == "by_hand"
    assert operation["id"] in [row["id"] for row in client.get(f"/api/veloiq_registry_operations?{EVERY_ROW}", headers=auth).json()]
    changed = client.put(f"/api/veloiq_registry_operations/{operation['id']}", headers=auth, json={**operation, "description": "All orders", "method": "POST"})
    assert changed.json()["description"] == "All orders" and changed.json()["method"] == "POST"
    duplicate = client.post("/api/veloiq_registry_operations", headers=auth, json={"connection_id": connection["id"], "name": "list", "path": "/x"})
    assert duplicate.status_code == 422 and "already has an operation" in str(duplicate.json())
    assert client.delete(f"/api/veloiq_registry_operations/{operation['id']}", headers=auth).status_code in (200, 204)


def test_a_secret_is_written_listed_masked_replaced_and_removed_and_its_value_is_never_returned(client, auth, secret_key):
    connection = _connection(client, auth)
    created = client.post("/api/veloiq_registry_secrets", headers=auth, json={"connection_id": connection["id"], "key": "token", "value": "never-shown-1"})
    assert created.status_code in (200, 201) and created.json()["value"] == "********" and "never-shown-1" not in created.text
    listed = client.get(f"/api/veloiq_registry_secrets?{EVERY_ROW}", headers=auth)
    mine = [row for row in listed.json() if row["connection_id"] == connection["id"]]
    assert mine == [{"connection_id": connection["id"], "key": "token", "value": "********", **{k: v for k, v in mine[0].items() if k == "eid"}}] or mine[0]["value"] == "********"
    assert "never-shown-1" not in listed.text
    eid = encode_eid([connection["id"], "token"])
    replaced = client.put(f"/api/veloiq_registry_secrets/{eid}", headers=auth, json={"connection_id": connection["id"], "key": "token", "value": "never-shown-2"})
    assert replaced.status_code == 200 and "never-shown-2" not in replaced.text
    unchanged = client.put(f"/api/veloiq_registry_secrets/{eid}", headers=auth, json={"connection_id": connection["id"], "key": "token", "value": "********"})
    assert unchanged.status_code == 422 and "needs a value" in str(unchanged.json())              # the mask is not a value
    assert client.delete(f"/api/veloiq_registry_secrets/{eid}", headers=auth).status_code in (200, 204)


def test_without_a_key_a_secret_is_refused_with_the_message(client, auth, monkeypatch):
    monkeypatch.delenv(REGISTRY_SECRET_KEY_ENVIRONMENT_VARIABLE, raising=False)
    connection = _connection(client, auth)
    refused = client.post("/api/veloiq_registry_secrets", headers=auth, json={"connection_id": connection["id"], "key": "token", "value": "x"})
    assert refused.status_code == 409 and "no key is configured" in str(refused.json())


def test_usage_has_a_row_for_each_connection_operation_and_usage_and_a_switch_saves_at_once(client, auth):
    connection = _connection(client, auth)
    operation = client.post("/api/veloiq_registry_operations", headers=auth, json={"connection_id": connection["id"], "name": "o", "path": "/o"}).json()
    rows = [row for row in client.get(f"/api/veloiq_registry_usage?{EVERY_ROW}", headers=auth).json() if row["connection_id"] == connection["id"]]
    assert sorted((row["item_kind"], row["usage"], row["is_enabled"]) for row in rows) == [
        ("api_operation", "ai_agents", False), ("api_operation", "integration_hub", False), ("connection", "ai_agents", False), ("connection", "integration_hub", False)]
    row = next(r for r in rows if r["item_kind"] == "api_operation" and r["usage"] == "integration_hub")
    eid = encode_eid(["api_operation", operation["id"], "integration_hub"])
    assert client.put(f"/api/veloiq_registry_usage/{eid}", headers=auth, json={**row, "is_enabled": True}).status_code == 200
    after = [r for r in client.get(f"/api/veloiq_registry_usage?{EVERY_ROW}", headers=auth).json() if r["item_kind"] == "api_operation" and r["item_id"] == operation["id"]]
    assert {(r["usage"], r["is_enabled"]) for r in after} == {("ai_agents", False), ("integration_hub", True)}
    assert client.post("/api/veloiq_registry_usage", headers=auth, json=row).status_code in (404, 405)       # rows are not added or removed by hand


def test_a_connection_page_has_the_operations_secrets_and_usage_as_relation_tabs(client, auth):
    definitions = client.get("/api/veloiq/non-model-data-resources", headers=auth).json()
    by_name = {definition["resource"]: definition for definition in definitions["models"]}
    connections = by_name["veloiq_registry_connections"]
    assert {relation["resource"] for relation in connections["relations"]} == {"veloiq_registry_operations", "veloiq_registry_secrets", "veloiq_registry_usage"}
    assert connections["capabilities"] == {"create": True, "update": True, "delete": True}
    assert by_name["veloiq_registry_usage"]["capabilities"] == {"create": False, "update": True, "delete": False}


def test_only_an_administrator_may_use_the_registry_lists(client, auth, manager_auth, viewer_auth):
    for headers in (manager_auth, viewer_auth, {}):
        assert client.get(CONNECTIONS, headers=headers).status_code in (401, 403)
        assert client.post(CONNECTIONS, headers=headers, json={"name": "n", "endpoint_type": "rest_api", "base_url": "https://x"}).status_code in (401, 403)
        assert client.get("/api/veloiq_registry_secrets", headers=headers).status_code in (401, 403)
    assert client.get(CONNECTIONS, headers=auth).status_code == 200
