"""Signed-out visitors of a public portal act as the portal's anonymous user (and only then)."""
import pytest

from veloiq_framework.portals import portal_anonymous_visitors
from veloiq_framework.portals.portal_anonymous_visitors import PORTAL_REQUEST_HEADER, clear_anonymous_user_cache
from veloiq_framework.portals.read_portal_definitions import PortalDefinition


@pytest.fixture
def portals_with_anonymous_users(monkeypatch, manager_auth):
    """A public portal whose visitors browse as the Manager test user, and a sign-in-only portal."""
    portals = {
        "store": PortalDefinition(site="store", folder="ext/store", roles=["Manager"], anonymous_user="alice_test"),
        "members": PortalDefinition(site="members", folder="ext/members", roles=["Manager"]),
        "ghost-store": PortalDefinition(site="ghost-store", folder="ext/ghost", roles=["Manager"], anonymous_user="nobody_here"),
    }
    monkeypatch.setattr(portal_anonymous_visitors, "read_portal_definitions", lambda: portals)
    clear_anonymous_user_cache()
    yield
    clear_anonymous_user_cache()


def test_a_public_portals_visitor_reads_as_its_anonymous_user(client, portals_with_anonymous_users):
    response = client.get("/api/project?_start=0&_end=5", headers={PORTAL_REQUEST_HEADER: "store"})
    assert response.status_code == 200
    # The anonymous user's roles still apply: Manager may not delete.
    assert client.delete("/api/project/999999", headers={PORTAL_REQUEST_HEADER: "store"}).status_code == 403


def test_other_signed_out_requests_still_need_a_sign_in(client, portals_with_anonymous_users):
    assert client.get("/api/project").status_code == 401
    for site in ("members", "unknown", "ghost-store"):
        assert client.get("/api/project", headers={PORTAL_REQUEST_HEADER: site}).status_code == 401


def test_a_sign_in_wins_over_the_anonymous_user(client, auth, portals_with_anonymous_users):
    response = client.get("/auth/me", headers={**auth, PORTAL_REQUEST_HEADER: "store"})
    assert response.status_code == 200 and response.json()["username"] == "admin"


def test_the_public_settings_say_whether_visitors_may_browse_but_never_who():
    store = PortalDefinition(site="store", folder="ext/store", anonymous_user="storefront")
    settings = store.to_public_settings()
    assert settings["allows_signed_out_visitors"] is True
    assert "storefront" not in str(settings.values())
