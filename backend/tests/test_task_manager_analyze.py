"""Server-side aggregation of the Analyze section (POST /api/<resource>/analyze).

The browser uses this endpoint instead of downloading every row once a list has more
rows than the ``analyze_server_aggregation_threshold`` view setting. It must give the
numbers the browser would compute, for the rows the list's filters select.
"""
import statistics

import pytest

PROJECT_TITLE = "Analyze-Endpoint-Project"
FIELDS = [
    {"key": "status", "type": "string"},
    {"key": "priority", "type": "string"},
    {"key": "planned_work_hours", "type": "number"},
    {"key": "project_id", "type": "number", "reference": True},
]


@pytest.fixture
def project_id(client, auth):
    """A project with five tasks; both are deleted afterwards, so other tests' lists are unaffected."""
    project_id = client.post("/api/project", json={"name": PROJECT_TITLE, "status": "active"}, headers=auth).json()["id"]
    tasks = [("todo", "high", 2.0), ("todo", "high", 4.0), ("todo", "low", 7.0), ("done", "high", 10.0), ("done", "low", None)]
    task_ids = [
        client.post("/api/task", json={"title": f"Analyze task {index}", "status": status, "priority": priority,
                                       "planned_work_hours": hours, "project_id": project_id}, headers=auth).json()["id"]
        for index, (status, priority, hours) in enumerate(tasks)
    ]
    yield project_id
    for task_id in task_ids:
        client.delete(f"/api/task/{task_id}", headers=auth)
    client.delete(f"/api/project/{project_id}", headers=auth)


def test_analyze_groups_like_the_browser(client, auth, project_id):
    body = {"fields": FIELDS, "category_keys": ["status", "priority"], "series_keys": ["planned_work_hours"],
            "summary_function": "stddev", "stats_keys": ["planned_work_hours", "project_id"]}
    # The list's own query-param filters select this project's tasks only.
    r = client.post(f"/api/task/analyze?project_id={project_id}", json=body, headers=auth)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total_rows"] == 5
    groups = {tuple(group["key"]): group["values"]["planned_work_hours"] for group in data["groups"]}
    assert groups[("todo", "high")] == statistics.stdev([2.0, 4.0])
    assert groups[("todo", "low")] == 0          # a single value
    assert groups[("done", "low")] == 0          # empty values are skipped
    assert data["stats"]["numeric"]["planned_work_hours"]["sum"] == 23.0
    # The referenced project's title comes with the groups/statistics, for labels.
    assert data["reference_titles"]["project_id"][str(project_id)] == PROJECT_TITLE


def test_analyze_applies_search_column_filters_and_ranking(client, auth, project_id):
    body = {"fields": FIELDS, "category_keys": ["status"], "series_keys": ["planned_work_hours"],
            "summary_function": "sum", "search": "analyze task", "column_filters": {"priority": ["high"]},
            "ranking": {"mode": "top", "key": "planned_work_hours", "n": 1}}
    r = client.post(f"/api/task/analyze?project_id={project_id}", json=body, headers=auth)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total_rows"] == 3                    # the three "high" tasks
    assert data["groups"] == [{"key": ["done"], "values": {"planned_work_hours": 10.0}}]
    assert len(data["sample_rows"]) == 1              # only the rows of the kept group


def test_analyze_requires_authentication(client):
    r = client.post("/api/task/analyze", json={"fields": FIELDS, "category_keys": ["status"], "series_keys": []})
    assert r.status_code in (401, 403)
