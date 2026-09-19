"""Per-request user identity for ``jm_log``.

``auth_middleware`` sets the authenticated user's id for the duration of a
request, and ``jm_log`` prefixes every line with it so log lines from
concurrent users can be told apart. Outside an authenticated request (startup,
background threads, unauthenticated paths) the value is ``0``.

Kept dependency-free on purpose: ``factory.py`` imports it on every app start,
and ``data_mgmt_utils`` pulls in pandas/numpy.
"""
from __future__ import annotations

from contextvars import ContextVar, Token
from typing import Optional

_LOG_USER_EID: ContextVar[int] = ContextVar("veloiq_log_user_eid", default=0)


def set_log_user(eid: Optional[int]) -> Token:
    """Set the user id shown by ``jm_log`` (``None`` or invalid -> ``0``)."""
    try:
        value = int(eid) if eid is not None else 0
    except (TypeError, ValueError):
        value = 0
    return _LOG_USER_EID.set(value)


def reset_log_user(token: Token) -> None:
    """Restore the value in effect before the matching ``set_log_user``."""
    _LOG_USER_EID.reset(token)


def get_log_user() -> int:
    """Return the current user id for logging, or 0 when there is none."""
    return _LOG_USER_EID.get()
