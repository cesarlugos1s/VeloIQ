"""Check who sends an incoming call to a webhook or an inbound API endpoint of the registry: a signature or an API key."""
from __future__ import annotations

import hashlib
import hmac
from typing import Optional

from .connection_registry_models import Connection
from .connection_secret_encryption import read_decrypted_secret

SIGNATURE_PREFIX = "sha256="


def compute_webhook_signature(shared_secret: str, body: bytes) -> str:
    """The HMAC-SHA256 of the request body with the shared secret, as lowercase hexadecimal text (what a sender puts in the header)."""
    return hmac.new(shared_secret.encode(), body, hashlib.sha256).hexdigest()


# spec: receive-inbound-webhooks :: Signature method
def webhook_signature_is_valid(connection: Connection, body: bytes, received_signature: Optional[str]) -> bool:
    """Whether the signature sent with a body is the HMAC-SHA256 of the body with the connection's signing secret.

    The signature may carry the prefix ``sha256=``. A missing signature, a missing secret or any difference gives False; the comparison
    takes the same time wherever the texts differ.
    """
    shared_secret = read_decrypted_secret(connection, "signing_secret")
    if not shared_secret or not received_signature:
        return False
    received = received_signature.strip().removeprefix(SIGNATURE_PREFIX).lower()
    return hmac.compare_digest(compute_webhook_signature(shared_secret, body), received)


# spec: receive-pushed-data-through-inbound-api-endpoints :: Inbound API endpoint
def api_key_is_valid(connection: Connection, received_key: Optional[str]) -> bool:
    """Whether the key a sender sent is the connection's api key secret (compared in constant time)."""
    stored_key = read_decrypted_secret(connection, "api_key")
    return bool(stored_key and received_key) and hmac.compare_digest(stored_key.encode(), received_key.encode())
