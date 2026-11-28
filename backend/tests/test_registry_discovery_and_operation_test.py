"""URL discovery and the operation test of the shared connection registry, against a small web server on this machine."""
import json
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

import pytest
from cryptography.fernet import Fernet

from veloiq_framework.shared_connection_registry.connection_secret_encryption import REGISTRY_SECRET_KEY_ENVIRONMENT_VARIABLE
from veloiq_framework.shared_connection_registry.json_schema_from_sample import infer_json_schema
from veloiq_framework.shared_connection_registry.operation_discovery_from_url import analyse_url, classify_path_segment, discover_operation_from_url

OPENAPI = {"openapi": "3.0.0", "paths": {"/orders/{order_id}": {"get": {
    "operationId": "getOrder", "summary": "Read one order",
    "parameters": [{"name": "order_id", "in": "path", "required": True, "schema": {"type": "integer"}}],
    "responses": {"200": {"content": {"application/json": {"schema": {"type": "object", "properties": {"id": {"type": "integer"}}}}}}}}}}}


class OtherSystem(BaseHTTPRequestHandler):
    """A tiny API: an order with an OpenAPI description, an item without one, a secured page, a write call and an OAuth token address."""
    received: list = []

    def log_message(self, *arguments):
        pass

    def _send(self, status, payload, headers=None):
        raw = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        self.wfile.write(raw)

    def _read(self):
        length = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(length).decode() if length else ""

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Allow", "GET, DELETE, OPTIONS")
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        OtherSystem.received.append(("GET", self.path, self.headers.get("Authorization")))
        if path == "/openapi.json":
            return self._send(200, OPENAPI)
        if path == "/basic":
            ok = self.headers.get("Authorization") == "Basic dXNlcjpwdw=="            # user:pw
            return self._send(200 if ok else 401, {"ok": ok})
        if path == "/header-key":
            ok = self.headers.get("X-Token") == "k1" or self.headers.get("X-API-Key") == "k1"
            return self._send(200 if ok else 401, {"ok": ok, "by": "X-Token" if self.headers.get("X-Token") else "X-API-Key"})
        if path == "/query-key":
            query = self.path.partition("?")[2]
            ok = "key=k1" in query or "api_key=k1" in query
            return self._send(200 if ok else 401, {"ok": ok, "query": query})
        if path == "/secure":
            ok = self.headers.get("Authorization") in ("Bearer s3cr3t", "Bearer oauth-token-1")
            return self._send(200 if ok else 401, {"ok": ok})
        if path.startswith("/orders/"):
            return self._send(200, {"id": int(path.rsplit("/", 1)[1]), "total": 5.5})
        if path.startswith("/items/"):
            return self._send(200, [{"sku": "A1", "qty": 3}])
        return self._send(404, {"error": "no such page"})

    def do_POST(self):
        body = self._read()
        OtherSystem.received.append(("POST", self.path, body))
        if self.path == "/oauth/token":
            fields = parse_qs(body)
            ok = fields.get("client_id") == ["client-1"] and fields.get("client_secret") == ["client-secret"]
            return self._send(200 if ok else 401, {"access_token": "oauth-token-1"} if ok else {"error": "bad client"})
        return self._send(201, {"created": json.loads(body) if body else None})


@pytest.fixture(scope="module")
def other_system():
    server = ThreadingHTTPServer(("127.0.0.1", 0), OtherSystem)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{server.server_address[1]}"
    server.shutdown()


@pytest.fixture()
def secret_key(monkeypatch):
    monkeypatch.setenv(REGISTRY_SECRET_KEY_ENVIRONMENT_VARIABLE, Fernet.generate_key().decode())


# ---- identifiers by shape (no list of words) -------------------------------------------------------------

