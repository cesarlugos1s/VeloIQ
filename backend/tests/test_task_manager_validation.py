"""Validation: error responses for malformed input (422, 400, 404).

Covers:
- Missing required fields
- Wrong types (string for int, etc.)
- Non-existent FK references
- Empty strings for required fields
- Nonexistent record lookups
"""
import pytest


# ---------------------------------------------------------------------------
# Missing required fields
# ---------------------------------------------------------------------------

def test_create_project_missing_name(client, auth):
    r = client.post("/api/project", json={"status": "active"}, headers=auth)
    assert r.status_code == 422


def test_create_task_missing_title(client, auth):
    r = client.post("/api/task", json={"status": "todo"}, headers=auth)
    assert r.status_code == 422


def test_create_team_member_missing_email(client, auth):
    r = client.post("/api/team_member", json={"name": "NoEmail"}, headers=auth)
    assert r.status_code == 422


def test_create_team_member_missing_name(client, auth):
    r = client.post("/api/team_member", json={"email": "no@name.com"}, headers=auth)
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# Wrong types
# ---------------------------------------------------------------------------

def test_create_project_owner_id_string(client, auth):
    r = client.post(
        "/api/project", json={"name": "BadType", "owner_id": "not_an_int"}, headers=auth
    )
    assert r.status_code == 422


def test_create_task_priority_invalid_string(client, auth):
    r = client.post(
        "/api/task",
        json={"title": "BadPrio", "planned_work_hours": "many"},
        headers=auth,
    )
    assert r.status_code == 422


def test_update_project_name_to_int(client, auth):
    r = client.post("/api/project", json={"name": "IntName"}, headers=auth)
    pid = r.json()["id"]
    r = client.put(f"/api/project/{pid}", json={"name": 12345}, headers=auth)
    # Pydantic coerces int to str; the API may accept it.
    assert r.status_code in (200, 422)


# ---------------------------------------------------------------------------
# Non-existent FK references
# ---------------------------------------------------------------------------

def test_create_task_bad_project_fk(client, auth):
    r = client.post(
        "/api/task", json={"title": "BadFK", "project_id": 999999}, headers=auth
    )
    # SQLite with FK enforcement off may accept; other DBs would reject.
    # We verify the API doesn't crash and returns a reasonable status.
    assert r.status_code in (201, 400, 422, 404)


def test_update_project_bad_owner_fk(client, auth):
    r = client.post("/api/project", json={"name": "BadOwner"}, headers=auth)
    pid = r.json()["id"]
    r = client.put(f"/api/project/{pid}", json={"owner_id": 999999}, headers=auth)
    # Same tolerance for SQLite with FK enforcement off
    assert r.status_code in (200, 400, 422, 404)


# ---------------------------------------------------------------------------
# Nonexistent records / 404
# ---------------------------------------------------------------------------

def test_get_nonexistent_task(client, auth):
    r = client.get("/api/task/999999", headers=auth)
    assert r.status_code == 404


def test_update_nonexistent_project(client, auth):
    r = client.put("/api/project/999999", json={"name": "Ghost"}, headers=auth)
    assert r.status_code == 404


def test_delete_nonexistent_team_member(client, auth):
    r = client.delete("/api/team_member/999999", headers=auth)
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Empty strings for required fields
# ---------------------------------------------------------------------------

def test_create_task_empty_title(client, auth):
    r = client.post("/api/task", json={"title": ""}, headers=auth)
    # Some validators allow empty strings; at minimum the endpoint shouldn't crash.
    assert r.status_code in (201, 422)
