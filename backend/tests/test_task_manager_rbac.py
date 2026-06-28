"""RBAC: role-based access control — Admin vs Manager vs Viewer permissions.

Validates that:
- Admin (admin_test) can CRUD + delete
- Manager (alice_test) can CRUD but NOT delete
- Viewer (carol_test) can GET but NOT create/update/delete
"""
import pytest


# ---------------------------------------------------------------------------
# Admin — full access (baseline)
# ---------------------------------------------------------------------------

def test_admin_can_create(client, auth):
    r = client.post("/api/project", json={"name": "AdminProject"}, headers=auth)
    assert r.status_code == 201


def test_admin_can_delete(client, auth):
    r = client.post("/api/project", json={"name": "ToDelete"}, headers=auth)
    pid = r.json()["id"]
    r = client.delete(f"/api/project/{pid}", headers=auth)
    assert r.status_code == 204


# ---------------------------------------------------------------------------
# Manager — CRUD, no delete
# ---------------------------------------------------------------------------

def test_manager_can_create(client, manager_auth):
    r = client.post("/api/project", json={"name": "MgrProject"}, headers=manager_auth)
    assert r.status_code == 201


def test_manager_can_read(client, manager_auth):
    r = client.get("/api/project", headers=manager_auth)
    assert r.status_code == 200


def test_manager_can_update(client, manager_auth):
    r = client.post("/api/project", json={"name": "MgrUpdate"}, headers=manager_auth)
    pid = r.json()["id"]
    r = client.put(f"/api/project/{pid}", json={"name": "MgrUpdated"}, headers=manager_auth)
    assert r.status_code == 200
    assert r.json()["name"] == "MgrUpdated"


def test_manager_cannot_delete(client, manager_auth):
    r = client.post("/api/project", json={"name": "MgrNoDelete"}, headers=manager_auth)
    pid = r.json()["id"]
    r = client.delete(f"/api/project/{pid}", headers=manager_auth)
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# Viewer — read-only
# ---------------------------------------------------------------------------

def test_viewer_can_read(client, viewer_auth):
    r = client.get("/api/project", headers=viewer_auth)
    assert r.status_code == 200


def test_viewer_cannot_create(client, viewer_auth):
    r = client.post("/api/project", json={"name": "ViewerProject"}, headers=viewer_auth)
    assert r.status_code == 403


def test_viewer_cannot_update(client, viewer_auth, auth):
    r = client.post("/api/project", json={"name": "ViewerUpdate"}, headers=auth)
    pid = r.json()["id"]
    r = client.put(f"/api/project/{pid}", json={"name": "Hacked"}, headers=viewer_auth)
    assert r.status_code == 403


def test_viewer_cannot_delete(client, viewer_auth, auth):
    r = client.post("/api/project", json={"name": "ViewerDelete"}, headers=auth)
    pid = r.json()["id"]
    r = client.delete(f"/api/project/{pid}", headers=viewer_auth)
    assert r.status_code == 403


# ---------------------------------------------------------------------------
# Cross-model: Manager delete blocked on all resources
# ---------------------------------------------------------------------------

def test_manager_cannot_delete_task(client, manager_auth):
    r = client.post("/api/task", json={"title": "MgrTask"}, headers=manager_auth)
    tid = r.json()["id"]
    r = client.delete(f"/api/task/{tid}", headers=manager_auth)
    assert r.status_code == 403


def test_manager_cannot_delete_team_member(client, manager_auth):
    r = client.post(
        "/api/team_member",
        json={"name": "MgrMember", "email": "mgr@test.com"},
        headers=manager_auth,
    )
    mid = r.json()["id"]
    r = client.delete(f"/api/team_member/{mid}", headers=manager_auth)
    assert r.status_code == 403
