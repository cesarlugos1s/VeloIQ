"""What a REST connection needs to authenticate, read from its settings and secrets and checked once, for every caller.

The framework's own calls turn it into headers and a query (``build_authentication``); the Integration Hub turns it into the authentication objects of
dlt. Neither repeats the lookup of the secrets or the checks of what is missing.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from veloiq_framework.utils.i18n_utils import _

from .connection_registry_models import Connection
from .connection_registry_store import RegistryRuleError
from .connection_secret_encryption import read_decrypted_secret

DEFAULT_API_KEY_HEADER_NAME = "X-API-Key"
DEFAULT_API_KEY_QUERY_PARAMETER_NAME = "api_key"


@dataclass(frozen=True)
class ResolvedRestAuthentication:
    """The authentication of a connection with its secrets decrypted: ``kind`` is the connection's authentication, the other fields are what that kind uses."""
    kind: str
    user_name: Optional[str] = None
    password: Optional[str] = None
    token: Optional[str] = None
    api_key: Optional[str] = None
    api_key_header_name: Optional[str] = None
    api_key_query_parameter_name: Optional[str] = None
    oauth_token_url: Optional[str] = None
    oauth_client_id: Optional[str] = None
    oauth_client_secret: Optional[str] = None
    oauth_scope: Optional[str] = None


# spec: connect-to-rest-and-openapi-apis :: Basic and API-key authentication
def resolve_rest_authentication(connection: Connection) -> ResolvedRestAuthentication:
    """The authentication of a REST connection, with the secrets it needs decrypted.

    :raises RegistryRuleError: When a setting or a secret the authentication needs is missing, or the authentication is not supported.
    """
    settings = connection.connection_has_rest_connection_settings[0]
    kind = settings.authentication
    if kind in ("none", "login_token"):
        return ResolvedRestAuthentication(kind)        # a login token is obtained by rest_login_token, which reads its own settings and secret
    if kind == "bearer_token":
        token = read_decrypted_secret(connection, "token")
        if not token:
            raise RegistryRuleError(_("The connection has no token secret."))
        return ResolvedRestAuthentication(kind, token=token)
    if kind == "oauth2_client_credentials":
        client_secret = read_decrypted_secret(connection, "client_secret")
        if not (settings.oauth_token_url and settings.oauth_client_id and client_secret):
            raise RegistryRuleError(_("OAuth needs the token address, the client identifier and the client secret."))
        return ResolvedRestAuthentication(kind, oauth_token_url=settings.oauth_token_url, oauth_client_id=settings.oauth_client_id,
                                          oauth_client_secret=client_secret, oauth_scope=settings.oauth_scope)
    if kind == "user_name_and_password":
        password = read_decrypted_secret(connection, "password")
        if not settings.user_name:
            raise RegistryRuleError(_("Basic authentication needs the user name."))
        if not password:
            raise RegistryRuleError(_("The connection has no password secret."))
        return ResolvedRestAuthentication(kind, user_name=settings.user_name, password=password)
    if kind in ("api_key_header", "api_key_query"):
        api_key = read_decrypted_secret(connection, "api_key")
        if not api_key:
            raise RegistryRuleError(_("The connection has no api key secret."))
        return ResolvedRestAuthentication(
            kind, api_key=api_key, api_key_header_name=settings.api_key_header_name or DEFAULT_API_KEY_HEADER_NAME,
            api_key_query_parameter_name=settings.api_key_query_parameter_name or DEFAULT_API_KEY_QUERY_PARAMETER_NAME)
    raise RegistryRuleError(_("The authentication {name} is not supported.").format(name=kind))
