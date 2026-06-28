"""Custom API and Named Queries: task-manager sample custom endpoints.

Tests:
- POST /task/<id>/complete  — custom endpoint from custom_api.py
- GET  /task/by-project/<id> — custom endpoint from custom_api.py
- Named query: projects_with_tasks_and_members
"""
import pytest


# ---------------------------------------------------------------------------
# Custom API: complete-task
# ---------------------------------------------------------------------------

def test_complete_task_sets_status_to_done(client, auth):
    """POST /api/task/{id}/complete sets status='done'."""
    r = client.post("/api/task", json={"title": "CompleteMe", "status": "todo"}, headers=auth)
    assert r.status_code == 201
    tid = r.json()["id"]

    r = client.post(f"/api/task/{tid}/complete", headers=auth)
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == tid
    assert data["status"] == "done"

    # Verify persisted
    r = client.get(f"/api/task/{tid}", headers=auth)
    assert r.json()["status"] == "done"


def test_complete_task_nonexistent_returns_404(client, auth):
    """POST /api/task/999999/complete returns 404."""
    r = client.post("/api/task/999999/complete", headers=auth)
    assert r.status_code == 404


def test_complete_task_already_done(client, auth):
    """Completing an already-done task is idempotent."""
    r = client.post("/api/task", json={"title": "AlreadyDone", "status": "done"}, headers=auth)
    tid = r.json()["id"]

    r = client.post(f"/api/task/{tid}/complete", headers=auth)
    assert r.status_code == 200
    assert r.json()["status"] == "done"


# ---------------------------------------------------------------------------
# Custom API: tasks-by-project
# ---------------------------------------------------------------------------

def test_tasks_by_project_returns_correct_tasks(client, auth):
    """GET /api/task/by-project/{project_id} returns tasks for that project."""
    # Create a project
    r = client.post("/api/project", json={"name": "CustomProj"}, headers=auth)
    pid = r.json()["id"]

    # Create tasks under it
    client.post("/api/task", json={"title": "Task A", "project_id": pid}, headers=auth)
    client.post("/api/task", json={"title": "Task B", "project_id": pid}, headers=auth)

    # Create a task under NO project (project_id=None) — shouldn't appear
    client.post("/api/task", json={"title": "Orphan"}, headers=auth)

    r = client.get(f"/api/task/by-project/{pid}", headers=auth)
    assert r.status_code == 200
    tasks = r.json()
    assert len(tasks) == 2
    titles = {t["title"] for t in tasks}
    assert titles == {"Task A", "Task B"}


def test_tasks_by_project_empty(client, auth):
    """GET /api/task/by-project/{pid} returns empty list for project with no tasks."""
    r = client.post("/api/project", json={"name": "EmptyProj"}, headers=auth)
    pid = r.json()["id"]

    r = client.get(f"/api/task/by-project/{pid}", headers=auth)
    assert r.status_code == 200
    assert r.json() == []


# ---------------------------------------------------------------------------
# Named Query: projects_with_tasks_and_members
# ---------------------------------------------------------------------------

def test_named_query_list_returns_results(client, auth):
    """GET /projects_with_tasks_and_members returns joined data."""
    # Create a team member, a project, and a task to produce query rows
    r = client.post(
        "/api/team_member",
        json={"name": "QueryUser", "email": "query@test.com"},
        headers=auth,
    )
    mid = r.json()["id"]

    r = client.post(
        "/api/project",
        json={"name": "QueryProject", "status": "active", "owner_id": mid},
        headers=auth,
    )
    pid = r.json()["id"]

    r = client.post(
        "/api/task",
        json={"title": "QueryTask", "project_id": pid, "assignee_id": mid},
        headers=auth,
    )
    assert r.status_code == 201

    r = client.get("/api/projects_with_tasks_and_members", headers=auth)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)

    # At least one row where project_name matches
    project_names = {row.get("project_name") for row in data}
    assert "QueryProject" in project_names


def test_named_query_filter_by_project_id(client, auth):
    """Named query supports ?id= filter (scoped relation tab)."""
    r = client.post(
        "/api/team_member",
        json={"name": "FilterQM", "email": "filterqm@test.com"},
        headers=auth,
    )
    mid = r.json()["id"]

    # Project A
    r = client.post(
        "/api/project",
        json={"name": "ProjectA", "owner_id": mid},
        headers=auth,
    )
    pid_a = r.json()["id"]

    # Project B
    r = client.post(
        "/api/project",
        json={"name": "ProjectB", "owner_id": mid},
        headers=auth,
    )
    pid_b = r.json()["id"]

    # Tasks for each
    client.post(
        "/api/task",
        json={"title": "TaskA", "project_id": pid_a, "assignee_id": mid},
        headers=auth,
    )
    client.post(
        "/api/task",
        json={"title": "TaskB", "project_id": pid_b, "assignee_id": mid},
        headers=auth,
    )

    # Filter by project A
    r = client.get(f"/api/projects_with_tasks_and_members?id={pid_a}", headers=auth)
    assert r.status_code == 200
    data = r.json()
    project_names = {row.get("project_name") for row in data}
    assert "ProjectA" in project_names
    assert "ProjectB" not in project_names


def test_named_query_requires_auth(client):
    """Named query returns 401 without auth."""
    r = client.get("/api/projects_with_tasks_and_members")
    assert r.status_code == 401
