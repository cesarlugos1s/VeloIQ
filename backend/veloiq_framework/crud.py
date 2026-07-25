"""Automatic CRUD router generation for VeloIQ modules.

The most common module pattern — a database table with standard list/get/
create/update/delete endpoints — can be expressed in two lines::

    from veloiq_framework.crud import create_crud_router
    from .models import Task

    router = create_crud_router(Task)

``create_crud_router`` returns a FastAPI ``APIRouter`` pre-configured with:

* ``GET  /``           — paginated list  (query params: ``_start``, ``_end``)
* ``GET  /{id}``       — single record
* ``POST /``           — create
* ``PUT  /{id}``       — full update
* ``DELETE /{id}``     — delete

Response headers follow the react-admin / Refine convention:
``x-total-count`` and ``content-range`` are set on list responses.

Extend or override any route after calling ``create_crud_router``::

    router = create_crud_router(Task)

    @router.post("/{id}/complete")
    def complete_task(id: int, session: Session = Depends(get_session)):
        ...
"""
import base64
import csv
import io
import math
from typing import Any, Type, TypeVar

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, StreamingResponse
from sqlmodel import Session, SQLModel, func, select

from veloiq_framework.db import get_engine, get_session
from veloiq_framework.models import get_pk_field_name, build_model_str_label

T = TypeVar("T", bound=SQLModel)


# ---------------------------------------------------------------------------
# Permission helpers
# ---------------------------------------------------------------------------

def _get_user_roles(request: Request) -> list[str]:
    """Safely extract user roles from request state (set by auth middleware)."""
    user = getattr(request.state, "user", None)
    if user is None:
        return []
    return user.get("roles", [])


def _check_model_permissions(request: Request, model_class: type, method: str) -> None:
    """Raise 403 if no role in the user's token permits *method* on *model_class*.

    Only applies when the model has ``__veloiq_permissions__`` set via
    ``@model_access()``.  Roles not listed there are unrestricted on this model.
    Access is granted when ANY role either (a) is unlisted (no exception) or
    (b) is listed and its allowed actions include the requested action.
    """
    model_perms: dict | None = getattr(model_class, "__veloiq_permissions__", None)
    if not model_perms:
        return

    user_roles = _get_user_roles(request)
    if not user_roles:
        return  # Auth middleware handles unauthenticated requests.

    from veloiq_framework.auth.permissions import HTTP_TO_REFINE
    actions = HTTP_TO_REFINE.get(method.upper(), set())

    for role in user_roles:
        if role not in model_perms:
            return  # This role has no model-level exception — Layer 1 applies.
        if actions & set(model_perms[role]):
            return  # This role's exception explicitly permits the action.

    raise HTTPException(status_code=403, detail="Access denied for this resource")


def _get_field_permissions(model_class: type) -> dict[str, dict]:
    """Return field-level permission metadata for *model_class*.

    Reads from two sources (merged, with class-level taking precedence):
    - ``veloiq_field(read_roles=…, write_roles=…)`` — stored in Pydantic FieldInfo.json_schema_extra
    - ``__veloiq_field_permissions__`` class variable — for fields that use sa_column and
      cannot use pydantic.Field with json_schema_extra (e.g. framework auth models)
    """
    perms: dict[str, dict] = {}
    model_fields = getattr(model_class, "model_fields", {})
    for field_name, field_info in model_fields.items():
        extra = getattr(field_info, "json_schema_extra", None)
        if not isinstance(extra, dict):
            continue
        entry: dict = {}
        if "veloiq_read_roles" in extra:
            entry["read_roles"] = extra["veloiq_read_roles"]
        if "veloiq_write_roles" in extra:
            entry["write_roles"] = extra["veloiq_write_roles"]
        if entry:
            perms[field_name] = entry

    # Merge class-level declarations (used by framework models with sa_column fields).
    class_perms: dict = getattr(model_class, "__veloiq_field_permissions__", {})
    for field_name, entry in class_perms.items():
        perms[field_name] = {**perms.get(field_name, {}), **entry}

    return perms


