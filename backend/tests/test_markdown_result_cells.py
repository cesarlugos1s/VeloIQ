"""Markdown text in a result cell (e.g. a Task description authored in Markdown)
is rendered as formatted HTML by the table, editable-table and list view types,
while plain values keep their escaped-text rendering and raw HTML / unsafe link
schemes in the cell text stay neutralised.
"""
from __future__ import annotations

import pytest

from veloiq_framework.utils import views_utils

MARKDOWN_DESCRIPTION = (
    "## Launch Website\n\n"
    "Coordinate all sub-tasks and **flip the switch** on the new site.\n\n"
    "- All copy reviewed\n"
    "- Hosting and DNS confirmed live\n\n"
    "> See [deployment runbook](https://example.com/runbook)."
)


class TestRenderMarkdownCellHtml:
    def test_renders_markdown_text(self):
        rendered = views_utils._render_markdown_cell_html(MARKDOWN_DESCRIPTION)
        assert rendered.startswith('<div class="jm-md">')
        assert "<h2>Launch Website</h2>" in rendered
        assert "<strong>flip the switch</strong>" in rendered
        assert "<li>All copy reviewed</li>" in rendered
        assert "<blockquote>" in rendered
        assert 'href="https://example.com/runbook"' in rendered

    @pytest.mark.parametrize("value, expected", [
        ("in_progress", "in_progress"),
        ("a - b", "a - b"),
        (42, "42"),
        (None, ""),
        ("<b>x</b>", "&lt;b&gt;x&lt;/b&gt;"),
        ('<a href="/task/show/1">T</a>', '<a href="/task/show/1">T</a>'),
    ])
    def test_plain_values_unchanged(self, value, expected):
        assert views_utils._render_markdown_cell_html(value) == expected
        assert views_utils._render_markdown_cell_html(value) == views_utils._render_cell_html(value)

    def test_raw_html_in_markdown_stays_escaped(self):
        rendered = views_utils._render_markdown_cell_html(
            "**x**\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>")
        assert "<script>" not in rendered and "<img" not in rendered
        assert "&lt;script&gt;" in rendered

    def test_unsafe_link_scheme_neutralised(self):
        rendered = views_utils._render_markdown_cell_html("[x](javascript:alert(1))")
        assert "javascript:" not in rendered
        assert 'href="#"' in rendered


@pytest.mark.parametrize("view_type", ["table", "editable-table", "list"])
def test_view_types_render_markdown_cells(view_type):
    columns = ["title", "description", "status"]
    rows = [{"title": "Launch website", "description": MARKDOWN_DESCRIPTION, "status": "in_progress"}]
    rendered = views_utils.render_query_rows_as_dashboard_view_html(columns, rows, view_type)
    assert '<div class="jm-md">' in rendered
    assert "<h2>Launch Website</h2>" in rendered
    assert ".jm-md {" in rendered
