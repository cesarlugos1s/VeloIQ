"""Generic CSV import/export: create_crud_router()'s import-csv/export-csv routes.

Uses the Project model (task-manager sample) — a TimestampedModel subclass,
so these tests also cover that server-managed columns (created_at/updated_at)
are excluded from the Basic import's expected-headers set generically (by
server_default/onupdate introspection), not by guessing specific field names.
"""
import io


def test_export_csv_header_matches_model_fields(client, auth):
    r = client.get("/api/project/export-csv", headers=auth)
    assert r.status_code == 200
    header = r.text.splitlines()[0].split(",")
    assert set(header) == set(["id", "name", "description", "status", "owner_id", "created_at", "updated_at"])


def test_import_csv_rejects_server_managed_columns_as_required(client, auth):
    """created_at/updated_at must NOT be required headers for the Basic import path."""
    csv_body = "name,description,status,owner_id\nImported Project,A goal,active,\n"
    files = {"file": ("projects.csv", io.BytesIO(csv_body.encode()), "text/csv")}
    r = client.post("/api/project/import-csv", files=files, headers=auth)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["inserted"] == 1
    assert data["errors"] == []


def test_import_csv_dry_run_does_not_commit(client, auth):
    before = client.get("/api/project", headers=auth).json()
    csv_body = "name,description,status,owner_id\nDryRunOnly,x,active,\n"
    files = {"file": ("projects.csv", io.BytesIO(csv_body.encode()), "text/csv")}
    r = client.post("/api/project/import-csv?dry_run=true", files=files, headers=auth)
    assert r.status_code == 200
    assert r.json()["inserted"] == 1
    after = client.get("/api/project", headers=auth).json()
    assert len(after) == len(before)
    assert not any(p["name"] == "DryRunOnly" for p in after)


def test_import_csv_rejects_mismatched_headers(client, auth):
    csv_body = "name,not_a_real_field\nX,1\n"
    files = {"file": ("bad.csv", io.BytesIO(csv_body.encode()), "text/csv")}
    r = client.post("/api/project/import-csv", files=files, headers=auth)
    assert r.status_code == 422


def test_export_then_reimport_round_trips(client, auth):
    """The literal file export-csv produces (PK included) must be re-importable as-is.

    Re-importing rows whose PK already exists correctly fails per-row (this is
    an insert-only path, no upsert) rather than being rejected outright by the
    header check — that's the bug this test guards against: the PK column is
    part of every exported file, so the import's header validation must treat
    it as optional, not forbidden.
    """
    r = client.post("/api/project", json={"name": "RoundTripMe", "status": "active"}, headers=auth)
    assert r.status_code == 201

    export_resp = client.get("/api/project/export-csv?name=RoundTripMe", headers=auth)
    assert export_resp.status_code == 200
    lines = export_resp.text.strip().splitlines()
    assert len(lines) == 2  # header + the one matching row

    header = lines[0].split(",")
    assert set(header) == {"id", "name", "description", "status", "owner_id", "created_at", "updated_at"}

    # Re-import the exact exported file, unmodified, as a dry run: the header
    # (including "id") must be accepted — no 422 — and the colliding PK must
    # surface as a per-row error (a real DB constraint check via flush(),
    # not just Pydantic validation), not abort the whole request, and
    # nothing should actually be persisted since this is a dry run.
    before_reimport = client.get("/api/project", headers=auth).json()
    exported_csv = export_resp.text
    files = {"file": ("export.csv", io.BytesIO(exported_csv.encode()), "text/csv")}
    reimport_resp = client.post("/api/project/import-csv?dry_run=true", files=files, headers=auth)
    assert reimport_resp.status_code == 200, reimport_resp.text
    reimport_data = reimport_resp.json()
    assert reimport_data["total_rows"] == 1
    assert len(reimport_data["errors"]) == 1, "existing PK should fail as a per-row duplicate-key error"
    assert reimport_data["inserted"] == 0
    after_reimport = client.get("/api/project", headers=auth).json()
    assert len(after_reimport) == len(before_reimport), "dry_run must not persist anything even after flush()"

    # The reported message must be the concise DB error, not SQLAlchemy's
    # default str() (which appends the full parameterized SQL statement and
    # every bound value — unreadable at scale for a bulk-error preview).
    error_message = reimport_data["errors"][0]["message"]
    assert len(error_message) < 300
    assert "INSERT INTO" not in error_message
    assert "[parameters:" not in error_message

    # Same file with the PK column blanked out (a "reload as new rows" file)
    # must insert successfully as brand-new rows.
    blanked_csv = "\n".join(
        [header_line if i == 0 else _blank_id_column(header_line, header)
         for i, header_line in enumerate(lines)]
    )
    files2 = {"file": ("blanked.csv", io.BytesIO(blanked_csv.encode()), "text/csv")}
    fresh_resp = client.post("/api/project/import-csv", files=files2, headers=auth)
    assert fresh_resp.status_code == 200, fresh_resp.text
    fresh_data = fresh_resp.json()
    assert fresh_data["inserted"] == 1
    assert fresh_data["errors"] == []


def _blank_id_column(line: str, header: list) -> str:
    values = line.split(",")
    values[header.index("id")] = ""
    return ",".join(values)


def test_import_csv_one_bad_row_does_not_sink_valid_rows(client, auth):
    """A duplicate-PK row must not roll back the other valid rows in the same file."""
    r = client.post("/api/project", json={"name": "AlreadyExists", "status": "active"}, headers=auth)
    assert r.status_code == 201
    existing_id = r.json()["id"]

    before = client.get("/api/project", headers=auth).json()
    csv_body = (
        "id,name,description,status,owner_id\n"
        f"{existing_id},CollidesWithExisting,x,active,\n"
        ",BrandNewRow,y,active,\n"
    )
    files = {"file": ("mixed.csv", io.BytesIO(csv_body.encode()), "text/csv")}
    resp = client.post("/api/project/import-csv", files=files, headers=auth)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["total_rows"] == 2
    assert data["inserted"] == 1
    assert len(data["errors"]) == 1
    assert data["errors"][0]["row"] == 1

    after = client.get("/api/project", headers=auth).json()
    assert len(after) == len(before) + 1
    assert any(p["name"] == "BrandNewRow" for p in after)


def test_import_csv_override_registry_is_checked_first(client, auth):
    """A registered override loader takes precedence over the generic path."""
    from veloiq_framework.import_registry import register_import_loader, get_import_loader
    from app.modules.projects.models import Project

    calls = []

    def _custom_loader(row, session):
        calls.append(row)
        return (1, 0)

    register_import_loader(Project, _custom_loader)
    try:
        csv_body = "name,description,status,owner_id\nOverrideTest,x,active,\n"
        files = {"file": ("projects.csv", io.BytesIO(csv_body.encode()), "text/csv")}
        r = client.post("/api/project/import-csv", files=files, headers=auth)
        assert r.status_code == 200
        assert r.json()["inserted"] == 1
        assert len(calls) == 1
        assert calls[0]["name"] == "OverrideTest"
    finally:
        # Restore the generic path for any other test relying on it.
        from veloiq_framework import import_registry
        import_registry._REGISTRY.pop(getattr(Project, "__tablename__", None), None)
        assert get_import_loader(Project) is None