@pytest.mark.parametrize("url,expected_path", [
    ("https://example.org/users/42/posts", "/users/{id}/posts"),
    ("https://example.org/invoices/2024/lines", "/invoices/{id}/lines"),
    ("https://example.org/customers/7", "/customers/{id}"),
    ("https://example.org/allocationstrategy/12/results-summary", "/allocationstrategy/{id}/results-summary"),
    ("https://example.org/v1/orders/abc123", "/v1/orders/{id}"),
    ("https://example.org/vendors/Bonafont", "/vendors/Bonafont"),                       # letters only: stays in the path
    ("https://example.org/e/123e4567-e89b-12d3-a456-426614174000/on/2026-03-01", "/e/{uuid}/on/{date}"),
    ("https://example.org/a/1/b/2", "/a/{id}/b/{id_2}"),
    ("https://example.org/", "/"),
])
def test_identifiers_are_recognised_by_their_shape(url, expected_path):
    assert analyse_url(url)["path"] == expected_path


def test_query_values_become_typed_parameters_and_versions_are_not_identifiers():
    analysed = analyse_url("https://example.org/orders?page=2&ratio=0.5&q=abc")
    assert {p["name"]: (p["type"], p["default"]) for p in analysed["query_parameters"]} == {"page": ("integer", "2"), "ratio": ("number", "0.5"), "q": ("string", "abc")}
    assert [classify_path_segment(s) for s in ("v1", "V2", "42", "abc", "abc1")] == [None, None, ("id", "integer"), None, ("id", "string")]


def test_the_shape_rule_holds_no_word_list():
    import inspect
    from veloiq_framework.shared_connection_registry import operation_discovery_from_url as module
    source = inspect.getsource(module)
    assert not any(word in source for word in ('"posts"', '"users"', '"orders"', '"login"'))


# ---- discovery -------------------------------------------------------------------------------------------

def test_discovery_uses_the_description_before_the_real_request(other_system):
    OtherSystem.received.clear()
    found = discover_operation_from_url(f"{other_system}/orders/42")
    # The description gives the output, so the real request is not needed (the order of the strategies: analysis, description, OPTIONS, real request).
    assert found["found_by"] == ["url_analysis", "openapi_description", "options_request"]
    assert not any(call[1] == "/orders/42" for call in OtherSystem.received)
    assert (found["method"], found["path"], found["description"], found["source"]) == ("GET", "/orders/{order_id}", "Read one order", "url_discovery")
    assert found["allowed_methods"] == ["GET", "DELETE"]
    assert json.loads(found["parameters_schema"])["path"][0]["name"] == "order_id"
    assert json.loads(found["response_schema"])["properties"]["id"]["type"] == "integer"      # from the description first


def test_discovery_without_a_description_learns_the_output_from_the_real_request(other_system):
    found = discover_operation_from_url(f"{other_system}/items/7")
    assert "openapi_description" not in found["found_by"] and "real_request" in found["found_by"]
    assert found["path"] == "/items/{id}" and found["response_type"] == "array"
    assert json.loads(found["response_schema"]) == {"type": "array", "items": {"type": "object", "properties": {"sku": {"type": "string"}, "qty": {"type": "integer"}}}}
    assert found["parameters"]["path"][0]["default"] == "7" and found["http_method"] == "GET" and found["summary"]    # the shape IQVigilant's screens read


def test_a_write_method_is_never_sent_while_discovering(other_system):
    OtherSystem.received.clear()
    found = discover_operation_from_url(f"{other_system}/items/7", "POST")
    assert found["method"] == "POST" or found["method"] in ("GET", "DELETE")
    assert not any(call[0] == "POST" for call in OtherSystem.received)


def test_an_unreachable_url_still_gives_the_operation_from_the_url_and_says_so():
    found = discover_operation_from_url("http://127.0.0.1:9/items/7")
    assert found["found_by"] == ["url_analysis"] and found["path"] == "/items/{id}" and "could not be reached" in found["notice"]


@pytest.mark.parametrize("url,method", [("", "GET"), ("http://x/y", "TRACE")])
def test_discovery_refuses_an_empty_url_and_an_unknown_method(url, method):
    with pytest.raises(ValueError):
        discover_operation_from_url(url, method)


