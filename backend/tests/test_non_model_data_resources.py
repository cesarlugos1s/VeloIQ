"""Non-model data resources: non-model data served with the REST contract of a model.

A JSON-file resource with a composite key (a read-only packaged file under a
host-side overlay) is mounted on the sample app for these tests, so the sample
app's own files are never touched. The System Configuration resource is only
read and given invalid values, so its files are never written either.
"""
import json

import pytest

from veloiq_framework.non_model_data_resources import (
    RowEidEncodingError,
    JsonFileDataSource,
    NonModelDataField,
    NonModelDataResource,
    decode_eid,
    encode_eid,
    mount_non_model_data_resource,
)

RESOURCE = "test_regional_rates"


# ---------------------------------------------------------------------------
# eid
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("values", [
    ["R1", "A12"], ["a~b", "c"], ["a!", "c"], ["a", "~b"], ["a~", "b"], ["x!~y", "!!", "~"],
])
def test_composite_eid_round_trip(values):
    """Every composite key decodes back to its values, including separators and escapes."""
    assert decode_eid(encode_eid(values), len(values)) == values


def test_composite_eid_is_unambiguous():
    """Keys that differ only in where a separator sits get different eids."""
    assert encode_eid(["a~", "b"]) != encode_eid(["a", "~b"])


def test_single_key_eid_and_errors():
    """A one-field key is used as it is; empty parts and wrong part counts are rejected."""
    assert encode_eid([42]) == "42"
    assert encode_eid([3.0]) == "3"
    with pytest.raises(RowEidEncodingError):
        encode_eid(["R1", ""])
    with pytest.raises(RowEidEncodingError):
        decode_eid("R1", 2)


# ---------------------------------------------------------------------------
# JSON file resource
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def rate_files(tmp_path_factory):
    """Return (packaged file, overlay file) paths; the packaged file holds three rows."""
    folder = tmp_path_factory.mktemp("non_model_data")
    packaged = folder / "packaged_rates.json"
    packaged.write_text(json.dumps({"version": 1, "rates": [
        {"region": "R1", "code": "A1", "rate": 10, "active": True},
        {"region": "R1", "code": "B2", "rate": 25.5, "active": False},
        {"region": "R2", "code": "A1", "rate": 7, "active": True},
    ]}), encoding="utf-8")
    return packaged, folder / "config" / "rates_overlay.json"


@pytest.fixture(scope="module")
def mounted(app, rate_files):
    """Mount the test resource on the sample app once for this module."""
    packaged, overlay = rate_files
    data_resource = NonModelDataResource(
        name=RESOURCE,
        label=RESOURCE,
        pk_fields=["region", "code"],
        fields=[
            NonModelDataField(key="region"),
            NonModelDataField(key="code"),
            NonModelDataField(key="rate", type="number", required=True),
            NonModelDataField(key="active", type="boolean"),
            NonModelDataField(key="tier", options=["T1", "T2"]),
        ],
        data_source=JsonFileDataSource(overlay, packaged_path=packaged, rows_path=["rates"]),
        default_sort=("rate", "asc"),
    )
    mount_non_model_data_resource(app, data_resource)
    return data_resource


def test_list_paging_sort_and_total(client, auth, mounted):
    """The list honours the default sort, paging and x-total-count, and gives each row an eid."""
    response = client.get(f"/api/{RESOURCE}?_start=0&_end=2", headers=auth)
    assert response.status_code == 200
    assert response.headers["x-total-count"] == "3"
    rows = response.json()
    assert [row["rate"] for row in rows] == [7, 10]
    assert rows[0]["eid"] == "R2~A1" and rows[0]["id"] == "R2~A1" and rows[0]["_revision"]


def test_list_filters_and_search(client, auth, mounted):
    """Equality, range, contains and q filters match the model CRUD operators."""
    def keys(query):
        return sorted(row["eid"] for row in client.get(f"/api/{RESOURCE}?{query}", headers=auth).json())

    assert keys("region=R1") == ["R1~A1", "R1~B2"]
    assert keys("rate_gte=10") == ["R1~A1", "R1~B2"]
    assert keys("active=false") == ["R1~B2"]
    assert keys("code__in=B2,X") == ["R1~B2"]
    assert keys("q=r2") == ["R2~A1"]
    descending = client.get(f"/api/{RESOURCE}?_sort=rate&_order=desc", headers=auth).json()
    assert [row["rate"] for row in descending] == [25.5, 10, 7]


