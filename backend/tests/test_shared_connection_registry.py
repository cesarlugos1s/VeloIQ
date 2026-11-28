"""Shared connection registry, end to end on the task-manager sample: connections, secrets, operations and usage selection."""
import json
import uuid

import pytest
from cryptography.fernet import Fernet
from sqlmodel import Session, select

from veloiq_framework.db import get_engine
from veloiq_framework.shared_connection_registry.connection_registry_models import ConnectionSecret, UsageSelection
from veloiq_framework.shared_connection_registry.connection_secret_encryption import (
    REGISTRY_SECRET_KEY_ENVIRONMENT_VARIABLE, SecretCannotBeDecryptedError, decrypt_secret, encrypt_secret,
)
from veloiq_framework.shared_connection_registry.openapi_operation_import import OpenApiDescriptionError, list_operations_of_description

OPENAPI = {
    "openapi": "3.0.0",
    "paths": {
        "/orders/{order_id}": {
            "parameters": [{"name": "order_id", "in": "path", "required": True, "schema": {"type": "integer"}}],
            "get": {"operationId": "getOrder", "summary": "Read one order", "parameters": [{"name": "expand", "in": "query", "schema": {"type": "string"}}],
                    "responses": {"200": {"content": {"application/json": {"schema": {"$ref": "#/components/schemas/Order"}}}}}},
            "delete": {"summary": "Remove an order", "responses": {"204": {"description": "gone"}}},
        },
        "/orders": {"post": {"operationId": "createOrder", "requestBody": {"content": {"application/json": {"schema": {"type": "object"}}}}, "responses": {"201": {}}}},
    },
    "components": {"schemas": {"Order": {"type": "object", "properties": {"id": {"type": "integer"}}}}},
}


@pytest.fixture()
def secret_key(monkeypatch):
    key = Fernet.generate_key().decode()
    monkeypatch.setenv(REGISTRY_SECRET_KEY_ENVIRONMENT_VARIABLE, key)
    return key


def _name() -> str:
    return f"conn-{uuid.uuid4().hex[:8]}"


def _create(client, auth, **values):
    return client.post("/api/registry/connections", headers=auth, json={"name": _name(), "endpoint_type": "rest_api",
                       "rest_settings": {"base_url": "https://api.example.com"}, **values})


def test_a_rest_connection_keeps_its_settings_and_starts_with_every_usage_disabled(client, auth):
    created = _create(client, auth)
    assert created.status_code == 201
    body = created.json()
    assert body["rest_settings"]["authentication"] == "none" and body["rest_settings"]["timeout_seconds"] == 30 and body["is_enabled"] is True
    selections = client.get(f"/api/registry/usage-selections?item_kind=connection&item_id={body['id']}", headers=auth).json()
    assert sorted((row["usage"], row["is_enabled"]) for row in selections) == [("ai_agents", False), ("integration_hub", False)]
    assert client.get(f"/api/registry/connections/{body['id']}", headers=auth).json()["name"] == body["name"]


@pytest.mark.parametrize("payload,fragment", [
    ({"name": ""}, "needs a name"),
    ({"endpoint_type": "carrier_pigeon"}, "must be one of"),
    ({"rest_settings": {}}, "needs the address"),
    ({"rest_settings": {"base_url": "https://x", "authentication": "oauth2_client_credentials"}}, "OAuth needs"),
    ({"rest_settings": {"base_url": "https://x", "timeout_seconds": 999}}, "between 1 and 300"),
    ({"rest_settings": {"base_url": "https://x", "color": "red"}}, "Unknown REST setting"),
])
def test_values_that_the_definition_does_not_allow_are_refused_with_a_message(client, auth, payload, fragment):
    refused = _create(client, auth, **payload)
    assert refused.status_code == 422 and fragment in refused.json()["detail"]


def test_a_connection_name_is_unique(client, auth):
    name = _name()
    assert client.post("/api/registry/connections", headers=auth, json={"name": name, "endpoint_type": "rest_api", "rest_settings": {"base_url": "https://api.example.com"}}).status_code == 201
    again = client.post("/api/registry/connections", headers=auth, json={"name": name, "endpoint_type": "rest_api", "rest_settings": {"base_url": "https://api.example.com"}})
    assert again.status_code == 422 and "already exists" in again.json()["detail"]


