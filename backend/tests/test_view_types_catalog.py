"""The view type catalog (view_types.json) is the one source of the backend's view type lists."""
from veloiq_framework.utils.views_utils import resolve_dashboard_view_type
from veloiq_framework.view_types import (
    _read_catalog,
    get_all_view_types,
    get_view_type_label_text,
    get_view_types_for_context,
    resolve_view_type_token,
)


def test_each_token_is_listed_once_and_has_a_label():
    tokens = get_all_view_types()
    assert len(tokens) == len(set(tokens))
    assert all(get_view_type_label_text(token) != token for token in tokens)


def test_configuration_context_offers_every_view_type():
    assert get_view_types_for_context("configuration") == [token for token in get_all_view_types() if token != "analyze"]
    assert "analyze" not in get_view_types_for_context("configuration")
    assert "analyze" in get_view_types_for_context("kanban-column")
    assert "csv" not in get_view_types_for_context("list-page")
    assert "editable-csv" in get_view_types_for_context("relation-edit")


def test_spellings_resolve_to_tokens():
    assert resolve_view_type_token("Editable Table") == "editable-table"
    assert resolve_view_type_token("totalsdetails") == "totals-details"
    assert resolve_view_type_token("KanbanView") == "kanban"
    assert resolve_view_type_token("nonsense") == ""


def test_dashboard_view_type_resolution_uses_the_catalog():
    assert resolve_dashboard_view_type("primary-carousel") == "primary"
    assert resolve_dashboard_view_type("images") == "image"
    assert resolve_dashboard_view_type("muledit") == "editable-table"
    assert resolve_dashboard_view_type("sameetypelist") == "list"
    assert resolve_dashboard_view_type("custom_show_page") == "custom_show_page"
    assert resolve_dashboard_view_type("") == "table"


def test_map_view_type_requires_a_declared_map_location():
    assert "map" in get_view_types_for_context("list-page")
    assert "map" in get_view_types_for_context("relation-show")
    assert "map" not in get_view_types_for_context("kanban-column")
    assert resolve_view_type_token("MapView") == "map"
    map_entry = next(entry for entry in _read_catalog() if entry["token"] == "map")
    assert map_entry["requires"] == "map-location"