def test_get_one_and_not_found(client, auth, mounted):
    """A row is addressed by its composite eid; an unknown eid gives 404."""
    assert client.get(f"/api/{RESOURCE}/R1~B2", headers=auth).json()["rate"] == 25.5
    assert client.get(f"/api/{RESOURCE}/R1~ZZ", headers=auth).status_code == 404


def test_create_validates_and_writes_only_the_overlay(client, auth, mounted, rate_files):
    """Invalid values are rejected; a valid row goes to the overlay, never the packaged file."""
    packaged, overlay = rate_files
    packaged_before = packaged.read_text(encoding="utf-8")

    bad = client.post(f"/api/{RESOURCE}", json={"region": "R3", "code": "C3", "rate": "1x", "tier": "T3"},
                      headers=auth)
    assert bad.status_code == 422
    detail = bad.json()["detail"]
    assert mounted.get_field_by_key("rate").label in detail and mounted.get_field_by_key("tier").label in detail

    duplicate = client.post(f"/api/{RESOURCE}", json={"region": "R1", "code": "A1", "rate": 1}, headers=auth)
    assert duplicate.status_code == 422

    created = client.post(f"/api/{RESOURCE}", json={"region": "R3", "code": "C3", "rate": "12", "tier": "T1"},
                          headers=auth)
    assert created.status_code == 201
    assert created.json()["eid"] == "R3~C3" and created.json()["rate"] == 12.0
    assert packaged.read_text(encoding="utf-8") == packaged_before
    assert json.loads(overlay.read_text(encoding="utf-8"))["rates"][0]["code"] == "C3"


def test_update_detects_concurrent_edits(client, auth, mounted):
    """A write naming a revision the row no longer has is refused with 409."""
    row = client.get(f"/api/{RESOURCE}/R1~A1", headers=auth).json()
    first = client.patch(f"/api/{RESOURCE}/R1~A1", json={"rate": 11},
                         headers={**auth, "If-Match": row["_revision"]})
    assert first.status_code == 200 and first.json()["rate"] == 11
    stale = client.patch(f"/api/{RESOURCE}/R1~A1", json={"rate": 12, "_revision": row["_revision"]}, headers=auth)
    assert stale.status_code == 409
    # Key fields can't be changed by an update.
    client.patch(f"/api/{RESOURCE}/R1~A1", json={"region": "R4"}, headers=auth)
    assert client.get(f"/api/{RESOURCE}/R1~A1", headers=auth).status_code == 200


def test_delete_packaged_row_hides_it_with_overlay_marker(client, auth, mounted, rate_files):
    """Deleting a packaged row marks it deleted in the overlay; the packaged file is unchanged."""
    _packaged, overlay = rate_files
    assert client.delete(f"/api/{RESOURCE}/R2~A1", headers=auth).status_code == 204
    assert client.get(f"/api/{RESOURCE}/R2~A1", headers=auth).status_code == 404
    markers = [row for row in json.loads(overlay.read_text(encoding="utf-8"))["rates"] if row.get("_deleted")]
    assert markers == [{"region": "R2", "code": "A1", "_deleted": True}]


def test_export_csv_and_analyze(client, auth, mounted):
    """export-csv streams the matching rows; analyze aggregates them like model lists."""
    csv_text = client.get(f"/api/{RESOURCE}/export-csv?region=R1", headers=auth).text
    assert csv_text.splitlines()[0] == "region,code,rate,active,tier"
    assert len(csv_text.strip().splitlines()) == 3

    result = client.post(f"/api/{RESOURCE}/analyze", json={
        "fields": [{"key": "region", "type": "string"}, {"key": "rate", "type": "number"}],
        "category_keys": ["region"], "series_keys": ["rate"], "summary_function": "sum",
    }, headers=auth)
    assert result.status_code == 200