def test_the_discovery_endpoint_works_for_an_administrator_only(client, auth, manager_auth, other_system):
    found = client.post("/api/registry/operation-discoveries", headers=auth, json={"url": f"{other_system}/items/7"})
    assert found.status_code == 200 and found.json()["path"] == "/items/{id}"
    assert client.post("/api/registry/operation-discoveries", headers=auth, json={"url": ""}).status_code == 400
    assert client.post("/api/registry/operation-discoveries", headers=manager_auth, json={"url": "http://x/y"}).status_code in (401, 403)


# ---- the operation test ----------------------------------------------------------------------------------

def _connection(client, auth, other_system, **rest):
    return client.post("/api/registry/connections", headers=auth, json={
        "name": f"c-{uuid.uuid4().hex[:8]}", "endpoint_type": "rest_api", "rest_settings": {"base_url": other_system, **rest}}).json()["id"]


def _operation(client, auth, connection_id, **values):
    return client.post(f"/api/registry/connections/{connection_id}/operations", headers=auth,
                       json={"name": f"o-{uuid.uuid4().hex[:6]}", **values}).json()["id"]


def test_a_read_operation_is_sent_with_the_bearer_token_and_the_sample_values(client, auth, secret_key, other_system):
    connection_id = _connection(client, auth, other_system, authentication="bearer_token")
    client.put(f"/api/registry/connections/{connection_id}/secrets/token", headers=auth, json={"value": "s3cr3t"})
    operation_id = _operation(client, auth, connection_id, path="/orders/{order_id}", parameters_schema=json.dumps({"path": [{"name": "order_id", "default": "1"}]}))
    result = client.post(f"/api/registry/operations/{operation_id}/tests", headers=auth, json={"sample_values": {"path": {"order_id": 42}}}).json()
    assert result["status"] == "success" and result["http_status"] == 200 and result["body_parsed"] == {"id": 42, "total": 5.5}
    assert result["url"].endswith("/orders/42") and result["warning"] is None
    secured = _operation(client, auth, connection_id, path="/secure")
    assert client.post(f"/api/registry/operations/{secured}/tests", headers=auth).json()["http_status"] == 200      # the token was sent
    anonymous = _connection(client, auth, other_system)
    unauthenticated = _operation(client, auth, anonymous, path="/secure")
    assert client.post(f"/api/registry/operations/{unauthenticated}/tests", headers=auth).json()["status"] == "error"   # 401: no token


def test_a_write_operation_asks_for_confirmation_and_says_data_may_have_changed(client, auth, secret_key, other_system):
    connection_id = _connection(client, auth, other_system)
    operation_id = _operation(client, auth, connection_id, path="/orders", method="POST")
    OtherSystem.received.clear()
    first = client.post(f"/api/registry/operations/{operation_id}/tests", headers=auth, json={"sample_values": {"body": {"sku": "A1"}}}).json()
    assert first["status"] == "warning" and "Confirm to send" in first["warning"] and not OtherSystem.received      # nothing was sent
    confirmed = client.post(f"/api/registry/operations/{operation_id}/tests", headers=auth,
                            json={"sample_values": {"body": {"sku": "A1"}}, "confirm_mutation": True}).json()
    assert confirmed["http_status"] == 201 and confirmed["body_parsed"] == {"created": {"sku": "A1"}} and "data may have been created" in confirmed["warning"]


def test_oauth_client_credentials_get_a_token_first(client, auth, secret_key, other_system):
    connection_id = _connection(client, auth, other_system, authentication="oauth2_client_credentials",
                                oauth_token_url=f"{other_system}/oauth/token", oauth_client_id="client-1")
    operation_id = _operation(client, auth, connection_id, path="/secure")
    assert "needs the token address" in client.post(f"/api/registry/operations/{operation_id}/tests", headers=auth).json()["detail"]   # no client secret yet
    client.put(f"/api/registry/connections/{connection_id}/secrets/client_secret", headers=auth, json={"value": "client-secret"})
    assert client.post(f"/api/registry/operations/{operation_id}/tests", headers=auth).json()["http_status"] == 200


def _operation_and_call(client, auth, connection_id, path):
    operation_id = _operation(client, auth, connection_id, path=path)
    return client.post(f"/api/registry/operations/{operation_id}/tests", headers=auth).json()


