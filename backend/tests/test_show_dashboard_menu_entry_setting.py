"""The ``show_dashboard_menu_entry`` view setting reaches the UI view settings."""
from veloiq_framework.extension_registry import read_views_config


def test_show_dashboard_menu_entry_is_read_from_veloiq_toml(tmp_path):
    (tmp_path / "veloiq.toml").write_text("[views]\nshow_dashboard_menu_entry = false\n")
    assert read_views_config(tmp_path)["showDashboardMenuEntry"] is False


def test_show_dashboard_menu_entry_left_unset_is_not_sent(tmp_path):
    """Unset, the UI uses its default (shown)."""
    (tmp_path / "veloiq.toml").write_text("[views]\nlist_view_type = \"table\"\n")
    assert "showDashboardMenuEntry" not in read_views_config(tmp_path)