def _filter_read_fields(data: dict, model_class: type, user_roles: list[str]) -> dict:
    """Remove fields that *user_roles* cannot read per ``veloiq_field(read_roles=…)``."""
    field_perms = _get_field_permissions(model_class)
    if not field_perms:
        return data
    result = {}
    for key, value in data.items():
        fp = field_perms.get(key)
        if fp is None or "read_roles" not in fp:
            result[key] = value
        elif any(r in fp["read_roles"] for r in user_roles):
            result[key] = value
        # else: field is silently omitted for this user.
    return result


def _filter_write_payload(payload: dict, model_class: type, user_roles: list[str]) -> dict:
    """Drop write-restricted fields from *payload* (silently, to avoid UX breakage)."""
    field_perms = _get_field_permissions(model_class)
    if not field_perms:
        return payload
    result = {}
    for key, value in payload.items():
        fp = field_perms.get(key)
        if fp is None or "write_roles" not in fp:
            result[key] = value
        elif any(r in fp["write_roles"] for r in user_roles):
            result[key] = value
        # else: field is silently dropped.
    return result


def _build_rebac_clause(model_class: type, user: dict | None, session):
    """Return a SQLAlchemy WHERE clause for the model's ReBAC filter, or None.

    Returns None when the model has no ``@rebac`` decorator.
    Returns a ``false()`` clause when the filter explicitly denies all rows,
    or when user is absent on a rebac-protected model (deny-by-default).
    """
    filter_fn = getattr(model_class, "__rebac_filter__", None)
    if filter_fn is None:
        return None
    if not user:
        from sqlalchemy import false
        return false()
    clause = filter_fn(user, model_class, session)
    if clause is None or clause is True:
        return None
    if clause is False:
        from sqlalchemy import false
        return false()
    return clause


def _coerce_filter_value(value: str, col_type: Any) -> Any:
    """Cast a query-string value to the Python type expected by the column."""
    from sqlalchemy import types
    if isinstance(col_type, (types.Integer, types.BigInteger, types.SmallInteger)):
        try:
            return int(value)
        except (ValueError, TypeError):
            return value
    if isinstance(col_type, types.Boolean):
        return value.lower() in ("true", "1", "yes")
    if isinstance(col_type, (types.Float, types.Numeric)):
        try:
            return float(value)
        except (ValueError, TypeError):
            return value
    return value


