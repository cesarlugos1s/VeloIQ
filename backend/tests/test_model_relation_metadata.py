"""The endpoint that says which model each reference field of a record points to."""


def test_the_administrator_reads_the_reference_fields_and_the_models_they_point_to(client, auth):
    answer = client.get("/api/model-relations", headers=auth)
    assert answer.status_code == 200
    by_model = {entry["model"]: entry for entry in answer.json()}
    assert by_model, "the sample application has models with reference fields"
    for entry in by_model.values():
        assert entry["resource"] and entry["references"]
        for reference in entry["references"]:
            assert reference["field"] and reference["related_model"] and reference["related_resource"]
    # the registry's own models are in the answer too, so a reference by link table (an operation's connection) is listed
    assert any(reference["related_model"] == "Connection" for entry in by_model.values() for reference in entry["references"])


def test_only_an_administrator_may_read_it(client, manager_auth, viewer_auth):
    assert client.get("/api/model-relations", headers=manager_auth).status_code == 403
    assert client.get("/api/model-relations", headers=viewer_auth).status_code == 403
    assert client.get("/api/model-relations").status_code in (401, 403)
