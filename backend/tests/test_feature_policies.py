"""Role feature policies: an allowlist or blocklist of registered features per role.

Features are registered by extensions (e.g. IQVigilant's answering methods).
These tests register two test features of their own and use a dedicated
role, ``fp_clerk``, so the other suites' roles are unaffected; every test
starts and ends with no feature policy on it.
"""
import pytest

from veloiq_framework.access import can_use_feature, evaluate_feature_access, register_feature
from veloiq_framework.access.registry import _FEATURES

from tests.test_access_policies import FULL_METHODS, _make_role, _make_user

CLERK_ROLE = "fp_clerk"
OTHER_ROLE = "fp_other"
FEATURE_A = "fp_test:feature_a"
FEATURE_B = "fp_test:feature_b"


@pytest.fixture(scope="module", autouse=True)
def _test_features():
    register_feature("fp_test", "feature_a", "Feature", group="Group")
    register_feature("fp_test", "feature_b", "Feature")
    yield
    _FEATURES.pop(FEATURE_A, None)
    _FEATURES.pop(FEATURE_B, None)


@pytest.fixture(scope="module")
def clerk_role_id(client, auth):
    return _make_role(client, auth, CLERK_ROLE, FULL_METHODS)


@pytest.fixture(scope="module")
def other_role_id(client, auth):
    return _make_role(client, auth, OTHER_ROLE, FULL_METHODS)


@pytest.fixture(scope="module")
def clerk_auth(client, auth, clerk_role_id):
    return _make_user(client, auth, "fp_clerk_user", [CLERK_ROLE])


@pytest.fixture(autouse=True)
def _no_feature_policy_around_each_test(client, auth, clerk_role_id, other_role_id):
    for role_id in (clerk_role_id, other_role_id):
        client.delete(f"/auth/access-policies/{role_id}/features", headers=auth)
    yield
    for role_id in (clerk_role_id, other_role_id):
        client.delete(f"/auth/access-policies/{role_id}/features", headers=auth)


def _set_feature_policy(client, auth, role_id, mode, keys):
    r = client.put(
        f"/auth/access-policies/{role_id}/features",
        json={"mode": mode, "entries": [{"feature_key": k} for k in keys]},
        headers=auth,
    )
    assert r.status_code == 200, r.text
    return r.json()


def _user(*roles):
    return {"username": "u", "roles": list(roles)}


# ── Managing feature policies ───────────────────────────────────────────────

def test_only_admin_manages_feature_policies(client, clerk_auth, clerk_role_id):
    r = client.put(f"/auth/access-policies/{clerk_role_id}/features",
                   json={"mode": "block", "entries": []}, headers=clerk_auth)
    assert r.status_code == 403
    assert client.delete(f"/auth/access-policies/{clerk_role_id}/features", headers=clerk_auth).status_code == 403


def test_resources_list_registered_features(client, auth):
    features = client.get("/auth/access-policies/resources", headers=auth).json()["features"]
    a = next(f for f in features if f["key"] == FEATURE_A)
    assert a["source"] == "fp_test" and a["name"] == "feature_a"
    assert a["label"] and a["group"]


def test_role_row_carries_its_feature_policy(client, auth, clerk_role_id):
    _set_feature_policy(client, auth, clerk_role_id, "block", [FEATURE_A])
    row = client.get(f"/auth/access-policies/{clerk_role_id}", headers=auth).json()
    assert row["feature_policy"] == {"mode": "block", "entries": [{"feature_key": FEATURE_A, "active": True}]}
    # The module policy is independent of the feature policy.
    assert row["policy"] is None


@pytest.mark.parametrize("payload", [
    {"mode": "maybe", "entries": []},
    {"mode": "allow", "entries": [{"feature_key": "fp_test:unknown"}]},
    {"mode": "allow", "entries": [{"feature_key": FEATURE_A}, {"feature_key": FEATURE_A}]},
    {"mode": "allow", "entries": [{"module_key": "app:tasks"}]},
])
def test_invalid_feature_policies_rejected(client, auth, clerk_role_id, payload):
    r = client.put(f"/auth/access-policies/{clerk_role_id}/features", json=payload, headers=auth)
    assert r.status_code == 422


def test_admin_role_cannot_get_a_feature_policy(client, auth):
    admin_id = next(r["role_id"] for r in client.get("/auth/access-policies", headers=auth).json() if r["is_admin"])
    r = client.put(f"/auth/access-policies/{admin_id}/features", json={"mode": "allow", "entries": []}, headers=auth)
    assert r.status_code == 422


def test_one_feature_policy_per_role(client, auth, clerk_role_id):
    from sqlmodel import Session, select
    from veloiq_framework.access.models import RoleFeaturePolicy
    from veloiq_framework.db import get_engine

    _set_feature_policy(client, auth, clerk_role_id, "allow", [FEATURE_A])
    _set_feature_policy(client, auth, clerk_role_id, "block", [FEATURE_B])
    with Session(get_engine()) as session:
        rows = session.exec(select(RoleFeaturePolicy).where(RoleFeaturePolicy.role_id == clerk_role_id)).all()
    assert len(rows) == 1 and rows[0].mode == "block"
    assert RoleFeaturePolicy.__table__.c.role_id.unique


def test_feature_policy_changes_are_audited(client, auth, clerk_role_id):
    _set_feature_policy(client, auth, clerk_role_id, "allow", [FEATURE_A])
    client.delete(f"/auth/access-policies/{clerk_role_id}/features", headers=auth)
    rows = client.get(f"/auth/access-policies/audit?role_id={clerk_role_id}", headers=auth).json()
    assert [r["event"] for r in rows[:2]] == ["feature_delete", "feature_save"]
    assert rows[0]["before"] == {"mode": "allow", "entries": [{"feature_key": FEATURE_A}]}
    assert rows[0]["after"] is None
    assert rows[1]["actor_username"] == "admin"


