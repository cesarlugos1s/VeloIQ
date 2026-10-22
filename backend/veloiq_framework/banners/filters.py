"""Server-side form of the Dynamic List's "Advanced filters" rules.

A banner whose source is a model or a named query selects its objects with the
same rules the list page's Advanced filters panel builds, so a rule can be
copied from a saved list view into ``banners.json`` unchanged::

    {"fieldKey": "status", "operator": "equals", "value": "Open"}
    {"fieldKey": "hours", "operator": "between", "value": 2, "value2": 8}
    {"fieldKey": "due_date", "operator": "before",
     "value": {"mode": "relative", "direction": "next", "count": 1, "unit": "weeks"}}

Operators, as in the Advanced filters panel:

* text: ``contains`` (case-insensitive), ``equals``
* number: ``eq``, ``gt``, ``gte``, ``lt``, ``lte``, ``between``
* date: ``on``, ``after``, ``before``, ``between`` (absolute or relative dates)
* boolean: ``is``

All rules must match (AND), like on the list page. A rule's ``value`` may also
be a list, which matches when any of its values matches (OR), so one rule can
select several values of the same field.
"""
from __future__ import annotations

import calendar
from datetime import datetime, timedelta
from typing import Any, Callable, Optional

from sqlalchemy import and_, false, or_

from veloiq_framework.utils.views_utils import jm_log

# Operators whose rule compares numbers.
_NUMBER_OPERATORS = {"eq": "__eq__", "gt": "__gt__", "gte": "__ge__", "lt": "__lt__", "lte": "__le__"}


def _shift(base: datetime, unit: str, count: int) -> datetime:
    """Return *base* moved by *count* units (negative moves back).

    :param unit: ``days``, ``weeks``, ``months``, ``quarters`` or ``years``.
    """
    if unit == "days":
        return base + timedelta(days=count)
    if unit == "weeks":
        return base + timedelta(weeks=count)
    months = {"months": count, "quarters": count * 3, "years": count * 12}.get(unit, 0)
    month_index = base.month - 1 + months
    year = base.year + month_index // 12
    month = month_index % 12 + 1
    day = min(base.day, calendar.monthrange(year, month)[1])
    return base.replace(year=year, month=month, day=day)


def _unit_range(anchor: datetime, unit: str) -> tuple[datetime, datetime]:
    """Return the start and end of the *unit* (day, week, month...) containing *anchor*.

    Weeks start on Sunday, as dayjs' ``startOf("week")`` does on the list page.
    """
    day_start = anchor.replace(hour=0, minute=0, second=0, microsecond=0)
    if unit == "days":
        start = day_start
        end = start + timedelta(days=1)
    elif unit == "weeks":
        start = day_start - timedelta(days=(day_start.weekday() + 1) % 7)
        end = start + timedelta(weeks=1)
    elif unit == "months":
        start = day_start.replace(day=1)
        end = _shift(start, "months", 1)
    elif unit == "quarters":
        start = day_start.replace(day=1, month=(day_start.month - 1) // 3 * 3 + 1)
        end = _shift(start, "months", 3)
    else:
        start = day_start.replace(day=1, month=1)
        end = _shift(start, "years", 1)
    return start, end - timedelta(microseconds=1)


def resolve_relative_date(value: dict, as_range: bool, now: Optional[datetime] = None) -> dict:
    """Resolve a relative date rule value the way the list page does.

    :param value: ``{"mode": "relative", "direction": "previous" | "current" | "next",
        "count": n, "unit": "days" | "weeks" | "months" | "quarters" | "years"}``.
    :param as_range: Return ``{"start", "end"}`` of the whole unit instead of ``{"date"}``.
    :param now: The reference time (defaults to now); for tests.
    """
    base = now or datetime.now()
    count = int(value.get("count") or 1)
    direction = value.get("direction") or "next"
    unit = value.get("unit") or "weeks"
    step = 0 if direction == "current" else (-count if direction == "previous" else count)
    target = _shift(base, unit, step)
    start, end = _unit_range(target, unit)
    if as_range or direction == "current":
        return {"start": start, "end": end}
    return {"date": start}


def _absolute_date(value: Any) -> Optional[datetime]:
    """Return the datetime of an absolute rule date (``{"date": iso}`` or an ISO string)."""
    raw = value.get("date") if isinstance(value, dict) else value
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        jm_log(1, f"banner filters: '{raw}' is not an ISO date — rule ignored.")
        return None


def _date_range(value: Any) -> Optional[tuple[datetime, datetime]]:
    """Return the start and end of the day (or relative unit) a rule date names."""
    if isinstance(value, dict) and value.get("mode") == "relative":
        resolved = resolve_relative_date(value, as_range=True)
        return resolved["start"], resolved["end"]
    date = _absolute_date(value)
    return _unit_range(date, "days") if date else None


def _single_clause(column: Any, operator: str, value: Any, value2: Any) -> Any:
    """Return the SQL condition of one rule value, or None when it can't be built."""
    if operator == "contains":
        return column.ilike(f"%{value}%")
    if operator == "equals":
        return column == value
    if operator == "is":
        return column == bool(value)
    if operator in _NUMBER_OPERATORS:
        return getattr(column, _NUMBER_OPERATORS[operator])(value)
    if operator == "between":
        if isinstance(value, (int, float)) and isinstance(value2, (int, float)):
            return and_(column >= value, column <= value2)
        start, end = _date_range(value), _date_range(value2)
        return and_(column >= start[0], column <= end[1]) if start and end else None
    if operator in ("on", "after", "before"):
        day = _date_range(value)
        if day is None:
            return None
        if operator == "on":
            return and_(column >= day[0], column <= day[1])
        if operator == "after":
            return column > day[1]
        if isinstance(value, dict) and value.get("mode") == "relative":
            # A relative "before" compares against the unit's first day, like the list page.
            return column < resolve_relative_date(value, as_range=False)["date"]
        return column < day[0]
    return None


def build_rule_clauses(rules: list[dict], resolve_column: Callable[[str], Any]) -> list:
    """Return the SQL conditions of Advanced-filter *rules*.

    :param rules: The banner's ``filters``.
    :param resolve_column: Returns the ORM column for a rule's ``fieldKey``, or None.
    :return: One condition per usable rule. A rule naming an unknown field
        yields ``false()`` so a misconfigured banner selects nothing instead of
        everything; incomplete rules are skipped, as on the list page.
    """
    clauses = []
    for rule in rules or []:
        field_key = rule.get("fieldKey")
        operator = rule.get("operator")
        value = rule.get("value")
        if not field_key or not operator or value is None or value == "":
            continue
        column = resolve_column(field_key)
        if column is None:
            jm_log(1, f"banner filters: unknown field '{field_key}' — the banner selects no rows.")
            clauses.append(false())
            continue
        values = value if isinstance(value, list) else [value]
        parts = [_single_clause(column, operator, item, rule.get("value2")) for item in values]
        parts = [part for part in parts if part is not None]
        if not parts:
            jm_log(1, f"banner filters: rule on '{field_key}' with operator '{operator}' is not supported — ignored.")
            continue
        clauses.append(parts[0] if len(parts) == 1 else or_(*parts))
    return clauses
