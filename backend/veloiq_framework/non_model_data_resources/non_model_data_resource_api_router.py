"""FastAPI routers of the non-model data resources.

:func:`create_non_model_data_resource_router` gives one non-model data resource the REST
contract of the model CRUD router (:mod:`veloiq_framework.crud`), mounted under
``/api``:

* ``GET    /{name}``             — list with filters, search, sort and paging (``x-total-count``)
* ``GET    /{name}/export-csv``  — every matching row as CSV
* ``POST   /{name}/analyze``     — server-side aggregation for the Analyze section
* ``GET    /{name}/{eid}``       — one row
* ``POST   /{name}``             — add a row
* ``PUT    /{name}/{eid}``, ``PATCH /{name}/{eid}`` — change a row
* ``DELETE /{name}/{eid}``       — delete a row

Every row in a response carries ``eid`` (and ``id`` = ``eid`` when the resource
has no ``id`` field, for Refine) and ``_revision``. A write that sends the
revision it read (``If-Match`` header or ``_revision`` in the body) is refused
with 409 when the row changed since; the UI's HTTP helpers send it for every
row they read from a response marked with :data:`ROW_REVISIONS_RESPONSE_HEADER`.

:data:`non_model_data_catalog_router` serves ``GET /api/veloiq/non-model-data-resources``: the
``ModelDef`` of every non-model data resource the user may read, which the UI merges
into its model list.
"""
from __future__ import annotations

import csv
import io
from contextlib import contextmanager
from typing import Any, Iterator, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, Response, StreamingResponse

from veloiq_framework.crud import _sanitize
from veloiq_framework.utils.i18n_utils import _
from veloiq_framework.utils.views_utils import jm_log

from .non_model_data_resource_definitions import NonModelDataResource, get_non_model_data_resources
from .encode_decode_row_eid import RowEidEncodingError, decode_eid, encode_eid, row_key_value_as_text
from .filter_sort_page_rows import filter_rows_by_query_parameters, slice_rows_page, compute_row_revision, sort_rows_by_query_parameters
from .manage_data_sources_crud import DataSourceChangedConflictError, DataSourceRequestContext
from .validate_row_writes import build_validated_row

#: Response header telling the UI's HTTP helpers that the rows carry ``_revision``.
ROW_REVISIONS_RESPONSE_HEADER = "X-VeloIQ-Row-Revisions"


# ---------------------------------------------------------------------------
# Access
# ---------------------------------------------------------------------------


def _access_module_key_of(data_resource: NonModelDataResource) -> Optional[str]:
    """Return the access-registry key of the resource's module, or ``None``."""
    if not data_resource.module:
        return None
    from veloiq_framework.access.registry import get_modules
    return next((key for key, info in get_modules().items() if info.name == data_resource.module), None)


def check_non_model_data_resource_access(request: Request, data_resource: NonModelDataResource, action: str) -> None:
    """Raise 403 unless the user may perform *action* (``read``, ``create``, ``update``, ``delete``).

    Uses the resource's own ``access_check`` when it has one; otherwise the
    shared access decision (licensing, the role's methods and access policy)
    for the resource's module and name. Requests without a user are left to
    the auth middleware, as for models.
    """
    if data_resource.access_check is not None:
        data_resource.access_check(request, action)
        return
    user = getattr(request.state, "user", None)
    if user is None:
        return
    from veloiq_framework.access.decision import can_access, denied_exception
    if not can_access(user, _access_module_key_of(data_resource), data_resource.name, action):
        raise denied_exception()


def _signed_in_user_roles(request: Request) -> list[str]:
    """Return the signed-in user's roles."""
    user = getattr(request.state, "user", None) or {}
    return list(user.get("roles") or []) if isinstance(user, dict) else []


# ---------------------------------------------------------------------------
# Router of one resource
# ---------------------------------------------------------------------------


