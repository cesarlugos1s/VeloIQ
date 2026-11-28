"""Open the database of a database connection, test it and run read queries with the limits of the connection.

The password is the connection's ``password`` secret. A read query is one SELECT (or WITH ... SELECT) statement: it is checked by
reading the statement token by token (strings, quoted names and comments are skipped), and when the connection is read only the
database session is also set read only where the database supports it. The query timeout and the most rows are enforced.
"""
from __future__ import annotations

import re
import time
from typing import Any, Optional

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import URL, Engine
from sqlalchemy.pool import NullPool
from sqlalchemy.exc import NoSuchModuleError, SQLAlchemyError

from veloiq_framework.utils.i18n_utils import _

from .connection_registry_models import Connection
from .connection_registry_store import DATABASE_ENDPOINT_TYPE, RegistryRuleError
from .connection_secret_encryption import decrypt_secret
from .registry_choice_values import DATABASE_TYPE_DIALECTS, DATABASE_TYPES_WITHOUT_HOST, DATABASE_USUAL_PORTS

# SQL keywords that start or contain a statement that changes data or the database. They are grammar, not natural language.
STATEMENT_KEYWORDS_THAT_CHANGE_DATA = frozenset({
    "insert", "update", "delete", "merge", "drop", "alter", "create", "truncate", "grant", "revoke", "into", "call", "exec", "execute", "replace",
})
STATEMENT_KEYWORDS_THAT_READ = ("select", "with")


def _database_settings(connection: Connection):
    if connection.endpoint_type != DATABASE_ENDPOINT_TYPE or not connection.connection_has_database_connection_settings:
        raise RegistryRuleError(_("Only a database connection can be used this way."))
    return connection.connection_has_database_connection_settings[0]


def build_database_url(connection: Connection) -> URL:
    """The SQLAlchemy address of the database of a connection, with its password secret (if it has one)."""
    settings = _database_settings(connection)
    stored = next((secret for secret in connection.connection_has_connection_secret if secret.key == "password"), None)
    password = decrypt_secret(stored.value) if stored is not None else None
    dialect = DATABASE_TYPE_DIALECTS[settings.database_type]
    if settings.database_type in DATABASE_TYPES_WITHOUT_HOST:
        return URL.create(dialect, database=settings.database_name)
    return URL.create(dialect, username=settings.username or None, password=password, host=settings.host,
                      port=settings.port or DATABASE_USUAL_PORTS.get(settings.database_type), database=settings.database_name)


def open_database_engine(connection: Connection, with_session_limits: bool = False) -> Engine:
    """An engine for the database of a connection (one connection at a time, closed when the caller disposes it).

    :param with_session_limits: True to set the query timeout and the read-only mode on every session the engine opens (for a reader that opens
        its own sessions, such as dlt's), where the database type has a statement for it.
    :raises RegistryRuleError: When the driver of the database type is not installed.
    """
    settings = _database_settings(connection)
    try:
        engine = create_engine(build_database_url(connection), poolclass=NullPool)
        if with_session_limits:
            @event.listens_for(engine, "connect")
            def set_session_limits(dbapi_connection, _connection_record):
                cursor = dbapi_connection.cursor()
                try:
                    _limit_the_session(cursor.execute, settings.database_type, settings.query_timeout_seconds, settings.is_read_only)
                finally:
                    cursor.close()
        return engine
    except (NoSuchModuleError, ModuleNotFoundError, ImportError) as missing_driver:
        raise RegistryRuleError(_("The driver for the database type {database_type} is not installed ({problem}).").format(
            database_type=settings.database_type, problem=missing_driver)) from missing_driver


def _significant_tokens(statement: str) -> list[str]:
    """The words and the semicolons of a statement, leaving out strings, quoted names and comments."""
    tokens: list[str] = []
    position, length = 0, len(statement)
    while position < length:
        character = statement[position]
        if statement.startswith("--", position):
            end = statement.find("\n", position)
            position = length if end == -1 else end + 1
        elif statement.startswith("/*", position):
            end = statement.find("*/", position + 2)
            if end == -1:
                raise RegistryRuleError(_("The statement has a comment that is never closed."))
            position = end + 2
        elif character in "'\"`":
            closing = character
            position += 1
            while True:
                if position >= length:
                    raise RegistryRuleError(_("The statement has a quote that is never closed."))
                if statement[position] == closing:
                    if statement.startswith(closing * 2, position):
                        position += 2
                        continue
                    position += 1
                    break
                position += 1
        elif character == ";":
            tokens.append(";")
            position += 1
        else:
            word = re.match(r"\w+", statement[position:])
            if word:
                tokens.append(word.group(0).lower())
                position += len(word.group(0))
            else:
                position += 1
    return tokens


# spec: read-from-databases-with-read-only-limits :: Only reads are allowed
def ensure_single_read_statement(statement: str) -> None:
    """Accept one SELECT (or WITH ... SELECT) statement and refuse anything else.

    :raises RegistryRuleError: When the statement is empty, has several statements, does not start as a read, or changes data.
    """
    tokens = _significant_tokens(statement or "")
    while tokens and tokens[-1] == ";":
        tokens.pop()
    if not tokens:
        raise RegistryRuleError(_("The query is empty."))
    if ";" in tokens:
        raise RegistryRuleError(_("The query must be one statement."))
    if tokens[0] not in STATEMENT_KEYWORDS_THAT_READ:
        raise RegistryRuleError(_("The query must be a SELECT statement."))
    changing = next((token for token in tokens if token in STATEMENT_KEYWORDS_THAT_CHANGE_DATA), None)
    if changing is not None:
        raise RegistryRuleError(_("The query must only read: it contains {keyword}.").format(keyword=changing.upper()))