def test_a_secret_is_stored_encrypted_shown_masked_and_never_returned(client, auth, secret_key):
    connection_id = _create(client, auth).json()["id"]
    assert client.put(f"/api/registry/connections/{connection_id}/secrets/api_key", headers=auth, json={"value": "s3cr3t-value"}).status_code == 204
    shown = client.get(f"/api/registry/connections/{connection_id}", headers=auth)
    assert shown.json()["secrets"] == [{"key": "api_key", "value": "********"}]
    assert "s3cr3t-value" not in shown.text and "s3cr3t-value" not in client.get("/api/registry/connections", headers=auth).text
    with Session(get_engine()) as session:
        stored = session.exec(select(ConnectionSecret).where(ConnectionSecret.key == "api_key")).all()[-1]
        assert stored.value != "s3cr3t-value" and decrypt_secret(stored.value) == "s3cr3t-value"
    assert client.put(f"/api/registry/connections/{connection_id}/secrets/api_key", headers=auth, json={"value": "second"}).status_code == 204
    assert len(client.get(f"/api/registry/connections/{connection_id}", headers=auth).json()["secrets"]) == 1   # replaced, not added
    assert client.delete(f"/api/registry/connections/{connection_id}/secrets/api_key", headers=auth).status_code == 204
    assert client.delete(f"/api/registry/connections/{connection_id}/secrets/api_key", headers=auth).status_code == 404


def test_without_a_key_a_secret_is_refused_and_nothing_is_stored(client, auth, monkeypatch):
    monkeypatch.delenv(REGISTRY_SECRET_KEY_ENVIRONMENT_VARIABLE, raising=False)
    connection_id = _create(client, auth).json()["id"]
    refused = client.put(f"/api/registry/connections/{connection_id}/secrets/password", headers=auth, json={"value": "x"})
    assert refused.status_code == 409 and "no key is configured" in refused.json()["detail"]
    assert client.get(f"/api/registry/connections/{connection_id}", headers=auth).json()["secrets"] == []


def test_a_secret_cannot_be_read_with_another_key(secret_key, monkeypatch):
    stored = encrypt_secret("value")
    monkeypatch.setenv(REGISTRY_SECRET_KEY_ENVIRONMENT_VARIABLE, Fernet.generate_key().decode())
    with pytest.raises(SecretCannotBeDecryptedError):
        decrypt_secret(stored)


def test_operations_are_recorded_by_hand_with_unique_names_and_checked_methods(client, auth):
    connection_id = _create(client, auth).json()["id"]
    url = f"/api/registry/connections/{connection_id}/operations"
    created = client.post(url, headers=auth, json={"name": "list", "method": "get", "path": "/orders"})
    assert created.status_code == 201 and created.json()["method"] == "GET" and created.json()["source"] == "by_hand"
    assert "already has an operation" in client.post(url, headers=auth, json={"name": "list", "path": "/x"}).json()["detail"]
    assert "must be one of" in client.post(url, headers=auth, json={"name": "bad", "method": "TRACE", "path": "/x"}).json()["detail"]
    changed = client.put(f"/api/registry/operations/{created.json()['id']}", headers=auth, json={"description": "All orders", "method": "post"})
    assert changed.json()["description"] == "All orders" and changed.json()["method"] == "POST"
    assert client.delete(f"/api/registry/operations/{created.json()['id']}", headers=auth).status_code == 204
    assert client.get(url, headers=auth).json() == []


def test_an_openapi_description_lists_its_operations_with_the_fields_filled_in():
    operations = {operation["name"]: operation for operation in list_operations_of_description(json.dumps(OPENAPI))}
    assert set(operations) == {"getOrder", "DELETE /orders/{order_id}", "createOrder"}
    read = operations["getOrder"]
    assert (read["method"], read["path"], read["description"], read["source"]) == ("GET", "/orders/{order_id}", "Read one order", "openapi_import")
    parameters = json.loads(read["parameters_schema"])
    assert parameters["path"][0] == {"name": "order_id", "type": "integer", "required": True, "description": "", "default": ""}
    assert parameters["query"][0]["name"] == "expand"
    assert json.loads(read["response_schema"])["properties"]["id"]["type"] == "integer"      # the $ref is resolved
    assert "body" in json.loads(operations["createOrder"]["parameters_schema"])
    assert list_operations_of_description(__import__("yaml").safe_dump(OPENAPI))[0]["path"]  # YAML is read too


@pytest.mark.parametrize("content", ["not json or yaml: [", "{\"hello\": 1}", "[1, 2]"])
def test_content_that_is_not_an_openapi_description_is_refused(content):
    with pytest.raises(OpenApiDescriptionError):
        list_operations_of_description(content)


