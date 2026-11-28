"""Incoming webhooks and inbound API endpoints of the shared registry: settings, names, the signature and the API key."""
import uuid

import pytest
from cryptography.fernet import Fernet
from sqlmodel import Session

from veloiq_framework.db import get_engine
from veloiq_framework.shared_connection_registry import connection_registry_store as store
from veloiq_framework.shared_connection_registry.connection_registry_models import Connection
from veloiq_framework.shared_connection_registry.connection_secret_encryption import REGISTRY_SECRET_KEY_ENVIRONMENT_VARIABLE
from veloiq_framework.shared_connection_registry.incoming_call_verification import (
    api_key_is_valid, compute_webhook_signature, webhook_signature_is_valid,
)


@pytest.fixture()
def secret_key(monkeypatch):
    monkeypatch.setenv(REGISTRY_SECRET_KEY_ENVIRONMENT_VARIABLE, Fernet.generate_key().decode())


def unique_name() -> str:
    return f"endpoint-{uuid.uuid4().hex[:8]}"


def create(client, auth, endpoint_type, **settings):
    return client.post("/api/registry/connections", headers=auth, json={
        "name": f"conn-{uuid.uuid4().hex[:8]}", "endpoint_type": endpoint_type, "endpoint_settings": settings})


def test_an_incoming_webhook_keeps_its_name_and_the_hub_signature_header_by_default(client, auth):
    name = unique_name()
    created = create(client, auth, "incoming_webhook", endpoint_name=name)
    assert created.status_code == 201
    assert created.json()["endpoint_settings"] == {"direction": "incoming", "endpoint_name": name, "target_url": None,
                                                    "signature_header": "X-IH-Signature", "event_types": "all"}


def test_an_inbound_api_endpoint_keeps_its_name_authentication_and_push_size(client, auth):
    created = create(client, auth, "incoming_api_endpoint", endpoint_name=unique_name())
    assert created.json()["endpoint_settings"]["authentication"] == "hub_token"
    assert created.json()["endpoint_settings"]["max_records_per_push"] == 1000


@pytest.mark.parametrize("endpoint_type,settings,fragment", [
    ("incoming_webhook", {}, "lowercase letters, digits and hyphens"),
    ("incoming_webhook", {"endpoint_name": "Orders Now"}, "lowercase letters, digits and hyphens"),
    ("incoming_webhook", {"endpoint_name": "orders", "signature_header": " "}, "header that carries the signature"),
    ("incoming_webhook", {"endpoint_name": "orders", "direction": "outgoing"}, "does not match"),
    ("outgoing_webhook", {}, "needs the address"),
    ("incoming_webhook", {"endpoint_name": "orders", "color": "red"}, "Unknown webhook setting"),
    ("incoming_api_endpoint", {"endpoint_name": "orders", "authentication": "magic"}, "must be one of"),
    ("incoming_api_endpoint", {"endpoint_name": "orders", "max_records_per_push": 5000}, "between 1 and 1000"),
    ("incoming_api_endpoint", {"endpoint_name": "orders", "shape": 1}, "Unknown inbound API setting"),
])
def test_settings_the_definition_does_not_allow_are_refused_with_a_message(client, auth, endpoint_type, settings, fragment):
    refused = create(client, auth, endpoint_type, **settings)
    assert refused.status_code == 422 and fragment in refused.json()["detail"]


def test_an_endpoint_name_is_unique_among_endpoints_of_the_same_kind(client, auth):
    name = unique_name()
    assert create(client, auth, "incoming_webhook", endpoint_name=name).status_code == 201
    again = create(client, auth, "incoming_webhook", endpoint_name=name)
    assert again.status_code == 422 and "already exists" in again.json()["detail"]
    assert create(client, auth, "incoming_api_endpoint", endpoint_name=name).status_code == 201     # another kind: another address


def test_the_signing_secret_is_a_secret_of_the_connection_and_a_valid_signature_is_checked_on_the_body(client, auth, secret_key):
    connection_id = create(client, auth, "incoming_webhook", endpoint_name=unique_name()).json()["id"]
    assert client.put(f"/api/registry/connections/{connection_id}/secrets/signing_secret", headers=auth, json={"value": "shared"}).status_code == 204
    body = b'{"order": 1}'
    with Session(get_engine()) as session:
        connection = session.get(Connection, connection_id)
        good = compute_webhook_signature("shared", body)
        assert webhook_signature_is_valid(connection, body, good) and webhook_signature_is_valid(connection, body, "sha256=" + good.upper())
        assert not webhook_signature_is_valid(connection, b'{"order": 2}', good)             # another body
        assert not webhook_signature_is_valid(connection, body, compute_webhook_signature("other", body))
        assert not webhook_signature_is_valid(connection, body, None) and not webhook_signature_is_valid(connection, body, "")


def test_without_a_signing_secret_no_signature_is_valid(client, auth, secret_key):
    connection_id = create(client, auth, "incoming_webhook", endpoint_name=unique_name()).json()["id"]
    with Session(get_engine()) as session:
        assert not webhook_signature_is_valid(session.get(Connection, connection_id), b"{}", compute_webhook_signature("", b"{}"))


def test_an_api_key_is_valid_only_when_it_is_the_secret_of_the_connection(client, auth, secret_key):
    connection_id = create(client, auth, "incoming_api_endpoint", endpoint_name=unique_name(), authentication="api_key").json()["id"]
    client.put(f"/api/registry/connections/{connection_id}/secrets/api_key", headers=auth, json={"value": "key-123"})
    with Session(get_engine()) as session:
        connection = session.get(Connection, connection_id)
        assert api_key_is_valid(connection, "key-123")
        assert not api_key_is_valid(connection, "key-124") and not api_key_is_valid(connection, None) and not api_key_is_valid(connection, "")


def test_only_an_enabled_connection_is_found_by_its_endpoint_name(client, auth):
    name = unique_name()
    connection_id = create(client, auth, "incoming_webhook", endpoint_name=name).json()["id"]
    with Session(get_engine()) as session:
        assert store.find_enabled_incoming_endpoint(session, "incoming_webhook", name).id == connection_id
        assert store.find_enabled_incoming_endpoint(session, "incoming_api_endpoint", name) is None
        assert store.find_enabled_incoming_endpoint(session, "incoming_webhook", "no-such") is None
    client.put(f"/api/registry/connections/{connection_id}", headers=auth, json={"is_enabled": False})
    with Session(get_engine()) as session:
        assert store.find_enabled_incoming_endpoint(session, "incoming_webhook", name) is None


def test_endpoint_settings_can_be_changed_and_are_checked_again(client, auth):
    connection_id = create(client, auth, "incoming_api_endpoint", endpoint_name=unique_name()).json()["id"]
    changed = client.put(f"/api/registry/connections/{connection_id}", headers=auth, json={"endpoint_settings": {"max_records_per_push": 50}})
    assert changed.status_code == 200 and changed.json()["endpoint_settings"]["max_records_per_push"] == 50
    refused = client.put(f"/api/registry/connections/{connection_id}", headers=auth, json={"endpoint_settings": {"max_records_per_push": 0}})
    assert refused.status_code == 422