def _build_where_clauses(model_class: type, query_params) -> list:
    """Return SQLAlchemy WHERE clauses for any query params that match column names.

    Supports:
    - ``?field=value``        → exact equality (``WHERE field = value``)
    - ``?field__in=1,2,3``    → IN clause (``WHERE field IN (1, 2, 3)``)
    - ``?field__ilike=value`` → case-insensitive contains (``WHERE field ILIKE '%value%'``)
    - ``?field_like=value``   → case-insensitive contains (short form, same as __ilike)
    - ``?field_ne=value``     → not equal
    - ``?field_gte=value``    → greater than or equal
    - ``?field_lte=value``    → less than or equal
    - ``?q=value``            → search all string/Text fields (ILIKE ANY)
    """
    from sqlalchemy.inspection import inspect as sa_inspect
    try:
        mapper = sa_inspect(model_class)
    except Exception:
        return []
    # Build attr-key → (model_attr, col_type) mapping; also index by physical column name.
    filter_map: dict = {}
    for col_attr in mapper.column_attrs:
        col = col_attr.columns[0]
        entry = (col_attr.key, col.type)
        filter_map[col_attr.key] = entry
        if col.name != col_attr.key:
            filter_map[col.name] = entry

    # Collect string-field keys for "search all" (q parameter).
    from sqlalchemy import String, Text
    string_keys: list[str] = []
    for col_attr in mapper.column_attrs:
        col = col_attr.columns[0]
        if isinstance(col.type, (String, Text)) and col_attr.key not in ("eid", "id", "creation_date", "modification_date"):
            string_keys.append(col_attr.key)

    clauses = []
    for key, value in query_params.items():
        if key.startswith("_") or value is None or value == "":
            continue

        # Handle __in operator (comma-separated values)
        if key.endswith("__in"):
            base = key[:-4]
            if base in filter_map:
                attr_key, col_type = filter_map[base]
                raw_values = [v.strip() for v in str(value).split(",") if v.strip()]
                if raw_values:
                    coerced = [_coerce_filter_value(v, col_type) for v in raw_values]
                    clauses.append(getattr(model_class, attr_key).in_(coerced))
            continue

        # Handle operators
        if key.endswith("__ilike") or key.endswith("_like"):
            prefix = "__ilike" if key.endswith("__ilike") else "_like"
            base = key[: -len(prefix)]
            if base in filter_map:
                attr_key, _ = filter_map[base]
                clauses.append(getattr(model_class, attr_key).ilike(f"%{value}%"))
            continue

        if key.endswith("_ne"):
            base = key[:-3]
            if base in filter_map:
                attr_key, _ = filter_map[base]
                clauses.append(getattr(model_class, attr_key) != value)
            continue

        if key.endswith("_gte"):
            base = key[:-4]
            if base in filter_map:
                attr_key, col_type = filter_map[base]
                clauses.append(getattr(model_class, attr_key) >= _coerce_filter_value(value, col_type))
            continue

        if key.endswith("_lte"):
            base = key[:-4]
            if base in filter_map:
                attr_key, col_type = filter_map[base]
                clauses.append(getattr(model_class, attr_key) <= _coerce_filter_value(value, col_type))
            continue

        # "Search all fields" (q=value)
        if key == "q":
            if not string_keys:
                continue
            from sqlalchemy import or_
            clauses.append(
                or_(*[getattr(model_class, k).ilike(f"%{value}%") for k in string_keys])
            )
            continue

        if key not in filter_map:
            continue
        attr_key, col_type = filter_map[key]
        coerced = _coerce_filter_value(value, col_type)
        clauses.append(getattr(model_class, attr_key) == coerced)
    return clauses


