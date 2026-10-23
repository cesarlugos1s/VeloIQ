"""List queries over the rows of a non-model data resource: filters, search, sort and paging.

The query parameters are those of the model CRUD router
(:func:`veloiq_framework.crud._build_where_clauses`), applied in memory:

* ``?field=value``        exact match
* ``?field__in=1,2,3``    one of the values
* ``?field__ilike=value`` / ``?field_like=value``  case-insensitive contains
* ``?field_ne=value``     not equal
* ``?field_gte=value`` / ``?field_lte=value``      ranges
* ``?q=value``            case-insensitive contains in any text field
* ``?_sort=a,b&_order=asc,desc``  sort (several keys, as Refine's simple-rest sends them)
* ``?_start=0&_end=25``   paging

Values are compared with the field's type, so ``?rate_gte=10`` compares numbers.
"""
from __future__ import annotations

import datetime as _dt
import hashlib
import json
from typing import Any, Iterable, Mapping, Optional

from .non_model_data_resource_definitions import NonModelDataField, NonModelDataResource
from .encode_decode_row_eid import row_key_value_as_text

#: Operator suffixes of the list query parameters, longest first so ``__ilike`` wins over ``_like``.
_FILTER_OPERATOR_SUFFIXES = ("__ilike", "__in", "_like", "_gte", "_lte", "_ne")
#: Query-string text of the two boolean values (JSON literals, as the browser sends them).
_BOOLEAN_QUERY_TEXT_VALUES = {"true": True, "false": False, "1": True, "0": False}


def compute_row_revision(row: Mapping[str, Any]) -> str:
    """Return a short hash of a stored row, changing whenever any of its values changes."""
    stored = {key: value for key, value in row.items() if key not in ("eid", "id", "_revision")}
    canonical = json.dumps(stored, sort_keys=True, default=str, ensure_ascii=False)
    return hashlib.sha1(canonical.encode("utf-8")).hexdigest()[:16]


def value_as_field_type(field: Optional[NonModelDataField], value: Any) -> Any:
    """Return *value* (often query-string text) as the field's type, for comparisons.

    A value that can't be converted is returned unchanged, so it is compared as text.
    """
    if field is None or value is None:
        return value
    try:
        if field.type == "number":
            return value if isinstance(value, (int, float)) and not isinstance(value, bool) else float(value)
        if field.type == "boolean":
            return value if isinstance(value, bool) else _BOOLEAN_QUERY_TEXT_VALUES.get(str(value).strip().lower(), value)
        if field.type in ("date", "datetime"):
            text = str(value).replace("Z", "+00:00")
            parsed = _dt.datetime.fromisoformat(text)
            return parsed.date() if field.type == "date" else parsed.replace(tzinfo=None)
    except (TypeError, ValueError):
        return value
    return value


def _comparable_sort_key(field: Optional[NonModelDataField], value: Any) -> tuple[int, Any]:
    """Return a sort/compare key: typed values first, then text, with ``None`` last."""
    typed = value_as_field_type(field, value)
    if typed is None or typed == "":
        return (2, "")
    if isinstance(typed, (int, float, _dt.date, _dt.datetime)) and not isinstance(typed, bool):
        return (0, typed)
    if isinstance(typed, bool):
        return (0, int(typed))
    return (1, row_key_value_as_text(typed).lower())


def _row_matches_condition(row: dict, field: Optional[NonModelDataField], key: str, operator: str, value: str) -> bool:
    """True when the row's value of *key* satisfies ``operator value``.

    For a multi-value field (a list), the condition holds when any value
    satisfies it (``_ne``: when no value equals it).
    """
    cell = row.get(key)
    if isinstance(cell, (list, tuple)):
        if operator == "_ne":
            return not any(_row_matches_condition({key: item}, field, key, "", value) for item in cell)
        return any(_row_matches_condition({key: item}, field, key, operator, value) for item in cell)
    if operator == "__in":
        wanted = [part.strip() for part in str(value).split(",") if part.strip()]
        return any(_comparable_sort_key(field, cell) == _comparable_sort_key(field, part) for part in wanted)
    if operator in ("__ilike", "_like"):
        return str(value).lower() in row_key_value_as_text(cell).lower()
    left, right = _comparable_sort_key(field, cell), _comparable_sort_key(field, value)
    if operator == "_ne":
        return left != right
    if left[0] != right[0]:
        # Different kinds (a number against text, or an empty value) never match.
        return False
    if operator == "_gte":
        return left[1] >= right[1]
    if operator == "_lte":
        return left[1] <= right[1]
    return left == right


def filter_rows_by_query_parameters(data_resource: NonModelDataResource, rows: Iterable[dict], params: Mapping[str, Any]) -> list[dict]:
    """Return the rows matching the list query parameters (paging and sort excluded)."""
    known = {f.key: f for f in data_resource.fields}
    known.setdefault("eid", None)
    conditions: list[tuple[str, str, str]] = []
    search = ""
    for name, value in params.items():
        if name.startswith("_") or value is None or value == "":
            continue
        if name == "q":
            search = str(value).lower()
            continue
        if name in known:
            conditions.append((name, "", str(value)))
            continue
        for suffix in _FILTER_OPERATOR_SUFFIXES:
            if name.endswith(suffix) and name[: -len(suffix)] in known:
                conditions.append((name[: -len(suffix)], suffix, str(value)))
                break
    text_keys = [f.key for f in data_resource.fields if f.type == "string"]
    result = []
    for row in rows:
        if search and not any(search in row_key_value_as_text(row.get(key)).lower() for key in text_keys):
            continue
        if all(_row_matches_condition(row, known.get(key), key, operator, value) for key, operator, value in conditions):
            result.append(row)
    return result


def sort_rows_by_query_parameters(data_resource: NonModelDataResource, rows: list[dict], sort: Optional[str], order: Optional[str]) -> list[dict]:
    """Return *rows* sorted by the ``_sort``/``_order`` parameters, or by the resource's default sort."""
    keys = [key.strip() for key in (sort or "").split(",") if key.strip()]
    orders = [value.strip().lower() for value in (order or "").split(",") if value.strip()]
    if not keys and data_resource.default_sort:
        keys, orders = [data_resource.default_sort[0]], [data_resource.default_sort[1]]
    result = list(rows)
    # Stable sorts applied from the last key to the first give a multi-key sort.
    for index in range(len(keys) - 1, -1, -1):
        key = keys[index]
        descending = (orders[index] if index < len(orders) else "asc") == "desc"
        field = data_resource.get_field_by_key(key)
        result.sort(key=lambda row: _comparable_sort_key(field, row.get(key)), reverse=descending)
        if descending:
            # Keep rows without a value last in both directions.
            result = ([row for row in result if _comparable_sort_key(field, row.get(key))[0] != 2]
                      + [row for row in result if _comparable_sort_key(field, row.get(key))[0] == 2])
    return result


def slice_rows_page(rows: list[dict], start: int, end: int) -> list[dict]:
    """Return the rows of the page ``[start, end)``."""
    start = max(0, start)
    return rows[start:max(start, end)]
