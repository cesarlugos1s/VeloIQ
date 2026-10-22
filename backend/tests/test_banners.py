"""Collapsible model-based banners (banners.json + GET /api/veloiq/banners).

Each test writes its own banners.json and points the loader at it, so the
sample app's configuration is never touched.
"""
import json
from datetime import datetime

import pytest

from veloiq_framework.banners import definitions
from veloiq_framework.banners.filters import resolve_relative_date

PROJECT_TITLE = "Banner-Endpoint-Project"


@pytest.fixture
def banners_file(tmp_path, monkeypatch):
    """Return a writer that installs a banners.json for the current test."""
    path = tmp_path / "banners.json"

    def write(content: dict):
        path.write_text(json.dumps(content), encoding="utf-8")
        monkeypatch.setattr(definitions, "banner_file_paths", lambda: [path])
        monkeypatch.setattr(definitions, "_cache", None)

    return write


@pytest.fixture
def project_id(client, auth):
    """A project with four tasks; both are deleted afterwards."""
    project_id = client.post("/api/project", json={"name": PROJECT_TITLE, "status": "active"}, headers=auth).json()["id"]
    tasks = [("Banner task A", "todo", "critical", 2.0), ("Banner task B", "todo", "high", 5.0),
             ("Banner task C", "done", "critical", 8.0), ("Banner task D", "todo", "low", 1.0)]
    task_ids = [
        client.post("/api/task", json={"title": title, "status": status, "priority": priority,
                                       "planned_work_hours": hours, "project_id": project_id}, headers=auth).json()["id"]
        for title, status, priority, hours in tasks
    ]
    yield project_id
    for task_id in task_ids:
        client.delete(f"/api/task/{task_id}", headers=auth)
    client.delete(f"/api/project/{project_id}", headers=auth)


def _banner(client, auth, key, **params):
    """Return the payload of banner *key* on the page described by *params*, or None."""
    r = client.get("/api/veloiq/banners", params=params, headers=auth)
    assert r.status_code == 200, r.text
    return next((b for b in r.json()["banners"] if b["key"] == key), None)


def test_model_banner_applies_advanced_filter_rules(client, auth, project_id, banners_file):
    banners_file({"urgent": {
        "title": "Urgent tasks",
        "source": {"model": "Task"},
        "filters": [
            {"fieldKey": "title", "operator": "contains", "value": "banner task"},
            {"fieldKey": "priority", "operator": "equals", "value": ["critical", "high"]},
            {"fieldKey": "status", "operator": "equals", "value": "todo"},
        ],
        "sort": {"field": "planned_work_hours", "order": "desc"},
        "display_fields": ["title", {"key": "priority", "label": "Urgency"}],
    }})
    banner = _banner(client, auth, "urgent")
    assert banner["count"] == 2
    assert [row["title"] for row in banner["rows"]] == ["Banner task B", "Banner task A"]
    assert banner["columns"] == [{"key": "title", "label": "Title"}, {"key": "priority", "label": "Urgency"}]
    assert banner["row_resource"] == "task" and banner["view_all_resource"] == "task"
    assert all(row["eid"] for row in banner["rows"])


def test_number_between_and_max_rows(client, auth, project_id, banners_file):
    banners_file({"effort": {
        "source": {"model": "task"},
        "filters": [{"fieldKey": "title", "operator": "contains", "value": "banner task"},
                    {"fieldKey": "planned_work_hours", "operator": "between", "value": 2, "value2": 8}],
        "max_rows": 1,
    }})
    banner = _banner(client, auth, "effort")
    assert banner["count"] == 3          # the count covers every row, not only those listed
    assert len(banner["rows"]) == 1


def test_orm_spec_banner_groups_rows(client, auth, project_id, banners_file):
    banners_file({"by_priority": {
        "source": {"orm": {
            "from": "Task",
            "select": [["col", "Task", "priority"], ["agg", "count", "Task", "id", "task_count"]],
            "where": [["Task", "title", "ilike", "banner task%"], ["Task", "status", "!=", "done"]],
            "group_by": [["Task", "priority"]],
            "order_by": [["Task", "priority", "asc"]],
        }},
        # Rules on an ORM source select the rows before they are grouped.
        "filters": [{"fieldKey": "priority", "operator": "equals", "value": ["critical", "high"]},
                    {"fieldKey": "Task.planned_work_hours", "operator": "gte", "value": 2}],
        "view_all_resource": "task",
    }})
    banner = _banner(client, auth, "by_priority")
    assert banner["count"] == 2
    assert {row["priority"]: row["task_count"] for row in banner["rows"]} == {"critical": 1, "high": 1}
    assert banner["row_resource"] is None and banner["view_all_resource"] == "task"


