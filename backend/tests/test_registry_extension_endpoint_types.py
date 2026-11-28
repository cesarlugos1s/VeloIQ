"""Endpoint types an extension package adds to the registry: registering one, creating and changing a connection of it, its checks, the choices and the page data."""
import json

import pytest
from sqlmodel import Session

from veloiq_framework.db import get_engine
from veloiq_framework.shared_connection_registry import connection_registry_store as store
from veloiq_framework.shared_connection_registry.connection_registry_non_model_data_resources import _connection_row, fields_shown_for_each_endpoint_type
from veloiq_framework.shared_connection_registry.registry_choice_values import allowed_endpoint_types
from veloiq_framework.shared_connection_registry.registry_extension_endpoint_types import (
    ExtensionEndpointType, ExtensionEndpointTypeError, ExtensionSettingField, check_extension_settings, find_extension_endpoint_type, list_extension_endpoint_types,
    register_extension_endpoint_type, remove_all_extension_endpoint_types,
)


def refuse_two_sasl_without_a_user(settings):
    if settings.get("security") == "sasl" and not settings.get("user_name"):
        raise ExtensionEndpointTypeError("SASL needs a user name.")


BROKER = ExtensionEndpointType(
    name="test_broker", label="Test broker", secret_keys=("password",), check_settings=refuse_two_sasl_without_a_user,
    settings_fields=(
        ExtensionSettingField("address", "Address", required=True),
        ExtensionSettingField("kind", "Kind", type="choice", choices=("kafka", "amqp"), default="kafka"),
        ExtensionSettingField("port", "Port", type="number"),
        ExtensionSettingField("is_secure", "Secure", type="boolean", default=False),
        ExtensionSettingField("security", "Security", type="choice", choices=("plain", "sasl"), default="plain"),
        ExtensionSettingField("user_name", "User"),
    ))


@pytest.fixture()
def session(client):
    remove_all_extension_endpoint_types()
    with Session(get_engine()) as opened:
        yield opened
    remove_all_extension_endpoint_types()


def unique(name):
    import uuid
    return f"{name}-{uuid.uuid4().hex[:6]}"


def test_a_registered_type_is_allowed_listed_and_shown_with_its_settings_field(session):
    assert "test_broker" not in allowed_endpoint_types()
    register_extension_endpoint_type(BROKER)
    assert allowed_endpoint_types()[-1] == "test_broker" and find_extension_endpoint_type("test_broker") is BROKER and list_extension_endpoint_types() == [BROKER]
    assert fields_shown_for_each_endpoint_type()["test_broker"] == ["extension_settings"] and "rest_api" in fields_shown_for_each_endpoint_type()


@pytest.mark.parametrize("definition,fragment", [
    (ExtensionEndpointType(name="rest_api", label="x"), "already exists"), (ExtensionEndpointType(name="Bad Name", label="x"), "lowercase"),
    (ExtensionEndpointType(name="odd", label="x", settings_fields=(ExtensionSettingField("a", type="map"),)), "not valid"),
    (ExtensionEndpointType(name="odd", label="x", settings_fields=(ExtensionSettingField("a"), ExtensionSettingField("a"))), "not valid"),
    (ExtensionEndpointType(name="odd", label="x", settings_fields=(ExtensionSettingField("a", type="choice"),)), "not valid"),
])
def test_a_type_the_registry_cannot_accept_is_refused_with_the_reason(session, definition, fragment):
    with pytest.raises(ExtensionEndpointTypeError, match=fragment):
        register_extension_endpoint_type(definition)


def test_a_type_cannot_be_registered_twice(session):
    register_extension_endpoint_type(BROKER)
    with pytest.raises(ExtensionEndpointTypeError, match="already exists"):
        register_extension_endpoint_type(BROKER)


def test_a_connection_of_the_type_keeps_its_checked_settings_with_the_defaults_and_shows_them_without_a_secret(session):
    register_extension_endpoint_type(BROKER)
    connection = store.create_connection(session, unique("broker"), "test_broker", True, extension_settings={"address": "localhost:9092", "port": "9093", "is_secure": "true"})
    assert json.loads(connection.connection_has_extension_connection_settings[0].settings_json) == {"address": "localhost:9092", "kind": "kafka", "port": 9093, "is_secure": True, "security": "plain"}
    shown = store.connection_to_dict(connection)
    assert shown["endpoint_type"] == "test_broker" and shown["extension_settings"]["port"] == 9093 and shown["rest_settings"] is None
    assert _connection_row(connection)["extension_settings"] == connection.connection_has_extension_connection_settings[0].settings_json


