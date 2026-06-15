"""Relations: FK fields, one-to-many relationships between models."""


def test_task_belongs_to_project(client, auth):
    r = client.post("/api/project", json={"name": "RelProject"}, headers=auth)
    pid = r.json()["id"]
    r = client.post("/api/task", json={"title": "RelTask", "project_id": pid}, headers=auth)
    assert r.status_code == 201
    assert r.json()["project_id"] == pid


def test_task_assigned_to_team_member(client, auth):
    r = client.post("/api/team_member", json={"name": "Carol", "email": "carol@example.com"}, headers=auth)
    mid = r.json()["id"]
    r = client.post("/api/task", json={"title": "AssignedTask", "assignee_id": mid}, headers=auth)
    assert r.status_code == 201
    assert r.json()["assignee_id"] == mid


def test_project_owner_is_team_member(client, auth):
    r = client.post("/api/team_member", json={"name": "Dave", "email": "dave@example.com"}, headers=auth)
    mid = r.json()["id"]
    r = client.post("/api/project", json={"name": "OwnedProject", "owner_id": mid}, headers=auth)
    assert r.status_code == 201
    assert r.json()["owner_id"] == mid


def test_task_subtask_self_reference(client, auth):
    r = client.post("/api/task", json={"title": "ParentTask"}, headers=auth)
    parent_id = r.json()["id"]
    r = client.post("/api/task", json={"title": "SubTask", "parent_task_id": parent_id}, headers=auth)
    assert r.status_code == 201
    assert r.json()["parent_task_id"] == parent_id


def test_tasks_filtered_by_project_appear_in_list(client, auth):
    r = client.post("/api/project", json={"name": "FilterProject"}, headers=auth)
    pid = r.json()["id"]
    for i in range(3):
        client.post("/api/task", json={"title": f"Task {i}", "project_id": pid}, headers=auth)

    r = client.get("/api/task", headers=auth)
    assert r.status_code == 200
    project_tasks = [t for t in r.json() if t.get("project_id") == pid]
    assert len(project_tasks) == 3