def test_orm_spec_with_raw_sql_is_rejected(client, auth, project_id, banners_file):
    banners_file({"raw": {"source": {"orm": {"from": "Task", "where": [["raw", "1=1"]]}}}})
    assert _banner(client, auth, "raw") is None


def test_named_query_banner(client, auth, project_id, banners_file):
    banners_file({"project_tasks": {
        "source": {"named_query": "projects_with_tasks_and_members"},
        "filters": [{"fieldKey": "project_name", "operator": "equals", "value": PROJECT_TITLE}],
        "display_fields": ["task_title"],
    }})
    banner = _banner(client, auth, "project_tasks")
    assert banner["count"] == 4
    assert banner["columns"] == [{"key": "task_title", "label": "Task"}]
    assert banner["row_resource"] == "projects_with_tasks_and_members"


def test_page_targeting(client, auth, project_id, banners_file):
    source = {"model": "Task"}
    banners_file({
        "everywhere": {"source": source},
        "task_pages": {"source": source, "show_on": {"models": ["Task"]}},
        "projects_module": {"source": source, "show_on": {"modules": ["projects"]}},
        "portal": {"source": source, "show_on": {"sites": ["candidate-portal"]}},
    })
    on_task = {b["key"] for b in client.get("/api/veloiq/banners", params={"resource": "task"}, headers=auth).json()["banners"]}
    assert on_task == {"everywhere", "task_pages"}
    on_project = {b["key"] for b in client.get("/api/veloiq/banners", params={"resource": "project"}, headers=auth).json()["banners"]}
    assert on_project == {"everywhere", "projects_module"}
    on_portal = {b["key"] for b in client.get("/api/veloiq/banners", params={"site": "candidate-portal"}, headers=auth).json()["banners"]}
    assert on_portal == {"portal"}


def test_empty_hidden_disabled_and_invalid_banners(client, auth, project_id, banners_file):
    nothing = [{"fieldKey": "title", "operator": "equals", "value": "no such task"}]
    banners_file({
        "empty": {"source": {"model": "Task"}, "filters": nothing},
        "empty_shown": {"source": {"model": "Task"}, "filters": nothing, "hide_when_empty": False},
        "disabled": {"source": {"model": "Task"}, "enabled": False},
        "bad_position": {"source": {"model": "Task"}, "position": {"horizontal": "nowhere"}},
        "unknown_field": {"source": {"model": "Task"}, "filters": [{"fieldKey": "nope", "operator": "equals", "value": 1}],
                          "hide_when_empty": False},
    })
    keys = {b["key"]: b for b in client.get("/api/veloiq/banners", headers=auth).json()["banners"]}
    assert set(keys) == {"empty_shown", "unknown_field"}
    assert keys["unknown_field"]["count"] == 0        # an unknown field selects nothing, never everything


def test_host_file_overrides_extension_banner(tmp_path):
    ext_file, host_file = tmp_path / "ext.json", tmp_path / "host.json"
    ext_file.write_text(json.dumps({"alerts": {"source": {"model": "Task"}, "position": {"horizontal": "left", "vertical": "bottom"}}}))
    host_file.write_text(json.dumps({"alerts": {"position": {"horizontal": "right"}}}))
    merged = definitions.load_banner_definitions([ext_file, host_file])["alerts"]
    assert merged["position"] == {"horizontal": "right", "vertical": "bottom"}
    assert merged["source"] == {"model": "Task"}


def test_relative_dates_match_the_list_page():
    now = datetime(2026, 10, 22, 15, 30)       # a Thursday
    week = resolve_relative_date({"mode": "relative", "direction": "current", "unit": "weeks"}, as_range=True, now=now)
    assert week["start"] == datetime(2026, 10, 18) and week["end"].date() == datetime(2026, 10, 24).date()
    prev_quarter = resolve_relative_date({"mode": "relative", "direction": "previous", "count": 1, "unit": "quarters"},
                                         as_range=True, now=now)
    assert prev_quarter["start"] == datetime(2026, 7, 1) and prev_quarter["end"].date() == datetime(2026, 9, 30).date()
    next_month = resolve_relative_date({"mode": "relative", "direction": "next", "count": 1, "unit": "months"},
                                       as_range=False, now=now)
    assert next_month["date"] == datetime(2026, 11, 1)
