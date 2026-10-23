"""The admin-only Portals configuration pages: veloiq.toml [portals.*], each portal's menu and page overrides.

All three are non-model data resources (standard list and record pages); the
tests drive them through their REST endpoints against a temporary veloiq.toml.
"""
import json

import pytest

VELOIQ_TOML = """# App configuration.
[extensions]
enabled = []

# The store portal.
[portals.store]
folder = "ext/store"
roles = ["Shopper"]
title = "Store"

[portals.store.features]
csv_export = false

[views]
plain_color_base_hex = "#123456"
"""


@pytest.fixture
def portal_project(tmp_path, monkeypatch):
    """A host app root with veloiq.toml and the store portal's src/ folder."""
    import veloiq_framework.extension_registry as extension_registry

    (tmp_path / "veloiq.toml").write_text(VELOIQ_TOML)
    (tmp_path / "ext" / "store" / "src").mkdir(parents=True)
    (tmp_path / "ext" / "store" / "src" / "navigation.store.config.json").write_text(json.dumps([
        {"key": "module:offers", "label": "Offers", "icon": "ShopOutlined", "sequence": 10, "type": "module"},
        {"key": "offer", "label": "Offer", "icon": "TagOutlined", "sequence": 11, "type": "model", "custom": "kept"},
    ]))
    config_file = tmp_path / "veloiq.toml"
    monkeypatch.setattr(extension_registry, "find_config_file", lambda start=None: config_file)
    return tmp_path


def test_portals_are_listed_with_their_effective_settings(client, auth, portal_project):
    rows = client.get("/api/veloiq_portals", headers=auth).json()
    assert [row["site"] for row in rows] == ["store"]
    store = rows[0]
    assert store["roles"] == ["Shopper"] and store["title"] == "Store"
    assert store["csv_export"] is False and store["analyze"] is False and store["saved_views"] is True
    assert store["built"] is False and store["address"] == "/portals/store/"


def test_editing_a_portal_rewrites_only_its_tables(client, auth, portal_project):
    response = client.put("/api/veloiq_portals/store", headers=auth,
                          json={"title": "Online store", "roles": ["Shopper", "Buyer"], "analyze": True})
    assert response.status_code == 200, response.text
    text = (portal_project / "veloiq.toml").read_text()
    assert 'title = "Online store"' in text and 'roles = ["Shopper", "Buyer"]' in text
    assert "analyze = true" in text and "csv_export = false" in text
    # Everything else in the file stays as it was.
    assert text.startswith("# App configuration.\n[extensions]")
    assert '[views]\nplain_color_base_hex = "#123456"' in text


def test_declaring_and_removing_a_portal(client, auth, portal_project):
    response = client.post("/api/veloiq_portals", headers=auth, json={"site": "partners", "roles": ["Partner"]})
    assert response.status_code in (200, 201), response.text
    rows = {row["site"]: row for row in client.get("/api/veloiq_portals", headers=auth).json()}
    assert rows["partners"]["folder"] == "ext/partners" and rows["partners"]["default_layout"] == "horizontal"
    assert client.post("/api/veloiq_portals", headers=auth, json={"site": "partners", "roles": ["X"]}).status_code == 422
    assert client.post("/api/veloiq_portals", headers=auth, json={"site": "Bad Name", "roles": ["X"]}).status_code == 422
    assert client.post("/api/veloiq_portals", headers=auth, json={"site": "noroles", "roles": []}).status_code == 422
    assert client.delete("/api/veloiq_portals/partners", headers=auth).status_code in (200, 204)
    assert "partners" not in (portal_project / "veloiq.toml").read_text()


