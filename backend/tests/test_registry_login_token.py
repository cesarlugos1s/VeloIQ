"""The login-token authentication: log in once, reuse the token, log in again when a call is refused, and the settings it needs."""
import json
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest
from cryptography.fernet import Fernet
from sqlmodel import Session

from veloiq_framework.db import get_engine
from veloiq_framework.shared_connection_registry import connection_registry_store as store
from veloiq_framework.shared_connection_registry.connection_registry_models import Connection
from veloiq_framework.shared_connection_registry.connection_secret_encryption import REGISTRY_SECRET_KEY_ENVIRONMENT_VARIABLE
from veloiq_framework.shared_connection_registry.operation_test_call import call_operation
from veloiq_framework.shared_connection_registry.rest_login_token import forget_login_token


class AppWithLogin(BaseHTTPRequestHandler):
    """POST /auth/login gives a new token each time (valid until expire() is called); GET /secured needs the current one."""
    logins = 0
    valid_token = None
    last_login_body = None

    def log_message(self, *arguments):
        pass

    def _send(self, status, payload):
        raw = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(raw)

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(length) or b"{}")
        AppWithLogin.last_login_body = body
        if body.get("login") != "robot" or body.get("secret") != "s3cret":
            return self._send(401, {"detail": "bad credentials"})
        AppWithLogin.logins += 1
        AppWithLogin.valid_token = f"token-{AppWithLogin.logins}"
        self._send(200, {"data": {"jwt": AppWithLogin.valid_token}})

    def do_GET(self):
        if self.headers.get("Authorization") == f"Bearer {AppWithLogin.valid_token}":
            return self._send(200, {"ok": True})
        self._send(401, {"detail": "expired"})


@pytest.fixture(scope="module")
def app_url():
    server = ThreadingHTTPServer(("127.0.0.1", 0), AppWithLogin)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_address[1]}"
    server.shutdown()


@pytest.fixture()
def secret_key(monkeypatch):
    monkeypatch.setenv(REGISTRY_SECRET_KEY_ENVIRONMENT_VARIABLE, Fernet.generate_key().decode())


def login_settings(app_url, **overrides):
    return {"base_url": app_url, "authentication": "login_token", "user_name": "robot", "login_path": "/auth/login", "login_user_field": "login",
            "login_password_field": "secret", "login_token_path": "data.jwt", **overrides}


def create(client, auth, app_url, **overrides):
    return client.post("/api/registry/connections", headers=auth, json={"name": f"login-{uuid.uuid4().hex[:8]}", "endpoint_type": "rest_api",
                                                                          "rest_settings": login_settings(app_url, **overrides)})


def secured_operation(client, auth, connection_id):
    return client.post(f"/api/registry/connections/{connection_id}/operations", headers=auth, json={"name": "secured", "path": "/secured"}).json()


def test_a_call_logs_in_once_reuses_the_token_and_logs_in_again_when_the_token_is_refused(client, auth, secret_key, app_url):
    AppWithLogin.logins = 0
    connection_id = create(client, auth, app_url).json()["id"]
    assert client.put(f"/api/registry/connections/{connection_id}/secrets/password", headers=auth, json={"value": "s3cret"}).status_code == 204
    operation_id = secured_operation(client, auth, connection_id)["id"]
    forget_login_token(connection_id)
    with Session(get_engine()) as session:
        connection = session.get(Connection, connection_id)
        operation = connection.connection_has_operation[0]
        assert call_operation(connection, operation)["http_status"] == 200 and AppWithLogin.logins == 1
        assert AppWithLogin.last_login_body == {"login": "robot", "secret": "s3cret"}        # the names of the fields are the connection's
        assert call_operation(connection, operation)["http_status"] == 200 and AppWithLogin.logins == 1        # the token is reused
        AppWithLogin.valid_token = "expired-on-the-server"
        assert call_operation(connection, operation)["http_status"] == 200 and AppWithLogin.logins == 2        # refused, logged in again, repeated once


def test_a_refused_login_a_missing_password_and_an_answer_without_a_token_are_reported_with_a_message(client, auth, secret_key, app_url):
    wrong = create(client, auth, app_url).json()["id"]
    client.put(f"/api/registry/connections/{wrong}/secrets/password", headers=auth, json={"value": "wrong"})
    no_secret = create(client, auth, app_url).json()["id"]
    no_token = create(client, auth, app_url, login_token_path="data.nothing").json()["id"]
    client.put(f"/api/registry/connections/{no_token}/secrets/password", headers=auth, json={"value": "s3cret"})
    from veloiq_framework.shared_connection_registry.connection_registry_store import RegistryRuleError
    for connection_id, fragment in ((wrong, "refused with the status 401"), (no_secret, "no password secret"), (no_token, "no token at 'data.nothing'")):
        secured_operation(client, auth, connection_id)
        forget_login_token(connection_id)
        with Session(get_engine()) as session:
            connection = session.get(Connection, connection_id)
            with pytest.raises(RegistryRuleError, match=fragment):
                call_operation(connection, connection.connection_has_operation[0])


@pytest.mark.parametrize("overrides,fragment", [
    ({"login_path": None}, "needs the path of the login"),
    ({"user_name": None}, "needs the user name"),
    ({"login_token_path": ""}, "needs the path of the token"),
])
def test_the_login_token_authentication_needs_its_settings_when_saved(client, auth, app_url, overrides, fragment):
    refused = create(client, auth, app_url, **overrides)
    assert refused.status_code == 422 and fragment in refused.json()["detail"]


def test_a_veloiq_app_is_no_longer_an_endpoint_type_and_the_pages_show_the_login_fields_only_for_rest(client, auth):
    choices = client.get("/api/registry/choices", headers=auth).json()
    assert "veloiq_app" not in choices["endpoint_types"] and "login_token" in choices["rest_authentications"]
    assert "login_path" in choices["fields_by_endpoint_type"]["rest_api"] and "login_path" not in choices["fields_by_endpoint_type"]["file"]
