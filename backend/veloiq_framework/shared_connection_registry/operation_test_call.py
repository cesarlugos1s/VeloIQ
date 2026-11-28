"""Run an operation of the registry for real, with the connection's authentication and sample values for its parameters.

A GET is sent at once. A POST, PUT, PATCH or DELETE changes data on the other system, so it is sent only when the caller confirms,
and the result says that data may have been created, replaced, updated or removed.
"""
from __future__ import annotations

import json
from typing import Any
from urllib.parse import quote, urlencode

from veloiq_framework.utils.i18n_utils import _

from .connection_registry_models import Connection, Operation
from .connection_registry_store import RegistryRuleError
from .connection_secret_encryption import decrypt_secret
from .http_calls_to_other_systems import send_http_request

MUTATING_METHODS = ("POST", "PUT", "PATCH", "DELETE")


def mutation_note(method: str) -> str | None:
    """What a write call may have done, shown after it was sent."""
    notes = {
        "POST": _("A POST request was sent: data may have been created."),
        "PUT": _("A PUT request was sent: data may have been replaced."),
        "PATCH": _("A PATCH request was sent: data may have been updated."),
        "DELETE": _("A DELETE request was sent: data may have been removed."),
    }
    return notes.get(method)


def _secret(connection: Connection, key: str) -> str | None:
    stored = next((secret for secret in connection.connection_has_connection_secret if secret.key == key), None)
    return decrypt_secret(stored.value) if stored is not None else None


def _oauth_access_token(connection: Connection, settings) -> str:
    """Get an access token with the client credentials the connection holds."""
    client_secret = _secret(connection, "client_secret")
    if not (settings.oauth_token_url and settings.oauth_client_id and client_secret):
        raise RegistryRuleError(_("OAuth needs the token address, the client identifier and the client secret."))
    form = {"grant_type": "client_credentials", "client_id": settings.oauth_client_id, "client_secret": client_secret}
    if settings.oauth_scope:
        form["scope"] = settings.oauth_scope
    answer = send_http_request("POST", settings.oauth_token_url, form=form, timeout_seconds=settings.timeout_seconds, verify_tls=settings.is_tls_verified)
    token = (answer.parsed_json() or {}).get("access_token") if answer.http_status == 200 else None
    if not token:
        raise RegistryRuleError(_("The token address did not give an access token."))
    return token


def build_authentication_headers(connection: Connection) -> dict[str, str]:
    """The headers that authenticate a call with the connection's authentication.

    :raises RegistryRuleError: When a secret is missing, or the authentication is one the registry cannot apply yet.
    """
    settings = connection.connection_has_rest_connection_settings[0]
    if settings.authentication == "none":
        return {}
    if settings.authentication == "bearer_token":
        token = _secret(connection, "token")
        if not token:
            raise RegistryRuleError(_("The connection has no token secret."))
        return {"Authorization": f"Bearer {token}"}
    if settings.authentication == "oauth2_client_credentials":
        return {"Authorization": f"Bearer {_oauth_access_token(connection, settings)}"}
    # The settings do not yet say the user name, the header name or the query parameter name these need.
    raise RegistryRuleError(_("The authentication {name} is not supported yet: the connection settings do not hold what it needs.")
                            .format(name=settings.authentication))


def _sample_values(operation: Operation, sample_values: dict[str, Any]) -> tuple[dict[str, str], dict[str, str], Any]:
    """Path values, query values and body: the sample values given, else the defaults of the operation's parameters."""
    schema = json.loads(operation.parameters_schema) if operation.parameters_schema else {}
    given_path, given_query = sample_values.get("path") or {}, sample_values.get("query") or {}
    path_values = {p["name"]: str(given_path.get(p["name"], p.get("default", ""))) for p in schema.get("path", []) if p.get("name")}
    query_values = {p["name"]: str(given_query.get(p["name"], p.get("default", ""))) for p in schema.get("query", []) if p.get("name")}
    return path_values, {name: value for name, value in query_values.items() if value != ""}, sample_values.get("body")


# spec: test-an-operation-from-the-registry :: Operation test
# spec: test-an-operation-from-the-registry :: Confirmation for write operations
def run_operation_test(connection: Connection, operation: Operation, sample_values: dict[str, Any] | None = None,
                       confirm_mutation: bool = False) -> dict[str, Any]:
    """Send the operation and describe what came back (status, headers, body, duration), or why it was not sent.

    :raises RegistryRuleError: When the connection is not a REST connection or cannot authenticate.
    """
    if not connection.connection_has_rest_connection_settings:
        raise RegistryRuleError(_("Only a REST connection can be tested."))
    settings = connection.connection_has_rest_connection_settings[0]
    path_values, query_values, body = _sample_values(operation, sample_values or {})
    path = operation.path
    for name, value in path_values.items():
        path = path.replace("{" + name + "}", quote(value, safe=""))
    url = f"{settings.base_url.rstrip('/')}/{path.lstrip('/')}"
    if query_values:
        url += ("&" if "?" in url else "?") + urlencode(query_values)
    if operation.method in MUTATING_METHODS and not confirm_mutation:
        return {"status": "warning", "http_status": None, "headers": {}, "body": "", "body_parsed": None, "duration_ms": 0, "url": url,
                "warning": _("This is a {method} request, which can change data. Confirm to send it to: {url}").format(method=operation.method, url=url)}
    result = send_http_request(operation.method, url, headers=build_authentication_headers(connection), body=body,
                               timeout_seconds=settings.timeout_seconds, verify_tls=settings.is_tls_verified)
    if result.failure is not None:
        return {"status": "error", "http_status": None, "headers": {}, "body": "", "body_parsed": None, "duration_ms": result.duration_ms,
                "warning": None, "error": f"{result.failure} ({url})", "url": url}
    return {"status": "success" if result.http_status < 400 else "error", "http_status": result.http_status, "headers": result.headers,
            "body": result.text, "body_parsed": result.parsed_json(), "duration_ms": result.duration_ms,
            "warning": mutation_note(operation.method), "url": url}


# spec: connect-to-rest-and-openapi-apis :: REST operations
def call_operation(connection: Connection, operation: Operation, sample_values: dict[str, Any] | None = None) -> dict[str, Any]:
    """Send an operation as part of running something (not as a test), with the connection's authentication.

    The answer has the shape of ``run_operation_test``. A write method is sent without asking: the caller decides whether it may.
    """
    return run_operation_test(connection, operation, sample_values, confirm_mutation=True)