def test_menu_entries_are_edited_in_the_portals_menu_file(client, auth, portal_project):
    rows = client.get("/api/veloiq_portal_menu_entries", headers=auth).json()
    assert [row["key"] for row in rows] == ["module:offers", "offer"]
    offer_eid = next(row["eid"] for row in rows if row["key"] == "offer")
    assert client.put(f"/api/veloiq_portal_menu_entries/{offer_eid}", headers=auth,
                      json={"label": "Deals", "sequence": 5}).status_code == 200
    created = client.post("/api/veloiq_portal_menu_entries", headers=auth, json={
        "site": "store", "key": "welcome", "label": "Welcome", "type": "page", "route": "/welcome", "sequence": 0})
    assert created.status_code in (200, 201), created.text
    menu = json.loads((portal_project / "ext" / "store" / "src" / "navigation.store.config.json").read_text())
    offer = next(entry for entry in menu if entry["key"] == "offer")
    assert offer["label"] == "Deals" and offer["sequence"] == 5 and offer["custom"] == "kept"
    assert {"key": "welcome", "type": "page", "route": "/welcome"}.items() <= next(
        entry for entry in menu if entry["key"] == "welcome").items()
    module_eid = next(row["eid"] for row in rows if row["key"] == "module:offers")
    assert client.delete(f"/api/veloiq_portal_menu_entries/{module_eid}", headers=auth).status_code in (200, 204)
    menu = json.loads((portal_project / "ext" / "store" / "src" / "navigation.store.config.json").read_text())
    assert [entry["key"] for entry in menu] == ["offer", "welcome"]


def test_field_overrides_are_kept_as_model_overrides_and_served_to_the_portal(client, auth, portal_project):
    created = client.post("/api/veloiq_portal_field_overrides", headers=auth, json={
        "site": "store", "model": "Offer", "field": "internal_notes", "omit": True})
    assert created.status_code in (200, 201), created.text
    client.post("/api/veloiq_portal_field_overrides", headers=auth, json={
        "site": "store", "model": "Offer", "field": "title", "label": "Name"})
    overrides_file = portal_project / "ext" / "store" / "src" / "portalPageOverrides.json"
    assert json.loads(overrides_file.read_text()) == [
        {"name": "Offer", "fields": [{"key": "internal_notes", "omit": True}, {"key": "title", "label": "Name"}]},
    ]
    # The portal reads its menu and overrides before anyone signs in.
    configuration = client.get("/api/veloiq/portals/store/configuration").json()
    assert configuration["page_overrides"][0]["name"] == "Offer"
    assert [entry["key"] for entry in configuration["navigation"]] == ["module:offers", "offer"]
    rows = client.get("/api/veloiq_portal_field_overrides", headers=auth).json()
    for row in rows:
        assert client.delete(f"/api/veloiq_portal_field_overrides/{row['eid']}", headers=auth).status_code in (200, 204)
    assert json.loads(overrides_file.read_text()) == []


def test_only_administrators_reach_the_portal_configuration(client, manager_auth, portal_project):
    for resource in ("veloiq_portals", "veloiq_portal_menu_entries", "veloiq_portal_field_overrides"):
        assert client.get(f"/api/{resource}", headers=manager_auth).status_code == 403
    assert client.get("/api/veloiq/role-names", headers=manager_auth).status_code == 403
    catalog = client.get("/api/veloiq/non-model-data-resources", headers=manager_auth).json()["models"]
    assert not {"veloiq_portals", "veloiq_portal_menu_entries"} & {model["resource"] for model in catalog}


def test_role_names_for_administrators(client, auth, portal_project):
    role_names = client.get("/api/veloiq/role-names", headers=auth).json()
    assert "Admin" in role_names and "Manager" in role_names


def test_the_portal_configuration_pages_have_no_analyze_section(client, auth, portal_project):
    catalog = client.get("/api/veloiq/non-model-data-resources", headers=auth).json()["models"]
    configuration_models = {m["resource"]: m for m in catalog if m["resource"].startswith("veloiq_portal")}
    assert set(configuration_models) == {"veloiq_portals", "veloiq_portal_menu_entries", "veloiq_portal_field_overrides"}
    assert all(model.get("showAnalyzeSection") is False for model in configuration_models.values())
