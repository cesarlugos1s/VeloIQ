"""CRUD: create, read, update, delete for Project, Task, TeamMember."""
import pytest


# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------

def test_create_project(client, auth):
    r = client.post("/api/project", json={"name": "Alpha", "status": "active"}, headers=auth)
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Alpha"
    assert "id" in data


def test_list_projects(client, auth):
    client.post("/api/project", json={"name": "List-Test"}, headers=auth)
    r = client.get("/api/project", headers=auth)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    assert len(items) >= 1


def test_get_project(client, auth):
    r = client.post("/api/project", json={"name": "GetMe"}, headers=auth)
    pid = r.json()["id"]
    r = client.get(f"/api/project/{pid}", headers=auth)
    assert r.status_code == 200
    assert r.json()["name"] == "GetMe"


def test_update_project(client, auth):
    r = client.post("/api/project", json={"name": "OldName"}, headers=auth)
    pid = r.json()["id"]
    r = client.put(f"/api/project/{pid}", json={"name": "NewName", "status": "completed"}, headers=auth)
    assert r.status_code == 200
    assert r.json()["name"] == "NewName"


def test_delete_project(client, auth):
    r = client.post("/api/project", json={"name": "DeleteMe"}, headers=auth)
    pid = r.json()["id"]
    r = client.delete(f"/api/project/{pid}", headers=auth)
    assert r.status_code == 204
    r = client.get(f"/api/project/{pid}", headers=auth)
    assert r.status_code == 404


def test_get_nonexistent_project(client, auth):
    r = client.get("/api/project/999999", headers=auth)
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# TeamMember
# ---------------------------------------------------------------------------

def test_create_team_member(client, auth):
    r = client.post(
        "/api/team_member",
        json={"name": "Alice", "email": "alice@example.com", "role": "member"},
        headers=auth,
    )
    assert r.status_code == 201
    assert r.json()["name"] == "Alice"


def test_list_team_members(client, auth):
    r = client.get("/api/team_member", headers=auth)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_update_team_member(client, auth):
    r = client.post(
        "/api/team_member",
        json={"name": "Bob", "email": "bob@example.com"},
        headers=auth,
    )
    mid = r.json()["id"]
    r = client.put(f"/api/team_member/{mid}", json={"name": "Robert", "email": "bob@example.com"}, headers=auth)
    assert r.status_code == 200
    assert r.json()["name"] == "Robert"


def test_delete_team_member(client, auth):
    r = client.post(
        "/api/team_member",
        json={"name": "Temp", "email": "temp@example.com"},
        headers=auth,
    )
    mid = r.json()["id"]
    assert client.delete(f"/api/team_member/{mid}", headers=auth).status_code == 204
    assert client.get(f"/api/team_member/{mid}", headers=auth).status_code == 404


# ---------------------------------------------------------------------------
# Task
# ---------------------------------------------------------------------------

def test_create_task(client, auth):
    r = client.post("/api/project", json={"name": "TaskProject"}, headers=auth)
    pid = r.json()["id"]
    r = client.post(
        "/api/task",
        json={"title": "First Task", "status": "todo", "project_id": pid},
        headers=auth,
    )
    assert r.status_code == 201
    assert r.json()["title"] == "First Task"


def test_list_tasks(client, auth):
    r = client.get("/api/task", headers=auth)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_update_task_status(client, auth):
    r = client.post("/api/task", json={"title": "StatusTask", "status": "todo"}, headers=auth)
    tid = r.json()["id"]
    r = client.put(f"/api/task/{tid}", json={"title": "StatusTask", "status": "done"}, headers=auth)
    assert r.status_code == 200
    assert r.json()["status"] == "done"


def test_delete_task(client, auth):
    r = client.post("/api/task", json={"title": "DropTask"}, headers=auth)
    tid = r.json()["id"]
    assert client.delete(f"/api/task/{tid}", headers=auth).status_code == 204
    assert client.get(f"/api/task/{tid}", headers=auth).status_code == 404
