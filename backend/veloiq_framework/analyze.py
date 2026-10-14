"""Server-side aggregation of the Analyze section, for lists above the row threshold.

Below ``analyze_server_aggregation_threshold`` rows (``[views]`` of veloiq.toml,
System Configuration) the browser downloads the rows and aggregates them itself.
Above it, the browser asks ``POST /api/<resource>/analyze`` (see crud.py) for the
aggregated values instead, and this module computes them with the same rules:

* rows are filtered as the browser filters them -- the list's query-param filters
  (applied in SQL by the caller), then the search text and the column filters, which
  are ported here from the frontend (applyGlobalSearch / matchesColumnFilterValue);
* rows are grouped by the raw values of Categories 1-3 and each series is summarised
  with ``jm_summarize_values`` (the rules the frontend's summarizeValues applies);
* the Top N / Bottom N ranking keeps the same groups;
* the statistics are those of the back of the Analyze card.

Groups are keyed by raw category values and returned with the display titles of the
referenced records they hold, so the browser labels them with the same formatting code
it uses for rows it aggregates itself.
"""
from __future__ import annotations

from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence

from veloiq_framework.utils.views_utils import (
    JM_DEFAULT_SUMMARY_FUNCTION,
    jm_normalize_summary_function,
    jm_summarize_values,
)

# Synthetic series that counts rows (the frontend's COUNT_SERIES_KEY).
COUNT_SERIES_KEY = "__count__"
# Statistics list categorical value counts only below this many distinct values
# (the frontend's buildStatsSummary rule).
MAX_DISTINCT_CATEGORICAL_STATS = 20


def js_text(value: Any) -> str:
    """Text of a value as JavaScript's ``String(value)`` gives it (``1.0`` -> ``"1"``,
    ``True`` -> ``"true"``), so search and filter matching agree with the browser."""
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float):
        if value != value:
            return "NaN"
        if value.is_integer():
            return str(int(value))
    return str(value)


def row_matches_search(row: dict, query: str, field_keys: Sequence[str],
                       reference_titles: Dict[str, Dict[str, str]]) -> bool:
    """True when ``query`` (case-insensitive) is contained in the row's title, in any
    field value, or in the title of any record a reference field points to -- the
    browser's applyGlobalSearch."""
    query = (query or "").strip().lower()
    if not query:
        return True
    candidates: List[Any] = [row.get("_label")]
    for key in field_keys:
        value = row.get(key)
        candidates.append(value)
        if key in reference_titles and value is not None:
            title = reference_titles[key].get(js_text(value))
            if title:
                candidates.append(title)
    return any(candidate is not None and query in js_text(candidate).lower() for candidate in candidates)


def _decode_range(encoded: str, prefix: str):
    from urllib.parse import unquote
    rest = encoded[len(prefix):]
    separator = rest.index(":")
    return unquote(rest[:separator]), unquote(rest[separator + 1:])


def row_matches_column_filter(field: dict, row: dict, value: Any, pk_field: Optional[str]) -> bool:
    """True when ``row`` matches one selected column-filter value -- the browser's
    matchesColumnFilterValue, including its range-encoded buckets
    (``__range__:lo:hi``, ``__daterange__:lo:hi``, ``__catrange__:lo:hi``).

    :param field: The field's metadata: ``key``, ``type`` and ``reference`` (bool).
    """
    key, field_type, is_reference = field["key"], field.get("type"), bool(field.get("reference"))
    text = js_text(value)
    is_pk = pk_field is not None and key == pk_field
    if field_type == "number" and not is_reference and text.startswith("__range__:"):
        parts = text.split(":")
        try:
            low, high, record_value = float(parts[1]), float(parts[2]), float(row.get(key))
        except (TypeError, ValueError, IndexError):
            return False
        return low <= record_value <= high
    if field_type in ("date", "datetime") and text.startswith("__daterange__:"):
        low, high = _decode_range(text, "__daterange__:")
        record_value = js_text(row.get(key) if row.get(key) is not None else "")[:10]
        return low <= record_value <= high
    if field_type == "string" and not is_reference and text.startswith("__catrange__:"):
        low, high = _decode_range(text, "__catrange__:")
        record_value = js_text(row.get(key) if row.get(key) is not None else "")
        return low.casefold() <= record_value.casefold() <= high.casefold()
    if is_pk and text.startswith("__catrange__:"):
        low, high = _decode_range(text, "__catrange__:")
        record_label = js_text(row.get("_label") or "")
        return low.casefold() <= record_label.casefold() <= high.casefold()
    if is_pk and row.get("_label"):
        return js_text(row.get("_label")) == text or js_text(row.get(key)) == text
    return js_text(row.get(key)) == text