def _limit_the_session(dbapi_connection_executor, database_type: str, timeout_seconds: int, is_read_only: bool) -> None:
    """Set the timeout and the read-only mode of the session where the database type has a statement for it."""
    run = dbapi_connection_executor
    if database_type == "postgres":
        run(f"SET statement_timeout = {int(timeout_seconds) * 1000}")
        if is_read_only:
            run("SET default_transaction_read_only = on")
    elif database_type in ("mysql", "mariadb"):
        run(f"SET SESSION max_execution_time = {int(timeout_seconds) * 1000}" if database_type == "mysql" else f"SET SESSION max_statement_time = {int(timeout_seconds)}")
        if is_read_only:
            run("SET SESSION TRANSACTION READ ONLY")
    elif database_type == "sqlite" and is_read_only:
        run("PRAGMA query_only = ON")


# spec: read-from-databases-with-read-only-limits :: A read step runs a query
# spec: read-from-databases-with-read-only-limits :: Reading what is new
def run_read_query(connection: Connection, statement: str, parameters: Optional[dict[str, Any]] = None,
                   maximum_rows: Optional[int] = None, after_cursor_value: Any = None) -> list[dict[str, Any]]:
    """Run one read statement on the connection's database and return its rows as dictionaries.

    When the connection has a ``cursor_column`` the rows come ordered by it, and with ``after_cursor_value`` only the rows whose cursor
    column is greater than that value come back (the statement is wrapped as a subquery, so it is checked first as it is given).

    :param maximum_rows: Most rows to return; the connection's ``max_rows_per_run`` when not given.
    :param after_cursor_value: The last cursor value already read; needs the connection's ``cursor_column``.
    :raises RegistryRuleError: When the statement is not one read, the driver is missing, the database cannot be reached, or more rows
        than the limit would come back (the read fails instead of returning part of the rows).
    """
    settings = _database_settings(connection)
    ensure_single_read_statement(statement)
    limit = maximum_rows if maximum_rows is not None else settings.max_rows_per_run
    engine = open_database_engine(connection)
    if settings.cursor_column:
        column = engine.dialect.identifier_preparer.quote(settings.cursor_column)
        wrapped = f"SELECT * FROM ({statement.strip().rstrip(';')}) incremental_source"
        if after_cursor_value is not None:
            wrapped += f" WHERE {column} > :incremental_after_value"
            parameters = {**(parameters or {}), "incremental_after_value": after_cursor_value}
        statement_to_run = f"{wrapped} ORDER BY {column}"
    else:
        if after_cursor_value is not None:
            engine.dispose()
            raise RegistryRuleError(_("Reading only what changed needs the cursor column of the connection."))
        statement_to_run = statement
    try:
        with engine.connect() as database_session:
            _limit_the_session(lambda sql: database_session.exec_driver_sql(sql), settings.database_type,
                               settings.query_timeout_seconds, settings.is_read_only)
            cursor = database_session.execute(text(statement_to_run), parameters or {})
            names = list(cursor.keys())
            fetched = cursor.fetchmany(limit + 1)
            if len(fetched) > limit:
                raise RegistryRuleError(_("The query returned more than {rows} rows, the most the connection allows in one run.").format(rows=limit))
            return [dict(zip(names, row)) for row in fetched]
    except RegistryRuleError:
        raise
    except SQLAlchemyError as failure:
        raise RegistryRuleError(_("The database refused the query: {problem}").format(problem=str(getattr(failure, "orig", failure)).splitlines()[0])) from failure
    finally:
        engine.dispose()


# spec: manage-connections-with-secrets-and-a-connection-test :: Test a database connection
def test_database_connection(connection: Connection) -> dict[str, Any]:
    """Connect, run a trivial read and describe the result in the shape the connection test window shows."""
    settings = _database_settings(connection)
    address = f"{settings.host or ''}{':' + str(settings.port or DATABASE_USUAL_PORTS.get(settings.database_type)) if settings.database_type not in DATABASE_TYPES_WITHOUT_HOST else ''}/{settings.database_name}"
    result: dict[str, Any] = {"status": "error", "endpoint_type": connection.endpoint_type, "url": address, "http_status": None,
                              "duration_ms": None, "server": None, "error_type": None, "error_message": None, "note": None}
    started = time.monotonic()
    engine = open_database_engine(connection)
    try:
        with engine.connect() as database_session:
            database_session.execute(text("SELECT 1")).fetchall()
            version = engine.dialect.server_version_info
            result.update(status="success", server=f"{settings.database_type} {'.'.join(str(part) for part in version)}" if version else settings.database_type)
            if settings.is_read_only:
                result["note"] = _("The connection is read only: only SELECT statements are accepted.")
    except SQLAlchemyError as failure:
        result.update(error_type="unreachable", error_message=_("The database cannot be reached: {problem}").format(
            problem=str(getattr(failure, "orig", failure)).splitlines()[0]))
    finally:
        engine.dispose()
        result["duration_ms"] = int((time.monotonic() - started) * 1000)
    return result
