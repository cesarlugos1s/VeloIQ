"""The login-token authentication of a REST connection: log in with the user name and the password secret, keep the token, forget it when refused.

The token is kept in memory for each connection (a restart logs in again), is sent as a bearer token, and is replaced by a new login when a call
is refused with 401. Several workers each keep their own token.
"""
from __future__ import annotations

import threading
from typing import Optional

from veloiq_framework.utils.i18n_utils import _

from .connection_registry_models import Connection
from .connection_registry_store import RegistryRuleError
from .connection_secret_encryption import decrypt_secret
from .http_calls_to_other_systems import send_http_request
from .registry_answer_paths import read_at_path

LOGIN_TOKEN_AUTHENTICATION = "login_token"

_login_tokens: dict[int, str] = {}
_login_tokens_lock = threading.Lock()


def forget_login_token(connection_id: int) -> None:
    """Drop the token held for a connection, so the next call logs in again."""
    with _login_tokens_lock:
        _login_tokens.pop(connection_id, None)


# spec: connect-to-rest-and-openapi-apis :: Login-token authentication
def obtain_login_token(connection: Connection, force_new_login: bool = False) -> str:
    """The token of a connection with the login-token authentication: the one held, or one from a new login.

    :param force_new_login: True to log in even when a token is held (after the other system refused it).
    :raises RegistryRuleError: When a setting or the password secret is missing, the login cannot be reached or is refused, or its answer holds no token.
    """
    settings = connection.connection_has_rest_connection_settings[0]
    if not force_new_login:
        with _login_tokens_lock:
            held = _login_tokens.get(connection.id)
        if held:
            return held
    stored_password = next((secret for secret in connection.connection_has_connection_secret if secret.key == "password"), None)
    if not settings.user_name or not settings.login_path:
        raise RegistryRuleError(_("The login-token authentication needs the user name and the path of the login."))
    if stored_password is None:
        raise RegistryRuleError(_("The connection has no password secret."))
    login_body = {settings.login_user_field or "username": settings.user_name, settings.login_password_field or "password": decrypt_secret(stored_password.value)}
    answer = send_http_request("POST", f"{settings.base_url.rstrip('/')}/{settings.login_path.lstrip('/')}", body=login_body,
                               timeout_seconds=settings.timeout_seconds, verify_tls=settings.is_tls_verified)
    if answer.failure is not None:
        raise RegistryRuleError(_("The login could not be reached: {problem}").format(problem=answer.failure))
    if answer.http_status is None or answer.http_status >= 400:
        raise RegistryRuleError(_("The login was refused with the status {status}.").format(status=answer.http_status))
    token = read_at_path(answer.parsed_json(), settings.login_token_path or "access_token")
    if not isinstance(token, str) or not token:
        raise RegistryRuleError(_("The answer to the login has no token at '{path}'.").format(path=settings.login_token_path))
    with _login_tokens_lock:
        _login_tokens[connection.id] = token
    return token
