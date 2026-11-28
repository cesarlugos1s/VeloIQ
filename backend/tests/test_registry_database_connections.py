"""Database connections of the shared registry: settings, the connection test, and read queries with their limits (on a SQLite file)."""
import sqlite3
import uuid

import pytest
from sqlmodel import Session

from veloiq_framework.db import get_engine
from veloiq_framework.shared_connection_registry.connection_registry_models import Connection
from veloiq_framework.shared_connection_registry.connection_registry_store import RegistryRuleError
from veloiq_framework.shared_connection_registry.database_connection_access import ensure_single_read_statement, run_read_query


@pytest.fixture()
def database_file(tmp_path):
    path = tmp_path / "inventory.sqlite"
    with sqlite3.connect(path) as database:
        database.execute("create table item (id integer primary key, name text, changed_at text)")
        database.executemany("insert into item values (?, ?, ?)", [(n, f"item {n}", f"2026-01-0{n}") for n in range(1, 6)])
    return str(path)


def _create(client, auth, database_file, **settings):
    return client.post("/api/registry/connections", headers=auth, json={
        "name": f"db-{uuid.uuid4().hex[:8]}", "endpoint_type": "database",
        "database_settings": {"database_type": "sqlite", "database_name": database_file, **settings}})


def _connection(connection_id):
    session = Session(get_engine())
    return session, session.get(Connection, connection_id)


def test_a_database_connection_keeps_its_settings_with_the_defaults_of_the_definition(client, auth, database_file):
    created = _create(client, auth, database_file)
    assert created.status_code == 201
    settings = created.json()["database_settings"]
    assert settings["is_read_only"] is True and settings["query_timeout_seconds"] == 60 and settings["max_rows_per_run"] == 100000
    assert client.get("/api/registry/choices", headers=auth).json()["database_types"][:2] == ["postgres", "mysql"]


@pytest.mark.parametrize("settings,fragment", [
    ({"database_type": "paradox"}, "must be one of"),
    ({"database_type": "postgres"}, "needs the database server"),
    ({"database_type": "postgres", "host": "db.example.com", "port": 70000}, "between 1 and 65535"),
    ({"query_timeout_seconds": 0}, "between 1 and 600"),
    ({"color": "red"}, "Unknown database setting"),
])
def test_database_settings_the_definition_does_not_allow_are_refused_with_a_message(client, auth, database_file, settings, fragment):
    refused = _create(client, auth, database_file, **settings)
    assert refused.status_code == 422 and fragment in refused.json()["detail"]


def test_a_database_connection_is_tested_with_a_trivial_read_and_a_missing_database_is_reported(client, auth, database_file, tmp_path):
    good = _create(client, auth, database_file).json()
    tested = client.post(f"/api/registry/connections/{good['id']}/test", headers=auth).json()
    assert tested["status"] == "success" and tested["duration_ms"] is not None and "read only" in tested["note"]
    missing = _create(client, auth, str(tmp_path / "no-such-folder" / "x.sqlite")).json()
    failed = client.post(f"/api/registry/connections/{missing['id']}/test", headers=auth).json()
    assert failed["status"] == "error" and failed["error_type"] == "unreachable" and "cannot be reached" in failed["error_message"]


def test_a_read_query_returns_rows_as_dictionaries_with_bound_values(client, auth, database_file):
    session, connection = _connection(_create(client, auth, database_file).json()["id"])
    with session:
        rows = run_read_query(connection, "select id, name from item where changed_at > :since order by id", {"since": "2026-01-03"})
        assert rows == [{"id": 4, "name": "item 4"}, {"id": 5, "name": "item 5"}]


def test_a_read_that_returns_more_rows_than_the_limit_fails_instead_of_returning_part_of_them(client, auth, database_file):
    session, connection = _connection(_create(client, auth, database_file, max_rows_per_run=3).json()["id"])
    with session, pytest.raises(RegistryRuleError, match="more than 3 rows"):
        run_read_query(connection, "select * from item")


@pytest.mark.parametrize("statement,fragment", [
    ("", "empty"),
    ("delete from item", "must be a SELECT"),
    ("select 1; drop table item", "one statement"),
    ("with gone as (delete from item returning id) select * from gone", "contains DELETE"),
    ("select * into copy from item", "contains INTO"),
    ("select 'it''s; fine' as text -- delete; drop", None),
    ('select "update" from item /* insert; */', None),
    ("select 1;", None),
    ("select 'open", "quote that is never closed"),
])
def test_only_one_read_statement_is_accepted_and_strings_and_comments_are_skipped(statement, fragment):
    if fragment is None:
        ensure_single_read_statement(statement)
    else:
        with pytest.raises(RegistryRuleError, match=fragment):
            ensure_single_read_statement(statement)


def test_a_read_only_connection_refuses_a_change_even_when_the_statement_check_is_bypassed(client, auth, database_file):
    session, connection = _connection(_create(client, auth, database_file).json()["id"])
    from veloiq_framework.shared_connection_registry import database_connection_access as access
    with session, pytest.raises(RegistryRuleError, match="refused the query"):
        original = access.ensure_single_read_statement
        access.ensure_single_read_statement = lambda statement: None        # the database itself must still refuse
        try:
            run_read_query(connection, "update item set name = 'x'")
        finally:
            access.ensure_single_read_statement = original


def test_with_a_cursor_column_the_rows_come_ordered_and_only_those_after_the_last_value_are_read(client, auth, database_file):
    session, connection = _connection(_create(client, auth, database_file, cursor_column="id").json()["id"])
    with session:
        assert [row["id"] for row in run_read_query(connection, "select id, name from item order by name desc")] == [1, 2, 3, 4, 5]
        assert [row["id"] for row in run_read_query(connection, "select id, name from item;", after_cursor_value=3)] == [4, 5]
        assert run_read_query(connection, "select id from item", after_cursor_value=5) == []


def test_reading_after_a_value_needs_the_cursor_column(client, auth, database_file):
    session, connection = _connection(_create(client, auth, database_file).json()["id"])
    with session, pytest.raises(RegistryRuleError, match="needs the cursor column"):
        run_read_query(connection, "select id from item", after_cursor_value=3)
