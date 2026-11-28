"""Encryption of the secrets of connections (passwords, tokens, API keys, private keys).

A secret must be given back to the system that needs it, so it is encrypted (Fernet: AES with an authentication tag),
not hashed. The key comes from the ``[registry]`` section ``secret_key`` of ``jm_config.ini`` or from the environment
variable ``VELOIQ_REGISTRY_SECRET_KEY``. Without a key a secret cannot be saved. A stored secret is never returned by any API.
"""
from __future__ import annotations

import os
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from veloiq_framework.utils.i18n_utils import _

REGISTRY_SECRET_KEY_ENVIRONMENT_VARIABLE = "VELOIQ_REGISTRY_SECRET_KEY"


class SecretKeyNotConfiguredError(Exception):
    """No key is configured, so a secret cannot be encrypted or decrypted."""


class SecretCannotBeDecryptedError(Exception):
    """A stored secret was encrypted with another key, or was changed."""


def read_configured_secret_key() -> Optional[str]:
    """Return the configured key, or None: the environment variable first, then ``[registry] secret_key``."""
    from_environment = os.environ.get(REGISTRY_SECRET_KEY_ENVIRONMENT_VARIABLE, "").strip()
    if from_environment:
        return from_environment
    from veloiq_framework.utils.data_mgmt_utils import jm_obtain_config
    configuration = jm_obtain_config()
    if configuration.has_option("registry", "secret_key"):
        return configuration.get("registry", "secret_key").strip() or None
    return None


def build_cipher() -> Fernet:
    """Build the cipher from the configured key.

    :raises SecretKeyNotConfiguredError: When there is no key, or the key is not a valid Fernet key.
    """
    key = read_configured_secret_key()
    if key is None:
        raise SecretKeyNotConfiguredError(_(
            "Secrets cannot be saved because no key is configured: set secret_key in the [registry] section of jm_config.ini "
            "or the environment variable VELOIQ_REGISTRY_SECRET_KEY."))
    try:
        return Fernet(key.encode())
    except ValueError as invalid_key:
        raise SecretKeyNotConfiguredError(_("The configured secret key is not valid; generate one with Fernet.generate_key().")) from invalid_key


# spec: manage-connections-with-secrets-and-a-connection-test :: Secrets handling
def encrypt_secret(plain_value: str) -> str:
    """Encrypt a secret for storage."""
    return build_cipher().encrypt(plain_value.encode()).decode()


# spec: manage-connections-with-secrets-and-a-connection-test :: Secrets handling
def decrypt_secret(stored_value: str) -> str:
    """Decrypt a stored secret; only code that must send it to the other system calls this."""
    try:
        return build_cipher().decrypt(stored_value.encode()).decode()
    except InvalidToken as unreadable:
        raise SecretCannotBeDecryptedError(_("A stored secret cannot be read with the configured key.")) from unreadable
