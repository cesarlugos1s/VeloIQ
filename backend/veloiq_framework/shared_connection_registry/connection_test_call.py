"""Test a REST connection: send a GET to its base address with its authentication and say what came back.

Nothing is changed on the other system. A status of 404 or 405 on the base address counts as reachable, because many APIs have
nothing at their root; a status of 401 or 403 is a failure that says the credentials were not accepted.
"""
from __future__ import annotations

from typing import Any

from veloiq_framework.utils.i18n_utils import _

from .connection_registry_models import Connection
from .connection_registry_store import RegistryRuleError
from .http_calls_to_other_systems import send_http_request
from .operation_test_call import build_authentication_headers

REACHABLE_WITHOUT_A_PAGE_STATUSES = (404, 405)
CREDENTIALS_REFUSED_STATUSES = (401, 403)


# spec: manage-connections-with-secrets-and-a-connection-test :: Test a REST connection
def test_rest_connection(connection: Connection) -> dict[str, Any]:
    """Send the test request and describe the result in the shape the connection test window shows.

    :raises RegistryRuleError: When the connection is not a REST connection, or cannot authenticate (a secret is missing).
    """
    if not connection.connection_has_rest_connection_settings:
        raise RegistryRuleError(_("Only a REST connection can be tested."))
    settings = connection.connection_has_rest_connection_settings[0]
    answer = send_http_request("GET", settings.base_url, headers=build_authentication_headers(connection),
                               timeout_seconds=settings.timeout_seconds, verify_tls=settings.is_tls_verified)
    result: dict[str, Any] = {"status": "error", "endpoint_type": connection.endpoint_type, "url": settings.base_url,
                              "http_status": answer.http_status, "duration_ms": answer.duration_ms,
                              "server": next((value for key, value in answer.headers.items() if key.lower() == "server"), None),
                              "error_type": None, "error_message": None, "note": None}
    if answer.failure is not None:
        result.update(error_type="unreachable", error_message=_("The address {url} cannot be reached: {problem}").format(url=settings.base_url, problem=answer.failure))
    elif answer.http_status in CREDENTIALS_REFUSED_STATUSES:
        result.update(error_type="credentials_refused", error_message=_("The system did not accept the credentials (status {status}).").format(status=answer.http_status))
    elif answer.http_status in REACHABLE_WITHOUT_A_PAGE_STATUSES:
        result.update(status="success", note=_("Nothing is served at the base address (status {status}), but the system answered.").format(status=answer.http_status))
    elif answer.http_status >= 400:
        result.update(error_type="error_status", error_message=_("The system answered with the status {status}.").format(status=answer.http_status))
    else:
        result["status"] = "success"
    return result
