"""One small HTTP client for the registry (standard library only): the discovery and the test of operations use it."""
from __future__ import annotations

import json
import ssl
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Optional

MAXIMUM_BODY_CHARACTERS = 50_000


@dataclass
class HttpResult:
    """What came back from a call: a status (None when nothing answered), headers, the text, and how long it took.

    ``headers`` holds one value for each name (the last, when a name repeats); ``set_cookies`` holds every ``Set-Cookie`` value, because a server can set
    several cookies and a session (SAP's CSRF token, for one) is only valid with all of them.
    """
    http_status: Optional[int] = None
    headers: dict[str, str] = field(default_factory=dict)
    text: str = ""
    duration_ms: int = 0
    failure: Optional[str] = None
    set_cookies: list[str] = field(default_factory=list)

    def parsed_json(self) -> Any:
        """The body as JSON, or None when it is not JSON."""
        try:
            return json.loads(self.text)
        except ValueError:
            return None


def send_http_request(method: str, url: str, headers: Optional[dict[str, str]] = None, body: Any = None,
                      form: Optional[dict[str, str]] = None, timeout_seconds: int = 30, verify_tls: bool = True) -> HttpResult:
    """Send one request. A status of 400 or more is a result, not an exception; a failure to connect is in ``failure``."""
    data = None
    request_headers = dict(headers or {})
    if form is not None:
        from urllib.parse import urlencode
        data = urlencode(form).encode()
        request_headers.setdefault("Content-Type", "application/x-www-form-urlencoded")
    elif body is not None:
        data = json.dumps(body).encode()
        request_headers.setdefault("Content-Type", "application/json")
    request = urllib.request.Request(url, data=data, headers=request_headers, method=method)
    context = None if verify_tls else ssl._create_unverified_context()  # noqa: S323 (the administrator turned the check off)
    started = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds, context=context) as response:  # noqa: S310
            return HttpResult(response.status, dict(response.headers), response.read().decode("utf-8", "replace")[:MAXIMUM_BODY_CHARACTERS],
                              round((time.monotonic() - started) * 1000), set_cookies=list(response.headers.get_all("Set-Cookie") or []))
    except urllib.error.HTTPError as http_error:
        return HttpResult(http_error.code, dict(http_error.headers), http_error.read().decode("utf-8", "replace")[:MAXIMUM_BODY_CHARACTERS],
                          round((time.monotonic() - started) * 1000), set_cookies=list(http_error.headers.get_all("Set-Cookie") or []))
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as unreachable:
        reason = getattr(unreachable, "reason", unreachable)
        return HttpResult(duration_ms=round((time.monotonic() - started) * 1000), failure=str(reason))