def test_catalog_lists_model_def(client, auth, mounted):
    """The catalog gives the UI a ModelDef with the composite key and capabilities."""
    models = {m["resource"]: m for m in client.get("/api/veloiq/non-model-data-resources", headers=auth).json()["models"]}
    model = models[RESOURCE]
    assert model["isNonModelData"] and model["pkField"] == "eid" and model["pkFields"] == ["region", "code"]
    assert model["capabilities"] == {"create": True, "update": True, "delete": True}
    assert any(f["key"] == "tier" and f["options"] for f in model["fields"])


# ---------------------------------------------------------------------------
# System Configuration
# ---------------------------------------------------------------------------


def test_system_config_is_one_typed_record(client, auth):
    """The settings are one record with one typed field per registered setting."""
    rows = client.get("/api/veloiq_system_config", headers=auth).json()
    assert len(rows) == 1 and rows[0]["eid"] == "1"
    record = client.get("/api/veloiq_system_config/1", headers=auth).json()
    assert isinstance(record["log_up_to_relevance"], int)
    assert isinstance(record["log_to_file"], bool)
    assert record["_label"] == "System Configuration"

    models = {m["resource"]: m for m in client.get("/api/veloiq/non-model-data-resources", headers=auth).json()["models"]}
    model = models["veloiq_system_config"]
    assert model["isSingleRecord"] and model["listViewType"] == "primary"
    assert model["capabilities"] == {"create": False, "update": True, "delete": False}
    fields = {f["key"]: f for f in model["fields"]}
    assert fields["log_up_to_relevance"]["type"] == "number"
    assert fields["log_to_file"]["type"] == "boolean"
    assert fields["plain_color_base_hex"]["editViewType"] == "editable-color"
    assert [o["value"] for o in fields["modules_color_schema"]["options"]] == ["color-coded", "plain-color"]


def test_system_config_page_configuration_places_related_settings_side_by_side(client, auth):
    """VeloIQ's page_configs.json lays out the settings like the former console: grouped
    sections, with related settings in the same row."""
    rows = client.get("/api/views/configurations/VeloiqSystemConfig?view_type=show", headers=auth).json()
    show_rows = {row["object_name"]: row for row in rows if row["form_type"] == "show"}
    verbosity, file_verbosity = show_rows["log_up_to_relevance"], show_rows["file_log_up_to_relevance"]
    assert verbosity["section"] == file_verbosity["section"] == "Log verbosity"
    assert (verbosity["row"], verbosity["column"]) == (1, 1) and (file_verbosity["row"], file_verbosity["column"]) == (1, 2)
    assert show_rows["gallery_image_width"]["section_grid_col"] == 2
    assert not any(row["section"] == "Other settings" for row in show_rows.values())
    # The section look comes from the page configuration too.
    assert verbosity["section_css_class"] == "jm-settings-section"
    assert verbosity["section_icon"] and verbosity["section_accent_color"] and verbosity["section_description"]


@pytest.fixture
def no_system_config_writes(monkeypatch):
    """Fail the test instead of writing the sample app's jm_config.ini or veloiq.toml."""
    from veloiq_framework.system_config import system_config_non_model_data_resource

    def refuse(updates):
        raise AssertionError(f"System Configuration write attempted: {updates}")
    monkeypatch.setattr(system_config_non_model_data_resource, "save_system_config_updates", refuse)


def test_system_config_rejects_invalid_values_and_new_records(client, auth, no_system_config_writes):
    """Invalid values are rejected with a message, and the record can't be added or deleted."""
    models = {m["resource"]: m for m in client.get("/api/veloiq/non-model-data-resources", headers=auth).json()["models"]}
    schema_options = next(f["options"] for f in models["veloiq_system_config"]["fields"] if f["key"] == "modules_color_schema")
    # A value no option can equal: every allowed value joined together.
    not_an_option = "".join(str(option["value"]) for option in schema_options)
    for invalid in ({"log_up_to_relevance": "1x"}, {"log_up_to_relevance": 2.5},
                    {"modules_color_schema": not_an_option}, {"log_to_file": "2"}):
        response = client.patch("/api/veloiq_system_config/1", json=invalid, headers=auth)
        assert response.status_code == 422, invalid
    assert client.post("/api/veloiq_system_config", json={"id": 2}, headers=auth).status_code == 405
    assert client.delete("/api/veloiq_system_config/1", headers=auth).status_code == 405