def create_non_model_data_resource_router(data_resource: NonModelDataResource) -> APIRouter:
    """Return the APIRouter serving *resource* at ``/{resource.name}``."""
    data_resource.data_source.bind_to_data_resource(data_resource)
    router = APIRouter(prefix=f"/{data_resource.name}", tags=[data_resource.module.upper() if data_resource.module else data_resource.name])
    resource_has_id_field = data_resource.get_field_by_key("id") is not None

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _data_source_request_context(request: Request) -> DataSourceRequestContext:
        return DataSourceRequestContext(getattr(request.state, "user", None), request)

    def _eid_of_row(row: dict) -> Optional[str]:
        try:
            return encode_eid([row.get(key) for key in data_resource.pk_fields])
        except RowEidEncodingError:
            return None

    def _readable_row_for_roles(row: dict, roles: list[str]) -> dict:
        """Return *row* without the fields the roles may not read, with eid/id/_revision."""
        data = {
            key: value for key, value in row.items()
            if (field := data_resource.get_field_by_key(key)) is None
            or field.read_roles is None
            or set(field.read_roles) & set(roles)
        }
        data["eid"] = _eid_of_row(row)
        if not resource_has_id_field:
            data["id"] = data["eid"]
        data["_revision"] = compute_row_revision(row)
        if data_resource.single_record:
            # The one record of a settings form is titled with the resource's label.
            data["_label"] = _(data_resource.label)
        elif data_resource.title_fields:
            # A row's title (page headings, reference links): its title fields' values.
            title = " ".join(str(row.get(key)) for key in data_resource.title_fields if row.get(key) not in (None, ""))
            if title:
                data["_label"] = title
        return _sanitize(data)

    def _load_all_rows_or_500(request: Request) -> list[dict]:
        # Fields built at run time (e.g. one per registered setting) are current for this request.
        data_resource.refresh_fields()
        try:
            return data_resource.data_source.load_all_rows(_data_source_request_context(request))
        except HTTPException:
            # The source's own answer (e.g. 503 "being built"), with its message.
            raise
        except Exception as load_error:
            jm_log(3, f"non-model data resource {data_resource.name}: could not read the rows:", load_error)
            raise HTTPException(status_code=500, detail=_("The data of this list could not be read."))

    def _find_row_by_eid(rows: list[dict], eid: str) -> Optional[dict]:
        try:
            key_values = decode_eid(eid, len(data_resource.pk_fields))
        except RowEidEncodingError:
            return None
        wanted = encode_eid(key_values)
        return next((row for row in rows if _eid_of_row(row) == wanted), None)

    def _require_accepted_write_action(action: str) -> None:
        if not data_resource.accepts_write_action(action):
            raise HTTPException(status_code=405, detail=_("This action is not available for this list."))

    def _row_not_found_error() -> HTTPException:
        return HTTPException(status_code=404, detail=_("The row was not found. It may have been deleted."))

    def _reject_stale_row_revision(request: Request, payload: dict, row: dict) -> None:
        """Raise 409 when the request names a revision the row no longer has."""
        expected = request.headers.get("if-match") or payload.get("_revision")
        if expected and str(expected).strip('"') != compute_row_revision(row):
            raise HTTPException(status_code=409,
                                detail=_("This row was changed by someone else. Reload it and try again."))

    @contextmanager
    def _writing_under_data_source_hold() -> Iterator[None]:
        """Hold the source for a read-check-write and turn its errors into HTTP errors."""
        with data_resource.data_source.hold_for_read_check_write():
            try:
                yield
            except DataSourceChangedConflictError:
                raise HTTPException(status_code=409,
                                    detail=_("This row was changed by someone else. Reload it and try again."))
            except PermissionError:
                raise HTTPException(status_code=405, detail=_("This action is not available for this list."))

    def _json_rows_page_response(content: list[dict], start: int, end: int, total: int) -> JSONResponse:
        return JSONResponse(
            content=jsonable_encoder(content),
            headers={
                "x-total-count": str(total),
                "content-range": f"items {start}-{min(end, total)}/{total}",
                ROW_REVISIONS_RESPONSE_HEADER: "1",
            },
        )

    def _json_row_response(row: dict, roles: list[str], status_code: int = 200) -> JSONResponse:
        return JSONResponse(content=jsonable_encoder(_readable_row_for_roles(row, roles)), status_code=status_code,
                            headers={ROW_REVISIONS_RESPONSE_HEADER: "1"})

    # ── List ─────────────────────────────────────────────────────────────────

    @router.get("", summary=f"List {data_resource.name}")
    def list_rows_endpoint(
        request: Request,
        _start: int = Query(0, alias="_start"),
        _end: int = Query(25, alias="_end"),
        _sort: Optional[str] = Query(None, alias="_sort"),
        _order: Optional[str] = Query(None, alias="_order"),
    ):
        check_non_model_data_resource_access(request, data_resource, "read")
        roles = _signed_in_user_roles(request)
        rows = sort_rows_by_query_parameters(data_resource, filter_rows_by_query_parameters(data_resource, _load_all_rows_or_500(request), request.query_params), _sort, _order)
        content = [_readable_row_for_roles(row, roles) for row in slice_rows_page(rows, _start, _end)]
        return _json_rows_page_response(content, _start, _end, len(rows))

    # Static paths are registered before "/{eid}", which would otherwise match them.

    @router.get("/export-csv", summary=f"Export {data_resource.name} to CSV")
    def export_rows_csv_endpoint(request: Request):
        """Stream every row matching the request's filters as CSV, with the field keys as headers."""
        check_non_model_data_resource_access(request, data_resource, "read")
        roles = _signed_in_user_roles(request)
        rows = sort_rows_by_query_parameters(data_resource, filter_rows_by_query_parameters(data_resource, _load_all_rows_or_500(request), request.query_params), None, None)
        readable_keys = [f.key for f in data_resource.fields if f.read_roles is None or set(f.read_roles) & set(roles)]

        def _generate():
            buffer = io.StringIO()
            writer = csv.DictWriter(buffer, fieldnames=readable_keys, extrasaction="ignore")
            writer.writeheader()
            for row in rows:
                data = _readable_row_for_roles(row, roles)
                # Multi-value fields are written as their values joined.
                writer.writerow({key: row_key_value_as_text(data.get(key)) if isinstance(data.get(key), list)
                                 else data.get(key, "") for key in readable_keys})
            yield buffer.getvalue()

        return StreamingResponse(_generate(), media_type="text/csv",
                                 headers={"Content-Disposition": f'attachment; filename="{data_resource.name}.csv"'})

    @router.post("/analyze", summary=f"Aggregate {data_resource.name} for the Analyze section")
    def analyze_rows_endpoint(spec: dict, request: Request):
        """Aggregate the matching rows for the Analyze section (see ``crud.py``'s ``analyze``)."""
        from veloiq_framework.analyze import jm_analyze_rows
        from veloiq_framework.extension_registry import read_views_config

        check_non_model_data_resource_access(request, data_resource, "read")
        roles = _signed_in_user_roles(request)
        rows = []
        for row in filter_rows_by_query_parameters(data_resource, _load_all_rows_or_500(request), request.query_params):
            data = _readable_row_for_roles(row, roles)
            data["_label"] = " ".join(str(row.get(key) or "") for key in data_resource.title_fields).strip() or data["eid"]
            rows.append(data)
        try:
            sample_size = int(read_views_config().get("analyzeServerAggregationThreshold") or 10000)
        except Exception:
            sample_size = 10000
        ranking = spec.get("ranking") or {}
        result = jm_analyze_rows(
            rows,
            fields=[f for f in (spec.get("fields") or []) if isinstance(f, dict) and f.get("key")],
            pk_field=data_resource.ui_primary_key_field,
            category_keys=[key for key in (spec.get("category_keys") or []) if key],
            series_keys=list(spec.get("series_keys") or []),
            summary_function=spec.get("summary_function") or "sum",
            ranking_mode=ranking.get("mode") or "none", ranking_key=ranking.get("key"),
            ranking_n=int(ranking.get("n") or 10), search=str(spec.get("search") or ""),
            column_filters={k: v for k, v in (spec.get("column_filters") or {}).items() if v},
            reference_titles={}, stats_keys=list(spec.get("stats_keys") or []), sample_size=sample_size)
        return JSONResponse(content=jsonable_encoder(_sanitize(result)))

    # ── Get one ──────────────────────────────────────────────────────────────

    @router.get("/{eid}", summary=f"Get {data_resource.name}")
    def get_row_endpoint(eid: str, request: Request):
        check_non_model_data_resource_access(request, data_resource, "read")
        row = _find_row_by_eid(_load_all_rows_or_500(request), eid)
        if row is None:
            raise _row_not_found_error()
        return _json_row_response(row, _signed_in_user_roles(request))

    # ── Create ───────────────────────────────────────────────────────────────

    @router.post("", status_code=201, summary=f"Create {data_resource.name}")
    def create_row(payload: dict, request: Request):
        check_non_model_data_resource_access(request, data_resource, "create")
        _require_accepted_write_action("create")
        roles = _signed_in_user_roles(request)
        with _writing_under_data_source_hold():
            rows = _load_all_rows_or_500(request)
            row, errors = build_validated_row(data_resource, payload, None, rows, roles)
            if errors:
                raise HTTPException(status_code=422, detail=" ".join(errors))
            saved = data_resource.data_source.create_row(_data_source_request_context(request), row)
        jm_log(1, f"non-model data resource {data_resource.name}: added row {_eid_of_row(saved)}")
        return _json_row_response(saved, roles, status_code=201)

    # ── Update ───────────────────────────────────────────────────────────────

    def _update_row_from_request(eid: str, payload: dict, request: Request) -> JSONResponse:
        check_non_model_data_resource_access(request, data_resource, "update")
        _require_accepted_write_action("update")
        roles = _signed_in_user_roles(request)
        with _writing_under_data_source_hold():
            rows = _load_all_rows_or_500(request)
            existing = _find_row_by_eid(rows, eid)
            if existing is None:
                raise _row_not_found_error()
            _reject_stale_row_revision(request, payload, existing)
            current_eid = _eid_of_row(existing)
            others = [row for row in rows if _eid_of_row(row) != current_eid]
            row, errors = build_validated_row(data_resource, payload, existing, others, roles)
            if errors:
                raise HTTPException(status_code=422, detail=" ".join(errors))
            saved = data_resource.data_source.update_row(_data_source_request_context(request), current_eid, row)
        jm_log(1, f"non-model data resource {data_resource.name}: changed row {current_eid}")
        return _json_row_response(saved, roles)

    @router.put("/{eid}", summary=f"Update {data_resource.name}")
    def update_row(eid: str, payload: dict, request: Request):
        return _update_row_from_request(eid, payload, request)

    @router.patch("/{eid}", summary=f"Partial update {data_resource.name}")
    def partial_update_row(eid: str, payload: dict, request: Request):
        return _update_row_from_request(eid, payload, request)

    # ── Delete ───────────────────────────────────────────────────────────────

    @router.delete("/{eid}", status_code=204, summary=f"Delete {data_resource.name}")
    def delete_row(eid: str, request: Request):
        check_non_model_data_resource_access(request, data_resource, "delete")
        _require_accepted_write_action("delete")
        with _writing_under_data_source_hold():
            existing = _find_row_by_eid(_load_all_rows_or_500(request), eid)
            if existing is None:
                raise _row_not_found_error()
            _reject_stale_row_revision(request, {}, existing)
            current_eid = _eid_of_row(existing)
            data_resource.data_source.delete_row(_data_source_request_context(request), current_eid)
        jm_log(1, f"non-model data resource {data_resource.name}: deleted row {current_eid}")
        return Response(status_code=204)

    # Access is checked in each handler, so the loader's module-level access
    # dependency skips these routes (as for the model CRUD routes).
    from veloiq_framework.access.dependencies import mark_model_checked
    for route in router.routes:
        if getattr(route, "endpoint", None) is not None:
            mark_model_checked(route.endpoint)
    return router


# ---------------------------------------------------------------------------
# Catalog
# ---------------------------------------------------------------------------

non_model_data_catalog_router = APIRouter(tags=["non-model-data-resources"])


@non_model_data_catalog_router.get("/veloiq/non-model-data-resources")
def list_non_model_data_resources(request: Request) -> dict[str, Any]:
    """Return ``{"models": [ModelDef, ...]}`` for every non-model data resource the user may read.

    Fields the user's roles may not read are left out of each ``ModelDef``, so
    the page schema matches what the endpoints return.
    """
    roles = _signed_in_user_roles(request)
    models = []
    for data_resource in get_non_model_data_resources():
        try:
            check_non_model_data_resource_access(request, data_resource, "read")
        except HTTPException:
            continue
        model_def = data_resource.to_model_def()
        if getattr(request.state, "user", None) is not None:
            model_def["fields"] = [
                f for f in model_def["fields"] if f.get("readRoles") is None or set(f["readRoles"]) & set(roles)
            ]
        models.append(model_def)
    return {"models": models}