def test_basic_authentication_sends_the_user_name_and_the_password_secret(client, auth, secret_key, other_system):
    nameless = client.post("/api/registry/connections", headers=auth, json={"name": f"n-{uuid.uuid4().hex[:6]}", "endpoint_type": "rest_api",
                           "rest_settings": {"base_url": other_system, "authentication": "user_name_and_password"}})
    assert nameless.status_code == 422 and "needs the user name" in nameless.json()["detail"]        # refused when it is saved
    connection_id = _connection(client, auth, other_system, authentication="user_name_and_password", user_name="user")
    no_secret = client.post(f"/api/registry/operations/{_operation(client, auth, connection_id, path='/basic')}/tests", headers=auth)
    assert no_secret.status_code == 422 and "no password secret" in no_secret.json()["detail"]
    client.put(f"/api/registry/connections/{connection_id}/secrets/password", headers=auth, json={"value": "pw"})
    assert _operation_and_call(client, auth, connection_id, "/basic")["http_status"] == 200
    client.put(f"/api/registry/connections/{connection_id}/secrets/password", headers=auth, json={"value": "wrong"})
    assert _operation_and_call(client, auth, connection_id, "/basic")["status"] == "error"
    assert client.post(f"/api/registry/connections/{connection_id}/test", headers=auth).json()["status"] in ("error", "success")


def test_an_api_key_goes_in_the_header_or_the_query_parameter_the_connection_names_with_conventional_defaults(client, auth, secret_key, other_system):
    in_default_header = _connection(client, auth, other_system, authentication="api_key_header")
    client.put(f"/api/registry/connections/{in_default_header}/secrets/api_key", headers=auth, json={"value": "k1"})
    answered = _operation_and_call(client, auth, in_default_header, "/header-key")
    assert answered["http_status"] == 200 and answered["body_parsed"]["by"] == "X-API-Key"           # the default header name
    in_named_header = _connection(client, auth, other_system, authentication="api_key_header", api_key_header_name="X-Token")
    client.put(f"/api/registry/connections/{in_named_header}/secrets/api_key", headers=auth, json={"value": "k1"})
    assert _operation_and_call(client, auth, in_named_header, "/header-key")["body_parsed"]["by"] == "X-Token"
    in_query = _connection(client, auth, other_system, authentication="api_key_query", api_key_query_parameter_name="key")
    client.put(f"/api/registry/connections/{in_query}/secrets/api_key", headers=auth, json={"value": "k1"})
    sent = _operation_and_call(client, auth, in_query, "/query-key")
    assert sent["http_status"] == 200 and "key=k1" in sent["body_parsed"]["query"]
    assert "k1" not in sent["url"]                                                                    # the key is sent but not shown in the result
    assert client.post(f"/api/registry/connections/{in_query}/test", headers=auth).json()["http_status"] in (200, 404)


def test_an_api_key_without_its_secret_or_a_header_name_is_refused_with_a_message(client, auth, secret_key, other_system):
    connection_id = _connection(client, auth, other_system, authentication="api_key_header")
    no_secret = client.post(f"/api/registry/operations/{_operation(client, auth, connection_id, path='/header-key')}/tests", headers=auth)
    assert no_secret.status_code == 422 and "no api key secret" in no_secret.json()["detail"]
    nameless = client.put(f"/api/registry/connections/{connection_id}", headers=auth, json={"rest_settings": {"api_key_header_name": None}})
    assert nameless.status_code == 422 and "name of the header" in nameless.json()["detail"]


def test_a_server_that_does_not_answer_is_reported_with_the_address(client, auth):
    connection_id = client.post("/api/registry/connections", headers=auth, json={
        "name": f"c-{uuid.uuid4().hex[:8]}", "endpoint_type": "rest_api", "rest_settings": {"base_url": "http://127.0.0.1:9", "timeout_seconds": 2}}).json()["id"]
    operation_id = _operation(client, auth, connection_id, path="/x")
    result = client.post(f"/api/registry/operations/{operation_id}/tests", headers=auth).json()
    assert result["status"] == "error" and result["http_status"] is None and "127.0.0.1:9" in result["error"]