def test_system_config_saves_only_changed_settings(client, auth, monkeypatch):
    """A save writes only the settings whose value changed."""
    from veloiq_framework.system_config import system_config_non_model_data_resource

    written: list[dict] = []
    monkeypatch.setattr(system_config_non_model_data_resource, "save_system_config_updates", written.append)
    record = client.get("/api/veloiq_system_config/1", headers=auth).json()
    new_level = 3 if record["log_up_to_relevance"] != 3 else 4
    payload = {key: value for key, value in record.items() if not key.startswith("_") and key not in ("eid",)}
    payload["log_up_to_relevance"] = new_level
    response = client.patch("/api/veloiq_system_config/1", json=payload, headers=auth)
    assert response.status_code == 200, response.text
    assert written == [{"log_up_to_relevance": str(new_level)}]


# ---------------------------------------------------------------------------
# Multi-value fields
# ---------------------------------------------------------------------------

MULTI_RESOURCE = "test_multi_value_rows"


@pytest.fixture(scope="module")
def multi_mounted(app, tmp_path_factory):
    """Mount a resource with a multi-value field backed by a JSON file."""
    path = tmp_path_factory.mktemp("multi") / "rows.json"
    path.write_text(json.dumps([{"code": "A", "tags": ["x", "y"]}, {"code": "B", "tags": []}]), encoding="utf-8")
    data_resource = NonModelDataResource(
        name=MULTI_RESOURCE, label=MULTI_RESOURCE, pk_fields=["code"],
        fields=[NonModelDataField(key="code"),
                NonModelDataField(key="tags", multiple=True, options=["x", "y", "z"])],
        data_source=JsonFileDataSource(path),
    )
    mount_non_model_data_resource(app, data_resource)
    return data_resource


def test_multi_value_field_validates_filters_and_exports(client, auth, multi_mounted):
    """Lists (or comma-separated text) are validated item by item, filters match any value,
    and CSV joins the values."""
    assert client.patch(f"/api/{MULTI_RESOURCE}/B", json={"tags": "z, x"}, headers=auth).json()["tags"] == ["z", "x"]
    assert client.patch(f"/api/{MULTI_RESOURCE}/B", json={"tags": ["w"]}, headers=auth).status_code == 422
    assert [row["code"] for row in client.get(f"/api/{MULTI_RESOURCE}?tags=y", headers=auth).json()] == ["A"]
    assert sorted(row["code"] for row in client.get(f"/api/{MULTI_RESOURCE}?tags=x", headers=auth).json()) == ["A", "B"]
    csv_text = client.get(f"/api/{MULTI_RESOURCE}/export-csv", headers=auth).text
    assert '"x, y"' in csv_text
    model = next(m for m in client.get("/api/veloiq/non-model-data-resources", headers=auth).json()["models"]
                 if m["resource"] == MULTI_RESOURCE)
    assert next(f for f in model["fields"] if f["key"] == "tags")["multiple"] is True


def test_rows_are_titled_by_their_title_fields(client, auth, multi_mounted):
    """A row's _label (page headings, reference links) comes from the resource's title fields."""
    multi_mounted.title_fields = ["code"]
    try:
        assert client.get(f"/api/{MULTI_RESOURCE}/A", headers=auth).json()["_label"] == "A"
    finally:
        multi_mounted.title_fields = []


def test_model_def_carries_value_colors_and_hidden_analyze_section(tmp_path):
    """`value_colors` reach the field as `valueColors`; `show_analyze_section=False` reaches the model."""
    resource = NonModelDataResource(
        name="test_colored_statuses",
        label="Statuses",
        pk_fields=["code"],
        fields=[NonModelDataField(key="code"),
                NonModelDataField(key="status", options=["Active", "Inactive"], value_colors={"Active": "green"})],
        data_source=JsonFileDataSource(str(tmp_path / "statuses.json")),
        show_analyze_section=False,
    )
    model = resource.to_model_def()
    assert model["showAnalyzeSection"] is False
    assert next(f for f in model["fields"] if f["key"] == "status")["valueColors"] == {"Active": "green"}
    assert "showAnalyzeSection" not in NonModelDataResource(
        name="test_plain", label="Plain", pk_fields=["code"], fields=[NonModelDataField(key="code")],
        data_source=JsonFileDataSource(str(tmp_path / "plain.json"))).to_model_def()
