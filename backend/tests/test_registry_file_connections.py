"""File and SFTP connections of the shared registry: settings, their checks, and the connection test a package supplies."""
import uuid

import pytest

from veloiq_framework.shared_connection_registry.connection_tester_registrations import (
    find_connection_tester, register_connection_tester, remove_registered_connection_testers,
)


def create(client, auth, endpoint_type, **settings):
    return client.post("/api/registry/connections", headers=auth, json={
        "name": f"files-{uuid.uuid4().hex[:8]}", "endpoint_type": endpoint_type, "file_settings": settings})


SFTP = {"folder_path": "/outbound", "host": "sftp.example.com", "username": "hub", "host_key_fingerprint": "SHA256:abc"}


def test_a_local_folder_connection_keeps_its_settings_with_the_defaults_of_the_definition(client, auth):
    created = create(client, auth, "file", folder_path="orders")
    assert created.status_code == 201
    assert created.json()["file_settings"] == {
        "location": "local_folder", "folder_path": "orders", "file_pattern": "*", "format": "csv", "encoding": "utf-8", "delimiter": ",",
        "has_header": True, "host": None, "port": None, "username": None, "host_key_fingerprint": None}


def test_an_sftp_connection_keeps_its_server_and_the_fingerprint_it_expects(client, auth):
    created = create(client, auth, "sftp_folder", format="excel", **SFTP)
    assert created.status_code == 201
    settings = created.json()["file_settings"]
    assert settings["location"] == "sftp_folder" and settings["host_key_fingerprint"] == "SHA256:abc" and settings["format"] == "excel"


@pytest.mark.parametrize("endpoint_type,settings,fragment", [
    ("file", {}, "needs the folder"),
    ("file", {"folder_path": "x", "format": "xml"}, "must be one of"),
    ("file", {"folder_path": "x", "file_pattern": " "}, "file name pattern"),
    ("file", {"folder_path": "x", "delimiter": ";;"}, "one character"),
    ("file", {"folder_path": "x", "location": "sftp_folder"}, "does not match"),
    ("file", {"folder_path": "x", "color": "red"}, "Unknown file setting"),
    ("sftp_folder", {**SFTP, "host": ""}, "needs the SFTP server"),
    ("sftp_folder", {**SFTP, "username": None}, "needs the SFTP user"),
    ("sftp_folder", {k: v for k, v in SFTP.items() if k != "host_key_fingerprint"}, "needs the fingerprint of the SFTP server"),
    ("sftp_folder", {**SFTP, "port": 70000}, "between 1 and 65535"),
])
def test_file_settings_the_definition_does_not_allow_are_refused_with_a_message(client, auth, endpoint_type, settings, fragment):
    refused = create(client, auth, endpoint_type, **settings)
    assert refused.status_code == 422 and fragment in refused.json()["detail"]


def test_file_settings_can_be_changed_and_are_checked_again(client, auth):
    connection_id = create(client, auth, "file", folder_path="orders").json()["id"]
    changed = client.put(f"/api/registry/connections/{connection_id}", headers=auth, json={"file_settings": {"format": "json", "file_pattern": "*.json"}})
    assert changed.status_code == 200 and changed.json()["file_settings"]["format"] == "json"
    assert client.put(f"/api/registry/connections/{connection_id}", headers=auth, json={"file_settings": {"folder_path": ""}}).status_code == 422


def test_a_package_supplies_the_test_of_an_endpoint_type_and_the_endpoint_uses_it(client, auth):
    connection_id = create(client, auth, "file", folder_path="orders").json()["id"]
    register_connection_tester("file", lambda connection: {"status": "success", "endpoint_type": connection.endpoint_type, "url": "orders",
                                                          "duration_ms": 1, "http_status": None, "server": None, "error_type": None,
                                                          "error_message": None, "note": "folder found"})
    try:
        answer = client.post(f"/api/registry/connections/{connection_id}/test", headers=auth).json()
        assert answer["status"] == "success" and answer["note"] == "folder found"
        assert find_connection_tester("sftp_folder") is None
    finally:
        remove_registered_connection_testers()


def test_the_connections_list_shows_the_settings_of_each_kind_without_one_kind_blanking_another(client, auth):
    database = client.post("/api/registry/connections", headers=auth, json={
        "name": f"db-{uuid.uuid4().hex[:8]}", "endpoint_type": "database",
        "database_settings": {"database_type": "postgres", "host": "db.example.com", "database_name": "stock", "username": "reader"}}).json()
    sftp = create(client, auth, "sftp_folder", **SFTP).json()
    rows = {row["id"]: row for row in client.get("/api/veloiq_registry_connections?_start=0&_end=5000", headers=auth).json()}
    assert rows[database["id"]]["host"] == "db.example.com" and rows[database["id"]]["username"] == "reader"
    assert rows[sftp["id"]]["host"] == "sftp.example.com" and rows[sftp["id"]]["username"] == "hub"


def test_the_choices_say_which_fields_each_endpoint_type_shows(client, auth):
    choices = client.get("/api/registry/choices", headers=auth).json()
    by_type = choices["fields_by_endpoint_type"]
    assert choices["fields_of_every_connection"] == ["id", "name", "endpoint_type", "is_enabled"]
    assert "base_url" in by_type["rest_api"] and "folder_path" not in by_type["rest_api"]
    assert "host_key_fingerprint" in by_type["sftp_folder"] and "host_key_fingerprint" not in by_type["file"] and "folder_path" in by_type["file"]
    assert "cursor_column" in by_type["database"] and "target_url" in by_type["outgoing_webhook"] and "target_url" not in by_type["incoming_webhook"]
    assert by_type["incoming_api_endpoint"] == ["endpoint_name", "inbound_authentication", "max_records_per_push"]
    from veloiq_framework.shared_connection_registry.connection_registry_non_model_data_resources import build_connections_non_model_data_resource
    every_field = {field for fields in by_type.values() for field in fields}
    resource_fields = {field.key for field in build_connections_non_model_data_resource().fields}
    decided_by_the_type = {"location", "direction"}                                             # the endpoint type decides them; the pages do not ask
    assert resource_fields - set(choices["fields_of_every_connection"]) == every_field | decided_by_the_type
    assert not decided_by_the_type & every_field
