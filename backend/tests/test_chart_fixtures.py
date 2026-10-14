"""Checks the backend chart implementation against the fixtures shared with the
frontend (test-fixtures/charts.json): the same summary function on the same rows
must give the same number in both layers, and both layers must use the same chart
catalogue and theme.
"""
import json
from pathlib import Path

import plotly.graph_objects as go
import pytest

from veloiq_framework.utils import views_utils as vu

FIXTURES = json.loads((Path(__file__).resolve().parents[2] / "test-fixtures" / "charts.json").read_text(encoding="utf-8"))
SUMMARY_FUNCTIONS = ("sum", "avg", "count", "max", "min", "stddev")


@pytest.mark.parametrize("case", FIXTURES["summary_cases"], ids=lambda case: case["name"])
def test_summary_functions(case):
    for summary_function in SUMMARY_FUNCTIONS:
        assert vu.jm_summarize_values(case["values"], summary_function) == pytest.approx(case["expected"][summary_function], abs=1e-9)


@pytest.mark.parametrize("case", FIXTURES["grouping_cases"], ids=lambda case: " • ".join(case["categories"]))
@pytest.mark.parametrize("summary_function", SUMMARY_FUNCTIONS)
def test_grouped_summaries(case, summary_function):
    result = vu.jm_group_and_summarize(FIXTURES["grouping_rows"], case["categories"], [case["series"]], summary_function)
    actual = {label: values[case["series"]] for label, values in result.items()}
    expected = case["expected"][summary_function]
    assert sorted(actual) == sorted(expected)
    for label, value in expected.items():
        assert actual[label] == pytest.approx(value, abs=1e-9)


@pytest.mark.parametrize("summary_function", SUMMARY_FUNCTIONS)
def test_pivot_aggfunc_matches_shared_summary(summary_function):
    """The pivots behind backend charts summarise with the same rules (a pandas pivot
    over the grouping rows gives the fixture's per-group values)."""
    import pandas as pd
    df = pd.DataFrame(FIXTURES["grouping_rows"])
    pivot = pd.pivot_table(df, values=["hours"], index=["status"], aggfunc=vu.jm_pandas_summary_aggfunc(summary_function), dropna=False)
    expected = next(case for case in FIXTURES["grouping_cases"] if case["categories"] == ["status"])["expected"][summary_function]
    for label, value in expected.items():
        assert pivot.loc[label, "hours"] == pytest.approx(value, abs=1e-9)


def test_chart_catalogue_matches_shared_catalogue():
    assert [dict(chart_type) for chart_type in vu.JM_CHART_TYPES] == FIXTURES["chart_types"]
    assert vu.JM_LEGACY_CHART_TYPE_IDS == FIXTURES["legacy_chart_type_ids"]
    assert vu.JM_DEFAULT_CHART_TYPE == FIXTURES["default_chart_type"]
    assert vu.JM_DEFAULT_SUMMARY_FUNCTION == FIXTURES["default_summary_function"]
    assert vu.JM_CATEGORY_LABEL_SEPARATOR == FIXTURES["category_label_separator"]


def test_legacy_chart_type_ids_are_normalized():
    for legacy, current in FIXTURES["legacy_chart_type_ids"].items():
        assert vu.jm_normalize_chart_type_id(legacy) == current
    assert vu.jm_normalize_chart_type_id("not-a-chart", fallback=FIXTURES["default_chart_type"]) == FIXTURES["default_chart_type"]


def test_chart_theme_matches_shared_theme():
    theme = FIXTURES["theme"]
    assert list(vu.JM_CHART_COLORWAY) == theme["colorway"]
    assert vu.JM_CHART_HEATMAP_COLORSCALE == theme["heatmap_colorscale"]
    assert vu.JM_CHART_HEATMAP_REVERSESCALE == theme["heatmap_reversescale"]
    assert vu.JM_CHART_NUMBER_FORMAT == theme["number_format"]
    assert vu.JM_CHART_FONT_FAMILY == theme["font_family"]
    assert vu.JM_CHART_FONT_SIZE == theme["font_size"]
    assert vu.JM_CHART_EMPTY_MESSAGE == theme["empty_message"]
    fig = go.Figure(go.Bar(x=["a"], y=[1]))
    vu.jm_apply_standard_chart_layout(fig)
    legend = fig.layout.legend
    for key, value in theme["legend"].items():
        assert getattr(legend, key) == value
    assert list(fig.layout.colorway) == theme["colorway"]
    assert fig.layout.yaxis.hoverformat == theme["number_format"]


@pytest.mark.parametrize("case", FIXTURES["grouping_cases"], ids=lambda case: " • ".join(case["categories"]))
@pytest.mark.parametrize("summary_function", SUMMARY_FUNCTIONS)
def test_server_side_analyze_matches_shared_grouping(case, summary_function):
    """The server-side aggregation of the Analyze section (lists above the row threshold)
    gives the same per-group numbers as the browser does for the same rows."""
    from veloiq_framework.analyze import jm_analyze_rows
    fields = [{"key": "status", "type": "string"}, {"key": "priority", "type": "string"}, {"key": "hours", "type": "number"}]
    result = jm_analyze_rows(FIXTURES["grouping_rows"], fields=fields, pk_field=None,
                             category_keys=case["categories"], series_keys=[case["series"]],
                             summary_function=summary_function)
    actual = {FIXTURES["category_label_separator"].join(group["key"]): group["values"][case["series"]] for group in result["groups"]}
    expected = case["expected"][summary_function]
    assert sorted(actual) == sorted(expected)
    for label, value in expected.items():
        assert actual[label] == pytest.approx(value, abs=1e-9)


def test_server_side_analyze_filters_ranks_and_samples():
    """Search, column filters (including range buckets), Top N and the row sample."""
    from veloiq_framework.analyze import jm_analyze_rows
    rows = [{"id": i, "_label": f"Task {i}", "status": "Open" if i % 2 else "Closed", "hours": float(i), "owner_id": i % 3}
            for i in range(1, 101)]
    fields = [{"key": "id", "type": "number"}, {"key": "status", "type": "string"},
              {"key": "hours", "type": "number"}, {"key": "owner_id", "type": "number", "reference": True}]
    titles = {"owner_id": {"0": "Ana", "1": "Luis", "2": "Marta"}}
    result = jm_analyze_rows(rows, fields=fields, pk_field="id", category_keys=["owner_id"], series_keys=["hours"],
                             search="marta", column_filters={"hours": ["__range__:10:50"]},
                             reference_titles=titles, ranking_mode="top", ranking_key="hours", ranking_n=1,
                             stats_keys=["hours", "status"], sample_size=5)
    # "marta" matches owner 2's title; hours 10-50 keeps 14, 17, ..., 50.
    expected_hours = [h for h in range(10, 51) if h % 3 == 2]
    assert result["total_rows"] == len(expected_hours)
    assert result["groups"] == [{"key": [2], "values": {"hours": float(sum(expected_hours))}}]
    assert len(result["sample_rows"]) == 5
    assert result["stats"]["numeric"]["hours"]["max"] == 50
    assert sorted(count for _value, count in result["stats"]["categorical"]["status"]) == sorted(
        [sum(1 for h in expected_hours if h % 2), sum(1 for h in expected_hours if not h % 2)])
