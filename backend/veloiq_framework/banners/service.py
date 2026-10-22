"""Data of the collapsible banners: which banners a page shows and their rows.

Every query is an ORM statement executed with :func:`jm_execute_orm`:

* ``{"model": "<class or table name>"}`` — ``select(Model)`` narrowed by the
  banner's Advanced-filter rules and by the model's row-level (ReBAC) filter.
* ``{"named_query": "<name>"}`` — the named query's own statement, narrowed by
  the rules (a rule's ``fieldKey`` is one of the named query's field keys).
* ``{"orm": {...}}`` — an ORM spec, as accepted by
  :func:`jm_build_orm_query_from_spec`, narrowed by the rules too: a rule's
  ``fieldKey`` is a column of the spec's ``from`` model, or ``"Model.column"``
  for a joined model. The rules apply before any ``group_by``.
  Raw SQL fragments are rejected.

The banner's count is the number of rows of that query; the expanded banner
lists its first ``max_rows`` rows. A banner is left out when the user may not
read the models it queries.
"""
from __future__ import annotations

import math
from typing import Any, Optional

from sqlalchemy import func
from sqlmodel import select

from veloiq_framework.utils.data_mgmt_utils import (
    _resolve_orm_column,
    jm_build_orm_query_from_spec,
    jm_execute_orm,
    jm_obtain_model_by_name,
    jm_pretty_df_column_names,
)
from veloiq_framework.utils.views_utils import jm_log

from .definitions import get_banner_definitions
from .filters import build_rule_clauses

#: Banner keys returned to the browser as they are (everything but the query).
_PUBLIC_KEYS = (
    "key", "title", "icon", "tone", "position", "collapsed", "expanded", "collapsed_content",
    "movable", "priority", "row_resource", "view_all_resource", "hide_when_empty",
)


class BannerSourceError(ValueError):
    """The banner's source can't be queried (unknown model, raw SQL, ...)."""


# ---------------------------------------------------------------------------
# Page targeting
# ---------------------------------------------------------------------------


def module_of_model(model_class: type) -> Optional[str]:
    """Return the module folder a model class is defined in (``app.modules.<module>.models``)."""
    parts = (getattr(model_class, "__module__", "") or "").split(".")
    if "modules" in parts and parts.index("modules") + 1 < len(parts):
        return parts[parts.index("modules") + 1]
    return None


def _page_names(resource: Optional[str], module: Optional[str]) -> tuple[set[str], set[str]]:
    """Return the names a page's resource is known by, and the page's modules.

    A resource may be a model's table name (``jm_exceptionalert``), its class
    name or a named query's name; ``show_on.models`` may use any of them.
    """
    from veloiq_framework.queries import get_named_query

    names: set[str] = set()
    modules: set[str] = {module.lower()} if module else set()
    if resource:
        names.add(resource.lower())
        model_class = jm_obtain_model_by_name(resource)
        if model_class is not None:
            names.update({model_class.__name__.lower(), getattr(model_class, "__tablename__", "").lower()})
            if not module and module_of_model(model_class):
                modules.add(module_of_model(model_class).lower())
        named_query = get_named_query(resource)
        if named_query is not None and not module and named_query.module:
            modules.add(named_query.module.lower())
    return names, modules


def banner_applies(banner: dict, resource: Optional[str], module: Optional[str], site: Optional[str]) -> bool:
    """Return True when *banner* is shown on the page described by the arguments.

    :param resource: The host app page's resource, if the page is a model or named query page.
    :param module: The page's module, when the browser knows it (custom pages).
    :param site: The external website asking (e.g. ``"candidate-portal"``); None for the host app.
    """
    show_on = banner.get("show_on") or {}
    if site:
        return site.lower() in {str(s).lower() for s in show_on.get("sites") or []}
    if show_on.get("all"):
        return True
    names, modules = _page_names(resource, module)
    if names & {str(m).lower() for m in show_on.get("models") or []}:
        return True
    return bool(modules & {str(m).lower() for m in show_on.get("modules") or []})


# ---------------------------------------------------------------------------
# Query building
# ---------------------------------------------------------------------------