def test_the_settings_can_be_given_as_json_text_as_a_page_sends_them_and_are_changed_as_a_whole(session):
    register_extension_endpoint_type(BROKER)
    connection = store.create_connection(session, unique("broker"), "test_broker", True, extension_settings=json.dumps({"address": "a:1"}))
    store.update_connection(session, connection, {"extension_settings": json.dumps({"address": "b:2", "kind": "amqp"})})
    assert store.connection_to_dict(connection)["extension_settings"]["address"] == "b:2" and store.connection_to_dict(connection)["extension_settings"]["kind"] == "amqp"


@pytest.mark.parametrize("settings,fragment", [
    ({}, "address of test_broker is required"), ({"address": "a", "extra": 1}, "Unknown setting of test_broker: extra"), ({"address": "a", "kind": "pigeon"}, "one of kafka, amqp"),
    ({"address": "a", "port": "many"}, "is a number"), ({"address": "a", "is_secure": "maybe"}, "is a truth value|is a boolean"), ({"address": "a", "security": "sasl"}, "SASL needs a user name"),
    ("not json", "not valid JSON"), ([1], "JSON object"),
])
def test_settings_that_do_not_fit_the_type_are_refused_with_the_reason(session, settings, fragment):
    register_extension_endpoint_type(BROKER)
    with pytest.raises(store.RegistryRuleError, match=fragment):
        store.create_connection(session, unique("broker"), "test_broker", True, extension_settings=settings)
    with pytest.raises(ExtensionEndpointTypeError):
        check_extension_settings(BROKER, settings)


def test_a_type_nobody_registered_and_settings_for_another_type_are_refused(session):
    with pytest.raises(store.RegistryRuleError, match="endpoint type"):
        store.create_connection(session, unique("broker"), "test_broker", True)
    rest = store.create_connection(session, unique("rest"), "rest_api", True, {"base_url": "http://localhost"})
    with pytest.raises(store.RegistryRuleError, match="extension added has extension settings"):
        store.update_connection(session, rest, {"extension_settings": {"address": "a"}})


def test_deleting_the_connection_deletes_its_extension_settings(session):
    register_extension_endpoint_type(BROKER)
    connection = store.create_connection(session, unique("broker"), "test_broker", True, extension_settings={"address": "a:1"})
    settings_id = connection.connection_has_extension_connection_settings[0].id
    store.delete_connection(session, connection)
    from veloiq_framework.shared_connection_registry.connection_registry_models import ExtensionConnectionSettings
    assert session.get(ExtensionConnectionSettings, settings_id) is None


def test_the_choices_endpoint_lists_the_type_with_its_fields_and_the_pages_create_a_connection_of_it(client, auth, session):
    register_extension_endpoint_type(BROKER)
    choices = client.get("/api/registry/choices", headers=auth).json()
    assert "test_broker" in choices["endpoint_types"] and choices["fields_by_endpoint_type"]["test_broker"] == ["extension_settings"]
    described = next(entry for entry in choices["extension_endpoint_types"] if entry["name"] == "test_broker")
    assert [field["name"] for field in described["settings_fields"]][:2] == ["address", "kind"] and described["secret_keys"] == ["password"]
    created = client.post("/api/registry/connections", headers=auth, json={"name": unique("broker"), "endpoint_type": "test_broker", "extension_settings": {"address": "x:1"}})
    assert created.status_code == 201 and created.json()["extension_settings"]["address"] == "x:1"
    refused = client.post("/api/registry/connections", headers=auth, json={"name": unique("broker"), "endpoint_type": "test_broker", "extension_settings": {}})
    assert refused.status_code == 422 and "required" in refused.json()["detail"]
    page_row = {"name": unique("page"), "endpoint_type": "test_broker", "is_enabled": True, "extension_settings": '{"address": "y:2"}'}
    from veloiq_framework.shared_connection_registry.connection_registry_non_model_data_resources import _create_connection
    row = _create_connection(None, page_row)
    assert json.loads(row["extension_settings"])["address"] == "y:2" and row["endpoint_type"] == "test_broker"
