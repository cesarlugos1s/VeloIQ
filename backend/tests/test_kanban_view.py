"""The kanban view type: column building and dashboard HTML rendering."""
from veloiq_framework.utils import views_utils
from veloiq_framework.utils.views_utils import (
    _build_kanban_columns,
    _kanban_split_column_names,
    render_query_rows_as_dashboard_view_html,
    resolve_dashboard_view_type,
)

ROWS = [
    {"name": "A", "status": "Open", "kind": "Forecast"},
    {"name": "B", "status": "Open", "kind": "Actual"},
    {"name": "C", "status": "Done", "kind": "Forecast"},
    {"name": "D", "status": "Done", "kind": "Forecast"},
    {"name": "E", "status": "Done", "kind": "Forecast"},
]


def test_kanban_is_a_known_view_type():
    assert resolve_dashboard_view_type("kanban") == "kanban"
    assert resolve_dashboard_view_type("KanbanView") == "kanban"


def test_split_column_is_the_first_column_whose_values_repeat():
    assert _kanban_split_column_names(["name", "status", "kind"], ROWS) == ["status"]
    assert _kanban_split_column_names(["name"], ROWS) == []


def test_columns_join_values_and_are_ordered_by_header():
    columns = _build_kanban_columns(ROWS, ["status", "kind"], 10)
    assert [header for header, _ in columns] == ["Done - Forecast", "Open - Actual", "Open - Forecast"]
    assert len(dict(columns)["Done - Forecast"]) == 3


def test_columns_over_the_maximum_keep_the_biggest():
    columns = _build_kanban_columns(ROWS, ["status", "kind"], 2)
    assert [header for header, _ in columns] == ["Done - Forecast", "Open - Actual"]


def test_render_has_a_column_per_value_with_counts(monkeypatch):
    monkeypatch.setattr(views_utils, "_kanban_maximum_columns", lambda: 10)
    html_text = render_query_rows_as_dashboard_view_html(["name", "status"], [dict(r) for r in ROWS], "kanban")
    assert html_text.count('class="jm-kanban-column"') == 2
    assert '<span class="jm-kanban-title">Done</span><span class="jm-kanban-count">(3)</span>' in html_text
    assert '<span class="jm-kanban-title">Open</span><span class="jm-kanban-count">(2)</span>' in html_text
