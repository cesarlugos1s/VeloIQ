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

from datetime import datetime
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
        mapper = sa_inspect(model)
        pk_column = mapper.primary_key[0]
        # The attribute holding the key is not always named like its column (``eid`` for ``cw_eid``).
        pk_attribute = mapper.get_property_by_column(pk_column).key
        titles[key] = {}
        id_list = list(ids)
        for start in range(0, len(id_list), 500):
            for record in session.exec(select(model).where(pk_column.in_(id_list[start:start + 500]))).all():
                titles[key][js_text(getattr(record, pk_attribute))] = title_of(record)
    return titles


# ── Advanced filter rules (the list's "Advanced filters"), ported from the frontend ──────────

def _month_start(moment: "datetime") -> "datetime":
    """First instant of the month of ``moment``."""
    return moment.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _shift_months(moment: "datetime", months: int) -> "datetime":
    """``moment`` moved by ``months`` calendar months (the day is clamped to the month's length)."""
    from calendar import monthrange
    index = moment.year * 12 + (moment.month - 1) + months
    year, month = divmod(index, 12)
    month += 1
    return moment.replace(year=year, month=month, day=min(moment.day, monthrange(year, month)[1]))


def _unit_bounds(moment: "datetime", unit: str) -> "tuple[datetime, datetime]":
    """First and last instants of the day, week (Sunday first, as dayjs), month, quarter or year of ``moment``."""
    from datetime import timedelta
    day_start = moment.replace(hour=0, minute=0, second=0, microsecond=0)
    last_microsecond = timedelta(microseconds=1)
    if unit in ("week", "weeks"):
        start = day_start - timedelta(days=(day_start.weekday() + 1) % 7)
        return start, start + timedelta(days=7) - last_microsecond
    if unit in ("month", "months"):
        start = _month_start(moment)
        return start, _shift_months(start, 1) - last_microsecond
    if unit in ("quarter", "quarters"):
        start = _month_start(_shift_months(moment, -((moment.month - 1) % 3)))
        return start, _shift_months(start, 3) - last_microsecond
    if unit in ("year", "years"):
        start = day_start.replace(month=1, day=1)
        return start, start.replace(year=start.year + 1) - last_microsecond
    return day_start, day_start + timedelta(days=1) - last_microsecond


def resolve_relative_date(value: Optional[dict], as_range: bool, now: Optional["datetime"] = None) -> dict:
    """Resolve a relative date of an advanced filter rule ("next 2 weeks", "current quarter"...).

    Returns ``{"start", "end"}`` when ``as_range`` is set or the direction is "current",
    otherwise ``{"date"}`` -- the frontend's resolveRelativeDate.
    """
    from datetime import datetime, timedelta
    value = value or {}
    base = now or datetime.now()
    count = int(value.get("count") if value.get("count") is not None else 1)
    direction = value.get("direction") or "next"
    unit = value.get("unit") or "weeks"
    sign = -1 if direction == "previous" else 1

    def shifted() -> "datetime":
        if direction == "current":
            return base
        if unit == "quarters":
            return _shift_months(base, sign * count * 3)
        if unit == "months":
            return _shift_months(base, sign * count)
        if unit == "years":
            return _shift_months(base, sign * count * 12)
        return base + timedelta(days=sign * count * (7 if unit == "weeks" else 1))

    anchor = shifted()
    start, end = _unit_bounds(anchor, unit)
    if as_range or direction == "current":
        return {"start": start, "end": end}
    return {"date": start}


def _to_naive_datetime(value: Any) -> "Optional[datetime]":
    """A date, datetime or ISO text as a naive local datetime, or None when it is not a date."""
    from datetime import date, datetime
    if isinstance(value, datetime):
        moment = value
    elif isinstance(value, date):
        moment = datetime(value.year, value.month, value.day)
    elif isinstance(value, str) and value.strip():
        try:
            from dateutil.parser import isoparse
            moment = isoparse(value.strip())
        except (ValueError, OverflowError):
            return None
    else:
        return None
    return moment.astimezone().replace(tzinfo=None) if moment.tzinfo else moment