def _contains_raw(spec: Any) -> bool:
    """Return True when an ORM spec holds a raw SQL fragment anywhere."""
    if isinstance(spec, dict):
        return "raw" in spec or any(_contains_raw(value) for value in spec.values())
    if isinstance(spec, (list, tuple)):
        return (len(spec) > 0 and spec[0] == "raw") or any(_contains_raw(item) for item in spec)
    return False


def _orm_spec_models(spec: dict) -> list[type]:
    """Return the model classes an ORM spec reads (its ``from`` and ``aliases``)."""
    names = [spec.get("from"), *(spec.get("aliases") or {}).values()]
    models = [jm_obtain_model_by_name(name) for name in names if name]
    return [model for model in models if model is not None]


def _user_may_read(user: Optional[dict], models: list[type]) -> bool:
    """Return True when *user* may read every model in *models*."""
    if user is None:
        return True
    from veloiq_framework.access.decision import can_access_model
    return all(can_access_model(user, model_class, "read") for model_class in models)


def _sorted(stmt: Any, sort: Optional[dict], resolve_column) -> Any:
    """Apply the banner's ``sort`` (``{"field", "order"}``) to *stmt*."""
    if not sort or not sort.get("field"):
        return stmt
    column = resolve_column(sort["field"])
    if column is None:
        jm_log(1, f"banner sort: unknown field '{sort['field']}' — not sorted.")
        return stmt
    return stmt.order_by(column.desc() if str(sort.get("order", "asc")).lower() == "desc" else column.asc())


def build_banner_query(banner: dict, session: Any, user: Optional[dict]) -> tuple[Any, dict, Optional[str]]:
    """Return the ORM statement of *banner*, its field labels and its default resource.

    :raises BannerSourceError: When the source can't be queried.
    :raises PermissionError: When *user* may not read the source's models.
    :return: ``(statement, {field_key: label}, resource)`` where the labels are
        those the source defines (named query fields) and the resource is the
        page a row opens by default.
    """
    from veloiq_framework.crud import _build_rebac_clause
    from veloiq_framework.queries import get_named_query

    source = banner["source"]
    rules = banner.get("filters") or []

    if "model" in source:
        model_class = jm_obtain_model_by_name(source["model"])
        if model_class is None:
            raise BannerSourceError(f"model '{source['model']}' not found")
        if not _user_may_read(user, [model_class]):
            raise PermissionError(source["model"])

        def resolve_column(key):
            return getattr(model_class, key, None)

        stmt = select(model_class)
        rebac_clause = _build_rebac_clause(model_class, user, session)
        if rebac_clause is not None:
            stmt = stmt.where(rebac_clause)
        for clause in build_rule_clauses(rules, resolve_column):
            stmt = stmt.where(clause)
        return _sorted(stmt, banner.get("sort"), resolve_column), {}, getattr(model_class, "__tablename__", None)

    if "named_query" in source:
        named_query = get_named_query(source["named_query"])
        if named_query is None:
            raise BannerSourceError(f"named query '{source['named_query']}' not found")
        if not _user_may_read(user, named_query.participating_models):
            raise PermissionError(source["named_query"])
        fields = {field.key: field for field in named_query.fields}

        def resolve_column(key):
            field = fields.get(key)
            if field is None:
                return None
            return getattr(field.source_model or named_query.primary_model, field.source_attr or field.key, None)

        stmt = named_query.query_factory(session, user)
        for clause in build_rule_clauses(rules, resolve_column):
            stmt = stmt.where(clause)
        labels = {key: field.label for key, field in fields.items() if field.label}
        return _sorted(stmt, banner.get("sort"), resolve_column), labels, named_query.name

    spec = source["orm"]
    if _contains_raw(spec):
        raise BannerSourceError("raw SQL fragments are not allowed in a banner's ORM spec")
    models = _orm_spec_models(spec)
    if not models:
        raise BannerSourceError(f"ORM spec model '{spec.get('from')}' not found")
    if not _user_may_read(user, models):
        raise PermissionError(spec.get("from"))
    stmt = jm_build_orm_query_from_spec(spec)
    if stmt is None:
        raise BannerSourceError("the ORM spec could not be built")

    def resolve_column(key):
        model_name, _dot, column_name = key.rpartition(".")
        return _resolve_orm_column(model_name or spec.get("from"), column_name)

    # WHERE conditions added after the spec's group_by still filter the rows before grouping.
    for clause in build_rule_clauses(rules, resolve_column):
        stmt = stmt.where(clause)
    return stmt, {}, None


