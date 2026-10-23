"""External portal definitions (veloiq.toml) and the framework UI features they enable."""
import pytest

from veloiq_framework.portals import framework_ui_features_for_user, read_portal_definitions

VELOIQ_TOML = """
[portals.candidate-portal]
folder = "ext/candidate-portal"
roles = ["Candidate"]
title = "VeilMatch"
token_storage_key = "veilmatch_candidate_token"

[portals.employer-portal]
roles = ["Employer"]
default_layout = "vertical"
show_dashboard_menu_entry = true

[portals.employer-portal.features]
analyze = true
csv_export = false
"""


@pytest.fixture
def portal_definitions(tmp_path):
    (tmp_path / "veloiq.toml").write_text(VELOIQ_TOML)
    return read_portal_definitions(tmp_path)


@pytest.fixture(autouse=True)
def role_policies_allow_everything(monkeypatch):
    """The roles' feature policies (read from the database) allow every feature here."""
    import veloiq_framework.access.decision as decision
    monkeypatch.setattr(decision, "can_use_feature", lambda user, key: True)


def test_portal_definitions_are_read_with_their_defaults(portal_definitions):
    candidate = portal_definitions["candidate-portal"]
    assert candidate.roles == ["Candidate"] and candidate.title == "VeilMatch"
    assert candidate.default_layout == "horizontal" and candidate.show_dashboard_menu_entry is False
    employer = portal_definitions["employer-portal"]
    assert employer.folder == "ext/employer-portal" and employer.token_storage_key == "employer-portal_token"
    assert employer.default_layout == "vertical" and employer.show_dashboard_menu_entry is True
    # The public settings never include the roles.
    assert "roles" not in candidate.to_public_settings()


def test_no_portals_without_a_portals_table(tmp_path):
    (tmp_path / "veloiq.toml").write_text("[views]\n")
    assert read_portal_definitions(tmp_path) == {}


def test_portal_users_get_the_portal_defaults(portal_definitions):
    features = framework_ui_features_for_user({"roles": ["Candidate"]}, portal_definitions)
    assert features["analyze"] is False
    assert features["csv_export"] and features["saved_views"] and features["column_selector"] and features["record_metadata"]


def test_a_portal_can_switch_features(portal_definitions):
    features = framework_ui_features_for_user({"roles": ["Employer"]}, portal_definitions)
    assert features["analyze"] is True and features["csv_export"] is False


def test_administrators_and_main_app_users_get_every_feature(portal_definitions):
    assert all(framework_ui_features_for_user({"roles": ["Admin", "Candidate"]}, portal_definitions).values())
    assert all(framework_ui_features_for_user({"roles": ["Viewer"]}, portal_definitions).values())


def test_a_role_policy_can_switch_a_feature_off(portal_definitions, monkeypatch):
    import veloiq_framework.access.decision as decision
    monkeypatch.setattr(decision, "can_use_feature", lambda user, key: key != "veloiq:csv_export")
    features = framework_ui_features_for_user({"roles": ["Viewer"]}, portal_definitions)
    assert features["csv_export"] is False and features["analyze"] is True