def test_the_output_structure_of_a_test_can_be_recorded_as_the_output_schema(client, auth, other_system):
    connection_id = _connection(client, auth, other_system)
    operation_id = _operation(client, auth, connection_id, path="/orders/{order_id}")
    recorded = client.post(f"/api/registry/operations/{operation_id}/response-schema-from-sample", headers=auth, json={"sample": {"id": 1, "tags": ["a"], "ok": True}})
    assert json.loads(recorded.json()["response_schema"]) == {"type": "object", "properties": {
        "id": {"type": "integer"}, "tags": {"type": "array", "items": {"type": "string"}}, "ok": {"type": "boolean"}}}
    assert client.post(f"/api/registry/operations/{operation_id}/response-schema-from-sample", headers=auth, json={}).status_code == 400


def test_a_schema_is_inferred_from_a_sample():
    assert infer_json_schema([]) == {"type": "array", "items": {}} and infer_json_schema(1.5) == {"type": "number"} and infer_json_schema(None) == {"type": "null"}


def test_an_openapi_description_can_be_previewed_before_a_connection_is_chosen(client, auth):
    preview = client.post("/api/registry/openapi-previews", headers=auth, json={"content": json.dumps(OPENAPI)})
    assert preview.status_code == 200 and preview.json()["operations"][0]["path"] == "/orders/{order_id}"
    refused = client.post("/api/registry/openapi-previews", headers=auth, json={"content": "{\"hello\": 1}"})
    assert refused.status_code == 422 and "not an OpenAPI description" in refused.json()["detail"]
    unreachable = client.post("/api/registry/openapi-previews", headers=auth, json={"address": "http://127.0.0.1:9/openapi.json"})
    assert unreachable.status_code == 422 and "supply the description as a file" in unreachable.json()["detail"]


def test_a_rest_connection_is_tested_with_a_get_to_its_base_address(client, auth, secret_key, other_system):
    def tested(base_path, **rest):
        connection_id = _connection(client, auth, other_system + base_path, **rest)
        return connection_id, client.post(f"/api/registry/connections/{connection_id}/test", headers=auth)
    connection_id, ok = tested("/secure", authentication="bearer_token")
    assert ok.status_code == 422 and "no token secret" in ok.json()["detail"]                  # the secret is missing: nothing is sent
    client.put(f"/api/registry/connections/{connection_id}/secrets/token", headers=auth, json={"value": "s3cr3t"})
    answered = client.post(f"/api/registry/connections/{connection_id}/test", headers=auth).json()
    assert answered["status"] == "success" and answered["http_status"] == 200 and answered["duration_ms"] >= 0 and answered["error_message"] is None
    client.put(f"/api/registry/connections/{connection_id}/secrets/token", headers=auth, json={"value": "wrong"})
    refused = client.post(f"/api/registry/connections/{connection_id}/test", headers=auth).json()
    assert refused["status"] == "error" and refused["error_type"] == "credentials_refused" and "did not accept the credentials" in refused["error_message"]
    _id, nothing_at_root = tested("/no-such-page")
    assert nothing_at_root.json()["status"] == "success" and "Nothing is served" in nothing_at_root.json()["note"]      # a 404 on the base address is reachable
    _id, unreachable = tested("", )
    down = client.post("/api/registry/connections", headers=auth, json={"name": f"d-{uuid.uuid4().hex[:6]}", "endpoint_type": "rest_api",
                                                                       "rest_settings": {"base_url": "http://127.0.0.1:9", "timeout_seconds": 2}}).json()["id"]
    failed = client.post(f"/api/registry/connections/{down}/test", headers=auth).json()
    assert failed["status"] == "error" and failed["error_type"] == "unreachable" and "127.0.0.1:9" in failed["error_message"]
    file_connection = client.post("/api/registry/connections", headers=auth, json={"name": f"f-{uuid.uuid4().hex[:6]}", "endpoint_type": "file"}).json()["id"]
    assert "Only a REST connection" in client.post(f"/api/registry/connections/{file_connection}/test", headers=auth).json()["detail"]
    assert client.post(f"/api/registry/connections/{connection_id}/test").status_code in (401, 403)