# ---------------------------------------------------------------------------
# Execution
# ---------------------------------------------------------------------------


def _plain(value: Any) -> Any:
    """Return *value* as a JSON-ready Python value (numpy scalars, NaN, timestamps)."""
    if hasattr(value, "item") and not isinstance(value, (str, bytes)):
        try:
            value = value.item()
        except (ValueError, TypeError):
            pass
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if hasattr(value, "to_pydatetime"):
        return value.to_pydatetime().isoformat()
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def _execute(stmt: Any, session: Any, jm_log_message: str):
    """Run *stmt* with :func:`jm_execute_orm` and return its result DataFrame."""
    _rset, results_df, _cursor, _connection, ok = jm_execute_orm(
        None, None, stmt,
        jm_log_message=jm_log_message,
        session=session,
        commit_session=False,
        readable_df_values_with_entity_names=False,
        log_level=3,
    )
    if not ok:
        jm_log(1, f"{jm_log_message}: the query failed — see the previous log lines.")
    return results_df


def _columns(banner: dict, row_keys: list[str], labels: dict) -> list[dict]:
    """Return the ``{key, label}`` columns the expanded banner shows for each row.

    ``display_fields`` entries are field keys or ``{"key", "label"}`` objects.
    Without them, the first three columns other than the identifiers are shown.
    """
    configured = banner.get("display_fields") or [
        key for key in row_keys if key not in ("id", "eid") and not key.startswith("_")
    ][:3]
    columns = []
    for entry in configured:
        key = entry.get("key") if isinstance(entry, dict) else entry
        label = (entry.get("label") if isinstance(entry, dict) else None) or labels.get(key)
        columns.append({"key": key, "label": label or jm_pretty_df_column_names([key])[0]})
    return columns


def banner_data(banner: dict, session: Any, user: Optional[dict]) -> Optional[dict]:
    """Return the browser payload of one banner: its settings, count, columns and rows.

    :return: None when the banner can't be shown to *user* (no read access, or a
        source that can't be queried, which is logged).
    """
    try:
        stmt, labels, source_resource = build_banner_query(banner, session, user)
    except PermissionError:
        jm_log(3, f"banner_data: '{banner['key']}' hidden — the user may not read '{banner['source']}'.")
        return None
    except BannerSourceError as source_error:
        jm_log(1, f"banner_data: banner '{banner['key']}' can't be queried: {source_error}")
        return None

    count_df = _execute(
        select(func.count()).select_from(stmt.order_by(None).subquery()),
        session, f"banner_data: count of banner '{banner['key']}'",
    )
    count = int(_plain(count_df.iloc[0, 0])) if not count_df.empty else 0

    rows_df = _execute(stmt.limit(int(banner.get("max_rows") or 50)), session,
                       f"banner_data: rows of banner '{banner['key']}'")
    rows = [{key: _plain(value) for key, value in record.items()} for record in rows_df.to_dict("records")]
    for row in rows:
        row.setdefault("eid", row.get("id"))

    payload = {key: banner.get(key) for key in _PUBLIC_KEYS}
    payload["row_resource"] = banner.get("row_resource") or source_resource
    payload["view_all_resource"] = banner.get("view_all_resource") or payload["row_resource"]
    payload.update({"count": count, "columns": _columns(banner, list(rows_df.columns), labels), "rows": rows})
    return payload


def banners_for_page(session: Any, user: Optional[dict], resource: Optional[str] = None,
                     module: Optional[str] = None, site: Optional[str] = None) -> list[dict]:
    """Return the payloads of the banners shown on one page, highest priority first.

    Banners with no rows are left out unless their ``hide_when_empty`` is false.
    """
    payloads = []
    for banner in get_banner_definitions().values():
        if not banner_applies(banner, resource, module, site):
            continue
        payload = banner_data(banner, session, user)
        if payload is None or (payload["count"] == 0 and payload.get("hide_when_empty", True)):
            continue
        payloads.append(payload)
    payloads.sort(key=lambda payload: (-(payload.get("priority") or 0), payload["key"]))
    jm_log(3, f"banners_for_page: resource={resource} module={module} site={site} -> {len(payloads)} banner(s)")
    return payloads