def test_deleting_a_role_deletes_its_feature_policy(client, auth):
    from sqlmodel import Session, select
    from veloiq_framework.access.models import RoleFeaturePolicy
    from veloiq_framework.db import get_engine

    role_id = _make_role(client, auth, "fp_doomed", FULL_METHODS)
    _set_feature_policy(client, auth, role_id, "block", [FEATURE_A])
    assert client.delete(f"/api/role/{role_id}", headers=auth).status_code == 204
    with Session(get_engine()) as session:
        assert session.exec(select(RoleFeaturePolicy).where(RoleFeaturePolicy.role_id == role_id)).first() is None


# ── The decision ─────────────────────────────────────────────────────────────

def test_no_feature_policy_allows_every_feature(clerk_role_id):
    assert can_use_feature(_user(CLERK_ROLE), FEATURE_A)
    assert can_use_feature(_user(CLERK_ROLE), FEATURE_B)


def test_allowlist_allows_only_listed_features(client, auth, clerk_role_id):
    _set_feature_policy(client, auth, clerk_role_id, "allow", [FEATURE_A])
    assert can_use_feature(_user(CLERK_ROLE), FEATURE_A)
    assert not can_use_feature(_user(CLERK_ROLE), FEATURE_B)


def test_blocklist_allows_all_but_listed_features(client, auth, clerk_role_id):
    _set_feature_policy(client, auth, clerk_role_id, "block", [FEATURE_A])
    assert not can_use_feature(_user(CLERK_ROLE), FEATURE_A)
    assert can_use_feature(_user(CLERK_ROLE), FEATURE_B)


def test_any_role_allowing_wins(client, auth, clerk_role_id, other_role_id):
    _set_feature_policy(client, auth, clerk_role_id, "block", [FEATURE_A])
    assert not can_use_feature(_user(CLERK_ROLE), FEATURE_A)
    assert can_use_feature(_user(CLERK_ROLE, OTHER_ROLE), FEATURE_A)
    _set_feature_policy(client, auth, other_role_id, "allow", [FEATURE_B])
    assert not can_use_feature(_user(CLERK_ROLE, OTHER_ROLE), FEATURE_A)


def test_admin_and_unregistered_features_always_allowed(client, auth, clerk_role_id):
    _set_feature_policy(client, auth, clerk_role_id, "allow", [])
    assert can_use_feature(_user("Admin"), FEATURE_A)
    assert can_use_feature(_user(CLERK_ROLE), "fp_test:not_registered")
    assert not can_use_feature(_user(CLERK_ROLE), FEATURE_A)


def test_user_without_roles_is_denied():
    decision = can_use_feature({"username": "nobody", "roles": []}, FEATURE_A)
    assert not decision and decision.reason == "no_role"


def test_evaluate_feature_access_is_pure():
    ctx = {
        "roles": ["R"],
        "admin_role": "Admin",
        "feature_policies": {"R": {"mode": "block", "entries": [{"feature_key": "x:a"}]}},
        "features": {"x:a": {}, "x:b": {}},
    }
    assert not evaluate_feature_access(ctx, "x:a")
    assert evaluate_feature_access(ctx, "x:b")


def test_effective_permissions_list_features(client, auth, clerk_auth, clerk_role_id):
    _set_feature_policy(client, auth, clerk_role_id, "block", [FEATURE_A])
    data = client.get("/auth/resource-permissions", headers=clerk_auth).json()
    assert data["effective"]["features"][FEATURE_A] is False
    assert data["effective"]["features"][FEATURE_B] is True
    assert data["context"]["feature_policies"][CLERK_ROLE]["mode"] == "block"
    assert FEATURE_A in data["context"]["features"]


# ── feature_is_enabled: configuration switch + role access ──────────────────

class _Config:
    """A stand-in for jm_obtain_config()'s ConfigParser: ``[s] k`` → bool."""

    def __init__(self, values):
        self.values = values

    def getboolean(self, section, key, fallback=False):
        return self.values.get((section, key), fallback)


def test_feature_is_enabled_needs_switch_and_role_access(client, auth, clerk_role_id):
    from veloiq_framework.access import feature_is_enabled, reset_feature_user, set_feature_user

    on = _Config({("s", "k"): True})
    off = _Config({("s", "k"): False})
    _set_feature_policy(client, auth, clerk_role_id, "block", [FEATURE_A])
    token = set_feature_user(_user(CLERK_ROLE))
    try:
        assert not feature_is_enabled(FEATURE_A, config_section="s", config_key="k", jm_config=on)
        assert feature_is_enabled(FEATURE_B, config_section="s", config_key="k", jm_config=on)
        assert not feature_is_enabled(FEATURE_B, config_section="s", config_key="k", jm_config=off)
        # A missing switch uses the fallback; no switch at all leaves only the role check.
        assert feature_is_enabled(FEATURE_B, config_section="s", config_key="missing",
                                  fallback=True, jm_config=on)
        assert feature_is_enabled(FEATURE_B)
        # An explicit user overrides the context's.
        assert feature_is_enabled(FEATURE_A, user=_user("Admin"))
    finally:
        reset_feature_user(token)


def test_feature_is_enabled_without_user_applies_only_the_switch(client, auth, clerk_role_id):
    from veloiq_framework.access import current_feature_user, feature_is_enabled

    _set_feature_policy(client, auth, clerk_role_id, "allow", [])
    assert current_feature_user() is None
    assert feature_is_enabled(FEATURE_A, config_section="s", config_key="k", jm_config=_Config({("s", "k"): True}))
    assert not feature_is_enabled(FEATURE_A, config_section="s", config_key="k", jm_config=_Config({}))
