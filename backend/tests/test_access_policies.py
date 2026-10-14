"""Role access policies, end to end on the task-manager sample.

One test (or a small group) per acceptance criterion of the access-policy
feature. A dedicated role, ``ap_clerk``, with full CRUD methods is created for
these tests so the other suites' Manager/Viewer users are unaffected; every
test starts and ends with no policy on it.
"""
import json

import pytest

from veloiq_framework.access import store
from veloiq_framework.auth.permissions import _MODEL_PERMISSIONS
from veloiq_framework.utils.i18n_utils import _

CLERK_ROLE = "ap_clerk"
FULL_METHODS = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]


def _entry(module_key, model_key=None, *, c=False, r=False, u=False, d=False):
    return {
        "module_key": module_key, "model_key": model_key,
        "can_create": c, "can_read": r, "can_update": u, "can_delete": d,
    }


def _make_role(client, auth, name, methods):
    r = client.post("/api/role", json={"name": name, "allowed_methods": json.dumps(methods)}, headers=auth)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _make_user(client, auth, username, roles):
    client.post(
        "/auth/register",
        json={"username": username, "password": "pw123456", "role_names": roles},
        headers=auth,
    )
    r = client.post("/auth/login", json={"username": username, "password": "pw123456"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def clerk_role_id(client, auth):
    return _make_role(client, auth, CLERK_ROLE, FULL_METHODS)


@pytest.fixture(scope="module")
def clerk_auth(client, auth, clerk_role_id):
    return _make_user(client, auth, "ap_clerk_user", [CLERK_ROLE])


@pytest.fixture(autouse=True)
def _no_policy_around_each_test(client, auth, clerk_role_id):
    client.delete(f"/auth/access-policies/{clerk_role_id}", headers=auth)
    yield
    client.delete(f"/auth/access-policies/{clerk_role_id}", headers=auth)


def _set_policy(client, auth, role_id, mode, entries):
    r = client.put(f"/auth/access-policies/{role_id}", json={"mode": mode, "entries": entries}, headers=auth)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def project_id(client, auth):
    r = client.post("/api/project", json={"name": "AccessPolicyProject"}, headers=auth)
    assert r.status_code == 201
    return r.json()["id"]


@pytest.fixture(scope="module")
def task_id(client, auth, project_id):
    r = client.post("/api/task", json={"title": "AccessPolicyTask", "status": "todo", "project_id": project_id}, headers=auth)
    assert r.status_code == 201
    return r.json()["id"]


DENIED = _("You do not have permission to perform this action.")


# ── A. Managing policies ─────────────────────────────────────────────────────

def test_a1_only_admin_manages_policies(client, auth, clerk_auth, manager_auth, clerk_role_id):
    for headers in (clerk_auth, manager_auth):
        assert client.get("/auth/access-policies", headers=headers).status_code == 403
        assert client.get("/auth/access-policies/resources", headers=headers).status_code == 403
        assert client.get("/auth/access-policies/audit", headers=headers).status_code == 403
        r = client.put(f"/auth/access-policies/{clerk_role_id}", json={"mode": "block", "entries": []}, headers=headers)
        assert r.status_code == 403
        assert client.delete(f"/auth/access-policies/{clerk_role_id}", headers=headers).status_code == 403
    assert client.get("/auth/access-policies", headers=auth).status_code == 200


def test_a2_policies_listed_per_role(client, auth, clerk_role_id):
    _set_policy(client, auth, clerk_role_id, "block", [_entry("app:projects", d=True)])
    rows = client.get("/auth/access-policies", headers=auth).json()
    clerk = next(row for row in rows if row["role_id"] == clerk_role_id)
    assert clerk["policy"]["mode"] == "block"
    assert clerk["policy"]["entries"][0]["active"] is True
    admin = next(row for row in rows if row["role_name"] == "Admin")
    assert admin["is_admin"] is True and admin["policy"] is None


def test_a3_admin_role_cannot_get_a_policy(client, auth):
    admin_id = next(r["role_id"] for r in client.get("/auth/access-policies", headers=auth).json() if r["is_admin"])
    r = client.put(f"/auth/access-policies/{admin_id}", json={"mode": "allow", "entries": []}, headers=auth)
    assert r.status_code == 422


def test_a4_resource_picker_lists_installed_non_system_modules(client, auth):
    data = client.get("/auth/access-policies/resources", headers=auth).json()
    keys = {m["key"] for m in data["modules"]}
    assert {"app:projects", "app:tasks", "app:team"} <= keys
    assert not any(k.split(":", 1)[1] in ("license", "authobjs") for k in keys)
    tasks = next(m for m in data["modules"] if m["key"] == "app:tasks")
    assert {"key": "task"} in tasks["models"]
    assert data["actions"] == ["create", "read", "update", "delete"]


@pytest.mark.parametrize("entry", [
    _entry("app:nonexistent", r=True),
    _entry("app:license", r=True),
    _entry("app:tasks", "project", r=True),
    _entry("app:tasks", "no_such_table", r=True),
])
def test_a4_unknown_or_excluded_keys_rejected(client, auth, clerk_role_id, entry):
    r = client.put(f"/auth/access-policies/{clerk_role_id}", json={"mode": "allow", "entries": [entry]}, headers=auth)
    assert r.status_code == 422


def test_a5_changes_are_audited(client, auth, clerk_role_id):
    _set_policy(client, auth, clerk_role_id, "allow", [_entry("app:tasks", r=True)])
    _set_policy(client, auth, clerk_role_id, "allow", [_entry("app:tasks", r=True, u=True)])
    rows = client.get(f"/auth/access-policies/audit?role_id={clerk_role_id}", headers=auth).json()
    latest = rows[0]
    assert latest["event"] == "save"
    assert latest["role_name"] == CLERK_ROLE
    assert latest["actor_username"] == "admin"
    assert latest["created_at"]
    assert latest["before"]["entries"][0]["can_update"] is False
    assert latest["after"]["entries"][0]["can_update"] is True


# ── B. Policy rules ───────────────────────────────────────────────────────────

def test_b1_one_policy_per_role(client, auth, clerk_role_id):
    from sqlmodel import Session, select
    from veloiq_framework.access.models import RoleAccessPolicy
    from veloiq_framework.db import get_engine

    _set_policy(client, auth, clerk_role_id, "allow", [_entry("app:tasks", r=True)])
    _set_policy(client, auth, clerk_role_id, "block", [_entry("app:tasks", d=True)])
    with Session(get_engine()) as session:
        rows = session.exec(select(RoleAccessPolicy).where(RoleAccessPolicy.role_id == clerk_role_id)).all()
    assert len(rows) == 1 and rows[0].mode == "block"
    assert RoleAccessPolicy.__table__.c.role_id.unique


def test_b2_no_policy_keeps_todays_behaviour(client, clerk_auth, project_id):
    assert client.get("/api/project", headers=clerk_auth).status_code == 200
    r = client.post("/api/project", json={"name": "ClerkCreates"}, headers=clerk_auth)
    assert r.status_code == 201
    assert client.delete(f"/api/project/{r.json()['id']}", headers=clerk_auth).status_code == 204


def test_b3_allowlist(client, auth, clerk_auth, clerk_role_id, project_id, task_id):
    _set_policy(client, auth, clerk_role_id, "allow", [_entry("app:tasks", r=True)])
    assert client.get("/api/task", headers=clerk_auth).status_code == 200
    assert client.get(f"/api/task/{task_id}", headers=clerk_auth).status_code == 200
    assert client.post("/api/task", json={"title": "x"}, headers=clerk_auth).status_code == 403
    assert client.put(f"/api/task/{task_id}", json={"title": "y"}, headers=clerk_auth).status_code == 403
    assert client.get("/api/project", headers=clerk_auth).status_code == 403
    assert client.get("/api/team_member", headers=clerk_auth).status_code == 403


def test_b4_blocklist(client, auth, clerk_auth, clerk_role_id):
    _set_policy(client, auth, clerk_role_id, "block", [_entry("app:projects", d=True)])
    r = client.post("/api/project", json={"name": "BlockDelete"}, headers=clerk_auth)
    assert r.status_code == 201
    assert client.get("/api/project", headers=clerk_auth).status_code == 200
    assert client.delete(f"/api/project/{r.json()['id']}", headers=clerk_auth).status_code == 403
    r = client.post("/api/task", json={"title": "Unaffected"}, headers=clerk_auth)
    assert r.status_code == 201
    assert client.delete(f"/api/task/{r.json()['id']}", headers=clerk_auth).status_code == 204


def test_b5_model_entry_overrides_module_entry(client, auth, clerk_auth, clerk_role_id, task_id):
    _set_policy(client, auth, clerk_role_id, "allow", [
        _entry("app:tasks", r=True),
        _entry("app:tasks", "task", r=True, u=True),
    ])
    r = client.put(f"/api/task/{task_id}", json={"title": "Overridden"}, headers=clerk_auth)
    assert r.status_code == 200


def test_b6_write_without_read_rejected(client, auth, clerk_role_id):
    for flags in ({"c": True}, {"u": True}, {"d": True}):
        r = client.put(
            f"/auth/access-policies/{clerk_role_id}",
            json={"mode": "allow", "entries": [_entry("app:tasks", **flags)]},
            headers=auth,
        )
        assert r.status_code == 422


def test_b7_empty_allowlist_saved_and_denies_everything(client, auth, clerk_auth, clerk_role_id):
    saved = _set_policy(client, auth, clerk_role_id, "allow", [])
    assert saved["policy"] == {"mode": "allow", "entries": []}
    assert client.get("/api/project", headers=clerk_auth).status_code == 403
    assert client.get("/api/task", headers=clerk_auth).status_code == 403


def test_b8_deleting_a_role_deletes_its_policy(client, auth):
    from sqlmodel import Session, select
    from veloiq_framework.access.models import RoleAccessPolicy
    from veloiq_framework.db import get_engine

    role_id = _make_role(client, auth, "ap_temp_role", FULL_METHODS)
    _set_policy(client, auth, role_id, "allow", [_entry("app:tasks", r=True)])
    assert client.delete(f"/api/role/{role_id}", headers=auth).status_code == 204
    with Session(get_engine()) as session:
        assert session.exec(select(RoleAccessPolicy).where(RoleAccessPolicy.role_id == role_id)).first() is None
    audit = client.get(f"/auth/access-policies/audit?role_id={role_id}", headers=auth).json()
    assert audit[0]["event"] == "role_deleted"


def test_b8_entries_of_removed_extensions_are_kept_inactive(client, auth, clerk_auth, clerk_role_id):
    from sqlmodel import Session
    from veloiq_framework.access.models import RoleAccessEntry
    from veloiq_framework.db import get_engine

    _set_policy(client, auth, clerk_role_id, "block", [_entry("app:projects", d=True)])
    policy_id = None
    with Session(get_engine()) as session:
        from sqlmodel import select
        from veloiq_framework.access.models import RoleAccessPolicy
        policy_id = session.exec(select(RoleAccessPolicy).where(RoleAccessPolicy.role_id == clerk_role_id)).first().id
        # As if an installed extension had been removed after the policy was saved.
        session.add(RoleAccessEntry(policy_id=policy_id, module_key="gone_ext:reports", can_read=True,
                                    can_create=True, can_update=True, can_delete=True))
        session.commit()
    store.invalidate_access_cache()

    row = client.get(f"/auth/access-policies/{clerk_role_id}", headers=auth).json()
    inactive = next(e for e in row["policy"]["entries"] if e["module_key"] == "gone_ext:reports")
    assert inactive["active"] is False
    # Saving the policy back keeps the inactive entry; it doesn't affect access.
    entries = [{k: v for k, v in e.items() if k != "active"} for e in row["policy"]["entries"]]
    _set_policy(client, auth, clerk_role_id, "block", entries)
    row = client.get(f"/auth/access-policies/{clerk_role_id}", headers=auth).json()
    assert any(e["module_key"] == "gone_ext:reports" for e in row["policy"]["entries"])
    assert client.get("/api/project", headers=clerk_auth).status_code == 200


# ── C. Evaluation ─────────────────────────────────────────────────────────────

def test_c1_c2_policy_cannot_grant_beyond_role_methods(client, auth, viewer_auth):
    viewer_id = next(r["role_id"] for r in client.get("/auth/access-policies", headers=auth).json() if r["role_name"] == "Viewer")
    try:
        _set_policy(client, auth, viewer_id, "allow", [_entry("app:projects", c=True, r=True, u=True, d=True)])
        assert client.post("/api/project", json={"name": "ViewerTries"}, headers=viewer_auth).status_code == 403
        assert client.get("/api/project", headers=viewer_auth).status_code == 200
    finally:
        client.delete(f"/auth/access-policies/{viewer_id}", headers=auth)


def test_c3_model_access_and_policy_intersect(client, auth, clerk_auth, clerk_role_id, project_id):
    _MODEL_PERMISSIONS["project"] = {CLERK_ROLE: ["list", "show"]}
    try:
        _set_policy(client, auth, clerk_role_id, "allow", [_entry("app:projects", r=True, u=True)])
        assert client.get(f"/api/project/{project_id}", headers=clerk_auth).status_code == 200
        r = client.put(f"/api/project/{project_id}", json={"name": "Nope"}, headers=clerk_auth)
        assert r.status_code == 403
    finally:
        _MODEL_PERMISSIONS.pop("project", None)


def test_c4_any_role_allowing_wins(client, auth, clerk_role_id):
    headers = _make_user(client, auth, "ap_two_roles", [CLERK_ROLE, "Viewer"])
    _set_policy(client, auth, clerk_role_id, "allow", [])
    assert client.get("/api/project", headers=headers).status_code == 200
    assert client.post("/api/project", json={"name": "No"}, headers=headers).status_code == 403


def test_c5_grace_period_is_read_only(client, auth, clerk_auth, clerk_role_id, monkeypatch):
    import veloiq_framework.licensing_utils as lic

    pool = {"module_groups": {"pm": ["projects"]}, "licensed_modules": ["projects"],
            "write_allowed_modules": [], "group_statuses": {"pm": "grace_period"}, "warnings": []}
    monkeypatch.setattr(lic, "aggregate_license_pool", lambda extensions=None: pool)
    _set_policy(client, auth, clerk_role_id, "allow", [_entry("app:projects", c=True, r=True, u=True, d=True)])
    assert client.get("/api/project", headers=clerk_auth).status_code == 200
    assert client.post("/api/project", json={"name": "Grace"}, headers=clerk_auth).status_code == 403
    assert client.post("/api/project", json={"name": "Grace"}, headers=auth).status_code == 403


def test_c6_rbac_middleware_now_checks_get(client, auth):
    _make_role(client, auth, "ap_no_get", ["POST"])
    headers = _make_user(client, auth, "ap_no_get_user", ["ap_no_get"])
    assert client.get("/api/project", headers=headers).status_code == 403


def test_c6_role_get_migration_runs_once(client, auth):
    from sqlmodel import Session, select
    from veloiq_framework.access.models import RoleAccessAudit
    from veloiq_framework.auth.models import Role
    from veloiq_framework.db import get_engine

    engine = get_engine()
    _make_role(client, auth, "ap_legacy_role", [])
    with Session(engine) as session:
        for row in session.exec(select(RoleAccessAudit).where(RoleAccessAudit.event == store.EVENT_ROLE_GET_MIGRATION)).all():
            session.delete(row)
        session.commit()
    store.migrate_role_read_methods(engine)
    with Session(engine) as session:
        role = session.exec(select(Role).where(Role.name == "ap_legacy_role")).first()
        assert {"GET", "HEAD"} <= set(json.loads(role.allowed_methods))
        role.allowed_methods = "[]"
        session.add(role)
        session.commit()
    store.migrate_role_read_methods(engine)
    with Session(engine) as session:
        role = session.exec(select(Role).where(Role.name == "ap_legacy_role")).first()
        assert json.loads(role.allowed_methods) == []


# ── D. Backend enforcement ───────────────────────────────────────────────────

def test_d1_named_query_routes(client, auth, clerk_auth, clerk_role_id):
    assert client.get("/api/projects_with_tasks_and_members", headers=clerk_auth).status_code == 200
    _set_policy(client, auth, clerk_role_id, "allow", [_entry("app:tasks", r=True)])
    assert client.get("/api/projects_with_tasks_and_members", headers=clerk_auth).status_code == 403


def test_d2_custom_endpoints_checked_at_module_level(client, auth, clerk_auth, clerk_role_id, task_id, project_id):
    _set_policy(client, auth, clerk_role_id, "allow", [_entry("app:tasks", r=True)])
    assert client.get(f"/api/task/by-project/{project_id}", headers=clerk_auth).status_code == 200
    assert client.post(f"/api/task/{task_id}/complete", headers=clerk_auth).status_code == 403
    _set_policy(client, auth, clerk_role_id, "allow", [_entry("app:tasks", c=True, r=True)])
    assert client.post(f"/api/task/{task_id}/complete", headers=clerk_auth).status_code == 200


def test_d2_requires_action_overrides_http_method():
    from fastapi import APIRouter, Depends, FastAPI, Request
    from fastapi.testclient import TestClient

    from veloiq_framework.access import requires_action
    from veloiq_framework.access.dependencies import make_module_access_dependency

    seen = []
    import veloiq_framework.access.dependencies as deps

    def fake_require(user, module_key, model_key, action):
        seen.append((module_key, action))

    router = APIRouter()

    @router.post("/search", dependencies=[Depends(requires_action("read"))])
    def search():
        return {"ok": True}

    @router.post("/do")
    def do():
        return {"ok": True}

    app = FastAPI()

    @app.middleware("http")
    async def set_user(request: Request, call_next):
        request.state.user = {"roles": ["X"]}
        return await call_next(request)

    app.include_router(router, dependencies=[Depends(make_module_access_dependency("app:demo"))])
    original = deps.require_access
    deps.require_access = fake_require
    try:
        c = TestClient(app)
        assert c.post("/search").status_code == 200
        assert c.post("/do").status_code == 200
    finally:
        deps.require_access = original
    assert seen == [("app:demo", "read"), ("app:demo", "create")]


def test_d3_indirect_read_paths(client, auth, clerk_auth, clerk_role_id, project_id):
    r = client.post("/api/dashboard/pinned-records", json={"resource": "project", "record_id": project_id}, headers=clerk_auth)
    assert r.status_code == 200
    _set_policy(client, auth, clerk_role_id, "allow", [_entry("app:tasks", r=True)])
    pinned = client.get("/api/dashboard/pinned-records", headers=clerk_auth).json()
    assert all(g["resource"] != "project" for g in pinned["groups"])
    recent = client.get("/api/dashboard/recent-activity?days=30", headers=clerk_auth).json()
    assert all(g["resource"] != "project" for g in recent["groups"])
    r = client.post("/api/_meta/bulk-read", json={"resource": "project", "ids": [project_id]}, headers=clerk_auth)
    assert r.status_code == 403
    assert client.get("/api/project/export-csv", headers=clerk_auth).status_code == 403
    r = client.post("/api/project/analyze", json={"categories": [], "series": []}, headers=clerk_auth)
    assert r.status_code == 403
    r = client.post("/api/_meta/bulk-read", json={"resource": "task", "ids": [1]}, headers=clerk_auth)
    assert r.status_code == 200


def test_d4_csv_import_requires_create(client, auth, clerk_auth, clerk_role_id):
    _set_policy(client, auth, clerk_role_id, "allow", [_entry("app:projects", r=True, u=True)])
    files = {"file": ("p.csv", b"name,description,status,owner_id\nImported,,active,\n", "text/csv")}
    assert client.post("/api/project/import-csv", files=files, headers=clerk_auth).status_code == 403
    _set_policy(client, auth, clerk_role_id, "allow", [_entry("app:projects", c=True, r=True)])
    files = {"file": ("p.csv", b"name,description,status,owner_id\nImported,,active,\n", "text/csv")}
    assert client.post("/api/project/import-csv", files=files, headers=clerk_auth).status_code == 200


def test_d4_csv_import_updates_require_update(client, auth, clerk_auth, clerk_role_id):
    from veloiq_framework.import_registry import _REGISTRY, register_import_loader

    register_import_loader("team_member", lambda row, session: (0, 1))
    try:
        _set_policy(client, auth, clerk_role_id, "allow", [_entry("app:team", c=True, r=True)])
        files = {"file": ("t.csv", b"name\nUpdated\n", "text/csv")}
        assert client.post("/api/team_member/import-csv", files=files, headers=clerk_auth).status_code == 403
        _set_policy(client, auth, clerk_role_id, "allow", [_entry("app:team", c=True, r=True, u=True)])
        files = {"file": ("t.csv", b"name\nUpdated\n", "text/csv")}
        assert client.post("/api/team_member/import-csv", files=files, headers=clerk_auth).status_code == 200
    finally:
        _REGISTRY.pop("team_member", None)


def test_d5_sqladmin_views_use_the_decision(client, monkeypatch):
    import veloiq_framework.licensing_utils as lic

    client.cookies.clear()
    r = client.post("/admin/login", data={"username": "admin", "password": "admin"}, follow_redirects=False)
    assert r.status_code in (302, 303)
    assert client.get("/admin/project/list").status_code == 200
    pool = {"module_groups": {"pm": ["projects"]}, "licensed_modules": [], "write_allowed_modules": []}
    monkeypatch.setattr(lic, "aggregate_license_pool", lambda extensions=None: pool)
    assert client.get("/admin/project/list").status_code in (403, 401)
    pool["licensed_modules"] = ["projects"]
    assert client.get("/admin/project/list").status_code == 200
    assert client.get("/admin/project/create").status_code in (403, 401)
    client.cookies.clear()


def test_d6_denied_message_leaks_nothing(client, auth, clerk_auth, clerk_role_id):
    _set_policy(client, auth, clerk_role_id, "allow", [])
    r = client.get("/api/project", headers=clerk_auth)
    assert r.status_code == 403
    detail = r.json()["detail"]
    assert detail == DENIED
    assert CLERK_ROLE not in detail and "polic" not in detail.lower()


# ── E. Effective permissions (backend side of the frontend's refresh) ───────

def test_e4_effective_permissions_follow_policy_changes(client, auth, clerk_auth, clerk_role_id):
    data = client.get("/auth/resource-permissions", headers=clerk_auth).json()
    assert data["effective"]["models"]["project"]["read"] is True
    assert data["context"]["roles"] == [CLERK_ROLE]
    _set_policy(client, auth, clerk_role_id, "allow", [_entry("app:tasks", r=True)])
    data = client.get("/auth/resource-permissions", headers=clerk_auth).json()
    assert data["effective"]["models"]["project"]["read"] is False
    assert data["effective"]["models"]["task"] == {"create": False, "read": True, "update": False, "delete": False}
    assert data["effective"]["modules"]["app:tasks"]["read"] is True
    assert data["context"]["policies"][CLERK_ROLE]["mode"] == "allow"
    assert "app:tasks" in data["context"]["registry"]["modules"]