def test_the_administrator_previews_chooses_and_records_operations_and_a_second_import_skips_the_ones_already_there(client, auth):
    connection_id = _create(client, auth).json()["id"]
    preview = client.post(f"/api/registry/connections/{connection_id}/operation-imports/preview", headers=auth, json={"content": json.dumps(OPENAPI)})
    assert preview.status_code == 200 and len(preview.json()["operations"]) == 3
    chosen = [operation for operation in preview.json()["operations"] if operation["name"] in ("getOrder", "createOrder")]
    first = client.post(f"/api/registry/connections/{connection_id}/operation-imports", headers=auth, json={"operations": chosen})
    assert first.status_code == 201 and [o["name"] for o in first.json()["recorded"]] == ["getOrder", "createOrder"]
    assert {o["source"] for o in first.json()["recorded"]} == {"openapi_import"}
    second = client.post(f"/api/registry/connections/{connection_id}/operation-imports", headers=auth, json={"operations": chosen[:1]}).json()
    assert second["recorded"] == [] and "already has an operation" in second["skipped"][0]["reason"]
    assert len(client.get(f"/api/registry/connections/{connection_id}/operations", headers=auth).json()) == 2


def test_an_unreachable_address_says_so_and_a_file_can_be_supplied_instead(client, auth):
    connection_id = _create(client, auth).json()["id"]
    unreachable = client.post(f"/api/registry/connections/{connection_id}/operation-imports/preview", headers=auth,
                              json={"address": "http://127.0.0.1:9/openapi.json"})
    assert unreachable.status_code == 422 and "supply the description as a file" in unreachable.json()["detail"]
    assert client.post(f"/api/registry/connections/{connection_id}/operation-imports/preview", headers=auth,
                       json={"content": json.dumps(OPENAPI)}).status_code == 200


def test_usage_selection_has_one_row_for_each_item_and_usage_and_a_change_applies_to_it(client, auth):
    connection_id = _create(client, auth).json()["id"]
    operation_id = client.post(f"/api/registry/connections/{connection_id}/operations", headers=auth, json={"name": "o", "path": "/o"}).json()["id"]
    for _unused in range(2):                       # writing twice does not add a second row
        assert client.put("/api/registry/usage-selections", headers=auth,
                          json={"item_kind": "api_operation", "item_id": operation_id, "usage": "integration_hub", "is_enabled": True}).status_code == 200
    rows = client.get(f"/api/registry/usage-selections?item_kind=api_operation&item_id={operation_id}", headers=auth).json()
    assert sorted((r["usage"], r["is_enabled"]) for r in rows) == [("ai_agents", False), ("integration_hub", True)]
    assert "must be one of" in client.put("/api/registry/usage-selections", headers=auth,
                                          json={"item_kind": "api_operation", "item_id": operation_id, "usage": "everyone", "is_enabled": True}).json()["detail"]
    other_kind = client.put("/api/registry/usage-selections", headers=auth,       # a kind owned elsewhere keeps only its selection row here
                            json={"item_kind": "webhook_subscription", "item_id": 7, "usage": "ai_agents", "is_enabled": True})
    assert other_kind.status_code == 200


def test_deleting_a_connection_removes_its_secrets_settings_operations_and_selections(client, auth, secret_key):
    connection_id = _create(client, auth).json()["id"]
    client.put(f"/api/registry/connections/{connection_id}/secrets/token", headers=auth, json={"value": "t"})
    operation_id = client.post(f"/api/registry/connections/{connection_id}/operations", headers=auth, json={"name": "o", "path": "/o"}).json()["id"]
    assert client.delete(f"/api/registry/connections/{connection_id}", headers=auth).status_code == 204
    assert client.get(f"/api/registry/connections/{connection_id}", headers=auth).status_code == 404
    assert client.get(f"/api/registry/usage-selections?item_kind=api_operation&item_id={operation_id}", headers=auth).json() == []
    assert client.get(f"/api/registry/usage-selections?item_kind=connection&item_id={connection_id}", headers=auth).json() == []


def test_only_an_administrator_may_use_the_registry(client, auth, manager_auth, viewer_auth):
    for headers in (manager_auth, viewer_auth):
        assert client.get("/api/registry/connections", headers=headers).status_code in (401, 403)
        assert client.post("/api/registry/connections", headers=headers, json={"name": "x", "endpoint_type": "file"}).status_code in (401, 403)
    assert client.get("/api/registry/connections").status_code in (401, 403)
    assert client.get("/api/registry/connections", headers=auth).status_code == 200


