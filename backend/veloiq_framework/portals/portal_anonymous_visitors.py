"""Signed-out visitors of a public portal (e.g. a store's shoppers browsing the catalog).

A portal whose ``[portals.<site>]`` declares ``anonymous_user = "<username>"``
lets visitors who have not signed in use the API as that user: typically a
low-privilege service account whose role allows reading the catalog. The
portal's frontend sends the header ``X-VeloIQ-Portal: <site>`` with its
requests; a request that carries no sign-in token but names such a portal is
served as that user, so

- no password is kept in ``veloiq.toml`` and no token reaches the browser
  (the rights are those of the user's roles, enforced like any other user's:
  role methods, access policies, ``@model_access``, ``@rebac``);
- signing in (a real token) always wins over the anonymous user.

This replaces a separate proxy that injected a service account's token: the
exposure is the same (anyone may browse as that user), without a second server.
"""
from __future__ import annotations

import time
from typing import Optional

from veloiq_framework.portals.read_portal_definitions import read_portal_definitions

#: Request header naming the portal a request comes from (sent by VeloIQPortalApp).
PORTAL_REQUEST_HEADER = "X-VeloIQ-Portal"
#: How long a portal's anonymous user (id and roles) is reused before it is read again.
ANONYMOUS_USER_CACHE_SECONDS = 60

_anonymous_user_payloads: dict[str, tuple[float, Optional[dict]]] = {}


def _read_active_user_payload(engine, username: str) -> Optional[dict]:
    """Return the request-user payload of the active user *username* (``None`` when missing or inactive)."""
    from sqlmodel import Session, select

    from veloiq_framework.auth.models import User

    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == username)).first()
        if user is None or user.status != "Active":
            return None
        return {
            "sub": str(user.id),
            "eid": user.id,
            "username": user.username,
            "roles": [role.name for role in user.roles],
        }


def anonymous_visitor_user_payload(portal_site: str, engine) -> Optional[dict]:
    """Return the request user for a signed-out visitor of *portal_site*, or ``None``.

    ``None`` when the site is not a declared portal, declares no
    ``anonymous_user``, or that user does not exist or is inactive.
    """
    if not portal_site:
        return None
    portal = read_portal_definitions().get(portal_site)
    if portal is None or not portal.anonymous_user:
        return None
    cached = _anonymous_user_payloads.get(portal.anonymous_user)
    if cached is not None and time.monotonic() - cached[0] < ANONYMOUS_USER_CACHE_SECONDS:
        payload = cached[1]
    else:
        payload = _read_active_user_payload(engine, portal.anonymous_user)
        _anonymous_user_payloads[portal.anonymous_user] = (time.monotonic(), payload)
    if payload is None:
        return None
    return {**payload, "roles": list(payload["roles"]), "portal_anonymous_visitor": portal.site}


def clear_anonymous_user_cache() -> None:
    """Forget the cached anonymous users (tests, or after changing a portal's user)."""
    _anonymous_user_payloads.clear()