def _sanitize(value: Any) -> Any:
    """Replace non-JSON-serializable values so serialization never fails."""
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if isinstance(value, memoryview):
        value = bytes(value)
    if isinstance(value, (bytes, bytearray)):
        return "data:application/octet-stream;base64," + base64.b64encode(value).decode()
    if isinstance(value, dict):
        return {k: _sanitize(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_sanitize(v) for v in value]
    return value


def _concise_error_message(exc: Exception, max_len: int = 300) -> str:
    """Return a short, single-line message for a per-row import error.

    SQLAlchemy wraps DBAPI errors (e.g. a psycopg2 UniqueViolation) in a
    ``StatementError`` whose default ``str()`` appends the full parameterized
    SQL statement and every bound parameter value — accurate, but unreadable
    when a CSV import reports one of these per failed row. ``exc.orig`` is
    the original DBAPI exception with just the database's own message, which
    is what's actually useful here.
    """
    orig = getattr(exc, "orig", None)
    message = str(orig) if orig is not None else str(exc)
    message = " ".join(message.split())  # collapse embedded newlines/whitespace
    if len(message) > max_len:
        message = message[: max_len - 1] + "…"
    return message


def _to_dict(obj: SQLModel) -> dict:
    if obj is None:
        return {}
    data = obj.model_dump()
    # Canonical title (honours __veloiq_ui__["titleFields"]; works for plain
    # SQLModel tables too, e.g. imported models that lack a VeloIQ base class).
    data["_label"] = build_model_str_label(obj)
    return _sanitize(data)


def create_crud_router(
    model_class: Type[T],
    *,
    prefix: str | None = None,
    tags: list[str] | None = None,
    pk_type: type = int,
) -> APIRouter:
    """Return an APIRouter with standard CRUD endpoints for *model_class*.

    Parameters
    ----------
    model_class:
        A SQLModel table class.
    prefix:
        URL prefix for all routes.  Defaults to ``/<tablename>``.
    tags:
        OpenAPI tags.  Defaults to ``[<tablename>]``.
    pk_type:
        Python type of the primary key (default ``int``).
    """
    tablename = getattr(model_class, "__tablename__", model_class.__name__.lower())
    _prefix = prefix if prefix is not None else f"/{tablename}"
    _tags = tags or [tablename]
    pk_field = get_pk_field_name(model_class)

    router = APIRouter(prefix=_prefix, tags=_tags)

    # ── ReBAC helper (closure over model_class and pk_field) ──────────────────

    def _get_rebac_record(record_id, session, user: dict | None):
        """Fetch a record by PK while enforcing the model's ReBAC filter.

        Returns None both when the record does not exist AND when it exists but
        is inaccessible to *user* — callers raise 404 in both cases to avoid
        leaking record existence.
        """
        filter_fn = getattr(model_class, "__rebac_filter__", None)
        if filter_fn is None:
            return session.get(model_class, record_id)
        if not user:
            return None
        clause = filter_fn(user, model_class, session)
        if clause is None or clause is True:
            return session.get(model_class, record_id)
        if clause is False:
            return None
        pk_col = getattr(model_class, pk_field)
        stmt = select(model_class).where(pk_col == record_id).where(clause)
        return session.exec(stmt).first()

    # ── List ─────────────────────────────────────────────────────────────────

    @router.get("", summary=f"List {tablename}")
    def list_items(
        request: Request,
        _start: int = Query(0, alias="_start"),
        _end: int = Query(25, alias="_end"),
        session: Session = Depends(get_session),
    ):
        _check_model_permissions(request, model_class, "GET")
        user = getattr(request.state, "user", None) or {}
        where_clauses = _build_where_clauses(model_class, request.query_params)
        rebac_clause = _build_rebac_clause(model_class, user, session)
        count_stmt = select(func.count()).select_from(model_class)
        list_stmt = select(model_class)
        for clause in where_clauses:
            count_stmt = count_stmt.where(clause)
            list_stmt = list_stmt.where(clause)
        if rebac_clause is not None:
            count_stmt = count_stmt.where(rebac_clause)
            list_stmt = list_stmt.where(rebac_clause)
        total = session.exec(count_stmt).one()
        rows = session.exec(list_stmt.offset(_start).limit(max(0, _end - _start))).all()
        user_roles = user.get("roles", [])
        content = [_filter_read_fields(_to_dict(r), model_class, user_roles) for r in rows if r is not None]
        return JSONResponse(
            content=jsonable_encoder(content),
            headers={
                "x-total-count": str(total),
                "content-range": f"items {_start}-{min(_end, total)}/{total}",
            },
        )

    # ── Import from CSV / Export to CSV ─────────────────────────────────────────
    # NOTE: these must be registered before the "/{record_id}" routes below —
    # FastAPI/Starlette matches routes in registration order, and an untyped
    # "/{record_id}" path pattern greedily matches any single path segment
    # (type coercion to pk_type happens after matching, not during route
    # selection), so a static path registered afterward would be permanently
    # shadowed and return a 422 instead of ever being reached.

    # Fields never required/accepted as input columns for the generic "Basic"
    # path: the PK, plus any column that is structurally server-managed (has
    # a server_default and/or onupdate set) — detected generically rather
    # than by guessing name conventions, since different apps/models name
    # these fields differently (created_at/updated_at, creation_date/
    # modification_date, ...).
    #
    # Computed lazily (memoized on first request) rather than here at
    # router-construction time: accessing mapper.column_attrs forces
    # SQLAlchemy to fully configure every mapper in the app, which can fail
    # with "One or more mappers failed to initialize" if create_crud_router()
    # runs (as it does, from generated api.py) before every module defining
    # a relationship target has been imported yet. By the time a real HTTP
    # request arrives, app startup (and configure_mappers()) has completed.
    _readonly_import_fields_cache: list = [None]

    def _get_readonly_import_fields() -> set[str]:
        if _readonly_import_fields_cache[0] is None:
            from sqlalchemy import inspect as _sa_inspect
            managed: set[str] = set()
            try:
                mapper = _sa_inspect(model_class)
                for col_attr in mapper.column_attrs:
                    col = col_attr.columns[0]
                    if col.server_default is not None or col.server_onupdate is not None or col.onupdate is not None:
                        managed.add(col_attr.key)
            except Exception:
                pass
            _readonly_import_fields_cache[0] = {pk_field} | managed
        return _readonly_import_fields_cache[0]

    @router.post("/import-csv", summary=f"Import {tablename} from CSV")
    def import_csv(
        request: Request,
        file: UploadFile = File(...),
        dry_run: bool = Query(False, description="Validate without committing to the database."),
        session: Session = Depends(get_session),
    ):
        """Import rows from an uploaded CSV file.

        If a custom loader is registered for *model_class* (see
        ``veloiq_framework.import_registry``), every row is delegated to it instead
        of the generic path below — this is the hook host apps/extensions use to
        plug in business-key/FK-by-name resolution instead of a plain insert.

        Otherwise (the OSS "Basic" path): the CSV header must match the model's
        field names exactly (no fuzzy matching, no relation-name resolution — a
        foreign key column is only accepted as a raw id value under its own exact
        column name). Rows are validated via Pydantic/SQLModel and inserted in a
        single batch. ``dry_run=true`` validates and reports without committing.
        """
        _check_model_permissions(request, model_class, "POST")
        user = getattr(request.state, "user", None) or {}
        user_roles = user.get("roles", [])

        raw = file.file.read()
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = raw.decode("latin-1")
        reader = csv.DictReader(io.StringIO(text))
        if reader.fieldnames is None:
            raise HTTPException(status_code=422, detail="CSV file has no header row")

        from veloiq_framework.import_registry import get_import_loader
        loader_fn = get_import_loader(model_class)

        errors: list[dict] = []
        total_rows = 0

        if loader_fn is not None:
            inserted = 0
            updated = 0
            for i, row in enumerate(reader, start=1):
                total_rows += 1
                try:
                    added, upd = loader_fn(row, session)
                    inserted += added
                    updated += upd
                except Exception as exc:
                    errors.append({"row": i, "message": str(exc)})
            if dry_run:
                session.rollback()
            else:
                session.commit()
            return {"inserted": inserted, "updated": updated, "errors": errors, "total_rows": total_rows}

        # Basic OSS path: exact header match required, except the PK and any
        # server-managed columns, which are *optional* — present when
        # re-importing a file this same route exported (round-trip, where
        # the PK header is always included), absent for a fresh insert file.
        # They are never *required* headers, but a header matching any real
        # model field (readonly or not) is accepted; only genuinely unknown
        # column names are rejected.
        all_fields = set(model_class.model_fields.keys())
        required_fields = all_fields - _get_readonly_import_fields()
        file_fields = set(reader.fieldnames)
        missing = required_fields - file_fields
        unexpected = file_fields - all_fields
        if missing or unexpected:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"CSV headers must match model fields exactly (the primary key and any "
                    f"server-managed columns are optional). Required: {sorted(required_fields)}. "
                    f"Missing: {sorted(missing)}. Unexpected: {sorted(unexpected)}."
                ),
            )

        # Each row is committed (or, for dry_run, flushed then rolled back) in
        # its own short-lived session — not one batch add_all()+commit() on
        # the shared request session — so a duplicate-key or other DB-level
        # constraint violation on one row can't crash or roll back any other
        # valid row; it's just reported per-row, same as a validation error.
        # (An earlier version used session.begin_nested() SAVEPOINTs on the
        # shared session instead; that doesn't reliably roll back on SQLite —
        # a released savepoint survives session.rollback() there, a known
        # pysqlite driver quirk — so this uses fully separate sessions per
        # row instead, which behaves correctly on every backend.)
        # Using flush() (not just Pydantic validation) also means dry_run
        # actually catches real DB constraint violations — e.g. re-importing
        # a row whose PK already exists — while still persisting nothing.
        # A small sample of successfully-processed rows' final coerced values
        # (including any DB-assigned default, e.g. an autoincrement PK) is
        # returned alongside the errors — enough to sanity-check that dates/
        # numbers/FKs coerced the way you'd expect, without the response
        # ballooning for large files (the CSV the user just uploaded already
        # has every row; echoing all of them back adds little beyond that).
        _SAMPLE_ROW_LIMIT = 10
        sample_rows: list[dict] = []

        inserted = 0
        engine = get_engine()
        for i, row in enumerate(reader, start=1):
            total_rows += 1
            filtered = _filter_write_payload(dict(row), model_class, user_roles)
            coerced = {k: _coerce_value(k, v) for k, v in filtered.items()}
            # An empty PK column (e.g. a fresh-insert file that kept the
            # header but left the value blank) should let the DB generate
            # the value, not be passed through as an empty string.
            if coerced.get(pk_field) in (None, ""):
                coerced.pop(pk_field, None)
            try:
                obj = model_class.model_validate(coerced)
            except Exception as exc:
                errors.append({"row": i, "message": _concise_error_message(exc)})
                continue

            with Session(engine) as row_session:
                try:
                    row_session.add(obj)
                    row_session.flush()
                    # Capture the sample before commit/rollback — reading
                    # attributes off a rolled-back or detached object risks
                    # DetachedInstanceError; right after flush() every column
                    # (including DB-assigned defaults) is populated and safe.
                    if len(sample_rows) < _SAMPLE_ROW_LIMIT:
                        sample_rows.append(_sanitize(obj.model_dump()))
                    if dry_run:
                        row_session.rollback()
                    else:
                        row_session.commit()
                    inserted += 1
                except Exception as exc:
                    row_session.rollback()
                    errors.append({"row": i, "message": _concise_error_message(exc)})

        return {
            "inserted": inserted,
            "updated": 0,
            "errors": errors,
            "total_rows": total_rows,
            "sample_rows": sample_rows,
        }

    @router.get("/export-csv", summary=f"Export {tablename} to CSV")
    def export_csv(request: Request, session: Session = Depends(get_session)):
        """Stream every row matching the request's filters as a CSV file.

        Headers are the exact model field names (round-trips with ``import-csv``
        above). Respects the same query-param filters and ReBAC rules as the list
        endpoint, unlike the client-side "quick export" of currently-loaded rows.
        """
        _check_model_permissions(request, model_class, "GET")
        user = getattr(request.state, "user", None) or {}
        user_roles = user.get("roles", [])
        where_clauses = _build_where_clauses(model_class, request.query_params)
        rebac_clause = _build_rebac_clause(model_class, user, session)
        stmt = select(model_class)
        for clause in where_clauses:
            stmt = stmt.where(clause)
        if rebac_clause is not None:
            stmt = stmt.where(rebac_clause)
        rows = session.exec(stmt).all()
        fieldnames = list(model_class.model_fields.keys())

        def _generate():
            buf = io.StringIO()
            writer = csv.DictWriter(buf, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            yield buf.getvalue()
            buf.seek(0)
            buf.truncate(0)
            for row in rows:
                data = _filter_read_fields(row.model_dump(), model_class, user_roles)
                writer.writerow({k: data.get(k, "") for k in fieldnames})
                yield buf.getvalue()
                buf.seek(0)
                buf.truncate(0)

        return StreamingResponse(
            _generate(),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{tablename}.csv"'},
        )

    # ── Get one ───────────────────────────────────────────────────────────────

    @router.get("/{record_id}", summary=f"Get {tablename}")
    def get_item(record_id: pk_type, request: Request, session: Session = Depends(get_session)):  # type: ignore[valid-type]
        _check_model_permissions(request, model_class, "GET")
        user = getattr(request.state, "user", None) or {}
        row = _get_rebac_record(record_id, session, user)
        if row is None:
            raise HTTPException(status_code=404, detail=f"{tablename} {record_id} not found")
        return _filter_read_fields(_to_dict(row), model_class, user.get("roles", []))

    # ── Create ────────────────────────────────────────────────────────────────

    @router.post("", status_code=201, summary=f"Create {tablename}")
    def create_item(payload: dict, request: Request, session: Session = Depends(get_session)):
        _check_model_permissions(request, model_class, "POST")
        user = getattr(request.state, "user", None) or {}
        user_roles = user.get("roles", [])
        payload.pop(pk_field, None)
        filtered = _filter_write_payload(payload, model_class, user_roles)
        coerced = {k: _coerce_value(k, v) for k, v in filtered.items()}
        try:
            row = model_class.model_validate(coerced)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        session.add(row)
        session.commit()
        session.refresh(row)
        return _filter_read_fields(_to_dict(row), model_class, user_roles)

    # ── Update ────────────────────────────────────────────────────────────────

    def _coerce_value(key: str, value):
        """Coerce string values to the Python type expected by the column."""
        if not isinstance(value, str):
            return value
        import datetime as _dt
        from sqlalchemy import inspect as _sa_inspect
        from sqlalchemy import DateTime as _DateTime, Date as _Date
        try:
            mapper = _sa_inspect(model_class)
            col = mapper.columns.get(key)
            if col is None:
                return value
            # Empty string → None for nullable columns (e.g. unselected FK dropdown).
            if value == "" and col.nullable:
                return None
            if isinstance(col.type, _DateTime):
                # Strip trailing Z for Python 3.10 compatibility.
                return _dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
            if isinstance(col.type, _Date):
                # Slice to YYYY-MM-DD in case a datetime string is sent.
                return _dt.date.fromisoformat(value[:10])
        except Exception:
            pass
        return value

    # Fields that must never be overwritten by a client update.
    _READONLY_FIELDS = {"created_at", "creation_date", "modification_date"}

    def _apply_update(record_id, payload, session, user: dict):
        user_roles = user.get("roles", []) if user else []
        row = _get_rebac_record(record_id, session, user)
        if row is None:
            raise HTTPException(status_code=404, detail=f"{tablename} {record_id} not found")
        payload.pop(pk_field, None)
        filtered = _filter_write_payload(payload, model_class, user_roles)
        for key, value in filtered.items():
            if key in _READONLY_FIELDS:
                continue
            if hasattr(row, key):
                setattr(row, key, _coerce_value(key, value))
        session.add(row)
        session.commit()
        session.refresh(row)
        return _filter_read_fields(_to_dict(row), model_class, user_roles)

    @router.put("/{record_id}", summary=f"Update {tablename}")
    def update_item(
        record_id: pk_type,  # type: ignore[valid-type]
        payload: dict,
        request: Request,
        session: Session = Depends(get_session),
    ):
        _check_model_permissions(request, model_class, "PUT")
        return _apply_update(record_id, payload, session, getattr(request.state, "user", None) or {})

    @router.patch("/{record_id}", summary=f"Partial update {tablename}")
    def partial_update_item(
        record_id: pk_type,  # type: ignore[valid-type]
        payload: dict,
        request: Request,
        session: Session = Depends(get_session),
    ):
        _check_model_permissions(request, model_class, "PATCH")
        return _apply_update(record_id, payload, session, getattr(request.state, "user", None) or {})

    # ── Delete ────────────────────────────────────────────────────────────────

    @router.delete("/{record_id}", status_code=204, summary=f"Delete {tablename}")
    def delete_item(record_id: pk_type, request: Request, session: Session = Depends(get_session)):  # type: ignore[valid-type]
        _check_model_permissions(request, model_class, "DELETE")
        user = getattr(request.state, "user", None) or {}
        row = _get_rebac_record(record_id, session, user)
        if row is None:
            raise HTTPException(status_code=404, detail=f"{tablename} {record_id} not found")
        session.delete(row)
        session.commit()

    return router