def _evenly_spaced(items: Sequence[Any], size: int) -> List[Any]:
    """At most ``size`` items, evenly spaced over ``items`` (all of them when fewer)."""
    if size <= 0 or len(items) <= size:
        return list(items)
    step = len(items) / size
    return [items[int(index * step)] for index in range(size)]


def jm_analyze_rows(rows: List[dict], *, fields: List[dict], pk_field: Optional[str],
                    category_keys: Sequence[Optional[str]], series_keys: Sequence[str],
                    summary_function: str = JM_DEFAULT_SUMMARY_FUNCTION,
                    ranking_mode: str = "none", ranking_key: Optional[str] = None, ranking_n: int = 10,
                    search: str = "", column_filters: Optional[Dict[str, List[Any]]] = None,
                    reference_titles: Optional[Dict[str, Dict[str, str]]] = None,
                    stats_keys: Sequence[str] = (), sample_size: int = 10000,
                    category_title: Optional[Callable[[str, Any], str]] = None) -> dict:
    """
    Aggregate rows for the Analyze section, with the browser's rules.

    :param rows: The rows matching the list's query-param filters, as dicts (with ``_label``).
    :param fields: Metadata of every field: dicts with ``key``, ``type`` and ``reference`` (bool).
    :param pk_field: The model's primary-key field.
    :param category_keys: Category 1, 2 and 3 field keys (empty ones are skipped).
    :param series_keys: Numeric series to summarise (COUNT_SERIES_KEY counts rows).
    :param summary_function: sum, avg, count, max, min or stddev.
    :param ranking_mode: "none", "top" or "bottom".
    :param ranking_key: Numeric field the ranking sorts groups by.
    :param ranking_n: How many groups the ranking keeps.
    :param search: The list's search text.
    :param column_filters: Selected column-filter values by field key (OR within a field, AND across).
    :param reference_titles: Titles of referenced records, by field key then ``js_text(id)``.
    :param stats_keys: Fields summarised on the statistics side (the visible list columns).
    :param sample_size: Most rows returned as a sample, for charts that plot individual rows.
    :param category_title: Optional callable(field_key, raw value) -> title, used to order
        tied groups by label; defaults to the referenced record's title or the value's text.
    :return: dict with ``total_rows``, ``groups`` (``key``: raw category values, ``values``:
        summaries by series key), ``sample_rows``, ``stats`` (``numeric``: summaries by field,
        ``categorical``: raw value counts by field) and ``reference_titles``.
    """
    reference_titles = reference_titles or {}
    fields_by_key = {field["key"]: field for field in fields}
    field_keys = [field["key"] for field in fields]
    summary_function = jm_normalize_summary_function(summary_function)

    # Filters the browser applies on top of the list's own filters.
    if search and search.strip():
        rows = [row for row in rows if row_matches_search(row, search, field_keys, reference_titles)]
    for key, selected in (column_filters or {}).items():
        field = fields_by_key.get(key)
        if not field or not selected:
            continue
        rows = [row for row in rows if any(row_matches_column_filter(field, row, value, pk_field) for value in selected)]

    categories = [key for key in category_keys if key]
    numeric_series = [key for key in series_keys if key != COUNT_SERIES_KEY]
    aggregation_keys = list(dict.fromkeys(list(series_keys) + ([ranking_key] if ranking_key else [])))

    def group_key(row: dict) -> tuple:
        return tuple(js_text(row.get(key)) if row.get(key) is not None else None for key in categories)

    groups: Dict[tuple, dict] = {}
    group_rows: Dict[tuple, List[int]] = {}
    for index, row in enumerate(rows):
        key = group_key(row)
        if key not in groups:
            groups[key] = {"key": [row.get(category) for category in categories],
                           "values_raw": {series: [] for series in aggregation_keys}}
            group_rows[key] = []
        group_rows[key].append(index)
        for series in aggregation_keys:
            groups[key]["values_raw"][series].append(1 if series == COUNT_SERIES_KEY else row.get(series))
    summarized = []
    for key, group in groups.items():
        summarized.append({
            "group_id": key,
            "key": group["key"],
            "values": {series: jm_summarize_values(values, summary_function)
                       for series, values in group["values_raw"].items()},
        })

    def title_of(category: str, value: Any) -> str:
        if category_title is not None:
            return category_title(category, value)
        if value is None:
            return "-"
        return reference_titles.get(category, {}).get(js_text(value)) or js_text(value)

    if ranking_mode in ("top", "bottom") and ranking_key:
        limit = max(1, int(ranking_n or 10))
        label_of = lambda group: " • ".join(title_of(category, value) for category, value in zip(categories, group["key"]))
        summarized.sort(key=lambda group: (-group["values"].get(ranking_key, 0) if ranking_mode == "top"
                                           else group["values"].get(ranking_key, 0), label_of(group)))
        summarized = summarized[:limit]

    kept_rows = sorted(index for group in summarized for index in group_rows[group["group_id"]])
    sample_columns = list(dict.fromkeys(["_label"] + ([pk_field] if pk_field else []) + categories + numeric_series))
    sample_rows = [{column: rows[index].get(column) for column in sample_columns}
                   for index in _evenly_spaced(kept_rows, sample_size)]

    numeric_stats, categorical_stats = {}, {}
    for key in stats_keys:
        field = fields_by_key.get(key)
        if not field:
            continue
        if field.get("type") == "number" and not field.get("reference"):
            values = [row.get(key) for row in rows]
            has_values = any(value is not None and value != "" for value in values)
            numeric_stats[key] = {name: (jm_summarize_values(values, name) if has_values else None)
                                  for name in ("sum", "avg", "min", "max", "stddev")}
        else:
            counts: Dict[str, list] = {}
            for row in rows:
                value = row.get(key)
                entry = counts.setdefault(js_text(value) if value is not None else "\x00null", [value, 0])
                entry[1] += 1
                if len(counts) > 10 * MAX_DISTINCT_CATEGORICAL_STATS:
                    break
            if len(counts) <= 10 * MAX_DISTINCT_CATEGORICAL_STATS:
                categorical_stats[key] = [[value, count] for value, count in counts.values()]

    return {
        "total_rows": len(rows),
        "groups": [{"key": group["key"], "values": group["values"]} for group in summarized],
        "sample_rows": sample_rows,
        "stats": {"numeric": numeric_stats, "categorical": categorical_stats},
        "reference_titles": reference_titles,
    }


def reference_titles_for(rows: Iterable[dict], reference_fields: Dict[str, type], session,
                         title_of: Callable[[Any], str]) -> Dict[str, Dict[str, str]]:
    """
    Titles of the records the rows' reference fields point to, by field key then
    ``js_text(id)`` -- what the browser shows (and searches) for a reference value.

    :param rows: Row dicts.
    :param reference_fields: Reference field key -> referenced SQLModel class.
    :param session: An open database session.
    :param title_of: Callable returning a record's title (build_model_str_label).
    """
    from sqlalchemy import inspect as sa_inspect
    from sqlmodel import select

    rows = list(rows)
    titles: Dict[str, Dict[str, str]] = {}
    for key, model in reference_fields.items():
        ids = {row.get(key) for row in rows if row.get(key) is not None}
        if not ids:
            continue
        pk_column = sa_inspect(model).primary_key[0]
        titles[key] = {}
        id_list = list(ids)
        for start in range(0, len(id_list), 500):
            for record in session.exec(select(model).where(pk_column.in_(id_list[start:start + 500]))).all():
                titles[key][js_text(getattr(record, pk_column.key))] = title_of(record)
    return titles