def _rule_date_range(value: Any, as_range: bool) -> dict:
    """An advanced filter rule's date value as a range or one date (relative or absolute)."""
    if isinstance(value, dict) and value.get("mode") == "relative":
        return resolve_relative_date(value, as_range)
    moment = _to_naive_datetime(value.get("date") if isinstance(value, dict) else value)
    if moment is None:
        return {}
    start, end = _unit_bounds(moment, "day")
    return {"start": start, "end": end} if as_range else {"date": start}


def row_matches_advanced_filter_rule(field: dict, row: dict, rule: dict,
                                     reference_titles: Optional[Dict[str, Dict[str, str]]] = None) -> bool:
    """True when ``row`` satisfies one advanced filter rule -- the browser's list ``matchesRule``.

    :param field: The rule's field metadata: ``key``, ``type``, ``reference`` (bool) and
        optionally ``options`` (``[{"value", "label"}]``).
    :param rule: ``{"fieldKey", "operator", "value", "value2"}`` as the advanced filter builder saves it.
    :param reference_titles: Titles of the records reference fields point to, per field key.
    """
    operator = rule.get("operator")
    if not field or not operator:
        return True
    raw = row.get(field["key"])
    if raw is None:
        return False
    if field.get("reference"):
        raw = ((reference_titles or {}).get(field["key"], {})).get(js_text(raw)) or raw
    elif field.get("options"):
        raw = next((option.get("label") for option in field["options"] if option and option.get("value") == raw), None) or raw
    field_type = field.get("type")

    if field_type == "string":
        target = js_text(rule.get("value") if rule.get("value") is not None else "").lower()
        if not target:
            return True
        text = js_text(raw).lower()
        if operator == "contains":
            return target in text
        if operator == "equals":
            return text == target
        return True

    if field_type == "number":
        try:
            number = float(raw)
        except (TypeError, ValueError):
            return False

        def as_number(value: Any) -> Optional[float]:
            try:
                return float(value)
            except (TypeError, ValueError):
                return None

        target, target2 = as_number(rule.get("value")), as_number(rule.get("value2"))
        if operator == "between":
            return target is not None and target2 is not None and target <= number <= target2
        comparisons = {"eq": lambda a, b: a == b, "gt": lambda a, b: a > b, "gte": lambda a, b: a >= b,
                       "lt": lambda a, b: a < b, "lte": lambda a, b: a <= b}
        if operator in comparisons:
            return target is not None and comparisons[operator](number, target)
        return True

    if field_type == "boolean":
        return bool(raw) == bool(rule.get("value")) if operator == "is" else True

    if field_type in ("date", "datetime"):
        moment = _to_naive_datetime(raw)
        if moment is None:
            return False
        if operator == "on":
            window = _rule_date_range(rule.get("value"), True)
            return bool(window) and window["start"] <= moment <= window["end"]
        if operator in ("after", "before"):
            target = _rule_date_range(rule.get("value"), False).get("date")
            if target is None:
                return False
            day_start, day_end = _unit_bounds(target, "day")
            return moment > day_end if operator == "after" else moment < day_start
        if operator == "between":
            first = _rule_date_range(rule.get("value"), True)
            last = _rule_date_range(rule.get("value2"), True)
            if not first or not last:
                return False
            return first["start"] <= moment <= last["end"]
        return True
    return True


# ── Categorical breakdown (the rows of a categorical summary card), ported from the frontend ─────

#: A summary card lists every distinct value while there are fewer than this many (the frontend's
#: CATEGORICAL_BREAKDOWN_DISTINCT_THRESHOLD).
CATEGORICAL_BREAKDOWN_DISTINCT_THRESHOLD = 5


def build_categorical_breakdown(counts: Dict[str, int], others_label: str,
                                threshold: int = CATEGORICAL_BREAKDOWN_DISTINCT_THRESHOLD) -> List[dict]:
    """The rows of a categorical summary card: the values with the highest counts (descending, at
    most ``threshold - 1``), then one row grouping all the remaining values when there are more
    distinct values than fit -- the frontend's buildCategoricalBreakdown.

    Each row is ``{"value", "count"}``; the grouping row also has ``"is_others": True``.
    """
    ranked = sorted(({"value": value, "count": count} for value, count in counts.items()),
                    key=lambda entry: entry["count"], reverse=True)
    if len(ranked) < threshold:
        return ranked
    shown = ranked[:threshold - 1]
    others = sum(entry["count"] for entry in ranked[threshold - 1:])
    return shown + [{"value": others_label, "count": others, "is_others": True}]
