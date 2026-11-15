"""The Python ports of the list's advanced filter rules and categorical breakdown."""
from datetime import datetime

from veloiq_framework.analyze import (
    build_categorical_breakdown, resolve_relative_date, row_matches_advanced_filter_rule,
)

TEXT = {"key": "title", "type": "string"}
NUMBER = {"key": "hours", "type": "number"}
DATE = {"key": "due", "type": "date"}


def test_string_rules_ignore_case():
    row = {"title": "Quarterly Report"}
    assert row_matches_advanced_filter_rule(TEXT, row, {"operator": "contains", "value": "report"})
    assert not row_matches_advanced_filter_rule(TEXT, row, {"operator": "contains", "value": "invoice"})
    assert row_matches_advanced_filter_rule(TEXT, row, {"operator": "equals", "value": "quarterly report"})


def test_number_rules_use_the_operator():
    row = {"hours": 5}
    assert row_matches_advanced_filter_rule(NUMBER, row, {"operator": "gt", "value": 3})
    assert not row_matches_advanced_filter_rule(NUMBER, row, {"operator": "lt", "value": 3})
    assert row_matches_advanced_filter_rule(NUMBER, row, {"operator": "between", "value": 5, "value2": 9})
    assert not row_matches_advanced_filter_rule(NUMBER, {"hours": None}, {"operator": "gt", "value": 3})


def test_date_rules_absolute_and_relative():
    row = {"due": "2026-11-10"}
    before = {"operator": "before", "value": {"mode": "absolute", "date": "2026-11-15"}}
    after = {"operator": "after", "value": {"mode": "absolute", "date": "2026-11-15"}}
    assert row_matches_advanced_filter_rule(DATE, row, before)
    assert not row_matches_advanced_filter_rule(DATE, row, after)


def test_relative_ranges():
    now = datetime(2026, 11, 15)  # a Sunday
    quarter = resolve_relative_date({"direction": "current", "unit": "quarters"}, True, now)
    assert quarter["start"] == datetime(2026, 10, 1) and quarter["end"].date().isoformat() == "2026-12-31"
    week = resolve_relative_date({"direction": "previous", "unit": "weeks", "count": 1}, True, now)
    assert week["start"] == datetime(2026, 11, 8) and week["end"].date().isoformat() == "2026-11-14"


def test_categorical_breakdown_groups_the_rest():
    counts = {"a": 5, "b": 4, "c": 3, "d": 2, "e": 1, "f": 1}
    rows = build_categorical_breakdown(counts, "Others")
    assert [row["value"] for row in rows] == ["a", "b", "c", "d", "Others"]
    assert rows[-1] == {"value": "Others", "count": 2, "is_others": True}
    assert build_categorical_breakdown({"a": 1, "b": 2}, "Others") == [{"value": "b", "count": 2}, {"value": "a", "count": 1}]