def test_one_operation_is_read_with_its_connection_and_without_any_secret(client, auth, secret_key):
    connection_id = _create(client, auth).json()["id"]
    client.put(f"/api/registry/connections/{connection_id}/secrets/token", headers=auth, json={"value": "never-shown"})
    operation_id = client.post(f"/api/registry/connections/{connection_id}/operations", headers=auth, json={"name": "List todos", "path": "/todos"}).json()["id"]
    read = client.get(f"/api/registry/operations/{operation_id}", headers=auth)
    assert read.status_code == 200 and read.json()["method"] == "GET" and read.json()["path"] == "/todos"
    assert read.json()["connection"]["base_url"] == "https://api.example.com" and read.json()["connection"]["id"] == connection_id
    assert "never-shown" not in read.text and "secrets" not in read.json()["connection"]
    assert client.get("/api/registry/operations/999999", headers=auth).status_code == 404


def test_every_operation_is_listed_with_its_connection_and_can_be_kept_by_method(client, auth):
    connection_id = _create(client, auth).json()["id"]
    name = client.get(f"/api/registry/connections/{connection_id}", headers=auth).json()["name"]
    get_id = client.post(f"/api/registry/connections/{connection_id}/operations", headers=auth, json={"name": "read", "path": "/a"}).json()["id"]
    post_id = client.post(f"/api/registry/connections/{connection_id}/operations", headers=auth, json={"name": "write", "path": "/b", "method": "POST"}).json()["id"]
    everything = {row["id"]: row for row in client.get("/api/registry/operations", headers=auth).json()}
    assert {get_id, post_id} <= set(everything) and everything[get_id]["connection"]["name"] == name
    reads = {row["id"] for row in client.get("/api/registry/operations?method=get", headers=auth).json()}
    assert get_id in reads and post_id not in reads
    assert client.get("/api/registry/operations").status_code in (401, 403)


def test_the_allowed_values_of_the_choice_fields_come_from_one_endpoint(client, auth):
    choices = client.get("/api/registry/choices", headers=auth).json()
    assert "rest_api" in choices["endpoint_types"] and choices["operation_methods"] == ["GET", "POST", "PUT", "PATCH", "DELETE"]
    assert "bearer_token" in choices["rest_authentications"] and "offset" in choices["rest_paging_styles"] and choices["usages"] == ["ai_agents", "integration_hub"]
    assert "api_key" in choices["secret_keys"] and choices["oauth_authentications"] == ["oauth2_client_credentials"]
    assert client.get("/api/registry/choices").status_code in (401, 403)


def test_an_item_that_another_package_uses_is_not_deleted_and_the_message_names_what_uses_it(client, auth):
    from veloiq_framework.shared_connection_registry.registry_item_in_use_checks import register_item_in_use_check, remove_registered_item_in_use_checks
    connection_id = _create(client, auth).json()["id"]
    operation_id = client.post(f"/api/registry/connections/{connection_id}/operations", headers=auth, json={"name": "used", "path": "/u"}).json()["id"]
    free_id = client.post(f"/api/registry/connections/{connection_id}/operations", headers=auth, json={"name": "free", "path": "/f"}).json()["id"]
    register_item_in_use_check(lambda kind, item_id: ["Orders", "Invoices"] if (kind, item_id) == ("api_operation", operation_id) else [])
    try:
        refused = client.delete(f"/api/registry/operations/{operation_id}", headers=auth)
        assert refused.status_code == 409 and "Orders, Invoices" in refused.json()["detail"] and "used" in refused.json()["detail"]
        via_list = client.delete(f"/api/veloiq_registry_operations/{operation_id}", headers=auth)
        assert via_list.status_code == 409 and "Orders" in str(via_list.json())
        connection_refused = client.delete(f"/api/registry/connections/{connection_id}", headers=auth)       # one of its operations is in use
        assert connection_refused.status_code == 409 and "Orders" in connection_refused.json()["detail"]
        assert client.delete(f"/api/registry/operations/{free_id}", headers=auth).status_code == 204            # not in use: deleted
    finally:
        remove_registered_item_in_use_checks()
    assert client.delete(f"/api/registry/connections/{connection_id}", headers=auth).status_code == 204          # no check any more
