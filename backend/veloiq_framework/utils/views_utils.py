"""VeloIQ-native ``views_utils`` substrate for the ported NLP engine.

Functions/constants below are extracted verbatim from JuiceMantics'
``app/utils/views_utils.py`` (the HTML/df/chart rendering subset the engine
reaches). They run unchanged against VeloIQ; only the module header is curated
(app.* imports dropped, engine resolved lazily, optional deps guarded).
"""
import decimal, json, random, html, re, time, sys, os, colorsys
from math import ceil
from pathlib import Path
from typing import Dict, Any, List, Optional
import requests
import numpy as np
import pandas
from pandas import pivot_table, DataFrame, concat
from markupsafe import Markup
from plotly import offline as pyo
from plotly import graph_objects as go
from plotly.subplots import make_subplots
try:
    from statsmodels.tsa.seasonal import seasonal_decompose
except Exception:
    seasonal_decompose = None
from sqlmodel import Session, SQLModel, text
try:
    from colorama import Fore, Style, init
except Exception:
    class _NoColor:
        def __getattr__(self, _n): return ""
    Fore = Style = _NoColor()
    def init(*a, **k): pass

from veloiq_framework.utils.i18n_utils import _
from veloiq_framework.utils.data_mgmt_utils import (
    absolute_url, jm_action_db_query_prefix, jm_rowcount, pre_save, jm_obtain_config,
    jm_log,
    jm_identify_date_period_columns, jm_obtain_model_by_name,
    jm_extract_column_names_from_SQL, replace_query_results_with_object_labels,
    _parse_entity_type_from_column,
)
def resolve_dashboard_view_type(raw: Optional[str]) -> str:
    normalized = str(raw or "").strip().lower()
    normalized = normalized.replace("_", "").replace("-", "").replace(" ", "")
    normalized = normalized.removesuffix("view")
    if normalized == "primary":
        return "primary"
    if normalized in {"gallery", "image"}:
        return "gallery"
    if normalized in {"editabletable", "editable", "muledit"}:
        # muledit is a legacy CubicWeb multi-edit view; render it as the
        # (read-only) table view — inline editing is a frontend concern.
        return "editable-table"
    if normalized == "list":
        return "list"
    if normalized == "csv":
        return "csv"
    if normalized in {"totalsdetails", "totaldetails"}:
        return "totals-details"
    # Pass through custom page names (e.g. "custom_show_mechanism_results")
    raw_trimmed = str(raw or "").strip()
    if raw_trimmed and re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', raw_trimmed):
        return raw_trimmed
    return "table"


DYNAMIC_RESOURCE_FONT_STACK = (
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, "
    "'Helvetica Neue', Arial, 'Noto Sans', sans-serif"
)


DASHBOARD_WIDGET_BASE_STYLE = (
    "background-color:var(--jm-bg,#fff);"
    f"font-family:{DYNAMIC_RESOURCE_FONT_STACK};"
    "font-size:14px;"
    "line-height:1.5715;"
)


DASHBOARD_TONE_SOLID = "#2563eb"


DASHBOARD_TONE_SOFT = "#dbeafe"


DASHBOARD_TONE_SOFTER = "#eff6ff"


DASHBOARD_TONE_TEXT = "#1e3a8a"


DASHBOARD_TEXT_PRIMARY = "#0f172a"


DASHBOARD_TEXT_SECONDARY = "#475569"


DASHBOARD_BORDER = "#dbe3ef"


JM_CSS_VARS_ROOT = """
<style>
:root {
  --jm-bg: #ffffff;
  --jm-bg-secondary: #f5fbff;
  --jm-bg-tertiary: #f3f6f9;
  --jm-bg-elevated: #ffffff;
  --jm-text-primary: #0f172a;
  --jm-text-secondary: #475569;
  --jm-text-tertiary: #6b7280;
  --jm-text-link: #1677FF;
  --jm-border: #dbe3ef;
  --jm-border-secondary: #d1d5db;
  --jm-border-cell: #eef2f7;
  --jm-separator: #e0e0e0;
  --jm-card-bg: #ffffff;
  --jm-card-border: #cfe0eb;
  --jm-card-header-from: #f5fbff;
  --jm-card-header-to: #eff8ff;
  --jm-card-shadow: rgba(18, 47, 64, 0.10);
  --jm-card-back-bg: #f8fcff;
  --jm-card-back-border: #e2eef6;
  --jm-btn-bg: #fff;
  --jm-btn-border: #d9d9d9;
  --jm-btn-text: rgba(0,0,0,0.88);
  --jm-btn-hover-bg: #ffffff;
  --jm-input-bg: #ffffff;
  --jm-input-text: #111111;
  --jm-input-placeholder: #9aa7b5;
  --jm-input-editable-bg: #f3f6f9;
  --jm-kpi-banner-bg: #F2FFFF;
  --jm-kpi-user-bg: #d6f0ff;
  --jm-kpi-ask-bg: #edf7ff;
  --jm-kpi-label: #3f5565;
  --jm-kpi-value: #1677FF;
  --jm-kpi-paragraph: #333;
  --jm-tone-soft: #dbeafe;
  --jm-tone-softer: #eff6ff;
  --jm-carousel-btn-bg: #ffffff;
  --jm-carousel-btn-text: #456277;
  --jm-carousel-btn-border: #b8d0e0;
  --jm-carousel-active-bg: #eaf5ff;
  --jm-carousel-active-border: #8eb3ca;
  --jm-carousel-active-text: #194f6f;
  --jm-carousel-header-from: #f6fafc;
  --jm-carousel-header-to: #eef5f8;
  --jm-filter-popover-bg: #fff;
  --jm-filter-popover-shadow: rgba(17,24,39,.16);
  --jm-sort-arrow: #9ca3af;
  --jm-filter-icon: #6b7280;
  --jm-numeric-bar: rgba(37,99,235,.16);
  --jm-no-results: #6b7280;
}

/* Dark-mode overrides — applied via data attribute (iframes) or body class (inline) */
:root[data-jm-dark],
body.jm-dark {
  --jm-bg: #141414;
  --jm-bg-secondary: #1a1a2e;
  --jm-bg-tertiary: #1f1f33;
  --jm-bg-elevated: #1c1c1c;
  --jm-text-primary: #e4e4e7;
  --jm-text-secondary: #a1a1aa;
  --jm-text-tertiary: #71717a;
  --jm-text-link: #4ea4f6;
  --jm-border: #2e2e3a;
  --jm-border-secondary: #3f3f50;
  --jm-border-cell: #232336;
  --jm-separator: #2e2e3a;
  --jm-card-bg: #1c1c2e;
  --jm-card-border: #2e3d4f;
  --jm-card-header-from: #1a1a2e;
  --jm-card-header-to: #1e2230;
  --jm-card-shadow: rgba(0, 0, 0, 0.30);
  --jm-card-back-bg: #181828;
  --jm-card-back-border: #2a2a40;
  --jm-btn-bg: #23233a;
  --jm-btn-border: #3f3f50;
  --jm-btn-text: rgba(228,228,231,0.88);
  --jm-btn-hover-bg: #2a2a44;
  --jm-input-bg: #1a1a2e;
  --jm-input-text: #e4e4e7;
  --jm-input-placeholder: #6b6b80;
  --jm-input-editable-bg: #1f1f33;
  --jm-kpi-banner-bg: #141828;
  --jm-kpi-user-bg: #162030;
  --jm-kpi-ask-bg: #161e30;
  --jm-kpi-label: #8fa4b5;
  --jm-kpi-value: #4ea4f6;
  --jm-kpi-paragraph: #b0b0c0;
  --jm-tone-soft: #1e2a40;
  --jm-tone-softer: #181e30;
  --jm-carousel-btn-bg: #23233a;
  --jm-carousel-btn-text: #8fa4b5;
  --jm-carousel-btn-border: #2e3d4f;
  --jm-carousel-active-bg: #1a2840;
  --jm-carousel-active-border: #3a5570;
  --jm-carousel-active-text: #a0c8e8;
  --jm-carousel-header-from: #1a1a2e;
  --jm-carousel-header-to: #1e2230;
  --jm-filter-popover-bg: #1c1c2e;
  --jm-filter-popover-shadow: rgba(0,0,0,.40);
  --jm-sort-arrow: #6b6b80;
  --jm-filter-icon: #71717a;
  --jm-numeric-bar: rgba(78,164,246,.20);
  --jm-no-results: #71717a;
}
</style>
"""


def _split_select_columns(select_clause: str) -> List[str]:
    """Split a SELECT projection by commas, ignoring commas inside parentheses."""
    parts: List[str] = []
    depth = 0
    current: List[str] = []
    for ch in select_clause:
        if ch == "(":
            depth += 1
            current.append(ch)
        elif ch == ")":
            depth -= 1
            current.append(ch)
        elif ch == "," and depth == 0:
            parts.append("".join(current))
            current = []
        else:
            current.append(ch)
    if current:
        parts.append("".join(current))
    return parts


def _derive_display_column_names(sql_statement: str, alias_columns: List[str]) -> List[str]:
    """
    Return display-friendly header labels for *alias_columns*.

    For each SQL alias the function looks up the original field expression
    (the part before AS), strips any table-alias prefix (e.g. ``t1.``) and
    the ``cw_`` column-name prefix, then checks whether that base name is
    unique across the whole projection.  If it is unique the base name is
    used as the display label (and will be translated by i18n).  If two or
    more projected columns share the same base name the original SQL alias is
    kept so headers stay unambiguous.

    Expressions that contain parentheses (aggregate functions, casts, …) are
    never simplified — their alias is always kept as-is.

    Falls back gracefully to the raw alias list when the SQL cannot be parsed.
    """
    if not sql_statement or not alias_columns:
        return list(alias_columns)

    sql_clean = sql_statement.replace("\n", " ").replace("\r", " ")
    select_match = re.search(r"(?i)SELECT\s+(.+?)\s+FROM\b", sql_clean, re.DOTALL)
    if not select_match:
        return list(alias_columns)

    parts = _split_select_columns(select_match.group(1))

    alias_to_field: Dict[str, str] = {}
    for part in parts:
        part = part.strip()
        as_match = re.search(r"(?i)\bAS\s+(\w+)\s*$", part)
        if not as_match:
            continue
        alias = as_match.group(1).lower()
        expr = part[: as_match.start()].strip()
        # Skip expressions containing function calls
        if "(" in expr:
            continue
        # Strip table-alias prefix and grab the rightmost identifier
        field_match = re.search(r"(?:[\w]+\.)?(\w+)\s*$", expr)
        if not field_match:
            continue
        raw_field = field_match.group(1).lower()
        base_field = raw_field[3:] if raw_field.startswith("cw_") else raw_field
        alias_to_field[alias] = base_field

    from collections import Counter
    field_count = Counter(alias_to_field.values())

    display_names: List[str] = []
    for alias in alias_columns:
        base_field = alias_to_field.get(alias.lower())
        if base_field and field_count[base_field] == 1:
            display_names.append(base_field)
        else:
            display_names.append(alias)
    return display_names


def serialize_query_rset_rows(sql_rset: Any) -> tuple[list[str], list[Dict[str, Any]]]:
    rows = list(getattr(sql_rset, "rset", None) or [])
    columns: List[str] = []
    rset_df = getattr(sql_rset, "rset_df", None)
    rset_df_columns = getattr(rset_df, "columns", None)
    if rset_df_columns is not None:
        columns = [str(column) for column in list(rset_df_columns)]
    if not columns:
        query_command = str(getattr(sql_rset, "query_command", "") or "")
        extracted_columns = jm_extract_column_names_from_SQL(query_command)
        if extracted_columns:
            columns = [str(column) for column in extracted_columns]
    serialized_rows: List[Dict[str, Any]] = []

    for row in rows:
        if hasattr(row, "_mapping"):
            mapping = dict(row._mapping)
            if not columns:
                columns = [str(k) for k in mapping.keys()]
            row_values = list(mapping.values())
        elif isinstance(row, (list, tuple)):
            row_values = list(row)
            if not columns:
                columns = [f"col_{idx + 1}" for idx in range(len(row_values))]
        else:
            row_values = [row]
            if not columns:
                columns = ["value"]

        if len(row_values) > len(columns):
            columns.extend([f"col_{idx + 1}" for idx in range(len(columns), len(row_values))])
        elif len(row_values) < len(columns):
            row_values.extend([None] * (len(columns) - len(row_values)))

        serialized_rows.append({columns[idx]: row_values[idx] for idx in range(len(columns))})

    return columns, serialized_rows


def _looks_like_anchor_html(value: Any) -> bool:
    return isinstance(value, str) and value.strip().lower().startswith("<a ")


def _render_cell_html(value: Any) -> str:
    if value is None:
        return ""
    if _looks_like_anchor_html(value):
        return str(value)
    return html.escape(str(value))


def _try_parse_numeric_value(value: Any) -> Optional[float]:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float, decimal.Decimal)):
        numeric_value = float(value)
        if np.isfinite(numeric_value):
            return numeric_value
        return None
    if _looks_like_anchor_html(value):
        return None
    text_value = str(value).strip()
    if text_value == "":
        return None
    normalized = text_value.replace(",", "").replace("$", "").replace("%", "")
    if normalized.startswith("(") and normalized.endswith(")"):
        normalized = "-" + normalized[1:-1]
    try:
        numeric_value = float(normalized)
        if np.isfinite(numeric_value):
            return numeric_value
        return None
    except (TypeError, ValueError):
        return None


def _identify_numeric_column_max_abs(
        sql_columns: List[str],
        sql_rows: List[Dict[str, Any]],
) -> Dict[str, float]:
    numeric_max_by_column: Dict[str, float] = {}
    for column in sql_columns:
        non_empty_count = 0
        numeric_values: List[float] = []
        for row in sql_rows:
            raw_value = row.get(column, None)
            if raw_value in (None, ""):
                continue
            non_empty_count += 1
            parsed_value = _try_parse_numeric_value(raw_value)
            if parsed_value is not None:
                numeric_values.append(parsed_value)
        if non_empty_count == 0 or len(numeric_values) == 0:
            continue
        # Keep numeric bars only when the column is mostly numeric.
        if len(numeric_values) / max(non_empty_count, 1) < 0.8:
            continue
        numeric_max_by_column[column] = max(abs(value) for value in numeric_values)
    return numeric_max_by_column


def _render_searchable_paginated_table_html(
        sql_columns: List[str],
        sql_rows: List[Dict[str, Any]],
        widget_prefix: str = "jm_dash_table",
        search_placeholder: Optional[str] = None,
        display_columns: Optional[List[str]] = None,
) -> str:
    widget_id = f"{widget_prefix}_{random.randint(1, 10_000_000)}"
    header_labels = display_columns if display_columns and len(display_columns) == len(sql_columns) else sql_columns
    normalized_columns = [html.escape(_(str(col))) for col in header_labels]
    numeric_max_by_column = _identify_numeric_column_max_abs(sql_columns, sql_rows)

    table_headers = "".join(
        (
            '<th>'
            '<div class="jm-header-cell">'
            f'<button type="button" class="jm-sort-btn" data-col-index="{column_idx}">'
            f'<span class="jm-sort-label">{column_label}</span>'
            '<span class="jm-sort-indicator">'
            '<span class="jm-sort-up"></span>'
            '<span class="jm-sort-down"></span>'
            '</span>'
            '</button>'
            f'<button type="button" class="jm-filter-btn" data-col-index="{column_idx}" '
            f'title="{_("Filter")}">'
            '<svg class="jm-filter-icon" viewBox="0 0 16 16" aria-hidden="true">'
            '<path d="M2 3h12L9.5 8v4l-3 1V8L2 3z"></path>'
            '</svg>'
            '</button>'
            f'<div class="jm-filter-popover" data-col-index="{column_idx}">'
            f'<div class="jm-col-filter-options" data-col-index="{column_idx}"></div>'
            f'<button type="button" class="jm-filter-clear" data-col-index="{column_idx}">{_("Clear")}</button>'
            '</div>'
            '</div>'
            '</th>'
        )
        for column_idx, column_label in enumerate(normalized_columns)
    )

    table_rows = ""
    for row in sql_rows:
        row_cells_html: List[str] = []
        for column in sql_columns:
            raw_value = row.get(column, "")
            rendered_value = _render_cell_html(raw_value)
            text_value = _extract_text_from_html(raw_value)
            sort_numeric = _try_parse_numeric_value(raw_value)
            sort_value = str(sort_numeric) if sort_numeric is not None else text_value.lower()
            cell_inner_html = rendered_value

            if column in numeric_max_by_column and sort_numeric is not None:
                max_abs = numeric_max_by_column[column]
                ratio = min(1.0, abs(sort_numeric) / max_abs) if max_abs > 0 else 0
                cell_inner_html = (
                    '<div class="jm-numeric-cell">'
                    f'<div class="jm-numeric-bar" style="width:{ratio * 100:.2f}%;"></div>'
                    f'<span class="jm-numeric-text">{rendered_value}</span>'
                    '</div>'
                )

            row_cells_html.append(
                (
                    f'<td data-filter-value="{html.escape(text_value.lower())}" '
                    f'data-filter-raw="{html.escape(text_value)}" '
                    f'data-sort-value="{html.escape(sort_value)}" '
                    f'data-sort-type="{"number" if sort_numeric is not None else "text"}">'
                    f"{cell_inner_html}"
                    "</td>"
                )
            )
        table_rows += f"<tr>{''.join(row_cells_html)}</tr>"

    placeholder = search_placeholder or _("Search table rows...")
    return (
        f'<div id="{widget_id}" style="{DASHBOARD_WIDGET_BASE_STYLE}">'
        '<div class="jm-toolbar">'
        f'<input type="text" class="jm-search" placeholder="{placeholder}" />'
        '</div>'
        '<div class="jm-table-wrap">'
        '<table class="jm-table">'
        f'<thead><tr class="jm-header-row">{table_headers}</tr></thead>'
        f"<tbody>{table_rows}</tbody>"
        "</table>"
        '</div>'
        '<div class="jm-pagination">'
        f'<button type="button" class="jm-prev">{_("Prev")}</button>'
        '<span class="jm-page-info"></span>'
        f'<button type="button" class="jm-next">{_("Next")}</button>'
        '<select class="jm-page-size">'
        '<option value="10">10</option><option value="20">20</option>'
        '<option value="50">50</option><option value="100">100</option>'
        '</select>'
        "</div>"
        "<script>"
        "(function(){"
        f"const root=document.getElementById('{widget_id}'); if(!root) return;"
        "const search=root.querySelector('.jm-search');"
        "const pageSizeSel=root.querySelector('.jm-page-size');"
        "const prevBtn=root.querySelector('.jm-prev');"
        "const nextBtn=root.querySelector('.jm-next');"
        "const info=root.querySelector('.jm-page-info');"
        "const tbody=root.querySelector('tbody');"
        "const rows=Array.from(tbody.querySelectorAll('tr'));"
        "const rowOrder=new Map(rows.map((row,idx)=>[row,idx]));"
        "const sortButtons=Array.from(root.querySelectorAll('.jm-sort-btn'));"
        "const filterButtons=Array.from(root.querySelectorAll('.jm-filter-btn'));"
        "const filterPopovers=Array.from(root.querySelectorAll('.jm-filter-popover'));"
        "const filterOptionContainers=Array.from(root.querySelectorAll('.jm-col-filter-options'));"
        "const filterClearButtons=Array.from(root.querySelectorAll('.jm-filter-clear'));"
        "const noResultsClass='jm-no-results';"
        "let page=1;"
        "let sortStates=[];"
        "function getFilterText(row,colIdx){"
        " const cell=row.children[colIdx]; if(!cell) return '';"
        " return String(cell.dataset.filterValue||cell.textContent||'').toLowerCase();"
        "}"
        "function getFilterRawText(row,colIdx){"
        " const cell=row.children[colIdx]; if(!cell) return '';"
        " return String(cell.dataset.filterRaw||cell.textContent||'').trim();"
        "}"
        "function getSortValue(row,colIdx){"
        " const cell=row.children[colIdx]; if(!cell) return {type:'text',value:''};"
        " const type=cell.dataset.sortType||'text';"
        " const raw=String(cell.dataset.sortValue||'');"
        " if(type==='number'){ const num=Number(raw); return {type:'number',value:Number.isFinite(num)?num:0}; }"
        " return {type:'text',value:raw.toLowerCase()};"
        "}"
        "function getSortStateIndex(colIdx){"
        " return sortStates.findIndex((state)=>state.index===colIdx);"
        "}"
        "function cycleSortDirection(direction){"
        " if(direction===1) return -1;"
        " if(direction===-1) return 0;"
        " return 1;"
        "}"
        "function compareSortPair(left,right,direction){"
        " if(left.type==='number' && right.type==='number'){"
        "  if(left.value===right.value) return 0;"
        "  return left.value>right.value?direction:-direction;"
        " }"
        " if(left.value===right.value) return 0;"
        " return left.value>right.value?direction:-direction;"
        "}"
        "function closeAllPopovers(){"
        " filterPopovers.forEach((pop)=>pop.classList.remove('open'));"
        "}"
        "function getSelectedValuesForColumn(colIdx){"
        " const container=filterOptionContainers[colIdx];"
        " if(!container) return [];"
        " return Array.from(container.querySelectorAll('.jm-col-filter-checkbox:checked'))"
        "  .map((input)=>String(input.value||'').trim())"
        "  .filter(Boolean);"
        "}"
        "function updateFilterButtonStates(){"
        " filterButtons.forEach((button,idx)=>{"
        "  const selected=getSelectedValuesForColumn(idx);"
        "  if(selected.length>0) button.classList.add('active');"
        "  else button.classList.remove('active');"
        " });"
        "}"
        "function initializeFilterOptions(){"
        " filterOptionContainers.forEach((container,idx)=>{"
        "  const values=[];"
        "  const seen=new Set();"
        "  rows.forEach((row)=>{"
        "   const raw=getFilterRawText(row,idx);"
        "   if(!raw || seen.has(raw)) return;"
        "   seen.add(raw); values.push(raw);"
        "  });"
        "  values.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}));"
        "  values.forEach((value)=>{"
        "   const label=document.createElement('label');"
        "   label.className='jm-filter-option';"
        "   const input=document.createElement('input');"
        "   input.type='checkbox'; input.className='jm-col-filter-checkbox'; input.value=value;"
        "   const span=document.createElement('span');"
        "   span.textContent=value;"
        "   label.appendChild(input);"
        "   label.appendChild(span);"
        "   container.appendChild(label);"
        "  });"
        " });"
        "}"
        "function applyFilters(){"
        " const q=(search.value||'').toLowerCase().trim();"
        " const colValues=filterOptionContainers.map((_,idx)=>getSelectedValuesForColumn(idx));"
        " return rows.filter((row)=>{"
        "  const rowText=(row.textContent||'').toLowerCase();"
        "  if(q && !rowText.includes(q)) return false;"
        "  for(let i=0;i<colValues.length;i++){"
        "   const selectedValues=colValues[i];"
        "   if(selectedValues.length>0 && !selectedValues.includes(getFilterRawText(row,i))) return false;"
        "  }"
        "  return true;"
        " });"
        "}"
        "function sortRows(filteredRows){"
        " if(sortStates.length===0) return filteredRows.slice();"
        " return filteredRows.slice().sort((a,b)=>{"
        "  for(let i=0;i<sortStates.length;i++){"
        "   const state=sortStates[i];"
        "   const left=getSortValue(a,state.index);"
        "   const right=getSortValue(b,state.index);"
        "   const compared=compareSortPair(left,right,state.direction);"
        "   if(compared!==0) return compared;"
        "  }"
        "  return (rowOrder.get(a)||0)-(rowOrder.get(b)||0);"
        " });"
        "}"
        "function updateSortIndicators(){"
        " sortButtons.forEach((btn,idx)=>{"
        "  const up=btn.querySelector('.jm-sort-up');"
        "  const down=btn.querySelector('.jm-sort-down');"
        "  if(!up || !down) return;"
        "  up.classList.remove('active');"
        "  down.classList.remove('active');"
        "  const stateIdx=getSortStateIndex(idx);"
        "  if(stateIdx===-1) return;"
        "  const direction=sortStates[stateIdx].direction;"
        "  if(direction>0) up.classList.add('active');"
        "  if(direction<0) down.classList.add('active');"
        " });"
        "}"
        "function render(){"
        " const pageSize=parseInt(pageSizeSel.value||'10',10);"
        " const filtered=applyFilters();"
        " const sorted=sortRows(filtered);"
        " const pages=Math.max(1,Math.ceil(sorted.length/pageSize));"
        " if(page>pages) page=pages;"
        " const start=(page-1)*pageSize; const end=start+pageSize;"
        " const visible=sorted.slice(start,end);"
        " tbody.innerHTML='';"
        " if(visible.length===0){"
        "  const tr=document.createElement('tr'); tr.className=noResultsClass;"
        "  const td=document.createElement('td'); td.colSpan=Math.max(1,sortButtons.length);"
        f"  td.textContent='{_('No matching rows')}';"
        "  tr.appendChild(td); tbody.appendChild(tr);"
        " } else { visible.forEach((row)=>tbody.appendChild(row)); }"
        f" info.textContent=`{_('Page')} ${{page}} {_('of')} ${{pages}} (${{sorted.length}} {_('rows')})`;"
        " prevBtn.disabled=page<=1; nextBtn.disabled=page>=pages;"
        " updateSortIndicators();"
        " updateFilterButtonStates();"
        "}"
        "search.addEventListener('input',()=>{page=1;render();});"
        "pageSizeSel.addEventListener('change',()=>{page=1;render();});"
        "filterButtons.forEach((button,idx)=>button.addEventListener('click',(event)=>{"
        " event.preventDefault(); event.stopPropagation();"
        " const pop=filterPopovers[idx];"
        " const isOpen=pop && pop.classList.contains('open');"
        " closeAllPopovers();"
        " if(pop && !isOpen) pop.classList.add('open');"
        "}));"
        "filterOptionContainers.forEach((container)=>container.addEventListener('change',(event)=>{"
        " const target=event.target;"
        " if(target && target.classList && target.classList.contains('jm-col-filter-checkbox')){"
        "  page=1; render();"
        " }"
        "}));"
        "filterClearButtons.forEach((button,idx)=>button.addEventListener('click',(event)=>{"
        " event.preventDefault(); event.stopPropagation();"
        " const container=filterOptionContainers[idx];"
        " if(container){"
        "  Array.from(container.querySelectorAll('.jm-col-filter-checkbox')).forEach((input)=>{ input.checked=false; });"
        " }"
        " page=1; render();"
        "}));"
        "document.addEventListener('click',(event)=>{"
        " if(!root.contains(event.target)) closeAllPopovers();"
        "});"
        "sortButtons.forEach((button,idx)=>button.addEventListener('click',(event)=>{"
        " const additive=Boolean(event && (event.ctrlKey||event.metaKey));"
        " const existingIdx=getSortStateIndex(idx);"
        " const currentDirection=existingIdx>=0?sortStates[existingIdx].direction:0;"
        " const nextDirection=cycleSortDirection(currentDirection);"
        " if(!additive){"
        "  sortStates=nextDirection===0?[]:[{index:idx,direction:nextDirection}];"
        " } else if(existingIdx>=0){"
        "  if(nextDirection===0){"
        "   sortStates=sortStates.filter((state)=>state.index!==idx);"
        "  } else {"
        "   sortStates=sortStates"
        "    .filter((state)=>state.index!==idx)"
        "    .concat([{index:idx,direction:nextDirection}]);"
        "  }"
        " } else if(nextDirection!==0){"
        "  sortStates=sortStates.concat([{index:idx,direction:nextDirection}]);"
        " }"
        " page=1; render();"
        "}));"
        "prevBtn.addEventListener('click',()=>{if(page>1){page--;render();}});"
        "nextBtn.addEventListener('click',()=>{page++;render();});"
        "initializeFilterOptions();"
        "render();"
        "})();"
        "</script>"
        "<style>"
        f"#{widget_id} * {{ box-sizing:border-box; font-family:{DYNAMIC_RESOURCE_FONT_STACK} !important; font-size:12px !important; }}"
        f"#{widget_id} .jm-toolbar {{ margin-bottom:10px; }}"
        f"#{widget_id} .jm-search {{ width:100%; padding:6px 8px; border:1px solid var(--jm-border,{DASHBOARD_BORDER}); border-radius:8px; line-height:1.4; color:var(--jm-text-primary,{DASHBOARD_TEXT_PRIMARY}); background:var(--jm-input-bg,#fff); }}"
        f"#{widget_id} .jm-search:focus {{ outline:none; border-color:{DASHBOARD_TONE_SOLID}; box-shadow:0 0 0 2px rgba(37,99,235,.12); }}"
        f"#{widget_id} .jm-table-wrap {{ overflow:auto; background:var(--jm-bg,#fff); border:1px solid var(--jm-border,{DASHBOARD_BORDER}); border-radius:8px; }}"
        f"#{widget_id} .jm-table {{ width:100%; border-collapse:separate; border-spacing:0; background:var(--jm-bg,#fff); line-height:1.45; }}"
        f"#{widget_id} .jm-table thead tr.jm-header-row th {{ position:sticky; top:0; z-index:2; background:linear-gradient(135deg, var(--jm-tone-soft,{DASHBOARD_TONE_SOFT}) 0%, var(--jm-tone-softer,{DASHBOARD_TONE_SOFTER}) 100%); color:var(--jm-text-secondary,{DASHBOARD_TEXT_SECONDARY}); border-bottom:1px solid var(--jm-border,{DASHBOARD_BORDER}); padding:0; text-align:left; }}"
        f"#{widget_id} .jm-header-cell {{ position:relative; display:flex; align-items:center; gap:6px; padding:4px 6px; }}"
        f"#{widget_id} .jm-table tbody td {{ border-bottom:1px solid var(--jm-border-cell,#eef2f7); padding:7px 8px; vertical-align:middle; color:var(--jm-text-primary,{DASHBOARD_TEXT_PRIMARY}); }}"
        f"#{widget_id} .jm-table tbody td a, "
        f"#{widget_id} .jm-table tbody td a:visited, "
        f"#{widget_id} .jm-table tbody td a:hover, "
        f"#{widget_id} .jm-table tbody td a:active {{ "
        "color:inherit !important; text-decoration:none !important; font:inherit !important; "
        "line-height:inherit !important; }"
        # Object links (dc_title → show page) opt out of the plain-text reset
        # above and render as Ant-style links (theme link colour, underline on
        # hover). Higher specificity + !important to win over the reset. Closing
        # braces are single `}` — a stray `}` would attach to the next rule's
        # selector and invalidate it.
        f"#{widget_id} .jm-table tbody td a.jm-entity-link, "
        f"#{widget_id} .jm-table tbody td a.jm-entity-link:visited, "
        f"#{widget_id} .jm-table tbody td a.jm-entity-link:active {{ "
        "color:var(--jm-text-link,#1677ff) !important; text-decoration:none !important; cursor:pointer !important; }"
        f"#{widget_id} .jm-table tbody td a.jm-entity-link:hover {{ "
        "color:var(--jm-text-link,#1677ff) !important; text-decoration:underline !important; }"
        f"#{widget_id} .jm-table tbody tr:last-child td {{ border-bottom:none; }}"
        f"#{widget_id} .jm-sort-btn {{ flex:1; min-width:0; display:flex; gap:6px; align-items:center; justify-content:space-between; border:none; background:transparent; padding:4px 2px; cursor:pointer; color:inherit; font-weight:600; text-align:left; }}"
        f"#{widget_id} .jm-sort-label {{ overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }}"
        f"#{widget_id} .jm-sort-indicator {{ display:inline-flex; flex-direction:column; align-items:center; justify-content:center; min-width:12px; gap:2px; user-select:none; }}"
        f"#{widget_id} .jm-sort-up, #{widget_id} .jm-sort-down {{ width:0; height:0; display:block; border-left:4px solid transparent; border-right:4px solid transparent; opacity:.55; }}"
        f"#{widget_id} .jm-sort-up {{ border-bottom:5px solid var(--jm-sort-arrow,#9ca3af); }}"
        f"#{widget_id} .jm-sort-down {{ border-top:5px solid var(--jm-sort-arrow,#9ca3af); }}"
        f"#{widget_id} .jm-sort-up.active {{ border-bottom-color:{DASHBOARD_TONE_SOLID}; opacity:1; }}"
        f"#{widget_id} .jm-sort-down.active {{ border-top-color:{DASHBOARD_TONE_SOLID}; opacity:1; }}"
        f"#{widget_id} .jm-filter-btn {{ width:22px; height:22px; border:1px solid var(--jm-border-secondary,#d1d5db); border-radius:8px; background:var(--jm-btn-bg,#fff); display:inline-flex; align-items:center; justify-content:center; cursor:pointer; padding:0; }}"
        f"#{widget_id} .jm-filter-btn:hover {{ border-color:{DASHBOARD_TONE_SOLID}; }}"
        f"#{widget_id} .jm-filter-btn.active {{ border-color:{DASHBOARD_TONE_SOLID}; background:var(--jm-tone-softer,{DASHBOARD_TONE_SOFTER}); }}"
        f"#{widget_id} .jm-filter-icon {{ width:12px; height:12px; fill:var(--jm-filter-icon,#6b7280); }}"
        f"#{widget_id} .jm-filter-btn.active .jm-filter-icon {{ fill:{DASHBOARD_TONE_SOLID}; }}"
        f"#{widget_id} .jm-filter-popover {{ display:none; position:absolute; right:0; top:30px; z-index:10; min-width:180px; background:var(--jm-filter-popover-bg,#fff); border:1px solid var(--jm-border-secondary,#d1d5db); border-radius:8px; box-shadow:0 8px 20px var(--jm-filter-popover-shadow,rgba(17,24,39,.16)); padding:8px; font-weight:400; color:var(--jm-text-primary,{DASHBOARD_TEXT_PRIMARY}); }}"
        f"#{widget_id} .jm-filter-popover.open {{ display:block; }}"
        f"#{widget_id} .jm-col-filter-options {{ max-height:360px; overflow:auto; border:1px solid var(--jm-border-secondary,#d1d5db); border-radius:8px; padding:8px; font-weight:400; }}"
        f"#{widget_id} .jm-filter-option {{ display:flex; align-items:center; gap:12px; font-size:24px; padding:8px; cursor:pointer; font-weight:400; line-height:1.2; }}"
        f"#{widget_id} .jm-filter-option:hover {{ background:var(--jm-tone-softer,{DASHBOARD_TONE_SOFTER}); border-radius:8px; }}"
        f"#{widget_id} .jm-filter-option input {{ margin:0; transform:none; }}"
        f"#{widget_id} .jm-filter-option span {{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:400; }}"
        f"#{widget_id} .jm-filter-clear {{ margin-top:8px; width:100%; border:1px solid var(--jm-border-secondary,#d1d5db); border-radius:8px; background:var(--jm-btn-bg,#fff); padding:5px 6px; font-size:12px; cursor:pointer; color:var(--jm-text-secondary,{DASHBOARD_TEXT_SECONDARY}); }}"
        f"#{widget_id} .jm-numeric-cell {{ position:relative; min-height:22px; }}"
        f"#{widget_id} .jm-numeric-bar {{ position:absolute; left:0; top:2px; bottom:2px; background:var(--jm-numeric-bar,rgba(37,99,235,.16)); border-radius:8px; }}"
        f"#{widget_id} .jm-numeric-text {{ position:relative; display:block; text-align:right; padding-right:2px; font-variant-numeric:tabular-nums; }}"
        f"#{widget_id} .jm-pagination {{ display:flex; gap:8px; align-items:center; margin-top:10px; }}"
        f"#{widget_id} .jm-prev, #{widget_id} .jm-next {{ border:1px solid var(--jm-border-secondary,#d1d5db); background:var(--jm-btn-bg,#fff); border-radius:8px; padding:4px 10px; cursor:pointer; color:var(--jm-text-secondary,{DASHBOARD_TEXT_SECONDARY}); }}"
        f"#{widget_id} .jm-prev:disabled, #{widget_id} .jm-next:disabled {{ opacity:.5; cursor:not-allowed; }}"
        f"#{widget_id} .jm-page-size {{ padding:4px 6px; border:1px solid var(--jm-border-secondary,#d1d5db); border-radius:8px; background:var(--jm-btn-bg,#fff); color:var(--jm-text-secondary,{DASHBOARD_TEXT_SECONDARY}); }}"
        f"#{widget_id} tr.jm-no-results td {{ color:var(--jm-no-results,#6b7280); text-align:center; padding:14px; }}"
        "</style>"
        "</div>"
    )


def _render_searchable_paginated_list_html(
        sql_columns: List[str],
        sql_rows: List[Dict[str, Any]],
        display_columns: Optional[List[str]] = None,
) -> str:
    """Render rows as a distinct vertical list (not a table grid).

    Mirrors the frontend DynamicResource "list" view
    (relations/RelatedObjectsInlineValues.tsx, viewType="list"): a vertical list
    where each record leads with its linked object title(s). Here each result row
    becomes a list item — the object-identifier cells (already linkified to
    ``<a class="jm-entity-link" …>dc_title</a>`` by _resolve_entity_eid_cells) form
    the item's linked title, and the remaining (attribute) columns are shown
    beneath as ``Label: value`` pairs. Searchable + paginated like the other
    dashboard widgets.
    """
    widget_id = f"jm_dash_list_{random.randint(1, 10_000_000)}"
    placeholder = search_placeholder = _("Search list rows...")
    header_labels = display_columns if display_columns and len(display_columns) == len(sql_columns) else sql_columns

    items_html_parts: List[str] = []
    for row in sql_rows:
        anchor_idxs = [i for i, c in enumerate(sql_columns) if _looks_like_anchor_html(row.get(c, ""))]
        if anchor_idxs:
            title_idxs = anchor_idxs
            anchor_set = set(anchor_idxs)
            detail_idxs = [i for i in range(len(sql_columns)) if i not in anchor_set]
        else:
            # No object column — lead with the first cell, detail the rest.
            title_idxs = [0] if sql_columns else []
            detail_idxs = list(range(1, len(sql_columns)))

        search_bits: List[str] = []
        title_parts: List[str] = []
        for i in title_idxs:
            raw = row.get(sql_columns[i], "")
            title_parts.append(_render_cell_html(raw))
            search_bits.append(_extract_text_from_html(raw))

        detail_parts: List[str] = []
        for i in detail_idxs:
            col = sql_columns[i]
            raw = row.get(col, "")
            text = _extract_text_from_html(raw)
            if text.strip() == "":
                continue
            label = header_labels[i] if i < len(header_labels) else col
            detail_parts.append(
                '<div class="jm-list-field">'
                f'<span class="jm-list-label">{html.escape(_(str(label)))}</span>'
                f'<span class="jm-list-value">{_render_cell_html(raw)}</span>'
                '</div>'
            )
            search_bits.append(text)

        title_html = " ".join(p for p in title_parts if p) or "&nbsp;"
        search_attr = html.escape(" ".join(search_bits).lower(), quote=True)
        items_html_parts.append(
            f'<li class="jm-list-item" data-search="{search_attr}">'
            f'<div class="jm-list-title">{title_html}</div>'
            + (f'<div class="jm-list-details">{"".join(detail_parts)}</div>' if detail_parts else "")
            + "</li>"
        )
    items_html = "".join(items_html_parts)

    # Search + pagination JS (no f-string: substitute widget id / i18n via replace
    # so the many JS/CSS braces don't need escaping).
    script = (
        "<script>(function(){"
        "const root=document.getElementById('__WID__'); if(!root) return;"
        "const search=root.querySelector('.jm-search');"
        "const pageSizeSel=root.querySelector('.jm-page-size');"
        "const prevBtn=root.querySelector('.jm-prev');"
        "const nextBtn=root.querySelector('.jm-next');"
        "const info=root.querySelector('.jm-page-info');"
        "const listEl=root.querySelector('.jm-list');"
        "const items=Array.from(listEl.querySelectorAll('.jm-list-item'));"
        "let noRes=null; let page=1;"
        "function applyFilter(){"
        " const q=(search.value||'').toLowerCase().trim();"
        " return items.filter(function(it){return !q || String(it.dataset.search||'').includes(q);});"
        "}"
        "function render(){"
        " const pageSize=parseInt(pageSizeSel.value||'10',10);"
        " const filtered=applyFilter();"
        " const pages=Math.max(1,Math.ceil(filtered.length/pageSize));"
        " if(page>pages) page=pages;"
        " const start=(page-1)*pageSize; const end=start+pageSize;"
        " items.forEach(function(it){it.style.display='none';});"
        " filtered.slice(start,end).forEach(function(it){it.style.display='';});"
        " if(filtered.length===0){"
        "  if(!noRes){noRes=document.createElement('li'); noRes.className='jm-no-results'; noRes.textContent='__NOMATCH__'; listEl.appendChild(noRes);}"
        "  noRes.style.display='';"
        " } else if(noRes){ noRes.style.display='none'; }"
        " info.textContent='__PAGE__ '+page+' __OF__ '+pages+' ('+filtered.length+' __ROWS__)';"
        " prevBtn.disabled=page<=1; nextBtn.disabled=page>=pages;"
        "}"
        "search.addEventListener('input',function(){page=1;render();});"
        "pageSizeSel.addEventListener('change',function(){page=1;render();});"
        "prevBtn.addEventListener('click',function(){if(page>1){page--;render();}});"
        "nextBtn.addEventListener('click',function(){page++;render();});"
        "render();"
        "})();</script>"
    ).replace("__WID__", widget_id) \
     .replace("__NOMATCH__", _("No matching rows")) \
     .replace("__PAGE__", _("Page")).replace("__OF__", _("of")).replace("__ROWS__", _("rows"))

    style = (
        "<style>"
        "#__WID__ * { box-sizing:border-box; font-family:inherit; }"
        "#__WID__ .jm-toolbar { margin-bottom:10px; }"
        "#__WID__ .jm-search { width:100%; padding:6px 8px; border:1px solid var(--jm-border,#dbe3ef); border-radius:8px; line-height:1.4; color:var(--jm-text-primary,#0f172a); background:var(--jm-input-bg,#fff); }"
        "#__WID__ .jm-search:focus { outline:none; border-color:#2563eb; box-shadow:0 0 0 2px rgba(37,99,235,.12); }"
        "#__WID__ .jm-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }"
        "#__WID__ .jm-list-item { border:1px solid var(--jm-border,#dbe3ef); border-radius:8px; padding:10px 12px; background:var(--jm-bg,#fff); }"
        "#__WID__ .jm-list-title { display:flex; flex-wrap:wrap; gap:10px 16px; font-size:13px; font-weight:600; color:var(--jm-text-primary,#0f172a); }"
        "#__WID__ .jm-list-details { margin-top:6px; display:flex; flex-wrap:wrap; gap:4px 18px; }"
        "#__WID__ .jm-list-field { display:flex; gap:6px; font-size:12px; }"
        "#__WID__ .jm-list-label { color:var(--jm-text-secondary,#475569); font-weight:500; }"
        "#__WID__ .jm-list-label:after { content:':'; }"
        "#__WID__ .jm-list-value { color:var(--jm-text-primary,#0f172a); }"
        "#__WID__ .jm-no-results { list-style:none; color:var(--jm-no-results,#6b7280); text-align:center; padding:14px; }"
        "#__WID__ .jm-pagination { display:flex; gap:8px; align-items:center; margin-top:10px; }"
        "#__WID__ .jm-prev, #__WID__ .jm-next { border:1px solid var(--jm-border-secondary,#d1d5db); background:var(--jm-btn-bg,#fff); border-radius:8px; padding:4px 10px; cursor:pointer; color:var(--jm-text-secondary,#475569); }"
        "#__WID__ .jm-prev:disabled, #__WID__ .jm-next:disabled { opacity:.5; cursor:not-allowed; }"
        "#__WID__ .jm-page-size { padding:4px 6px; border:1px solid var(--jm-border-secondary,#d1d5db); border-radius:8px; background:var(--jm-btn-bg,#fff); color:var(--jm-text-secondary,#475569); }"
        "</style>"
    ).replace("__WID__", widget_id)

    return (
        f'<div id="{widget_id}" style="{DASHBOARD_WIDGET_BASE_STYLE}">'
        '<div class="jm-toolbar">'
        f'<input type="text" class="jm-search" placeholder="{html.escape(placeholder)}" />'
        '</div>'
        f'<ul class="jm-list">{items_html}</ul>'
        '<div class="jm-pagination">'
        f'<button type="button" class="jm-prev">{_("Prev")}</button>'
        '<span class="jm-page-info"></span>'
        f'<button type="button" class="jm-next">{_("Next")}</button>'
        '<select class="jm-page-size">'
        '<option value="10">10</option><option value="20">20</option>'
        '<option value="50">50</option><option value="100">100</option>'
        '</select>'
        '</div>'
        + script
        + style
        + '</div>'
    )


def _extract_text_from_html(value: Any) -> str:
    text_value = str(value or "")
    text_value = re.sub(r"<[^>]+>", "", text_value)
    return html.unescape(text_value).strip()


def _parse_primary_resource_from_sql(sql_statement: str, first_column_name: str) -> Optional[str]:
    """Return the entity-type token for the first column when it encodes a CubicWeb table alias.

    Kept for callers outside _resolve_entity_eid_cells (e.g. _build_primary_items).
    For general PK resolution across all columns, use _build_pk_col_to_model_from_sql.
    """
    sql_text = str(sql_statement or "")
    col_alias = str(first_column_name or "").strip().strip('"')
    if not sql_text or not col_alias:
        return None

    # CubicWeb path: FROM cw_<type> [AS <alias>]
    alias_regex = re.compile(
        r"FROM\s+cw_([a-zA-Z0-9_]+)\s+as\s+" + re.escape(col_alias) + r"\b",
        flags=re.IGNORECASE,
    )
    alias_match = alias_regex.search(sql_text)
    if alias_match and alias_match.group(1):
        return alias_match.group(1).lower()

    generic_match = re.search(r"FROM\s+cw_([a-zA-Z0-9_]+)", sql_text, flags=re.IGNORECASE)
    if generic_match and generic_match.group(1):
        return generic_match.group(1).lower()

    return None


def _build_pk_col_to_model_from_sql(sql_statement: str) -> Dict[str, Any]:
    """Return {pk_column_name_lower: model} for every table referenced in the SQL.

    Extracts all table names from FROM and JOIN clauses, resolves each to a
    SQLModel class, and maps the model's actual primary-key column name(s) to
    that model.  This lets _resolve_entity_eid_cells identify PK columns by their
    real column name — regardless of what the developer named them (id, eid,
    task_id, pricing_policy_id, ...) — rather than by column-name heuristics.
    """
    from sqlalchemy import inspect as sa_inspect

    sql_text = str(sql_statement or "")
    if not sql_text:
        return {}

    # Collect every table name that follows FROM or JOIN (handles cw_ prefix too).
    raw_names = re.findall(
        r"(?:FROM|JOIN)\s+['\"`]?([a-zA-Z][a-zA-Z0-9_]*)['\"`]?",
        sql_text,
        flags=re.IGNORECASE,
    )

    pk_to_model: Dict[str, Any] = {}
    for raw in raw_names:
        # Strip cw_ prefix used by the CubicWeb path.
        name = raw[3:] if raw.lower().startswith("cw_") else raw
        model = jm_obtain_model_by_name(name)
        if model is None:
            continue
        try:
            for pk_col in sa_inspect(model).primary_key:
                pk_to_model[pk_col.name.lower()] = model
        except Exception:
            # Fallback: try the conventional names.
            for attr in ("id", "eid"):
                if hasattr(model, attr):
                    pk_to_model[attr] = model
                    break

    return pk_to_model


def _parse_primary_id_from_href(href: str) -> Optional[int]:
    href_text = str(href or "")
    patterns = (
        r"/show/(\d+)(?:[/?#]|$)",
        r"/file/(\d+)/content(?:[/?#]|$)",
        r"/file/(\d+)(?:[/?#]|$)",
        r"/admin/file/details/(\d+)(?:[/?#]|$)",
    )
    for pattern in patterns:
        match = re.search(pattern, href_text, flags=re.IGNORECASE)
        if match and match.group(1):
            try:
                return int(match.group(1))
            except Exception:
                pass
    return None


def _extract_anchor_meta(value: Any) -> tuple[Optional[str], Optional[str]]:
    text_value = str(value or "").strip()
    if not _looks_like_anchor_html(text_value):
        return None, None
    href_match = re.search(r'href\s*=\s*["\']([^"\']+)["\']', text_value, flags=re.IGNORECASE)
    href = href_match.group(1).strip() if href_match and href_match.group(1) else None
    label = _extract_text_from_html(text_value) or href
    return href, label


def _extract_image_url_candidate(value: Any) -> Optional[str]:
    if value is None:
        return None
    if _looks_like_anchor_html(value):
        href, _label = _extract_anchor_meta(value)
        if href and re.search(r"/file/\d+/content(?:[/?#]|$)", href, flags=re.IGNORECASE):
            return href
    text_value = str(value).strip()
    if re.search(r"\.(png|jpg|jpeg|gif|webp|bmp|svg)(?:[?#].*)?$", text_value, flags=re.IGNORECASE):
        return text_value
    if re.search(r"/file/\d+/content(?:[/?#]|$)", text_value, flags=re.IGNORECASE):
        return text_value
    return None


def _normalize_gallery_image_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    text_value = str(url).strip()
    if not text_value:
        return None
    if text_value.startswith("http://") or text_value.startswith("https://") or text_value.startswith("data:"):
        return text_value
    if text_value.startswith("/"):
        return f"http://localhost:8000{text_value}"
    return text_value


def _extract_text_label_candidate(value: Any) -> Optional[str]:
    if value is None:
        return None
    if _looks_like_anchor_html(value):
        _href, label = _extract_anchor_meta(value)
        return label
    text_value = str(value).strip()
    if not text_value:
        return None
    if text_value.startswith("http://") or text_value.startswith("https://"):
        return None
    if re.search(r"/file/\d+/content(?:[/?#]|$)", text_value, flags=re.IGNORECASE):
        return None
    if re.fullmatch(r"\d+(\.0+)?", text_value):
        return None
    return text_value


def _extract_row_eid_candidate(row: Dict[str, Any], sql_columns: List[str]) -> Optional[int]:
    preferred_keys = ("file_eid", "eid", "id")
    for key in preferred_keys:
        if key in row:
            parsed = _coerce_eid(row.get(key))
            if parsed is not None:
                return parsed

    for column in sql_columns:
        value = row.get(column)
        if value is None:
            continue
        href, _label = _extract_anchor_meta(value)
        if href:
            parsed = _parse_primary_id_from_href(href)
            if parsed is not None:
                return parsed
        parsed = _coerce_eid(value)
        if parsed is not None:
            return parsed
    return None


_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "tif", "tiff"}


def _is_image_record_like_dynamic_resource(row: Dict[str, Any]) -> bool:
    data_format = str(row.get("data_format") or "").lower()
    if data_format.startswith("image/"):
        return True
    data_name = str(row.get("data_name") or "")
    extension = data_name.split(".")[-1].lower() if "." in data_name else ""
    if extension in _IMAGE_EXTENSIONS:
        return True
    return False


def _record_has_data_like_dynamic_resource(row: Dict[str, Any]) -> bool:
    if row.get("data_present") is False:
        return False
    data_size = row.get("data_size")
    if data_size is not None:
        try:
            return float(data_size) > 0
        except Exception:
            return True
    return True


def _render_searchable_paginated_gallery_html(sql_columns: List[str], sql_rows: List[Dict[str, Any]]) -> str:
    widget_id = f"jm_dash_gallery_{random.randint(1, 10_000_000)}"
    config = jm_obtain_config()
    try:
        gallery_image_width = int(config["views"]["image_width"])
    except Exception:
        gallery_image_width = 180
    try:
        gallery_image_length = int(config["views"]["image_length"])
    except Exception:
        gallery_image_length = 140

    file_description_cache: Dict[int, Optional[str]] = {}

    def _get_file_description(file_eid: Optional[int]) -> Optional[str]:
        if file_eid is None:
            return None
        if file_eid in file_description_cache:
            return file_description_cache[file_eid]
        try:
            with Session(engine) as session:
                description_row = session.execute(
                    text("SELECT cw_description FROM cw_file WHERE cw_eid = :eid"),
                    {"eid": file_eid},
                ).first()
            description_value = (
                description_row[0] if isinstance(description_row, (list, tuple))
                else description_row
            )
            description_text = str(description_value).strip() if description_value is not None else ""
            file_description_cache[file_eid] = description_text or None
        except Exception:
            file_description_cache[file_eid] = None
        return file_description_cache[file_eid]

    cards_html = ""
    seen_gallery_keys = set()
    for row_idx, row in enumerate(sql_rows):
        row_values = [row.get(column) for column in sql_columns]
        show_url = None
        for candidate in row_values:
            href_candidate, _label_candidate = _extract_anchor_meta(candidate)
            if href_candidate:
                show_url = href_candidate
                break
        file_id = (
            _coerce_eid(row.get("file_eid"))
            or _coerce_eid(row.get("eid"))
            or _coerce_eid(row.get("id"))
            or _extract_row_eid_candidate(row, sql_columns)
        )
        if not show_url and file_id is not None:
            show_url = f"/file/show/{file_id}"

        label = None
        # Prioritize any description-like field, regardless of exact column naming.
        description_like_candidates = []
        for key, value in row.items():
            if "description" in str(key).lower():
                description_like_candidates.append(value)

        preferred_label_candidates = (
            row.get("description"),
            row.get("data_description"),
            row.get("data_name"),
            row.get("title"),
            row.get("_label"),
            row.get("name"),
        )
        for candidate in tuple(description_like_candidates) + preferred_label_candidates + tuple(row_values):
            label = _extract_text_label_candidate(candidate)
            if label:
                break
        if (not label or re.fullmatch(r"File\s+\d+", str(label).strip(), flags=re.IGNORECASE)) and file_id is not None:
            db_description = _get_file_description(file_id)
            if db_description:
                label = db_description
        if not label:
            label = f"File {file_id or row_idx + 1}"

        explicit_image_values = (
            row.get("image_url"),
            row.get("img_url"),
            row.get("content_url"),
            row.get("url"),
            row.get("src"),
        )
        image_url = None
        for candidate in explicit_image_values + tuple(row_values):
            image_url = _extract_image_url_candidate(candidate)
            if image_url:
                break

        if not image_url and file_id is not None:
            is_image = _is_image_record_like_dynamic_resource(row)
            has_data = _record_has_data_like_dynamic_resource(row)
            # DynamicResource requires image metadata; fallback to file content URL when metadata is missing.
            if (is_image and has_data) or ("data_format" not in row and "data_name" not in row):
                image_url = f"/file/{file_id}/content"

        if not image_url:
            continue

        image_url = _normalize_gallery_image_url(image_url)
        if not image_url:
            continue

        dedupe_key = str(file_id or "") + "|" + str(image_url) + "|" + str(label)
        if dedupe_key in seen_gallery_keys:
            continue
        seen_gallery_keys.add(dedupe_key)

        image_tag_html = (
            f'<img src="{html.escape(str(image_url))}" '
            f'onerror="if(this.dataset.fallbackTried!==\'1\'){{this.dataset.fallbackTried=\'1\';'
            f'if(this.src.startsWith(window.location.origin + \'/\')){{this.src=\'http://localhost:8000\'+new URL(this.src).pathname;}}}}" '
            f'style="width:{gallery_image_width}px;height:{gallery_image_length}px;object-fit:contain;display:block;" />'
        )
        image_html = (
            f'<a href="{html.escape(str(show_url))}">{image_tag_html}</a>'
            if show_url else image_tag_html
        )
        cards_html += (
            '<div class="jm-gallery-card" data-gallery-item '
            f'data-label="{html.escape(str(label).lower())}">'
            f"{image_html}"
            '<div class="jm-gallery-label">'
            + (
                f'<a href="{html.escape(str(show_url))}">{html.escape(str(label))}</a>'
                if show_url else html.escape(str(label))
            )
            + '</div>'
            "</div>"
        )

    return (
        f'<div id="{widget_id}" style="{DASHBOARD_WIDGET_BASE_STYLE}">'
        '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">'
        f'<input type="text" class="jm-search" placeholder="{_("Search gallery items...")}" '
        f'style="padding:6px;min-width:260px;border:1px solid var(--jm-border,{DASHBOARD_BORDER});border-radius:8px;color:var(--jm-text-primary,{DASHBOARD_TEXT_PRIMARY});background:var(--jm-input-bg,#fff);" />'
        '</div>'
        '<div class="jm-gallery-grid" style="display:flex;flex-wrap:wrap;gap:16px;background-color:var(--jm-bg,#fff);">'
        f"{cards_html}"
        "</div>"
        '<div style="display:flex;gap:8px;align-items:center;margin-top:8px;">'
        f'<button type="button" class="jm-prev">{_("Prev")}</button>'
        '<span class="jm-page-info"></span>'
        f'<button type="button" class="jm-next">{_("Next")}</button>'
        f'<select class="jm-page-size" style="padding:6px;border:1px solid var(--jm-border,{DASHBOARD_BORDER});border-radius:8px;color:var(--jm-text-secondary,{DASHBOARD_TEXT_SECONDARY});background:var(--jm-btn-bg,#fff);">'
        '<option value="10">10</option><option value="20">20</option>'
        '<option value="50">50</option><option value="100">100</option>'
        '</select>'
        "</div>"
        "<script>"
        "(function(){"
        f"const root=document.getElementById('{widget_id}'); if(!root) return;"
        "const search=root.querySelector('.jm-search');"
        "const pageSizeSel=root.querySelector('.jm-page-size');"
        "const prevBtn=root.querySelector('.jm-prev');"
        "const nextBtn=root.querySelector('.jm-next');"
        "const info=root.querySelector('.jm-page-info');"
        "const items=Array.from(root.querySelectorAll('[data-gallery-item]'));"
        "let page=1;"
        "function visibleItems(){"
        " const q=(search.value||'').toLowerCase().trim();"
        " return items.filter(i=>!q || (i.dataset.label||'').includes(q) || (i.textContent||'').toLowerCase().includes(q));"
        "}"
        "function render(){"
        " const pageSize=parseInt(pageSizeSel.value||'10',10);"
        " const vis=visibleItems();"
        " const pages=Math.max(1,Math.ceil(vis.length/pageSize));"
        " if(page>pages) page=pages;"
        " const start=(page-1)*pageSize; const end=start+pageSize;"
        " items.forEach(i=>i.style.display='none');"
        " vis.slice(start,end).forEach(i=>{"
        "   i.style.display='';"
        "   const iframe=i.querySelector('iframe.jm-primary-embed');"
        "   if(iframe){"
        "     resizeEmbed(iframe);"
        "     setTimeout(()=>resizeEmbed(iframe),60);"
        "   }"
        " });"
        f" info.textContent=`{_('Page')} ${{page}} {_('of')} ${{pages}} (${{vis.length}} {_('rows')})`;"
        " prevBtn.disabled=page<=1; nextBtn.disabled=page>=pages;"
        "}"
        "search.addEventListener('input',()=>{page=1;render();});"
        "pageSizeSel.addEventListener('change',()=>{page=1;render();});"
        "prevBtn.addEventListener('click',()=>{if(page>1){page--;render();}});"
        "nextBtn.addEventListener('click',()=>{page++;render();});"
        "render();"
        "})();"
        "</script>"
        '<style>'
        f'#{widget_id} .jm-gallery-card {{ width: {gallery_image_width}px; background:var(--jm-card-bg,#fff); border-radius:8px; }}'
        f'#{widget_id} .jm-gallery-label {{ margin-top: 8px; text-align: center; font-size: 13px; background-color:var(--jm-card-bg,#fff); color:var(--jm-text-secondary,{DASHBOARD_TEXT_SECONDARY}); }}'
        f'#{widget_id} .jm-gallery-label a, #{widget_id} .jm-gallery-label a:visited {{ color:{DASHBOARD_TONE_TEXT}; text-decoration:none; font-weight:600; }}'
        f'#{widget_id} .jm-prev, #{widget_id} .jm-next {{ border:1px solid var(--jm-border-secondary,#d1d5db); background:var(--jm-btn-bg,#fff); border-radius:8px; padding:4px 10px; cursor:pointer; color:var(--jm-text-secondary,{DASHBOARD_TEXT_SECONDARY}); }}'
        f'#{widget_id} * {{ font-family: inherit !important; }}'
        '</style>'
        "</div>"
    )


def _build_primary_items(sql_columns: List[str], sql_rows: List[Dict[str, Any]], sql_statement: str) -> List[Dict[str, str]]:
    first_column = sql_columns[0] if len(sql_columns) > 0 else None
    if not first_column:
        return []

    resource = _parse_primary_resource_from_sql(sql_statement, first_column)
    primary_items: List[Dict[str, str]] = []

    for row in sql_rows:
        raw_value = row.get(first_column)
        if raw_value is None or str(raw_value).strip() == "":
            continue

        href, anchor_label = _extract_anchor_meta(raw_value)
        eid = _parse_primary_id_from_href(href) if href else _coerce_eid(raw_value)
        if eid is None:
            continue

        label = anchor_label if anchor_label else _extract_text_from_html(raw_value) or str(eid)

        # Prefer the href-derived resource when an anchor is present: it comes from the
        # per-row entity lookup and is authoritative, whereas the SQL-parsed `resource`
        # reflects only the driving FROM table and can be wrong for rows whose EIDs come
        # from a join target of a different model.
        item_resource: Optional[str] = None
        if href:
            href_resource = re.search(r"/embedded/([a-zA-Z0-9_]+)/show/\d+", href, flags=re.IGNORECASE)
            if href_resource and href_resource.group(1):
                item_resource = href_resource.group(1).lower()
            else:
                href_resource = re.search(r"/([a-zA-Z0-9_]+)/show/\d+", href, flags=re.IGNORECASE)
                if href_resource and href_resource.group(1):
                    item_resource = href_resource.group(1).lower()
        if not item_resource:
            item_resource = resource

        if not item_resource:
            continue

        show_url = f"/{item_resource}/show/{eid}"
        embedded_show_url = f"/embedded/{item_resource}/show/{eid}"
        primary_items.append(
            {
                "label": label,
                "show_url": show_url,
                "embedded_show_url": embedded_show_url,
            }
        )

    return primary_items


def _render_searchable_paginated_primary_html(
        primary_items: List[Dict[str, str]],
        primary_max_height_px: Optional[int] = None,
) -> str:
    widget_id = f"jm_dash_primary_{random.randint(1, 10_000_000)}"
    open_show_tooltip = _("Open show page")
    default_embedded_show_max_height_px = 840 * 3
    try:
        embedded_show_max_height_px = int(primary_max_height_px) if primary_max_height_px is not None else default_embedded_show_max_height_px
    except (TypeError, ValueError):
        embedded_show_max_height_px = default_embedded_show_max_height_px
    if embedded_show_max_height_px <= 0:
        embedded_show_max_height_px = default_embedded_show_max_height_px
    cards_markup = []
    for item in primary_items:
        show_url = str(item.get("show_url") or "")
        show_url_js = json.dumps(show_url)
        cards_markup.append(
            (
                '<div class="jm-primary-card" data-primary-item>'
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
                f'<div class="jm-primary-label">{html.escape(str(item.get("label") or ""))}</div>'
                f'<button type="button" class="jm-open-show-btn" '
                f'title="{html.escape(str(open_show_tooltip), quote=True)}" '
                f'aria-label="{html.escape(str(open_show_tooltip), quote=True)}" '
                f'onclick=\'window.open({show_url_js}, "_blank", "noopener,noreferrer"); return false;\'>'
                '<span aria-hidden="true" class="jm-open-show-icon">↗</span>'
                '</button>'
                '</div>'
                f'<iframe title="{html.escape(str(item.get("label") or ""))}" '
                f'src="{html.escape(str(item.get("embedded_show_url") or item.get("show_url") or ""))}" '
                f'class="jm-primary-embed" data-max-height="{embedded_show_max_height_px}" '
                f'style="width:100%;max-height:{embedded_show_max_height_px}px;border:0;"></iframe>'
                '</div>'
            )
        )
    cards_html = "".join(cards_markup)

    return (
        f'<div id="{widget_id}" style="{DASHBOARD_WIDGET_BASE_STYLE}">'
        '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">'
        f'<input type="text" class="jm-search" placeholder="{_("Search primary objects...")}" '
        f'style="padding:6px;min-width:260px;border:1px solid var(--jm-border,{DASHBOARD_BORDER});border-radius:8px;color:var(--jm-text-primary,{DASHBOARD_TEXT_PRIMARY});background:var(--jm-input-bg,#fff);" />'
        '</div>'
        '<div class="jm-primary-grid" style="display:flex;flex-wrap:wrap;gap:12px;">'
        f"{cards_html}"
        '</div>'
        '<div style="display:flex;gap:8px;align-items:center;margin-top:8px;">'
        f'<button type="button" class="jm-prev">{_("Prev")}</button>'
        '<span class="jm-page-info"></span>'
        f'<button type="button" class="jm-next">{_("Next")}</button>'
        f'<select class="jm-page-size" style="padding:6px;border:1px solid var(--jm-border,{DASHBOARD_BORDER});border-radius:8px;color:var(--jm-text-secondary,{DASHBOARD_TEXT_SECONDARY});background:var(--jm-btn-bg,#fff);">'
        '<option value="10">10</option><option value="20">20</option>'
        '<option value="50">50</option><option value="100">100</option>'
        '</select>'
        "</div>"
        "<script>"
        "(function(){"
        f"const root=document.getElementById('{widget_id}'); if(!root) return;"
        "const search=root.querySelector('.jm-search');"
        "const pageSizeSel=root.querySelector('.jm-page-size');"
        "const prevBtn=root.querySelector('.jm-prev');"
        "const nextBtn=root.querySelector('.jm-next');"
        "const info=root.querySelector('.jm-page-info');"
        "const items=Array.from(root.querySelectorAll('[data-primary-item]'));"
        "const embeds=Array.from(root.querySelectorAll('iframe.jm-primary-embed'));"
        "let page=1;"
        "function resizeEmbed(iframe){"
        " try {"
        "   const maxHeight=parseInt(iframe.dataset.maxHeight||'0',10)||0;"
        "   if(maxHeight>0){"
        "     iframe.style.maxHeight=`${maxHeight}px`;"
        "   }"
        "   const prevHeight=iframe.style.height;"
        "   iframe.style.height='1px';"
        "   const doc=iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);"
        "   if(!doc || !doc.documentElement){"
        "     if(prevHeight){ iframe.style.height=prevHeight; }"
        "     return;"
        "   }"
        "   const body=doc.body;"
        "   const htmlEl=doc.documentElement;"
        "   const contentHeight=Math.max("
        "     body ? body.scrollHeight : 0,"
        "     body ? body.clientHeight : 0,"
        "     body ? body.offsetHeight : 0,"
        "     htmlEl.scrollHeight || 0,"
        "     htmlEl.clientHeight || 0,"
        "     htmlEl.offsetHeight || 0"
        "   );"
        "   if(contentHeight>0){"
        "     const finalHeight=maxHeight>0 ? Math.min(contentHeight,maxHeight) : contentHeight;"
        "     iframe.style.height=`${finalHeight}px`;"
        "   } else if(prevHeight){"
        "     iframe.style.height=prevHeight;"
        "   } else {"
        "     iframe.style.height='240px';"
        "   }"
        " } catch(e) {"
        "   if(iframe && iframe.style && iframe.style.height==='1px'){"
        "     iframe.style.height='';"
        "   }"
        "   /* Ignore resize failures (e.g., cross-origin access restrictions). */"
        " }"
        "}"
        "function scheduleResize(iframe){"
        " resizeEmbed(iframe);"
        " [120, 450, 1000, 2200, 4200, 7000].forEach((ms)=>{"
        "   setTimeout(()=>resizeEmbed(iframe),ms);"
        " });"
        "}"
        "function setupEmbeds(){"
        " embeds.forEach((iframe)=>{"
        "   iframe.addEventListener('load',()=>{"
        "     scheduleResize(iframe);"
        "   });"
        "   if(iframe.contentDocument && iframe.contentDocument.readyState==='complete'){"
        "     scheduleResize(iframe);"
        "   }"
        " });"
        "}"
        "function visibleItems(){"
        " const q=(search.value||'').toLowerCase().trim();"
        " return items.filter(i=>!q || (i.textContent||'').toLowerCase().includes(q));"
        "}"
        "function render(){"
        " const pageSize=parseInt(pageSizeSel.value||'10',10);"
        " const vis=visibleItems();"
        " const pages=Math.max(1,Math.ceil(vis.length/pageSize));"
        " if(page>pages) page=pages;"
        " const start=(page-1)*pageSize; const end=start+pageSize;"
        " items.forEach(i=>i.style.display='none');"
        " vis.slice(start,end).forEach(i=>{"
        "   i.style.display='';"
        "   const iframe=i.querySelector('iframe.jm-primary-embed');"
        "   if(iframe){"
        "     scheduleResize(iframe);"
        "   }"
        " });"
        f" info.textContent=`{_('Page')} ${{page}} {_('of')} ${{pages}} (${{vis.length}} {_('rows')})`;"
        " prevBtn.disabled=page<=1; nextBtn.disabled=page>=pages;"
        "}"
        "search.addEventListener('input',()=>{page=1;render();});"
        "pageSizeSel.addEventListener('change',()=>{page=1;render();});"
        "prevBtn.addEventListener('click',()=>{if(page>1){page--;render();}});"
        "nextBtn.addEventListener('click',()=>{page++;render();});"
        "setupEmbeds();"
        "render();"
        "})();"
        "</script>"
        '<style>'
        f'#{widget_id} .jm-primary-card {{'
        ' width: 100%;'
        f' border: 1px solid var(--jm-border,{DASHBOARD_BORDER});'
        ' border-radius: 8px;'
        ' padding: 10px;'
        ' background: var(--jm-card-bg,#fff);'
        ' box-shadow: 0 8px 20px -16px rgba(37,99,235,.35);'
        ' color: var(--jm-text-primary,#0f172a);'
        ' }}'
        f'#{widget_id} .jm-primary-label {{ font-weight: 600; color:var(--jm-text-secondary,{DASHBOARD_TEXT_SECONDARY}); }}'
        f'#{widget_id} .jm-open-show-btn {{'
        ' width: 30px;'
        ' height: 30px;'
        f' border: 1px solid var(--jm-border,{DASHBOARD_BORDER});'
        ' border-radius: 8px;'
        f' background: var(--jm-tone-softer,{DASHBOARD_TONE_SOFTER});'
        f' color: {DASHBOARD_TONE_TEXT};'
        ' display: inline-flex;'
        ' align-items: center;'
        ' justify-content: center;'
        ' cursor: pointer;'
        ' }}'
        f'#{widget_id} .jm-open-show-btn:hover {{ background: var(--jm-tone-soft,{DASHBOARD_TONE_SOFT}); border-color:{DASHBOARD_TONE_SOLID}; }}'
        f'#{widget_id} .jm-open-show-icon {{ font-size: 14px; line-height: 1; }}'
        f'#{widget_id} .jm-prev, #{widget_id} .jm-next {{ border:1px solid var(--jm-border-secondary,#d1d5db); background:var(--jm-btn-bg,#fff); border-radius:8px; padding:4px 10px; cursor:pointer; color:var(--jm-text-secondary,{DASHBOARD_TEXT_SECONDARY}); }}'
        '</style>'
        "</div>"
    )


def _coerce_eid(raw_value: Any) -> Optional[int]:
    if raw_value is None:
        return None
    if isinstance(raw_value, int):
        return raw_value
    text_value = str(raw_value).strip()
    if text_value.isdigit():
        return int(text_value)
    float_like_match = re.fullmatch(r"(\d+)\.0+", text_value)
    if float_like_match:
        return int(float_like_match.group(1))
    return None


def _resolve_entity_eid_cells(
        sql_columns: List[str],
        sql_rows: List[Dict[str, Any]],
        sql_statement: str = "",
) -> None:
    """Replace object primary-key (eid) cells with navigable, titled links.

    When a result column holds the primary key of an entity, render each cell as
    ``<a href="/{resource}/show/{eid}">{dc_title}</a>`` instead of the raw eid —
    so every view type (table, list, gallery, primary, csv, custom) shows the
    object's title and links to its show page.

    Columns are identified in two passes:
    1. Column-name heuristic: ``HORSE__id`` / ``horse_id`` → model ``horse``.
    2. SQL-aware PK lookup: for any column not matched by the heuristic, check
       whether its name is the *actual* primary-key column of a model referenced
       in the SQL FROM/JOIN clauses (via SQLAlchemy inspection).  This correctly
       handles arbitrary PK names — id, eid, task_id, pricing_policy_id, etc. —
       without relying on naming conventions.
    Mutates ``sql_rows`` in place.
    """
    if not sql_rows or not sql_columns:
        return

    # Pass 1: column-name heuristic (<type>__id / <type>_id patterns).
    col_models: Dict[str, Any] = {}
    for col in sql_columns:
        etype = _parse_entity_type_from_column(col)
        if not etype:
            continue
        model = jm_obtain_model_by_name(etype)
        if model is not None:
            col_models[col] = model

    # Pass 2: SQL-aware PK lookup for columns not resolved by pass 1.
    unresolved = [c for c in sql_columns if c not in col_models]
    if unresolved and sql_statement:
        pk_col_to_model = _build_pk_col_to_model_from_sql(sql_statement)
        for col in unresolved:
            col_key = col.strip().strip('"').lower()
            if col_key in pk_col_to_model:
                col_models[col] = pk_col_to_model[col_key]

    if not col_models:
        return

    try:
        from veloiq_framework.db import get_engine
        from veloiq_framework.models import build_model_str_label as _bsl
        with Session(get_engine()) as session:
            anchor_cache: Dict[tuple, Optional[str]] = {}
            for col, model in col_models.items():
                tablename = getattr(model, "__tablename__", None) or model.__name__.lower()
                for row in sql_rows:
                    val = row.get(col)
                    if val is None or _looks_like_anchor_html(val):
                        continue
                    eid = _coerce_eid(val)
                    if eid is None:
                        continue
                    key = (model.__name__, eid)
                    if key not in anchor_cache:
                        try:
                            entity_object = session.get(model, eid)
                        except Exception:
                            entity_object = None
                        if entity_object is None:
                            anchor_cache[key] = None
                        else:
                            # Use the framework's canonical title resolution which honours
                            # __veloiq_ui__["titleFields"], the most-derived __str__ /
                            # dc_title override, then falls back to first string field.
                            label = _bsl(entity_object)
                            anchor_cache[key] = (
                                '<a href="' + html.escape(f"/{tablename}/show/{eid}") + '"'
                                ' class="jm-entity-link"'
                                ' style="color:var(--jm-text-link,#1677ff);text-decoration:none;cursor:pointer"'
                                " onmouseover=\"this.style.textDecoration='underline'\""
                                " onmouseout=\"this.style.textDecoration='none'\">"
                                + html.escape(str(label)) + '</a>'
                            )
                    anchor = anchor_cache[key]
                    if anchor:
                        row[col] = anchor

        # Rename resolved entity columns (e.g. "pricingpolicy__eid") to the model
        # class name so the table header reads "Pricingpolicy" instead of an
        # internal SQL alias. Mutates sql_columns and the row dicts in place.
        for col, model in col_models.items():
            new_col = model.__name__
            if new_col == col:
                continue
            try:
                idx = sql_columns.index(col)
                sql_columns[idx] = new_col
                for row in sql_rows:
                    if col in row:
                        row[new_col] = row.pop(col)
            except (ValueError, Exception):
                pass
    except Exception as resolve_error:
        jm_log(1, f"_resolve_entity_eid_cells: could not resolve entity eids: {resolve_error}")
        return


def render_query_rows_as_dashboard_view_html(
        sql_columns: List[str],
        sql_rows: List[Dict[str, Any]],
        requested_view_type: Optional[str],
        sql_statement: str = "",
        primary_max_height_px: Optional[int] = None,
) -> str:
    """
    Render already-materialized SQL rows to HTML using dashboard view-type semantics.
    """
    resolved_view_type = resolve_dashboard_view_type(requested_view_type)

    if len(sql_rows) == 0:
        return "No results found for this ask. (1)."

    # Show object columns by their dc_title, linked to the show page, across all
    # view types (instead of raw primary keys). Mutates sql_rows in place.
    _resolve_entity_eid_cells(sql_columns, sql_rows, sql_statement)

    display_columns = _derive_display_column_names(sql_statement, sql_columns)

    if resolved_view_type in {"table", "editable-table", "totals-details"}:
        return _render_searchable_paginated_table_html(sql_columns, sql_rows, display_columns=display_columns)

    if resolved_view_type == "list":
        return _render_searchable_paginated_list_html(sql_columns, sql_rows, display_columns=display_columns)

    if resolved_view_type == "gallery":
        return _render_searchable_paginated_gallery_html(sql_columns, sql_rows)

    if resolved_view_type == "csv":
        csv_lines = [",".join([html.escape(str(column)) for column in sql_columns])]
        for row in sql_rows:
            csv_lines.append(",".join([_render_cell_html(row.get(column, "")) for column in sql_columns]))
        return (
            f'<div style="{DASHBOARD_WIDGET_BASE_STYLE}">'
            f"{'<br/>'.join(csv_lines)}"
            "</div>"
        )

    if resolved_view_type == "primary":
        first_column = sql_columns[0] if len(sql_columns) > 0 else None
        if first_column is None:
            return "Primary view requires at least one result column."

        # Object eids in the first column were already linkified (with dc_title)
        # by _resolve_entity_eid_cells above; _build_primary_items reads the anchors.
        primary_items = _build_primary_items(sql_columns, sql_rows, sql_statement)
        if len(primary_items) == 0:
            return "No primary objects returned."
        return _render_searchable_paginated_primary_html(
            primary_items,
            primary_max_height_px=primary_max_height_px,
        )

    # Custom page view type (e.g. "custom_show_mechanism_results") —
    # render like primary but with ?view=<page_name> appended to embedded URLs
    # so the React frontend dispatches to the correct custom component.
    _KNOWN_VIEW_TYPES = {"table", "editable-table", "totals-details", "list", "gallery", "csv", "primary"}
    if resolved_view_type not in _KNOWN_VIEW_TYPES:
        primary_items = _build_primary_items(sql_columns, sql_rows, sql_statement)
        if len(primary_items) > 0:
            view_param = html.escape(resolved_view_type, quote=True)
            for item in primary_items:
                url = item.get("embedded_show_url", "")
                if url:
                    sep = "&" if "?" in url else "?"
                    item["embedded_show_url"] = f"{url}{sep}view={view_param}"
            return _render_searchable_paginated_primary_html(
                primary_items,
                primary_max_height_px=primary_max_height_px,
            )
        # Fallback to table if no primary items could be built
        return _render_searchable_paginated_table_html(sql_columns, sql_rows, display_columns=display_columns)

    header_labels = display_columns if display_columns and len(display_columns) == len(sql_columns) else sql_columns
    table_headers = "".join(
        f"<th>{html.escape(_(str(col)))}</th>" for col in header_labels
    )
    table_rows = ""
    for row in sql_rows:
        row_cells = "".join(f"<td>{_render_cell_html(row.get(col, ''))}</td>" for col in sql_columns)
        table_rows += f"<tr>{row_cells}</tr>"
    return (
        f'<div style="overflow:auto; {DASHBOARD_WIDGET_BASE_STYLE}">'
        '<table style="border-collapse:collapse;width:100%; background-color:var(--jm-bg,#fff); color:var(--jm-text-primary,#0f172a); font-size:inherit; line-height:inherit; font-family:inherit;">'
        f"<thead><tr>{table_headers}</tr></thead>"
        f"<tbody>{table_rows}</tbody>"
        "</table>"
        "</div>"
    )


def render_query_results_as_dashboard_view_html(
        sql_rset: Any,
        sql_statement: str,
        requested_view_type: Optional[str],
        primary_max_height_px: Optional[int] = None,
) -> str:
    """
    Render SQL result rows to HTML using the dashboard view-type semantics:
    primary, table, editable-table, csv, list.
    """

    resolved_view_type = resolve_dashboard_view_type(requested_view_type)
    sql_columns, sql_rows = serialize_query_rset_rows(sql_rset)

    if resolved_view_type in {"table", "editable-table", "list", "csv", "primary", "totals-details"}:
        sql_rows = replace_query_results_with_object_labels(
            sql_statement or "",
            sql_columns,
            sql_rows,
        )
    return render_query_rows_as_dashboard_view_html(
        sql_columns,
        sql_rows,
        requested_view_type,
        sql_statement=sql_statement,
        primary_max_height_px=primary_max_height_px,
    )


# jm_log lives in data_mgmt_utils (imported above). It used to be duplicated here
# verbatim, which gave the two copies independent timers and produced the
# same-timestamp duplicate log lines. The single canonical definition is reused.


def jm_render_html_from_rset(view, rset, view_type, rset_type = 'SQL'):
    """
    This function creates an HTML from a resultset.
    :param view: The view class that has the __cw used to get a view.
    :param rset: The resultset that needs to be rendered.
    :param view_type: The view type that needs to be rendered.
    :param rset_type: The type or resultset, either 'RQL' or 'SQL'.

    :return: view_content with the HTML rendered for the resultset.
    """

    resolved_rset_type = str(rset_type or "RQL").strip().upper()
    if resolved_rset_type == "SQL":
        sql_statement = str(getattr(rset, "query_command", "") or "")
        try:
            return render_query_results_as_dashboard_view_html(
                rset,
                sql_statement,
                view_type,
            )
        except Exception:
            try:
                # Fallback keeps SQL rendering available even when query text is missing/invalid.
                return render_query_results_as_dashboard_view_html(
                    rset,
                    "",
                    view_type,
                )
            except Exception:
                return _('This query results cannot be rendered.')

    elif resolved_rset_type == "RQL":
        # Create a view for the legacy RQL resultset and render its HTML.
        try:
            result_entity_view = view._cw.vreg['views'].select(view_type, view._cw, rset = rset)
            view_content = result_entity_view.render()
        except:
            try:
                # if the view rendering fails using the view_type, fallback to a default view type.
                result_entity_view = view._cw.vreg['views'].select('list', view._cw, rset = rset)
                view_content = result_entity_view.render()
            except:
                if rset and rset.rowcount > 0 and rset.get_entity(0, 0):
                    entity = rset.get_entity(0, 0)
                    if entity:
                        pk = getattr(entity.entity, 'id', None) or getattr(entity.entity, 'eid', None) or '?'
                        view_content = _('The entity ID is:') + ' ' + str(pk)
                else:
                    view_content = _('The entity ID cannot be found, the results are empty.')

        return view_content

    return _('The resultset type is not supported for HTML rendering.')


def _jm_guard_duplicate_plotly_container_ids(html_embeddable_plot: str) -> str:
    """
    Guard against duplicated Plotly container ids in malformed concatenated HTML.

    Duplicate ids break Plotly initialization because only the first matching element
    can be reliably targeted. When duplicates are detected, keep only the first chart
    block and drop trailing duplicated markup.
    """
    if not html_embeddable_plot:
        return html_embeddable_plot

    # Plotly offline divs default to height:100%, which can resolve to 0px inside
    # dynamically sized card containers. Enforce a concrete minimum chart height.
    html_embeddable_plot = re.sub(
        r'(<div id="[^"]+" class="plotly-graph-div" style=")([^"]*)("></div>)',
        lambda m: (
            m.group(1)
            + (
                "height:420px; width:100%;"
                if re.search(r'height\s*:\s*100%\s*;?', m.group(2), flags=re.IGNORECASE)
                else m.group(2)
            )
            + m.group(3)
        ),
        html_embeddable_plot,
        flags=re.IGNORECASE,
    )

    id_pattern = re.compile(r'<div id="([^"]+)" class="plotly-graph-div"[^>]*></div>', re.IGNORECASE)
    seen_ids = set()
    first_duplicate_pos = None
    duplicate_ids = []

    for match in id_pattern.finditer(html_embeddable_plot):
        plot_id = match.group(1)
        if plot_id in seen_ids:
            duplicate_ids.append(plot_id)
            if first_duplicate_pos is None:
                first_duplicate_pos = match.start()
        else:
            seen_ids.add(plot_id)

    if first_duplicate_pos is not None:
        jm_log(1, 'Duplicate Plotly graph container id detected. Truncating duplicated HTML block.',
               duplicate_ids)
        html_embeddable_plot = html_embeddable_plot[:first_duplicate_pos]

    remaining_ids = id_pattern.findall(html_embeddable_plot)
    assert len(remaining_ids) == len(set(remaining_ids)), 'Duplicate Plotly container ids remain after guard.'

    return html_embeddable_plot


def jm_get_plotly_chart_embeddable_html(html_embeddable_plot):
    """
    Generates the HTML for Plotly chart embedding.

    This function creates an HTML structure that embeds a Plotly plot into a
    webpage. It includes necessary script references to Plotly's JavaScript
    libraries to ensure the plot is fully functional.

    :return: A string containing the HTML snippet for embedding a Plotly chart.
    :rtype: str
    """

    guarded_plot_html = _jm_guard_duplicate_plotly_container_ids(html_embeddable_plot)

    plotly_chart_embeddable_html = (
            '<div>'
            '<script src="https://cdn.plot.ly/plotly-3.1.2.min.js"></script> '
            + guarded_plot_html +
            '</div>'
    )

    return plotly_chart_embeddable_html


def is_light_color(hex_color):
    """Determina si un color hexadecimal es claro."""
    hex_color = hex_color.lstrip('#')
    r, g, b = (int(hex_color[i:i+2], 16) / 255.0 for i in (0, 2, 4))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    return l > 0.5


def get_contrast_color(hex_color):
    """Obtiene el color de contraste (blanco o negro) para un color hexadecimal."""
    return 'black' if is_light_color(hex_color) else 'white'


def color_df_categorical_background(series):
    """
    Styles a Pandas Series to color-code categorical values with contrasting text.
    """
    if isinstance(series.iloc[0], dict) if not series.empty else False:
        series_as_str = series.astype(str)
        unique_values = series_as_str.unique()
        color_map = {value: f'background-color: #{hash(value) & 0xFFFFFF:06x}' for value in unique_values}
        def style_cell(v):
            bg_color = color_map.get(str(v), '')
            text_color = get_contrast_color(bg_color.split(': ')[1]) if bg_color else 'black'
            return f'{bg_color}; color: {text_color}'
        return series_as_str.apply(style_cell).tolist()
    elif not pandas.api.types.is_numeric_dtype(series.dtype):
        unique_values = series.unique()
        color_map = {value: f'background-color: #{hash(value) & 0xFFFFFF:06x}' for value in unique_values}
        def style_cell(v):
            bg_color = color_map.get(v, '')
            text_color = get_contrast_color(bg_color.split(': ')[1]) if bg_color else 'black'
            return f'{bg_color}; color: {text_color}'
        return series.apply(style_cell).tolist()
    else:
        return [''] * len(series)


def color_df_categorical_text(series):
    """
    Styles a Pandas Series to color-code categorical values with contrasting text.
    """
    if isinstance(series.iloc[0], dict) if not series.empty else False:
        series_as_str = series.astype(str)
        unique_values = series_as_str.unique()
        color_map = {value: f'color: #{hash(value) & 0xFFFFFF:06x}' for value in unique_values}
        def style_cell(v):
            bg_color = color_map.get(str(v), '')
            return f'{bg_color};'
        return series_as_str.apply(style_cell).tolist()
    elif not pandas.api.types.is_numeric_dtype(series.dtype):
        unique_values = series.unique()
        color_map = {value: f'color: #{hash(value) & 0xFFFFFF:06x}' for value in unique_values}
        def style_cell(v):
            bg_color = color_map.get(v, '')
            return f'{bg_color}'
        return series.apply(style_cell).tolist()
    else:
        return [''] * len(series)


def jm_pretty_df(df_to_format, include_bars_on_columns=tuple()
                 , format_decimals=True, show_bars=False, bars_color='WhiteSmoke'
                 , remove_duplicate_columns=True
                 , df_styles_to_apply = ('pretty_df_with_bars', 'color_code_categorical_columns_text', )
                 , output_format='HTML'
                 , keep_index = False
                 , reformat_column_names = False
                 , view_obj = None
                 ):
    """
    Show a pretty formatted version of the Dataframe.

    :param df_styles_to_apply: The style(s) to apply to the Dataframe.
                                Possible values: ('color_code_categorical_columns_background'
                                , 'color_code_categorical_columns_text'
                                , 'pretty_df_with_bars')
    :param df_to_format: A pandas DataFrame to pretty format.
    :param include_bars_on_columns: Columns of the DataFrame on which bars should be displayed as background on each of the columns.
                                    All columns in include_bars_on_columns must be numeric.
    :param format_decimals: True if decimals should be formatted to a maximum number of decimals.
    :param : Set it ti True if you want to show bars on columns. If True and include_bars_on_columns is empty,
            then it will show bars for all numeric columns.
    :return: The Dataframe now with a jm standard pretty format.
    """

    if remove_duplicate_columns:
        df_to_format = df_to_format.loc[:, ~df_to_format.columns.duplicated()].copy()

    if reformat_column_names:
        if view_obj is not None:
            # Use the locale translation, if any.
            for column in df_to_format.columns:
                new_column_name = view_obj._cw._(column)
                df_to_format = df_to_format.rename(columns={column: new_column_name})
        else:
            # Keep exact identifier names when no locale translator is available.
            df_to_format.columns = [str(column) for column in df_to_format.columns]

    if format_decimals:
        df_to_format = df_to_format.round(2)

    df_with_pretty_format = df_to_format.copy()

    try:

        if 'pretty_df_with_bars' in df_styles_to_apply:

            df_columns_names_list = tuple(df_with_pretty_format.columns.values.tolist())

            pandas.options.display.float_format = '{:,.2f}'.format

            if len(include_bars_on_columns) == 0 and show_bars:
                include_bars_on_columns = df_with_pretty_format.select_dtypes([np.int64, np.float64]).columns

            if len(include_bars_on_columns) > 0:
                df_with_pretty_format = df_with_pretty_format.style \
                    .format({
                    df_columns_names_list: "{:20,.0f}"
                }) \
                    .bar(subset=include_bars_on_columns, color=bars_color)

            else:
                df_with_pretty_format = df_with_pretty_format.style \
                    .format({
                    df_columns_names_list: "{:20,.0f}"
                })

            cell_hover = {  # for row hover use <tr> instead of <td>
                'selector': 'td:hover',
                'props': [('background-color', '#ffffb3')]
            }

            index_names = {
                'selector': '.index_name',
                'props': 'font:helvetica; font-style: italic; background-color: #509EE333; color: #006E80; font-weight:normal; align:left '
            }

            headers = {
                'selector': 'th:not(.index_name)',
                'props': 'background-color: #509EE333; color: #27537A; border-left: 10px solid transparent; text-align: left'
            }

            df_with_pretty_format = df_with_pretty_format.set_table_styles([cell_hover, index_names, headers])

            table_styles = [
                {'selector': 'th.rblank', 'props': 'background-color: transparent'},
                {'selector': 'td',
                 'props': 'padding-left: 5px; padding-right: 5px; text-align: left; background-color: transparent'},
                {'selector': 'th.row_heading', 'props': 'background-color: #F9FFFF;'}
            ]

            df_with_pretty_format = df_with_pretty_format.set_table_styles(table_styles, overwrite=False)

        if 'color_code_categorical_columns_background' in df_styles_to_apply:
            if isinstance(df_with_pretty_format, pandas.io.formats.style.Styler):
                df_with_pretty_format = df_with_pretty_format.apply(color_df_categorical_background)
            elif isinstance(df_with_pretty_format, DataFrame):
                df_with_pretty_format = df_with_pretty_format.style.apply(color_df_categorical_background)

        if 'color_code_categorical_columns_text' in df_styles_to_apply:
            if isinstance(df_with_pretty_format, pandas.io.formats.style.Styler):
                df_with_pretty_format = df_with_pretty_format.apply(color_df_categorical_text)
            elif isinstance(df_with_pretty_format, DataFrame):
                df_with_pretty_format = df_with_pretty_format.style.apply(color_df_categorical_text)

        if output_format == 'HTML':
            df_as_html = df_with_pretty_format.to_html(index = keep_index)
        else:
            df_as_html = df_with_pretty_format.to_markdown(index = keep_index)

    except Exception as e:
        # In case DataFrame formatting fails, return the simple conversion to HTML with no formatting.
        if output_format == 'HTML':
            df_as_html = df_to_format.to_html(index = keep_index)
        else:
            df_as_html = df_to_format.to_markdown(index = keep_index)

    return df_as_html


def _jm_wrap_plotly_inline_script(script_body: str) -> str:
    """
    Wrap Plotly inline script code in a guarded self-executing JavaScript block.

    The wrapper retries execution until Plotly and all referenced DOM targets exist,
    avoiding race conditions in asynchronously rendered pages.

    :param script_body: Original JavaScript block generated for a Plotly chart.
    :type script_body: str
    :return: Safe wrapper script that retries chart initialization when needed.
    :rtype: str
    """
    # Extract chart container ids referenced in common Plotly usage patterns.
    plot_ids = re.findall(r'getElementById\(["\']([^"\']+)["\']\)', script_body)
    plot_ids.extend(re.findall(r'Plotly\.(?:newPlot|react)\(\s*["\']([^"\']+)["\']', script_body))
    # Keep order while removing duplicates.
    seen_plot_ids = set()
    plot_ids = [pid for pid in plot_ids if not (pid in seen_plot_ids or seen_plot_ids.add(pid))]
    id_check = "true"
    if plot_ids:
        # Build a combined DOM-availability guard for all chart ids.
        checks = " && ".join([f'document.getElementById("{plot_id}")' for plot_id in plot_ids])
        id_check = f"({checks})"
    plot_ids_js = json.dumps(plot_ids)
    return (
        "(function(){\n"
        f"  var __jmPlotIds = {plot_ids_js};\n"
        "  var __jmEnsurePlotly = function(){\n"
        "    if (window.Plotly) return;\n"
        "    var existing = document.querySelector('script[data-jm-plotly-loader=\"1\"]');\n"
        "    if (existing) return;\n"
        "    var s = document.createElement('script');\n"
        "    s.src = 'https://cdn.plot.ly/plotly-3.1.2.min.js';\n"
        "    s.async = true;\n"
        "    s.setAttribute('data-jm-plotly-loader', '1');\n"
        "    document.head.appendChild(s);\n"
        "  };\n"
        "  var __jmWarnZeroHeight = function(){\n"
        "    if (!Array.isArray(__jmPlotIds) || __jmPlotIds.length === 0) return;\n"
        "    setTimeout(function(){\n"
        "      __jmPlotIds.forEach(function(plotId){\n"
        "        var el = document.getElementById(plotId);\n"
        "        if (!el) {\n"
        "          console.warn('[JM Plotly] container missing after init:', plotId);\n"
        "          return;\n"
        "        }\n"
        "        var h = el.clientHeight || el.offsetHeight || 0;\n"
        "        var w = el.clientWidth || el.offsetWidth || 0;\n"
        "        if (h <= 0 || w <= 0) {\n"
        "          console.warn('[JM Plotly] zero-sized container after init:', plotId, {width:w, height:h});\n"
        "          return;\n"
        "        }\n"
        "        if (!el.querySelector('.svg-container, canvas, svg')) {\n"
        "          console.warn('[JM Plotly] container has size but no rendered plot nodes:', plotId);\n"
        "        }\n"
        "      });\n"
        "    }, 800);\n"
        "  };\n"
        "  var __jmPlotlyRun = function(){\n"
        f"{script_body}\n"
        "  };\n"
        "  __jmEnsurePlotly();\n"
        f"  if (window.Plotly && {id_check}) {{ __jmPlotlyRun(); __jmWarnZeroHeight(); return; }}\n"
        "  var __jmPlotlyTries = 0;\n"
        "  var __jmPlotlyTimer = setInterval(function(){\n"
        "    __jmEnsurePlotly();\n"
        f"    if (window.Plotly && {id_check}) {{\n"
        "      clearInterval(__jmPlotlyTimer);\n"
        "      __jmPlotlyRun();\n"
        "      __jmWarnZeroHeight();\n"
        "    } else if (++__jmPlotlyTries > 40) {\n"
        "      clearInterval(__jmPlotlyTimer);\n"
        "      console.warn('[JM Plotly] init timed out waiting for Plotly or container ids:', __jmPlotIds);\n"
        "    }\n"
        "  }, 250);\n"
        "})();"
    )


# NOTE: This function might no longer be needed — all tested charts rendered
# correctly without sanitization (apply_sanitization=False by default).
def jm_satinize_custom_html(raw_html: str, apply_sanitization: bool = False) -> str:
    """
    Basic sanitizer for custom HTML snippets while keeping Plotly scripts functional.

    :param raw_html: The raw HTML string to sanitize.
    :param apply_sanitization: If True, apply the full sanitization logic.
                               If False (default), return the HTML unchanged
                               with a note appended.
    :return: Sanitized HTML string, or the original HTML with a note.
    """
    if not apply_sanitization:
        if not raw_html:
            return ""
        return raw_html + " no sanitize needed on this chart"

    _JM_DOCTYPE_RE = re.compile(r"(?is)<!doctype[^>]*>")
    _JM_STRIP_TAGS_RE = re.compile(r"(?is)</?(?:html|head|body|meta|title|link)\b[^>]*>")
    _JM_SCRIPT_TAG_RE = re.compile(r"(?is)<script\b([^>]*)>(.*?)</script>")
    _JM_SCRIPT_SRC_RE = re.compile(r'(?is)\bsrc=["\']?([^"\'>\s]+)["\']?')
    _JM_UNQUOTED_ATTR_RE = re.compile(r'(?i)\b(href|src)=([^\s"\'>]+)')
    _JM_PLOTLY_CDN_HOSTS = ("cdn.plot.ly",)
    # Only wrap scripts that actually invoke a Plotly rendering API. A loose
    # substring match (e.g. "Plotly" in body) falsely matches scripts that
    # merely reference `window.Plotly` for feature detection (like our flipping
    # card helpers), and wrapping them collapses their top-level function
    # declarations into a closure — breaking onclick handlers.
    _JM_PLOTLY_API_RE = re.compile(
        r"Plotly\.(?:newPlot|react|relayout|restyle|addTraces|update|animate|purge)\b"
    )

    if not raw_html:
        return ""



    cleaned = _JM_DOCTYPE_RE.sub("", raw_html)
    cleaned = _JM_STRIP_TAGS_RE.sub("", cleaned)

    def _script_handler(match: re.Match) -> str:
        attrs = match.group(1) or ""
        body = match.group(2) or ""
        src_match = _JM_SCRIPT_SRC_RE.search(attrs)
        if src_match:
            src = src_match.group(1)
            if any(host in src for host in _JM_PLOTLY_CDN_HOSTS):
                return f"<script{attrs}>{body}</script>"
            return ""

        if _JM_PLOTLY_API_RE.search(body):
            body = _jm_wrap_plotly_inline_script(body)
        return f"<script{attrs}>{body}</script>"

    cleaned_parts = []
    cursor = 0
    for script_match in _JM_SCRIPT_TAG_RE.finditer(cleaned):
        # Normalize unquoted attrs only on non-script HTML segments to avoid
        # corrupting inline JS payloads (e.g., Plotly data containing `href=`).
        html_chunk = cleaned[cursor:script_match.start()]
        if html_chunk:
            html_chunk = _JM_UNQUOTED_ATTR_RE.sub(lambda m: f'{m.group(1)}="{m.group(2)}"', html_chunk)
            cleaned_parts.append(html_chunk)

        cleaned_parts.append(_script_handler(script_match))
        cursor = script_match.end()

    trailing_html = cleaned[cursor:]
    if trailing_html:
        trailing_html = _JM_UNQUOTED_ATTR_RE.sub(lambda m: f'{m.group(1)}="{m.group(2)}"', trailing_html)
        cleaned_parts.append(trailing_html)

    cleaned = "".join(cleaned_parts)
    return f'<div class="nlchat-custom-html">{cleaned}</div>'


def jm_banner_content(banner_elements
                      , kpi_value_font_size = '1.0rem'
                      , align = 'center'):
    """
    Creates a string with an HTML banner from the elements provided in the input dictionary.

    Usage example:

        banner_elements = dict()
        details_list = list()

        detail_element_list = dict()
        detail_element_list['row'] = 1
        detail_element_list['column'] = 1
        detail_element_list['label'] = _("Avg Days of Inventory: ")
        detail_element_list['text'] = str(round(avg_days_of_inventory,1))
        details_list.append(detail_element_list)

        detail_element = dict()
        detail_element['row'] = 1
        detail_element['column'] = 2
        detail_element['label'] = _(" of days of inventory target ")
        detail_element['text'] = f'{str(round(avg_days_of_inventory_target, 1))} ({str(round(avg_days_of_inventory_perc_of_target))}%'
        details_list.append(detail_element)

        detail_element = dict()
        detail_element['row'] = 1
        detail_element['column'] = 3
        detail_element['label'] = str(round(count_of_order_units))
        detail_element['text'] = f'{str(round(total_lost_sales,2))}'
        details_list.append(detail_element)

        detail_element = dict()
        detail_element['row'] = 1
        detail_element['column'] = 4
        detail_element['label'] = _("Out of Inventory sales units: ")
        detail_element['text'] = str("{0:,.2f}".format(round(total_demand_units,2)))
        details_list.append(detail_element)

        banner_elements['details'] = details_list
        banner_content = jm_banner_content(banner_elements)
        self.w(banner_content)

    """

    banner_content = ''

    try:
        # Normalize alignment and map to CSS values
        align_normalized = (align or 'center').lower()
        if align_normalized in ('left', 'start'):
            justify_content = 'flex-start'
            item_align = 'flex-start'
            text_align = 'left'
            separator_margin = '4px 0'  # left aligned
        elif align_normalized in ('right', 'end'):
            justify_content = 'flex-end'
            item_align = 'flex-end'
            text_align = 'right'
            separator_margin = '4px 0 4px auto'  # push line to the right
        else:
            # default center
            justify_content = 'center'
            item_align = 'center'
            text_align = 'center'
            separator_margin = '4px auto'  # centered

        banner_content = f"""

        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        
        <style>
            /* Styles for the main banner container */
            .kpi-banner-container {{
                width: min(92%, 980px);
                max-width: 100%;
                margin: 6px auto;
                padding: 5px;
                background: var(--jm-kpi-banner-bg, #F2FFFF);
                border: none;
                box-shadow: 0 6px 16px rgba(27, 60, 80, 0.08);
                border-radius: 14px;
                display: flex;
                flex-direction: column;
                justify-content: {justify_content};
                align-items: {item_align};
                gap: 8px;
                color: var(--jm-text-primary, #0f172a);
            }}

            /* User sentence bubble */
            .kpi-banner-container:has(.jm-editable-input[data-attr="nl_sentence"]) {{
                margin-left: auto;
                margin-right: 0;
                background: var(--jm-kpi-user-bg, #d6f0ff);
                align-items: flex-end;
            }}
            .kpi-banner-container:has(.jm-editable-input[data-attr="nl_sentence"]) .kpi-label,
            .kpi-banner-container:has(.jm-editable-input[data-attr="nl_sentence"]) .kpi-value {{
                text-align: right !important;
            }}

            /* Ask sentence bubble */
            .kpi-banner-container:has(.jm-editable-input[data-attr="nl_asks_sentence"]) {{
                margin-left: auto;
                margin-right: 0;
                background: var(--jm-kpi-ask-bg, #edf7ff);
                align-items: flex-end;
            }}
            .kpi-banner-container:has(.jm-editable-input[data-attr="nl_asks_sentence"]) .kpi-label,
            .kpi-banner-container:has(.jm-editable-input[data-attr="nl_asks_sentence"]) .kpi-value {{
                text-align: right !important;
            }}

            /* Styles for individual KPI items */
            .kpi-item {{
                display: flex;
                flex-direction: column;
                align-items: {item_align};
                padding: 4px; /* Equivalent to p-1 */
                width: 100%; /* Ensures full width on all screen sizes */
            }}

            /* Styles for KPI labels */
            .kpi-label {{
                font-size: 0.75rem; /* Equivalent to text-sm */
                color: var(--jm-kpi-label, #3f5565);
                font-weight: 600;
                margin-bottom: 4px;
                letter-spacing: 0.04em;
                text-align: {text_align};
            }}

            /* Styles for KPI values */
            .kpi-value {{
                font-size: {{kpi_value_font_size}};
                color: var(--jm-kpi-value, #1677FF);
                font-weight: 500;
                text-align: {text_align};
                width: 100%;
            }}

            /* Editable attribute inputs inside KPI values */
            .kpi-value .jm-editable-input {{
                width: 100%;
                max-width: 100%;
                box-sizing: border-box;
                padding: 6px 10px;
                border: none;
                border-radius: 10px;
                background-color: var(--jm-input-bg, #ffffff);
                color: var(--jm-input-text, #111111);
                font-size: 0.875rem;
                line-height: 1.4;
                font-weight: 400;
                box-shadow: none;
                outline: none;
            }}

            .kpi-value textarea.jm-editable-input {{
                min-height: 96px;
                resize: vertical;
            }}

            .kpi-value .jm-editable-input[data-attr="nl_sentence"],
            .kpi-value .jm-editable-input[data-attr="nl_asks_sentence"] {{
                min-height: 96px;
                resize: vertical;
                overflow: auto;
                background: var(--jm-input-editable-bg, #f3f6f9);
            }}

            .kpi-value .jm-editable-input[data-attr="nl_sentence"]::placeholder,
            .kpi-value .jm-editable-input[data-attr="nl_asks_sentence"]::placeholder {{
                color: var(--jm-input-placeholder, #9aa7b5);
                opacity: 1;
            }}

            .kpi-value input.jm-editable-input[type="text"] {{
                height: 30px;
            }}

            .kpi-value input.jm-editable-input[type="checkbox"] {{
                width: 18px;
                height: 18px;
                padding: 0;
            }}

            /* Styles for longer paragraph content */
            .kpi-value-paragraph {{
                font-size: 0.85rem; /* Slightly larger than label, smaller than value */
                color: var(--jm-kpi-paragraph, #333);
                text-align: justify; /* Justify text for better readability in a paragraph */
                padding: 0 8px; /* Add some horizontal padding */
                margin-top: 4px;
            }}


            /* Styles for the separator line */
            .kpi-separator {{
                height: 1px;
                background-color: var(--jm-separator, #e0e0e0); /* Light gray line */
                width: 50%; /* Make it a "light line" */
                margin: {separator_margin}; /* Center horizontally and provide vertical spacing */
            }}
        
            /* Media queries for responsiveness (equivalent to md: classes) */
            @media (min-width: 768px) {{ /* Equivalent to md: breakpoint */
                .kpi-banner-container {{
                    flex-direction: row;
                    gap: 8px;
                }}
        
                .kpi-item {{
                width: 100%; /* Ensures full width for kpi-item on larger screens */
                }}
        
                .kpi-label {{
                font-size: 0.75rem; /* Equivalent to md:text-base */
                }}
        
                .kpi-value {{
                font-size: {{kpi_value_font_size}}; /* Equivalent to md:text-xl */
                }}
            }}
        </style>
                """

        banner_content += """
                <div class="kpi-banner-container">
            """

        if 'title' in banner_elements.keys():
            banner_content += f"""
            <p>
                <div class="kpi-label">{str(banner_elements['title'])}</div>
            </p>
            <br>
            """

        if 'subtitle' in banner_elements.keys():
            banner_content += f"""
            <p>
                <div class="kpi-label">{str(banner_elements['subtitle'])}</div>
                <div class="kpi-separator"></div>
            </p>
            <br>
            """

        if 'details' in banner_elements.keys():

            # Sort the list using a lambda function as the key
            # The tuple (x['row'], x['column']) ensures sorting by 'row' first,
            # then by 'column' for elements with the same 'row' value.
            details_list = banner_elements['details']
            details_list.sort(key=lambda x: (x['row'], x['column']))
            for details_element in details_list:
                banner_content += \
                    f"""<div class="kpi-item">"""
                if 'label' in details_element.keys():
                    banner_content += \
                        f"""<div class="kpi-label">{details_element['label']}</div>"""
                    f"""<div class="kpi-separator"></div>"""
                if 'text' in details_element.keys():
                    banner_content += \
                        f"""<div class="kpi-value">{details_element['text']}</div>"""
                banner_content += """</div>"""

        banner_content += """
            </div>
        """

    except Exception as e:
        jm_log(1, 'An error has occurred while trying to create the banner content.')
        jm_log(1, e)

    return banner_content


def jm_render_summary_table(
        self
        , df_to_summarize
        , maximum_of_index_levels_in_pivot=2
        , plot_the_summary_table=True, shown_by_default=True, include_totals_in_pivot=False
        , aggregate_function = 'sum'
):
    """

    :param self: The View object calling this function.
    :param df_to_summarize: The Dataframe from which a pivot table Dataframe will be created from.
    :param maximum_of_index_levels_in_pivot: The maximum of sequence numbers of the categorical columns to be summarized in the pivot table.
    :param plot_the_summary_table:  If the summary table should be rendered here to the calling iew object calling this function (self parameter above).
    :param shown_by_default:  If the summary table should have shown of hidden by default.
    :param include_totals_in_pivot: If the summary table should show the totals of each numeric column (pivot table margins).
    :return:
    """

    executable_command_df_html = ''

    try:

        pivot_df_numeric_columns_names = (
            df_to_summarize._get_numeric_data().columns)

        # If no numeric columns, add a count column, so the pivot tables and charts show counts summaries.
        if len(pivot_df_numeric_columns_names) == 0:
            if 'Count' not in df_to_summarize.columns:
                df_to_summarize['Count'] = 1
                pivot_df_numeric_columns_names = ['Count']

        pivot_df_categorical_columns_names = \
            [column for column in df_to_summarize.columns if column not in pivot_df_numeric_columns_names]

        # If no categorical columns, add a Totals column, so the pivot tables and charts show total summaries.
        if len(pivot_df_categorical_columns_names) == 0:
            if 'Totals' not in df_to_summarize.columns:
                df_to_summarize['Totals'] = 'Totals'
                pivot_df_categorical_columns_names = 'Totals'

        pivot_df_index_names = (
            list(pivot_df_categorical_columns_names[
                     0:
                     min(len(pivot_df_categorical_columns_names), maximum_of_index_levels_in_pivot)])
        )

        # Only create Pivot table Dataframe if we have at least 1 numeric and 1 categorical columns.
        if len(pivot_df_index_names) and len(pivot_df_numeric_columns_names) > 0:

            summary_pivot_df = pivot_table(df_to_summarize
                                           , values=pivot_df_numeric_columns_names
                                           , index=pivot_df_index_names
                                           , margins=include_totals_in_pivot
                                           , aggfunc=aggregate_function)

            executable_command_df_html = (
                jm_pretty_df(summary_pivot_df
                             , include_bars_on_columns=pivot_df_numeric_columns_names
                             , show_bars=True
                             ))

            if plot_the_summary_table:
                render_results_details_header(self, shown_by_default=shown_by_default)

                self.w(executable_command_df_html)

                render_results_details_footer(self)

    except Exception as e:
        jm_log(1, 'An error occurred in catim views jm_render_summary_table')
        jm_log(1, e)

    return executable_command_df_html


def jm_plot_chart_from_DataFrame(self
                                 , df_to_plot, chart_types=['bar']
                                 , plot_the_chart=True, shown_by_default=True
                                 , categorical_column_for_x_axis=[0]
                                 , categorical_column_for_z_axis=[1]
                                 , max_subplot_columns=2
                                 , remove_rows_having_all_numeric_columns_zero=False
                                 , plot_chart_name=''
                                 , plot_chart_title=''
                                 ):
    """
    Takes a Dataframe and plots is as a Chart.
    :param df_to_plot: The DataFrame with categorical and numeric values to create the chart from.
    :param chart_types: The type of Chart to plot: (bar, line, 3d, pie)
    :param plot_the_summary_table:  If the summary table should be rendered here to the calling view object
                                    which is calling this function (self parameter above).
    :param shown_by_default:  If the summary table should have shown of hidden by default.
    :param categorical_column_for_x_axis: The sequence number of the column to use as x_axis for the plot.
    :param categorical_column_for_z_axis: The sequence number of the column to use as z_axis for the plot.
                                            Only useful for 3D charts.
    :return: an HTML with the plot.
    """

    def resolve_numeric_col(cols, n):
        return cols[min(n, len(cols) - 1)] if len(cols) > 0 else None

    def resolve_categorical_col(cols, n, synthetic_name='Totals'):
        if not cols:
            if synthetic_name not in df_to_plot.columns:
                df_to_plot[synthetic_name] = synthetic_name
            return synthetic_name
        return cols[min(n, len(cols) - 1)]

    def obtain_pivot_table_for_chart(df_to_plot, chart_type, my_chart_sequence
                                     , categorical_column_for_x_axis, categorical_column_for_z_axis
                                     , prioritize_date_or_period_columns_for_x_axis=False
                                     , aggregate_function='mean'):

        executable_command_pivot_df = DataFrame()

        # Convert decimal columns to float, so _get_numeric_data function of the DataFrame recognizes them.
        # The _get_numeric_data() method in pandas DataFrames is designed to return columns
        # with integer or floating-point number dtypes.
        # It typically excludes columns with the Decimal dtype from the decimal module.
        if len(df_to_plot.index) > 0:
            for col in df_to_plot.columns:
                if type(df_to_plot.at[0, col]) == decimal.Decimal:
                    df_to_plot[col] = df_to_plot[col].astype('Float64')

        pivot_df_numeric_columns_names = df_to_plot._get_numeric_data().columns.tolist()
        # pivot_df_numeric_columns_names = df_to_plot.select_dtypes(include=['number']).columns.tolist()

        # If no numeric columns, add a count column, so the pivot tables and charts show counts summaries.
        if len(pivot_df_numeric_columns_names) == 0:
            if 'Count' not in df_to_plot.columns:
                df_to_plot['Count'] = 1
                pivot_df_numeric_columns_names = ['Count']

        if prioritize_date_or_period_columns_for_x_axis:
            # If we have a date or period column, use it for categorical columns,
            # because in trend or seasonality charts we want to show x axis as a time measure.
            date_or_period_columns = jm_identify_date_period_columns(df_to_plot)
            if len(date_or_period_columns) > 0:
                pivot_df_categorical_columns_names = date_or_period_columns
            else:
                pivot_df_categorical_columns_names = \
                    [column for column in df_to_plot.columns if column not in pivot_df_numeric_columns_names]

        else:
            pivot_df_categorical_columns_names = \
                [column for column in df_to_plot.columns if column not in pivot_df_numeric_columns_names]

        # If no categorical columns, add a Totals column, so the pivot tables and charts show total summaries.
        if len(pivot_df_categorical_columns_names) == 0:
            if 'Totals' not in df_to_plot.columns:
                df_to_plot['Totals'] = 'Totals'
                pivot_df_categorical_columns_names = ['Totals']

        if chart_type in ('3d', 'heatmap'):
            # We need 2 columns for x and z axis as Indexes.
            # resolve_categorical_col falls back to the last available column, and uses a distinct
            # synthetic name for z so pivot_table always receives two different dimension columns.
            x_cat = resolve_categorical_col(
                pivot_df_categorical_columns_names,
                categorical_column_for_x_axis[my_chart_sequence]
            )
            z_cat = resolve_categorical_col(
                pivot_df_categorical_columns_names,
                categorical_column_for_z_axis[my_chart_sequence],
                synthetic_name='Totals_z'
            )
            if x_cat == z_cat:
                if 'Totals_z' not in df_to_plot.columns:
                    df_to_plot['Totals_z'] = 'Totals_z'
                z_cat = 'Totals_z'

            if x_cat and pivot_df_numeric_columns_names:
                try:
                    executable_command_pivot_df = pivot_table(df_to_plot
                                                              , values=pivot_df_numeric_columns_names
                                                              , index=x_cat
                                                              , columns=z_cat
                                                              , aggfunc=aggregate_function)
                except Exception as e:
                    jm_log(1, 'An exception has occurred in catim views jm_plot_chart_from_DataFrame. ')
                    jm_log(1, e)

            my_chart_sequence += 1

        else:
            # We only need 1 column x-axis as Pivot Table Index.
            pivot_df_index_names = (
                list(pivot_df_categorical_columns_names[categorical_column_for_x_axis[0]
                                                        : min(len(pivot_df_categorical_columns_names)
                                                              , categorical_column_for_x_axis[0] + 1)])
            )

            # Only create Pivot table Dataframe if we have at least 1 numeric and 1 categorical columns.
            if pivot_df_index_names and pivot_df_numeric_columns_names:
                if len(pivot_df_index_names) > 0 and len(pivot_df_numeric_columns_names) > 0:

                    try:
                        executable_command_pivot_df = pivot_table(df_to_plot
                                                                  , values=pivot_df_numeric_columns_names
                                                                  , index=pivot_df_index_names
                                                                  , aggfunc=aggregate_function)
                    except Exception as e:
                        jm_log(1, 'An exception has occurred in catim views jm_plot_chart_from_DataFrame. ')
                        jm_log(1, e)

        # We need the numeric columns for y-axis.
        pivot_df_numeric_columns_names = (
            executable_command_pivot_df._get_numeric_data().columns)

        return executable_command_pivot_df, pivot_df_numeric_columns_names, pivot_df_categorical_columns_names

    # Start of jm_plot_chart_from_DataFrame __________________________________________________________
    # Determine subplots grid dimensions from the number of elements in the chart_types list.

    plot_chart_HTML = ''

    df_to_plot.fillna(0, inplace=True)

    if len(chart_types) == 0:
        chart_types = ['bar']

    if len(chart_types) > 0:

        if 'dash' in chart_types:
            plot_dash = True
        else:
            plot_dash = False

        if not plot_dash:

            subplots_rows = int(ceil(len(chart_types) / max_subplot_columns))
            subplots_cols = int(ceil(len(chart_types) / subplots_rows))

            jm_log(2, "rows, cols for subplot:", subplots_rows, subplots_cols)

            fig_plot = make_subplots(rows=subplots_rows, cols=subplots_cols
                                     , shared_xaxes=True
                                     , shared_yaxes=True
                                     )

            my_chart_sequence = 0
            charts_rendered = 0

            for chart_type in chart_types:

                if 'bar' in chart_type and 'horizontal' not in chart_type:

                    executable_command_pivot_df, pivot_df_numeric_columns_names, pivot_df_categorical_columns_names = (
                        obtain_pivot_table_for_chart(df_to_plot, chart_type, my_chart_sequence
                                                     , categorical_column_for_x_axis, categorical_column_for_z_axis))

                    if len(pivot_df_numeric_columns_names) > 0:

                        if remove_rows_having_all_numeric_columns_zero:
                            executable_command_pivot_df = (
                                executable_command_pivot_df)[(
                                    executable_command_pivot_df[pivot_df_numeric_columns_names] != 0).any(axis=1)]

                        subplot_row, subplot_col = (
                            jm_position_within_table_with_max_columns(my_chart_sequence, subplots_cols))

                        for pivot_df_numeric_columns_name in pivot_df_numeric_columns_names:
                            fig_plot.add_trace(
                                go.Bar(
                                    x=list(executable_command_pivot_df.index),
                                    y=list(executable_command_pivot_df[
                                               pivot_df_numeric_columns_name
                                           ]),
                                    name=pivot_df_numeric_columns_name,
                                )
                                , secondary_y=False
                                , row=subplot_row, col=subplot_col
                            )

                    if len(executable_command_pivot_df) > 0:
                        charts_rendered += 1

                    my_chart_sequence += 1

                if 'stacked' in chart_type and 'horizontal' not in chart_type:

                    executable_command_pivot_df, pivot_df_numeric_columns_names, pivot_df_categorical_columns_names = (
                        obtain_pivot_table_for_chart(df_to_plot, chart_type, my_chart_sequence
                                                     , categorical_column_for_x_axis, categorical_column_for_z_axis))

                    if len(pivot_df_numeric_columns_names) > 0:

                        if remove_rows_having_all_numeric_columns_zero:
                            executable_command_pivot_df = (
                                executable_command_pivot_df)[(
                                    executable_command_pivot_df[pivot_df_numeric_columns_names] != 0).any(axis=1)]

                        subplot_row, subplot_col = (
                            jm_position_within_table_with_max_columns(my_chart_sequence, subplots_cols))

                        for pivot_df_numeric_columns_name in pivot_df_numeric_columns_names:
                            fig_plot.add_trace(
                                go.Bar(
                                    x=list(executable_command_pivot_df.index),
                                    y=list(executable_command_pivot_df[
                                               pivot_df_numeric_columns_name
                                           ]),
                                    name=pivot_df_numeric_columns_name,
                                )
                                , secondary_y=False
                                , row=subplot_row, col=subplot_col
                            )

                    # Make it a Stacked Bar chart
                    fig_plot.update_layout(barmode='stack')

                    if len(executable_command_pivot_df) > 0:
                        charts_rendered += 1

                    my_chart_sequence += 1

                if 'line' in chart_type:

                    executable_command_pivot_df, pivot_df_numeric_columns_names, pivot_df_categorical_columns_names = (
                        obtain_pivot_table_for_chart(df_to_plot, chart_type, my_chart_sequence
                                                     , categorical_column_for_x_axis, categorical_column_for_z_axis))

                    if len(pivot_df_numeric_columns_names) > 0:

                        if remove_rows_having_all_numeric_columns_zero:
                            executable_command_pivot_df = (
                                executable_command_pivot_df)[
                                (executable_command_pivot_df[pivot_df_numeric_columns_names] != 0).any(axis=1)]

                        subplot_row, subplot_col = (
                            jm_position_within_table_with_max_columns(my_chart_sequence, subplots_cols))

                        for pivot_df_numeric_columns_name in pivot_df_numeric_columns_names:
                            fig_plot.add_trace(
                                go.Scatter(
                                    x=list(executable_command_pivot_df.index),
                                    y=list(executable_command_pivot_df[pivot_df_numeric_columns_name]),
                                    name=pivot_df_numeric_columns_name,
                                )
                                , secondary_y=False
                                , row=subplot_row, col=subplot_col
                            )

                        if len(executable_command_pivot_df) > 0:
                            charts_rendered += 1

                        my_chart_sequence += 1

                if 'bubble' in chart_type:

                    executable_command_pivot_df, pivot_df_numeric_columns_names, pivot_df_categorical_columns_names = (
                        obtain_pivot_table_for_chart(df_to_plot, chart_type, my_chart_sequence
                                                     , categorical_column_for_x_axis, categorical_column_for_z_axis))

                    if len(pivot_df_numeric_columns_names) > 0:
                        x_column_name = resolve_numeric_col(pivot_df_numeric_columns_names, 0)
                        y_column_name = resolve_numeric_col(pivot_df_numeric_columns_names, 1)
                        bubble_size_column_name = resolve_numeric_col(pivot_df_numeric_columns_names, 2)

                        if remove_rows_having_all_numeric_columns_zero:
                            executable_command_pivot_df = (
                                executable_command_pivot_df)[
                                (executable_command_pivot_df[pivot_df_numeric_columns_names] != 0).any(axis=1)]

                        if executable_command_pivot_df[bubble_size_column_name].max() != 0:
                            scale_factor_for_bubble_size = 100 / executable_command_pivot_df[
                                bubble_size_column_name].max()
                        else:
                            scale_factor_for_bubble_size = 100

                        for index_element in executable_command_pivot_df.index:
                            fig_plot.add_trace(go.Scatter(
                                x=[executable_command_pivot_df.at[index_element, x_column_name]]
                                , y=[executable_command_pivot_df.at[index_element, y_column_name]]
                                , name=index_element
                                , text=index_element
                                , marker_size=[executable_command_pivot_df.at[index_element, bubble_size_column_name]
                                               * scale_factor_for_bubble_size],
                            ))

                        fig_plot.update_traces(mode='markers + text')  # , marker=dict(sizemode='area', line_width=2))

                        fig_plot.update_layout(
                            xaxis=dict(
                                title=x_column_name,
                            ),
                            yaxis=dict(
                                title=y_column_name,
                            ),
                            annotations=[dict(
                                xref='paper',
                                yref='paper',
                                x=0, y=-0.3,
                                showarrow=False,
                                text=_('Bubble size is based on:') + ' ' + bubble_size_column_name
                            )
                            ],
                        )

                        if len(executable_command_pivot_df) > 0:
                            charts_rendered += 1

                        my_chart_sequence += 1

                if 'seasonal' in chart_type:

                    executable_command_pivot_df, pivot_df_numeric_columns_names, pivot_df_categorical_columns_names = (
                        obtain_pivot_table_for_chart(df_to_plot, chart_type, my_chart_sequence
                                                     , categorical_column_for_x_axis, categorical_column_for_z_axis
                                                     , prioritize_date_or_period_columns_for_x_axis = True))

                    if len(pivot_df_numeric_columns_names) > 0:

                        if remove_rows_having_all_numeric_columns_zero:
                            executable_command_pivot_df = (
                                executable_command_pivot_df)[(
                                    executable_command_pivot_df[pivot_df_numeric_columns_names] != 0).any(axis=1)]

                        subplot_row, subplot_col = (
                            jm_position_within_table_with_max_columns(my_chart_sequence, subplots_cols))

                        for pivot_df_numeric_columns_name in pivot_df_numeric_columns_names:

                            fig_plot.add_trace(
                                go.Scatter(
                                    x=list(executable_command_pivot_df.index),
                                    y=list(executable_command_pivot_df[pivot_df_numeric_columns_name]),
                                    name=pivot_df_numeric_columns_name,
                                )
                                , secondary_y=False
                                , row=subplot_row, col=subplot_col
                            )

                            seasonal_divisions = 4
                            seasonal_periods_within_each_division = int(
                                len(executable_command_pivot_df[pivot_df_numeric_columns_name]) / seasonal_divisions)

                            try:

                                seasonal_decomposed_values = seasonal_decompose(
                                    list(executable_command_pivot_df[pivot_df_numeric_columns_name])
                                    , period=seasonal_periods_within_each_division
                                    , model='additive'
                                    , extrapolate_trend=len(executable_command_pivot_df[pivot_df_numeric_columns_name])
                                    # If the seasonal_decompose returns fewer values than the frequency (number of periods),
                                    # extrapolate so no NaN values are returned.
                                )

                                fig_plot.add_trace(
                                    go.Scatter(
                                        y=seasonal_decomposed_values.seasonal,
                                        x=list(executable_command_pivot_df.index),
                                        name=pivot_df_numeric_columns_name + ' ' + self._cw._('seasonal'),
                                        line=dict(color='yellow', width=1.5, dash='dot')
                                    )
                                    , row=subplot_row, col=subplot_col
                                )

                                fig_plot.add_trace(
                                    go.Scatter(
                                        y=seasonal_decomposed_values.trend,
                                        x=list(executable_command_pivot_df.index),
                                        name=pivot_df_numeric_columns_name + ' ' + self._cw._('trend'),
                                        line=dict(color='cyan', width=1.5, dash='dot')
                                    )
                                    , row=subplot_row, col=subplot_col
                                )

                            except Exception as e:
                                jm_log(1,
                                       'An exception has occurred while seasonal_decomposed_values = seasonal_decompose() in seasonal.')

                            fig_plot.update_xaxes(range=[
                                min(list(executable_command_pivot_df.index))
                                , max(list(executable_command_pivot_df.index))])

                            # Draw a vertical line to visually separate each of the seasonal_divisions.
                            for vertical_segment_division in range(1, seasonal_divisions):
                                vertical_line_position = vertical_segment_division * seasonal_periods_within_each_division
                                fig_plot.add_vline(x=vertical_line_position, line_width=2, line_dash="dash",
                                                   line_color="#D3D3D3")

                        if len(executable_command_pivot_df) > 0:
                            charts_rendered += 1

                        my_chart_sequence += 1

                if 'trend' in chart_type:

                    executable_command_pivot_df, pivot_df_numeric_columns_names, pivot_df_categorical_columns_names = (
                        obtain_pivot_table_for_chart(df_to_plot, chart_type, my_chart_sequence
                                                     , categorical_column_for_x_axis, categorical_column_for_z_axis
                                                     , prioritize_date_or_period_columns_for_x_axis = True))

                    if len(pivot_df_numeric_columns_names) > 0:

                        if remove_rows_having_all_numeric_columns_zero:
                            executable_command_pivot_df = (
                                executable_command_pivot_df)[(
                                    executable_command_pivot_df[pivot_df_numeric_columns_names] != 0).any(axis=1)]

                        subplot_row, subplot_col = (
                            jm_position_within_table_with_max_columns(my_chart_sequence, subplots_cols))

                        for pivot_df_numeric_columns_name in pivot_df_numeric_columns_names:

                            fig_plot.add_trace(
                                go.Scatter(
                                    x=list(executable_command_pivot_df.index),
                                    y=list(executable_command_pivot_df[pivot_df_numeric_columns_name]),
                                    name=pivot_df_numeric_columns_name,
                                )
                                , secondary_y=False
                                , row=subplot_row, col=subplot_col
                            )

                            seasonal_divisions = 4
                            seasonal_periods_within_each_division = int(
                                len(executable_command_pivot_df[pivot_df_numeric_columns_name]) / seasonal_divisions)

                            try:

                                seasonal_decomposed_values = seasonal_decompose(
                                    list(executable_command_pivot_df[pivot_df_numeric_columns_name])
                                    , period=seasonal_periods_within_each_division
                                    , model='additive'
                                    , extrapolate_trend=len(executable_command_pivot_df[pivot_df_numeric_columns_name])
                                    # If the seasonal_decompose returns fewer values than the frequency (number of periods),
                                    # extrapolate so no NaN values are returned.
                                )

                                fig_plot.add_trace(
                                    go.Scatter(
                                        y=seasonal_decomposed_values.trend,
                                        x=list(executable_command_pivot_df.index),
                                        name=pivot_df_numeric_columns_name + ' trend',
                                        line=dict(color='cyan', width=1.5, dash='dot'),
                                    )
                                    , row=subplot_row, col=subplot_col
                                )

                            except Exception as e:
                                jm_log(1,
                                       'An exception has occurred while seasonal_decomposed_values = seasonal_decompose() in trend.')

                            fig_plot.update_xaxes(range=[
                                min(list(executable_command_pivot_df.index))
                                , max(list(executable_command_pivot_df.index))])

                            # Draw a vertical line to visually separate each of the seasonal_divisions .
                            for vertical_segment_division in range(1, seasonal_divisions):
                                vertical_line_position = vertical_segment_division * seasonal_periods_within_each_division
                                fig_plot.add_vline(x=vertical_line_position, line_width=2, line_dash="dash",
                                                   line_color="#D3D3D3")

                        if len(executable_command_pivot_df) > 0:
                            charts_rendered += 1

                        my_chart_sequence += 1

                # compose pie chart plot with sub-plots, each for one of the numeric variables to plot a pie for.
                if 'pie' in chart_type:

                    executable_command_pivot_df, pivot_df_numeric_columns_names, pivot_df_categorical_columns_names = (
                        obtain_pivot_table_for_chart(df_to_plot, chart_type, my_chart_sequence
                                                     , categorical_column_for_x_axis, categorical_column_for_z_axis))

                    # Limit the number of numeric values to plot to avoid visual overload of the pie chart subplots.
                    pivot_df_numeric_columns_names = pivot_df_numeric_columns_names[:6]
                    jm_log(1, 'pivot_df_numeric_columns_names', pivot_df_numeric_columns_names)

                    if len(pivot_df_numeric_columns_names) > 0:

                        if remove_rows_having_all_numeric_columns_zero:
                            executable_command_pivot_df = (
                                executable_command_pivot_df)[(
                                    executable_command_pivot_df[pivot_df_numeric_columns_names] != 0).any(axis=1)]

                        max_pie_subplot_columns = 2

                        pie_subplots_rows = int(ceil(len(pivot_df_numeric_columns_names) / max_pie_subplot_columns))
                        pie_subplots_cols = int(ceil(len(pivot_df_numeric_columns_names) / pie_subplots_rows))

                        jm_log(1, "rows, cols for PIE subplot:", pie_subplots_rows, pie_subplots_cols)

                        # using plotly 'specs' argument to make_subplots must be a 2D list of dictionaries with dimensions (1 x 1)
                        # For pie charts, we need to specify domain for each subplot,
                        # where each subplot will contain a pie for a numeric column.
                        type_domain_specs = []
                        for row in range(0, pie_subplots_rows):
                            type_domain_specs_col = []
                            for col in range(0, pie_subplots_cols):
                                type_domain_specs_col.append({'type': 'domain'})
                            type_domain_specs.append(type_domain_specs_col)

                        # Specify the name of each Pie subplot with the name of the numeric column we are plotting on each.
                        subplot_titles = [subplot_name for subplot_name in pivot_df_numeric_columns_names]

                        fig_plot = make_subplots(rows=pie_subplots_rows,
                                                 cols=pie_subplots_cols, specs=list(type_domain_specs)
                                                 , subplot_titles=subplot_titles
                                                 # , vertical_spacing = 0.25
                                                 # , horizontal_spacing = 0.25
                                                 )

                        for my_pie_sequence, pivot_df_numeric_columns_name in enumerate(pivot_df_numeric_columns_names):
                            pie_subplot_row, pie_subplot_col = (
                                jm_position_within_table_with_max_columns(my_pie_sequence, pie_subplots_cols))

                            fig_plot.add_trace(
                                go.Pie(
                                    labels=list(executable_command_pivot_df.index),
                                    values=list(executable_command_pivot_df[pivot_df_numeric_columns_name]),
                                    name=pivot_df_numeric_columns_name,
                                    textinfo='label+percent',
                                    insidetextorientation='radial'
                                ),
                                row=pie_subplot_row, col=pie_subplot_col
                            )

                        if len(executable_command_pivot_df) > 0:
                            charts_rendered += 1

                        my_chart_sequence += 1

                # compose boxplot chart plot with sub-plots, each for one of the numeric variables to plot a pie for.
                if 'boxplot' in chart_type:

                    executable_command_pivot_df, pivot_df_numeric_columns_names, pivot_df_categorical_columns_names = (
                        obtain_pivot_table_for_chart(df_to_plot, chart_type, my_chart_sequence
                                                     , categorical_column_for_x_axis, categorical_column_for_z_axis))

                    # Limit the number of numeric values to plot to avoid visual overload of the pie chart subplots.
                    pivot_df_numeric_columns_names = pivot_df_numeric_columns_names[:6]
                    jm_log(1, 'pivot_df_numeric_columns_names', pivot_df_numeric_columns_names)

                    if len(pivot_df_numeric_columns_names) > 0:

                        if remove_rows_having_all_numeric_columns_zero:
                            executable_command_pivot_df = (
                                executable_command_pivot_df)[(
                                    executable_command_pivot_df[pivot_df_numeric_columns_names] != 0).any(axis=1)]

                        max_boxplotsubplot_columns = 2

                        boxplotsubplots_rows = int(ceil(len(pivot_df_numeric_columns_names) / max_boxplotsubplot_columns))
                        boxplotsubplots_cols = int(ceil(len(pivot_df_numeric_columns_names) / boxplotsubplots_rows))

                        jm_log(1, "rows, cols for BOXPLOT subplot:", boxplotsubplots_rows, boxplotsubplots_cols)

                        # using plotly 'specs' argument to make_subplots must be a 2D list of dictionaries with dimensions (1 x 1)
                        # For pie charts, we need to specify domain for each subplot,
                        # where each subplot will contain a pie for a numeric column.
                        type_domain_specs = []
                        for row in range(0, boxplotsubplots_rows):
                            type_domain_specs_col = []
                            for col in range(0, boxplotsubplots_cols):
                                type_domain_specs_col.append({'type': 'domain'})
                            type_domain_specs.append(type_domain_specs_col)

                        # Specify the name of each Pie subplot with the name of the numeric column we are plotting on each.
                        subplot_titles = [subplot_name for subplot_name in pivot_df_numeric_columns_names]

                        fig_plot = make_subplots(rows=boxplotsubplots_rows,
                                                 cols=boxplotsubplots_cols, specs=list(type_domain_specs)
                                                 , subplot_titles=subplot_titles
                                                 # , vertical_spacing = 0.25
                                                 # , horizontal_spacing = 0.25
                                                 )

                        for pivot_df_numeric_columns_name in pivot_df_numeric_columns_names:

                            distinct_categorical_values = (
                                df_to_plot[pivot_df_categorical_columns_names[categorical_column_for_x_axis[0]]].unique())

                            for distinct_categorical_value in distinct_categorical_values:

                                dt_to_plot_subset = (
                                    df_to_plot[df_to_plot[pivot_df_categorical_columns_names[categorical_column_for_x_axis[0]]]
                                               == distinct_categorical_value] )

                                fig_plot.add_trace(
                                    go.Box(
                                        y = list(dt_to_plot_subset[pivot_df_numeric_columns_name]),
                                        x = list(dt_to_plot_subset[pivot_df_categorical_columns_names[categorical_column_for_x_axis[0]]]),
                                        name = pivot_df_numeric_columns_name + ' ' + str(distinct_categorical_value),
                                        boxpoints='all', # can also be outliers, or suspectedoutliers, or False
                                        jitter=0.3, # add some jitter for a better separation between points
                                        pointpos=-1.8 # relative position of points wrt box
                                    ),
                                )

                        if len(executable_command_pivot_df) > 0:
                            charts_rendered += 1

                        my_chart_sequence += 1

                if '3d' in chart_type:

                    executable_command_pivot_df, pivot_df_numeric_columns_names, pivot_df_categorical_columns_names = (
                        obtain_pivot_table_for_chart(df_to_plot, chart_type, my_chart_sequence
                                                     , categorical_column_for_x_axis, categorical_column_for_z_axis))

                    if len(pivot_df_numeric_columns_names) > 0:

                        if remove_rows_having_all_numeric_columns_zero:
                            executable_command_pivot_df = (
                                executable_command_pivot_df)[
                                (executable_command_pivot_df[pivot_df_numeric_columns_names] != 0).any(axis=1)]

                        if len(executable_command_pivot_df) > 0:

                            fig_plot = go.Figure(data=[go.Scatter3d(
                                x=list(executable_command_pivot_df.index),
                                y=list(executable_command_pivot_df.columns),
                                z=list(executable_command_pivot_df[pivot_df_numeric_columns_names]),
                                mode='markers')])

                            charts_rendered += 1

                        my_chart_sequence += 1

                if 'area' in chart_type and 'horizontal' not in chart_type:

                    executable_command_pivot_df, pivot_df_numeric_columns_names, pivot_df_categorical_columns_names = (
                        obtain_pivot_table_for_chart(df_to_plot, chart_type, my_chart_sequence
                                                     , categorical_column_for_x_axis, categorical_column_for_z_axis))

                    if len(pivot_df_numeric_columns_names) > 0:

                        if remove_rows_having_all_numeric_columns_zero:
                            executable_command_pivot_df = (
                                executable_command_pivot_df)[(
                                    executable_command_pivot_df[pivot_df_numeric_columns_names] != 0).any(axis=1)]

                        subplot_row, subplot_col = (
                            jm_position_within_table_with_max_columns(my_chart_sequence, subplots_cols))

                        for pivot_df_numeric_columns_name in pivot_df_numeric_columns_names:
                            fig_plot.add_trace(
                                go.Scatter(
                                    x=list(executable_command_pivot_df.index),
                                    y=list(executable_command_pivot_df[pivot_df_numeric_columns_name]),
                                    name=pivot_df_numeric_columns_name,
                                    fill='tozeroy',
                                )
                                , secondary_y=False
                                , row=subplot_row, col=subplot_col
                            )

                    if len(executable_command_pivot_df) > 0:
                        charts_rendered += 1

                    my_chart_sequence += 1

                if 'donut' in chart_type:

                    executable_command_pivot_df, pivot_df_numeric_columns_names, pivot_df_categorical_columns_names = (
                        obtain_pivot_table_for_chart(df_to_plot, chart_type, my_chart_sequence
                                                     , categorical_column_for_x_axis, categorical_column_for_z_axis))

                    pivot_df_numeric_columns_names = pivot_df_numeric_columns_names[:6]

                    if len(pivot_df_numeric_columns_names) > 0:

                        if remove_rows_having_all_numeric_columns_zero:
                            executable_command_pivot_df = (
                                executable_command_pivot_df)[(
                                    executable_command_pivot_df[pivot_df_numeric_columns_names] != 0).any(axis=1)]

                        max_donut_subplot_columns = 2
                        donut_subplots_rows = int(ceil(len(pivot_df_numeric_columns_names) / max_donut_subplot_columns))
                        donut_subplots_cols = int(ceil(len(pivot_df_numeric_columns_names) / donut_subplots_rows))

                        type_domain_specs = [
                            [{'type': 'domain'} for _ in range(donut_subplots_cols)]
                            for _ in range(donut_subplots_rows)
                        ]
                        subplot_titles = list(pivot_df_numeric_columns_names)

                        fig_plot = make_subplots(rows=donut_subplots_rows, cols=donut_subplots_cols
                                                 , specs=type_domain_specs
                                                 , subplot_titles=subplot_titles)

                        for my_donut_sequence, pivot_df_numeric_columns_name in enumerate(pivot_df_numeric_columns_names):
                            donut_subplot_row, donut_subplot_col = (
                                jm_position_within_table_with_max_columns(my_donut_sequence, donut_subplots_cols))

                            fig_plot.add_trace(
                                go.Pie(
                                    labels=list(executable_command_pivot_df.index),
                                    values=list(executable_command_pivot_df[pivot_df_numeric_columns_name]),
                                    name=pivot_df_numeric_columns_name,
                                    hole=0.4,
                                    textinfo='label+percent',
                                    insidetextorientation='radial',
                                ),
                                row=donut_subplot_row, col=donut_subplot_col
                            )

                        if len(executable_command_pivot_df) > 0:
                            charts_rendered += 1

                        my_chart_sequence += 1

                if 'bar-horizontal' in chart_type:

                    executable_command_pivot_df, pivot_df_numeric_columns_names, pivot_df_categorical_columns_names = (
                        obtain_pivot_table_for_chart(df_to_plot, chart_type, my_chart_sequence
                                                     , categorical_column_for_x_axis, categorical_column_for_z_axis))

                    if len(pivot_df_numeric_columns_names) > 0:

                        if remove_rows_having_all_numeric_columns_zero:
                            executable_command_pivot_df = (
                                executable_command_pivot_df)[(
                                    executable_command_pivot_df[pivot_df_numeric_columns_names] != 0).any(axis=1)]

                        subplot_row, subplot_col = (
                            jm_position_within_table_with_max_columns(my_chart_sequence, subplots_cols))

                        for pivot_df_numeric_columns_name in pivot_df_numeric_columns_names:
                            fig_plot.add_trace(
                                go.Bar(
                                    x=list(executable_command_pivot_df[pivot_df_numeric_columns_name]),
                                    y=list(executable_command_pivot_df.index),
                                    name=pivot_df_numeric_columns_name,
                                    orientation='h',
                                )
                                , secondary_y=False
                                , row=subplot_row, col=subplot_col
                            )

                    if len(executable_command_pivot_df) > 0:
                        charts_rendered += 1

                    my_chart_sequence += 1

                if 'stacked-horizontal' in chart_type:

                    executable_command_pivot_df, pivot_df_numeric_columns_names, pivot_df_categorical_columns_names = (
                        obtain_pivot_table_for_chart(df_to_plot, chart_type, my_chart_sequence
                                                     , categorical_column_for_x_axis, categorical_column_for_z_axis))

                    if len(pivot_df_numeric_columns_names) > 0:

                        if remove_rows_having_all_numeric_columns_zero:
                            executable_command_pivot_df = (
                                executable_command_pivot_df)[(
                                    executable_command_pivot_df[pivot_df_numeric_columns_names] != 0).any(axis=1)]

                        subplot_row, subplot_col = (
                            jm_position_within_table_with_max_columns(my_chart_sequence, subplots_cols))

                        for pivot_df_numeric_columns_name in pivot_df_numeric_columns_names:
                            fig_plot.add_trace(
                                go.Bar(
                                    x=list(executable_command_pivot_df[pivot_df_numeric_columns_name]),
                                    y=list(executable_command_pivot_df.index),
                                    name=pivot_df_numeric_columns_name,
                                    orientation='h',
                                )
                                , secondary_y=False
                                , row=subplot_row, col=subplot_col
                            )

                    fig_plot.update_layout(barmode='stack')

                    if len(executable_command_pivot_df) > 0:
                        charts_rendered += 1

                    my_chart_sequence += 1

                if 'area-horizontal' in chart_type:

                    executable_command_pivot_df, pivot_df_numeric_columns_names, pivot_df_categorical_columns_names = (
                        obtain_pivot_table_for_chart(df_to_plot, chart_type, my_chart_sequence
                                                     , categorical_column_for_x_axis, categorical_column_for_z_axis))

                    if len(pivot_df_numeric_columns_names) > 0:

                        if remove_rows_having_all_numeric_columns_zero:
                            executable_command_pivot_df = (
                                executable_command_pivot_df)[(
                                    executable_command_pivot_df[pivot_df_numeric_columns_names] != 0).any(axis=1)]

                        subplot_row, subplot_col = (
                            jm_position_within_table_with_max_columns(my_chart_sequence, subplots_cols))

                        for pivot_df_numeric_columns_name in pivot_df_numeric_columns_names:
                            fig_plot.add_trace(
                                go.Scatter(
                                    x=list(executable_command_pivot_df[pivot_df_numeric_columns_name]),
                                    y=list(executable_command_pivot_df.index),
                                    name=pivot_df_numeric_columns_name,
                                    fill='tozerox',
                                )
                                , secondary_y=False
                                , row=subplot_row, col=subplot_col
                            )

                    if len(executable_command_pivot_df) > 0:
                        charts_rendered += 1

                    my_chart_sequence += 1

                if 'scatter' in chart_type and 'bubble' not in chart_type:

                    executable_command_pivot_df, pivot_df_numeric_columns_names, pivot_df_categorical_columns_names = (
                        obtain_pivot_table_for_chart(df_to_plot, chart_type, my_chart_sequence
                                                     , categorical_column_for_x_axis, categorical_column_for_z_axis))

                    if len(pivot_df_numeric_columns_names) > 0:

                        x_column_name = resolve_numeric_col(pivot_df_numeric_columns_names, 0)
                        y_column_name = resolve_numeric_col(pivot_df_numeric_columns_names, 1)

                        if remove_rows_having_all_numeric_columns_zero:
                            executable_command_pivot_df = (
                                executable_command_pivot_df)[(
                                    executable_command_pivot_df[pivot_df_numeric_columns_names] != 0).any(axis=1)]

                        subplot_row, subplot_col = (
                            jm_position_within_table_with_max_columns(my_chart_sequence, subplots_cols))

                        fig_plot.add_trace(
                            go.Scatter(
                                x=list(executable_command_pivot_df[x_column_name]),
                                y=list(executable_command_pivot_df[y_column_name]),
                                text=list(executable_command_pivot_df.index),
                                mode='markers',
                                name=f'{x_column_name} vs {y_column_name}',
                            )
                            , secondary_y=False
                            , row=subplot_row, col=subplot_col
                        )

                        fig_plot.update_layout(
                            xaxis=dict(title=x_column_name),
                            yaxis=dict(title=y_column_name),
                        )

                    if len(executable_command_pivot_df) > 0:
                        charts_rendered += 1

                    my_chart_sequence += 1

                if 'histogram' in chart_type:

                    executable_command_pivot_df, pivot_df_numeric_columns_names, pivot_df_categorical_columns_names = (
                        obtain_pivot_table_for_chart(df_to_plot, chart_type, my_chart_sequence
                                                     , categorical_column_for_x_axis, categorical_column_for_z_axis))

                    if len(pivot_df_numeric_columns_names) > 0:

                        subplot_row, subplot_col = (
                            jm_position_within_table_with_max_columns(my_chart_sequence, subplots_cols))

                        for pivot_df_numeric_columns_name in pivot_df_numeric_columns_names:
                            fig_plot.add_trace(
                                go.Histogram(
                                    x=list(df_to_plot[pivot_df_numeric_columns_name]),
                                    name=pivot_df_numeric_columns_name,
                                )
                                , secondary_y=False
                                , row=subplot_row, col=subplot_col
                            )

                        if len(df_to_plot) > 0:
                            charts_rendered += 1

                    my_chart_sequence += 1

                if 'waterfall' in chart_type:

                    executable_command_pivot_df, pivot_df_numeric_columns_names, pivot_df_categorical_columns_names = (
                        obtain_pivot_table_for_chart(df_to_plot, chart_type, my_chart_sequence
                                                     , categorical_column_for_x_axis, categorical_column_for_z_axis))

                    if len(pivot_df_numeric_columns_names) > 0:

                        pivot_df_numeric_columns_name = resolve_numeric_col(pivot_df_numeric_columns_names, 0)

                        if remove_rows_having_all_numeric_columns_zero:
                            executable_command_pivot_df = (
                                executable_command_pivot_df)[(
                                    executable_command_pivot_df[pivot_df_numeric_columns_names] != 0).any(axis=1)]

                        subplot_row, subplot_col = (
                            jm_position_within_table_with_max_columns(my_chart_sequence, subplots_cols))

                        fig_plot.add_trace(
                            go.Waterfall(
                                x=list(executable_command_pivot_df.index),
                                y=list(executable_command_pivot_df[pivot_df_numeric_columns_name]),
                                measure=['relative'] * len(executable_command_pivot_df.index),
                                name=pivot_df_numeric_columns_name,
                                connector=dict(line=dict(color='rgba(128,128,128,0.4)')),
                            )
                            , secondary_y=False
                            , row=subplot_row, col=subplot_col
                        )

                    if len(executable_command_pivot_df) > 0:
                        charts_rendered += 1

                    my_chart_sequence += 1

                if 'heatmap' in chart_type:

                    executable_command_pivot_df, pivot_df_numeric_columns_names, pivot_df_categorical_columns_names = (
                        obtain_pivot_table_for_chart(df_to_plot, chart_type, my_chart_sequence
                                                     , categorical_column_for_x_axis, categorical_column_for_z_axis))

                    if len(executable_command_pivot_df) > 0:

                        if remove_rows_having_all_numeric_columns_zero:
                            executable_command_pivot_df = (
                                executable_command_pivot_df)[(
                                    executable_command_pivot_df[pivot_df_numeric_columns_names] != 0).any(axis=1)]

                        z_values = [
                            [float(v) if v == v else 0 for v in executable_command_pivot_df.loc[idx]]
                            for idx in executable_command_pivot_df.index
                        ]

                        fig_plot = go.Figure(data=go.Heatmap(
                            x=list(executable_command_pivot_df.columns),
                            y=list(executable_command_pivot_df.index),
                            z=z_values,
                            colorscale='Blues',
                        ))

                        charts_rendered += 1

                    my_chart_sequence += 1

                if 'crosstab' in chart_type:

                    executable_command_pivot_df, pivot_df_numeric_columns_names, pivot_df_categorical_columns_names = (
                        obtain_pivot_table_for_chart(df_to_plot, chart_type, my_chart_sequence
                                                     , categorical_column_for_x_axis, categorical_column_for_z_axis))

                    if len(executable_command_pivot_df) > 0:

                        if remove_rows_having_all_numeric_columns_zero:
                            executable_command_pivot_df = (
                                executable_command_pivot_df)[(
                                    executable_command_pivot_df[pivot_df_numeric_columns_names] != 0).any(axis=1)]

                        z_values = [
                            [float(v) if v == v else 0 for v in executable_command_pivot_df.loc[idx]]
                            for idx in executable_command_pivot_df.index
                        ]

                        fig_plot = go.Figure(data=go.Heatmap(
                            x=list(executable_command_pivot_df.columns),
                            y=list(executable_command_pivot_df.index),
                            z=z_values,
                            colorscale='Blues',
                        ))

                        charts_rendered += 1

                    my_chart_sequence += 1

                if 'radar' in chart_type:

                    executable_command_pivot_df, pivot_df_numeric_columns_names, pivot_df_categorical_columns_names = (
                        obtain_pivot_table_for_chart(df_to_plot, chart_type, my_chart_sequence
                                                     , categorical_column_for_x_axis, categorical_column_for_z_axis))

                    if len(pivot_df_numeric_columns_names) > 0:

                        # Ensure at least 3 spokes by cycling available columns, matching frontend fallback.
                        spoke_cols = list(pivot_df_numeric_columns_names)
                        while len(spoke_cols) < 3:
                            spoke_cols.append(spoke_cols[len(spoke_cols) % len(pivot_df_numeric_columns_names)])

                        if remove_rows_having_all_numeric_columns_zero:
                            executable_command_pivot_df = (
                                executable_command_pivot_df)[(
                                    executable_command_pivot_df[pivot_df_numeric_columns_names] != 0).any(axis=1)]

                        fig_plot = go.Figure()

                        for idx in executable_command_pivot_df.index:
                            r_values = [float(executable_command_pivot_df.at[idx, col]) for col in spoke_cols]
                            fig_plot.add_trace(go.Scatterpolar(
                                r=r_values,
                                theta=spoke_cols,
                                fill='toself',
                                name=str(idx),
                            ))

                        fig_plot.update_layout(
                            polar=dict(radialaxis=dict(visible=True)),
                            showlegend=True,
                        )

                        if len(executable_command_pivot_df) > 0:
                            charts_rendered += 1

                    my_chart_sequence += 1

                if 'combo' in chart_type:

                    executable_command_pivot_df, pivot_df_numeric_columns_names, pivot_df_categorical_columns_names = (
                        obtain_pivot_table_for_chart(df_to_plot, chart_type, my_chart_sequence
                                                     , categorical_column_for_x_axis, categorical_column_for_z_axis))

                    if len(pivot_df_numeric_columns_names) > 0:

                        primary_col = resolve_numeric_col(pivot_df_numeric_columns_names, 0)
                        secondary_col = resolve_numeric_col(pivot_df_numeric_columns_names, 1)

                        if remove_rows_having_all_numeric_columns_zero:
                            executable_command_pivot_df = (
                                executable_command_pivot_df)[(
                                    executable_command_pivot_df[pivot_df_numeric_columns_names] != 0).any(axis=1)]

                        subplot_row, subplot_col = (
                            jm_position_within_table_with_max_columns(my_chart_sequence, subplots_cols))

                        fig_plot.add_trace(
                            go.Bar(
                                x=list(executable_command_pivot_df.index),
                                y=list(executable_command_pivot_df[primary_col]),
                                name=primary_col,
                            )
                            , secondary_y=False
                            , row=subplot_row, col=subplot_col
                        )
                        fig_plot.add_trace(
                            go.Scatter(
                                x=list(executable_command_pivot_df.index),
                                y=list(executable_command_pivot_df[secondary_col]),
                                name=secondary_col,
                                mode='lines+markers',
                            )
                            , secondary_y=False
                            , row=subplot_row, col=subplot_col
                        )

                    if len(executable_command_pivot_df) > 0:
                        charts_rendered += 1

                    my_chart_sequence += 1

            if charts_rendered > 0:

                fig_plot.update_layout(
                    margin_b=90,
                    plot_bgcolor='rgba(0,0,0,0)',
                    paper_bgcolor='rgba(0,0,0,0)',
                    xaxis=dict(gridcolor='rgba(128,128,128,0.22)', zeroline=False, automargin=True),
                    yaxis=dict(gridcolor='rgba(128,128,128,0.22)', zeroline=False, automargin=True),
                    font=dict(
                        family="sans-serif",
                        size=10,
                        color="#8a97a5"
                    ),
                    legend=go.layout.Legend(
                        orientation="h",
                        bgcolor='rgba(0,0,0,0)',
                        bordercolor='rgba(128,128,128,0.35)',
                        borderwidth=1,
                        yanchor="bottom",
                        xanchor="right",
                        y=1.2,
                        x=1,
                        font=dict(
                            family="sans-serif",
                            size=10,
                            color="#8a97a5"
                        ),
                    )
                )

                # fig_plot.update_xaxes(title_text='Element', tickfont=dict(family='sans-serif', color='gray', size=12))
                # fig_plot.update_yaxes(title_text=related_uom(self,entity), tickfont=dict(family='sans-serif', color='gray', size=12))

                try:
                    plot_chart_HTML = pyo.plot(fig_plot, include_plotlyjs=False, output_type='div')
                except Exception as e:
                    jm_log(1, 'An exception has occurred while pyo.plot(fig_plot, include_plotlyjs=False, output_type=\'div\') in plot_chart_HTML.')
                    plot_chart_HTML = _('This type of chart could not be plotted with this data.')

                if plot_the_chart:
                    render_results_details_header(self,
                                                  details_bar_text=_('%s' % 'Show/Hide Chart' + ': '
                                                                               + ' '.join(chart_types))
                                                  , shown_by_default=shown_by_default)
                    plot_chart_HTML = jm_get_plotly_chart_embeddable_html(plot_chart_HTML)

                    render_results_details_footer(self)

            else:
                plot_chart_HTML += ' '.join(chart_types) + ': '
                plot_chart_HTML += _('There are not enough columns or rows to show this Chart.')
                plot_chart_HTML += '<br>'
                plot_chart_HTML += (plot_chart_HTML)

        if plot_dash:
            #plot_chart_in_plotly_dash(df_to_plot, chart_types)
            pass

    else:
        plot_chart_HTML += ' '.join(chart_types) + ': '
        plot_chart_HTML += _(
            'There are not enough columns to show this Chart. Try with more columns or a low dimensional chart like Bar or Line.')
        plot_chart_HTML += '<br>'
        plot_chart_HTML += (plot_chart_HTML)

    return jm_satinize_custom_html(plot_chart_HTML)


def jm_plot_chart_in_metabase(query, chart_types
                              , query_name='New Question', query_description='New Question'
                              , database_analytical_db_id = None):
    """
    Creates a new query (card) in some collection of the JuiceMantics Metabase  dashboards,
    and returns the URI we can navigate to, showing the new query (card) in JuiceMantics Metabase  dashboards.

    :param df_to_plot: DataFrame containing the data to plot in the chart.
    :param chart_types: The type of Chart to plot: (bar, line, 3d, pie)

    :return: the URI that contains the new report corresponding to the query to plot.
    """

    jm_config = jm_obtain_config()
    jm_metabase_database_id = int(round(float(jm_config['metabase']['metabase_database_id'])))
    metabase_collection_id = int(round(float(jm_config['metabase']['metabase_collection_id'])))
    metabase_display_type = jm_config['metabase']['metabase_display_type']

    if database_analytical_db_id:
        metabase_database_id = database_analytical_db_id
    else:
        metabase_database_id = jm_metabase_database_id

    metabase_query_card_URI = ''

    create_sql_card = True

    if create_sql_card:
        jm_config = jm_obtain_config()
        metabase_url = jm_config['metabase']['metabase_url']
        metabase_card_subdomain = jm_config['metabase']['metabase_card_subdomain']
        metabase_session_subdomain = jm_config['metabase']['metabase_session_subdomain']
        metabase_pw = jm_config['metabase']['metabase_pw']

        # Get a Metabase session
        api_url = f'{metabase_url}{metabase_session_subdomain}'

        headers = {'Content-Type': 'application/json'}

        payload = {'username': 'cesar.lugo.marcos@juicemantics.com', 'password': metabase_pw}

        session_id_response = requests.post(api_url, headers=headers, json=payload)

        jm_log(1, )
        jm_log(1, session_id_response.text)
        jm_log(1, )

        # # Get Metabase databases
        # api_url = f''{metabase_url}api/database/'
        #
        # headers_dict = session_id_response.json()
        #
        # for key, value in headers_dict.items():
        #     if key == 'id':
        #         jm_log(1, 'ID is:',value)
        #         metabase_session_id = value
        #
        # headers = {
        #     'Content-Type': "application/json",
        #     "X-Metabase-Session": metabase_session_id
        # }
        #
        # payload = {'name': 'JuiceMantics','engine':'PostgreSQL'}
        #
        # response = requests.post(api_url, headers=headers, json=payload)
        #
        # jm_log(1, )
        # print (json.dumps(response.json(), indent=4, sort_keys=True))
        # jm_log(1, )

        # Create an SQL query card and add it to collection 1.

        api_url = 'http://localhost:3000/api/card'

        null = None

        visualization_settings = {"table.pivot_column": "cw_initial_retail_price", "table.cell_column": "cw_item_name"}
        results_metadata = null

        headers_dict = session_id_response.json()

        metabase_session_id = 0

        for key, value in headers_dict.items():
            if key == 'id':
                jm_log(1, 'ID is:', value)
                metabase_session_id = value

        headers = {
            'Content-Type': "application/json",
            "X-Metabase-Session": metabase_session_id
        }

        query = query.replace('\\n', '').replace('\\', '')

        payload = {"name": query_name
            , "dataset_query": {"type": "native", "native": {"query": query, "template-tags": {}}
                , "database": metabase_database_id}
            , "display": metabase_display_type
            , "description": query_description
            , "visualization_settings": visualization_settings
            , "parameters": []
            , "metabase_collection_id": metabase_collection_id
            , "collection_position": null
            , "result_metadata": results_metadata}

        query_card_response = requests.post(api_url, headers=headers, json=payload)

        query_card_dict = query_card_response.json()

        query_card_id = None

        for key, value in query_card_dict.items():
            jm_log(1, key, value)
            if key == 'id':
                query_card_id = value
            if key == 'name':
                query_card_name = value
            if key == 'description':
                query_card_description = value
            if key == 'display':
                query_card_display = value

        jm_log(2, )
        jm_log(1, json.dumps(query_card_response.json(), indent=4, sort_keys=True))
        jm_log(2, )
        # jm_log(1, 'Query Card results:',query_card_id, query_card_name, query_card_description, query_card_display)
        jm_log(2, )

        card_url = f'{metabase_url}{metabase_card_subdomain}/'

        if query_card_id:
            metabase_query_card_URI = card_url + str(query_card_id)

    return metabase_query_card_URI


def jm_position_within_table_with_max_columns(element_sequence, max_columns):
    """
    Calculates the row and column position from an element_sequence ordinal (starting at 0),
    given a maximum subplot columns allowed per row.

    :param element_sequence: The ordinal sequence to calculate the row anc column position from.
    :param max_columns: The maximum columns allowed per row.

    :return: row, col
    """

    row = element_sequence // max_columns + 1
    col = element_sequence % (max_columns) + 1

    return row, col


def jm_initialize_views_content():
    """
    Initializes the view contents as needed by the jm_render_views function.

    :return: Initialized jm_render_views_content.
    """

    jm_render_views_content = list()

    return jm_render_views_content


def jm_append_view_content(jm_render_views_content
                           , sentence_ask_text = ''
                           , element_to_render_as_view = ''
                           , element_to_render_type = 'HTML'
                           , render_vid = 'list'
                           , view_load_method = 'eager'
                           , element_support_content = ''
                           , html_format_to_render = 'width: 100%; min-width: 500px; padding: 2px;'
                           , tab_id = '001'
                           , row_column = None
                           , maximum_columns_per_row = 2
                           ):
    """
    Appends and element to render the view contents in ta table as needed by the jm_render_views function.

    :param jm_render_views_content: a list of jm_render_view_content dicts,
                                    each with the content of the elements to render as views:
    :param: sentence_ask_text: The question or ask that lead to answer the elements to render.
    :param: element_to_render_as_view: The elements to render,
                                            which content must be according to each corresponding rsets_to_render_types.
    :param: element_to_render_type: The type or element, either 'cw rset', 'cw rset decomposition, 'dataframe', 'HTML'.
    :param: render_vid: The type or view to display it, like 'primary', 'text', 'csv', 'simplelist', 'list',
                         'sameetypelist', 'table', editable-table'.
    :param: view_load_method: The view_load_methods parameter you want for each element ('eager', 'lazy).
    :param: element_support_content: HTML content that contains support content for the element to be shown.
    :param: html_format_to_render: The HTML code to display it,
                        like: 'min-width: 600px; padding: 2px; font-size: 14px; background-color: whitesmoke;'
    :param: render_tab_id: The tab id to display it, only needed if view_load_methods is 'lazy'.
    :param: row_column: The row, column ordinal numbers you want for each view
                        to appear in the table, each starting with 1.
    :param maximum_columns_per_row: The maximum columns per row to render in the view table.

    :return: jm_render_views_content.
    """

    jm_render_view_content = dict()
    jm_render_view_content['sentence_ask_text'] = sentence_ask_text
    jm_render_view_content['element_to_render_as_view'] = element_to_render_as_view
    jm_render_view_content['element_to_render_type'] = element_to_render_type
    jm_render_view_content['render_vid'] = render_vid
    jm_render_view_content['element_support_content'] = element_support_content
    jm_render_view_content['view_load_method'] = view_load_method
    jm_render_view_content['html_format_to_render'] = html_format_to_render
    jm_render_view_content['render_tab_id'] = tab_id
    if row_column is None:
        jm_render_view_content['row_column'] = list(
            jm_position_within_table_with_max_columns(
                len(jm_render_views_content), maximum_columns_per_row))
    else:
        jm_render_view_content['row_column'] = row_column

    jm_render_views_content.append(jm_render_view_content)

    return jm_render_views_content


def jm_render_carousel_styles(view):
    """
    Return HTML/CSS/JS assets required to render the carousel UI component.

    :param view: Calling view context (reserved for compatibility/extension).
    :type view: Any
    :return: HTML string containing style and script blocks for carousel behavior.
    :rtype: str
    """

    view_content = ''

    # Inject carousel styles and initialization script used by rendered view sections.
    view_content += ('''
<style>
    /* --- Carousel Core Styles --- */
    .carousel-container {
        width: 100%;
        box-sizing: border-box;
        box-shadow: 0 8px 22px var(--jm-card-shadow, rgba(19, 49, 67, 0.08));
        border: 1px solid var(--jm-card-border, #cfe0eb);
        border-radius: 14px;
        background: linear-gradient(180deg, var(--jm-carousel-header-from, #f6fafc) 0%, var(--jm-carousel-header-to, #eef5f8) 100%);
        position: relative;
        padding: 8px;
    }

    .carousel-viewport {
        width: 100%;
        overflow: hidden;
        border-radius: 12px;
    }

    .carousel-track {
        display: flex;
        transition: transform 0.5s ease-in-out;
        width: fit-content;
    }

    .carousel-slide {
        flex-shrink: 0;
        width: 1200px; /* Default width, can be overridden by inline style or a more specific class */
        height: 100%;
        box-sizing: border-box;
        text-align: start;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }

    /* Optional: Slide-specific styling */
    .slide-1 { background-color: transparent; }
    .slide-2 { background-color: #b2ebf2; }
    .slide-3 { background-color: #c8e6c9; }
    .slide-4 { background-color: #ffccbc; }

    /* --- Navigation Button Styles (Adapted) --- */

    .carousel-nav-button {
        position: absolute;
        top: 0;
        background: var(--jm-carousel-btn-bg, #ffffff);
        color: var(--jm-carousel-btn-text, #456277);
        border: 1px solid var(--jm-carousel-btn-border, #b8d0e0);
        padding: 3px 5px;
        cursor: pointer;
        z-index: 10;
        font-size: 1em;
        line-height: 1;
        border-radius: 999px;
        transition: background-color 0.2s ease;
        margin: 1px;
        display: none;
        box-shadow: 0 2px 5px var(--jm-card-shadow, rgba(26, 54, 73, 0.08));
    }

    .carousel-nav-button:hover {
        background: var(--jm-carousel-active-bg, #eaf5ff);
        border-color: var(--jm-carousel-active-border, #8eb3ca);
        color: var(--jm-carousel-active-text, #194f6f);
    }

    /* Target buttons using their specific classes instead of IDs */
    .carousel-prev-button {
        left: 1px;
    }

    .carousel-next-button {
        right: 1px;
    }
</style>
   
<script>
(() => {

    /**
     * Initializes the carousel functionality for a single, specific carousel container.
     * @param {HTMLElement} carouselContainer The root element of the carousel.
     */
    function initCarousel(carouselContainer) {
        // Find elements *within* the specific container
        const track = carouselContainer.querySelector('.carousel-track');
        // If no track is found, something is wrong, so stop.
        if (!track) return;

        const viewport = carouselContainer.querySelector('.carousel-viewport');
        const slides = Array.from(track.children);
        // Using querySelector here to find the buttons relative to the *container*
        const nextButton = carouselContainer.querySelector('.carousel-next-button');
        const prevButton = carouselContainer.querySelector('.carousel-prev-button');

        // Resize slides to fill the carousel viewport width so the card uses the full container width.
        const fitSlidesToViewport = () => {
            const vpWidth = viewport ? viewport.clientWidth : carouselContainer.clientWidth;
            if (vpWidth > 0) {
                slides.forEach(slide => { slide.style.width = vpWidth + 'px'; });
            }
        };
        fitSlidesToViewport();

        // Use the first slide's width as the standard for movement
        // We calculate this dynamically, which is crucial for multiple carousels with different slide sizes.
        let slideWidth = slides.length > 0 ? slides[0].getBoundingClientRect().width : 0;
        const slideLabels = slides.map(slide => (slide.getAttribute('data-slide-label') || '').trim());
        
        let currentIndex = 0;
        const totalSlides = slides.length;

        // Ensure we have buttons and slides before proceeding
        if (!nextButton || !prevButton || totalSlides === 0) return;

        const updateNavTooltips = () => {
            const prevLabel = currentIndex > 0 ? (slideLabels[currentIndex - 1] || '') : '';
            const nextLabel = currentIndex < totalSlides - 1 ? (slideLabels[currentIndex + 1] || '') : '';
            const prevText = prevLabel || '';
            const nextText = nextLabel || '';
            prevButton.title = prevText;
            prevButton.setAttribute('aria-label', prevText);
            nextButton.title = nextText;
            nextButton.setAttribute('aria-label', nextText);
        };

        // Function to move the carousel track
        const moveToSlide = (index) => {
            // Calculate the distance to move: index * slide width
            const offset = -index * slideWidth;
            track.style.transform = `translateX(${offset}px)`;
            currentIndex = index;

            // Optional: Disable buttons at the start/end
            prevButton.disabled = currentIndex === 0;
            nextButton.disabled = currentIndex === totalSlides - 1;
            prevButton.style.display = currentIndex === 0 ? 'none' : 'inline-block';
            nextButton.style.display = currentIndex === totalSlides - 1 ? 'none' : 'inline-block';
            updateNavTooltips();
        };

        // Initialize the first slide position and button states
        moveToSlide(0);

        // Event listener for the Next button
        nextButton.addEventListener('click', () => {
            if (currentIndex < totalSlides - 1) {
                moveToSlide(currentIndex + 1);
            }
        });

        // Event listener for the Previous button
        prevButton.addEventListener('click', () => {
            if (currentIndex > 0) {
                moveToSlide(currentIndex - 1);
            }
        });

        // Optional: Re-calculate slide width and reposition on window resize
        window.addEventListener('resize', () => {
            fitSlidesToViewport();
            // Re-calculate the current slide width in case of responsive layout changes
            const currentSlideWidth = slides.length > 0 ? slides[0].getBoundingClientRect().width : 0;
            // The logic uses the *new* slide width but keeps the same *current index*
            const offset = -currentIndex * currentSlideWidth;
            track.style.transform = `translateX(${offset}px)`;
        });
    }

    function runCarouselInit() {
        // 1. Find all elements with the 'data-carousel' attribute.
        const carouselContainers = document.querySelectorAll('[data-carousel]');

        // 2. Loop through each container and initialize a carousel instance.
        carouselContainers.forEach((container) => {
            if (container.dataset.carouselInitialized === '1') return;
            initCarousel(container);
            container.dataset.carouselInitialized = '1';
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runCarouselInit, { once: true });
    }
    // Also run immediately for cases where HTML is injected dynamically.
    setTimeout(runCarouselInit, 0);
})();

</script>
       
    ''')

    return view_content


def jm_render_flipping_card_styles(view):
    """
    Renders a flipping card element.

    :param view: The view calling this function, to use its writing(w) and view rendering(wview) capabilities.

    :return:
    """

    view_content = ''

    view_content += (
        f'''
    <style>
    .container {{
        width: var(--card-width, 100%);
        min-height: var(--card-height, 200px);
        min-width: 300px;
        position: relative;
        perspective: 1000px;
        transition: width 0.3s ease-in-out, height 0.8s ease-in-out;
        overflow-y: auto;
        border: 1px solid var(--jm-card-border, #cfe0eb);
        border-radius: 16px;
        box-shadow: 0 10px 28px var(--jm-card-shadow, rgba(18, 47, 64, 0.10));
        background: var(--jm-card-bg, #ffffff);
        color: var(--jm-text-primary, #0f172a);
    }}

    .jm-card-header {{
        position: sticky;
        top: 0;
        z-index: 4;
        width: 100%;
        min-height: 34px;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        padding: 8px 12px 2px 12px;
        box-sizing: border-box;
        background: linear-gradient(180deg, var(--jm-card-header-from, #f5fbff) 0%, var(--jm-card-header-to, #eff8ff) 100%);
    }}

    .jm-card-buttons {{
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease-in-out;
    }}

    .container:hover .jm-card-buttons,
    .jm-card-header:hover .jm-card-buttons {{
        opacity: 1;
        pointer-events: auto;
    }}

    .jm-card-buttons button:hover {{
        background: var(--jm-btn-hover-bg, #ffffff) !important;
        border-color: #4096ff !important;
        color: #4096ff !important;
    }}

    .card {{
        width: 100%;
        height: 100%;
        /* Height and width are now controlled by the container */
                                                     position: relative;
        transition: transform 0.8s ease-in-out;
        transform-style: preserve-3d;
    }}

    /*
    =========================================================
    2. CSS Flip State
    =========================================================
    */
    .card.is-flipped {{
        transform: rotateY(180deg);
    }}

    /*
    =========================================================
    3. CSS Faces Styling and Positioning
    =========================================================
    */
    .front, .back {{
        position: absolute;
        width: 100%;
        box-sizing: border-box;
        border-radius: 0 0 16px 16px;
        box-shadow: none;
        backface-visibility: hidden;
        min-height: 100%;
        background: var(--jm-card-bg, #ffffff);
        color: var(--jm-text-primary, #0f172a);
    }}

    .front {{
        display: flex;
        flex-direction: column;
        flex-start;
    }}

    .back {{
        transform: rotateY(180deg);
        min-height: 1px;
    }}

    /* Larger Content for the Back */
        .back-content {{
        margin-top: 0;
        padding: 10px 14px 14px;
        border-top: 1px solid var(--jm-card-back-border, #e2eef6);
        background: var(--jm-card-back-bg, #f8fcff);
        color: var(--jm-text-primary, #0f172a);
        }}
        .back-content p {{ margin-bottom: 1em; }}
        .back-content ul {{ padding-left: 20px; list-style-type: disc; }}

</style>
    '''
    )

    return view_content


def jm_render_flipping_card_resizing_scripts(view):
    """
    Renders a flipping card script.

    :param view: The view calling this function, to use its writing(w) and view rendering(wview) capabilities.

    :return: None
    """

    view_content = ''

    view_content += (
        f'''
<script>
/*
=========================================================
4. JavaScript Functionality: Toggle flip class AND manage height
=========================================================
*/
/**
 * Calculates the maximum offsetWidth among an element and all its descendants.
 * @param {{HTMLElement}} element - The parent element to measure.
 
 * @returns {{number}} The maximum width in pixels.
 */
 
function isCardFlipped(id_unique_suffix) {{
    const CardElement = document.getElementById('myCard' + id_unique_suffix);

    if (CardElement) {{
    // The class 'is-flipped' is added/removed by your flipCard function.
    // We use classList.contains() to check if the class is currently present.
    const isFlipped = CardElement.classList.contains('is-flipped');

    return isFlipped; // Returns true if flipped, false otherwise
}}

// Return false if the element wasn't found
console.error('CardElement not found.');
return false;
}}

function getMaxContentWidth(element) {{
    if (!element) return 0;

    // Collect the offsetWidth of all descendants.
    const childrenWidths = Array.from(element.querySelectorAll('*')).map(el => el.offsetWidth);

    // Include the parent's width in case it's the widest container.
    childrenWidths.push(element.offsetWidth);

    // Filter out potential non-finite values before calculating max.
    const validWidths = childrenWidths.filter(w => isFinite(w) && w > 0);

    // Use Math.max with the spread operator. If validWidths is empty, return 0.
    return validWidths.length > 0 ? Math.max(...validWidths) : 0;
    }}

/**
* Calculates the maximum offsetHeight among an element and all its descendants.
* @param {{HTMLElement}} element - The parent element to measure.

* @returns {{number}} The maximum height in pixels.
*/

function getMaxContentHeight(element) {{
    if (!element) return 0;
    
    // Collect the offsetHeight of all descendants.
    const childrenHeights = Array.from(element.querySelectorAll('*')).map(el => el.offsetHeight);
    
    // Include the parent's height.
    childrenHeights.push(element.offsetHeight);
    
    // Filter out potential non-finite values before calculating max.
    const validHeights = childrenHeights.filter(h => isFinite(h) && h > 0);
    
    // Use Math.max with the spread operator. If validHeights is empty, return 0.
    return validHeights.length > 0 ? Math.max(...validHeights) : 0;
    }}

function maximizeCardSize(id_unique_suffix) {{
    
    const CardContainerElement = document.getElementById('cardContainer' + id_unique_suffix);
    const Front = CardContainerElement.querySelector('.front');
    const minHeight = 500;
    const minWidth = 300;
    
    let FacingSize = CardContainerElement.querySelector('.front');
    
    let cardIsFlipped = isCardFlipped(id_unique_suffix);
    
    if (cardIsFlipped)
    {{
        FacingSize = CardContainerElement.querySelector('.back');
    }}

    if (FacingSize) {{
        // Temporarily make the element visible for accurate measurement. ---
        const originalDisplay = FacingSize.style.display;
        const originalVisibility = FacingSize.style.visibility;
    
        // Show element to force reflow and get correct dimensions.
        FacingSize.style.setProperty('display', 'block', 'important');
        FacingSize.style.setProperty('visibility', 'hidden', 'important');
    
        let cardHeight = getMaxContentHeight(FacingSize);
        let cardWidth = getMaxContentWidth(FacingSize);
    
        // --- RESTORE: Restore original display/visibility status. ---
        FacingSize.style.display = originalDisplay;
        FacingSize.style.visibility = originalVisibility;
    
        // Fallback for safety, though getMaxContent should handle this now.
        cardHeight = cardHeight || FacingSize.offsetHeight || minHeight; // Use minimum safe height if 0 is returned
        cardWidth = cardWidth || FacingSize.offsetWidth || minWidth;   // Use minimum safe width if 0 is returned

        // The .front face is position:absolute inside .card, which sits below the sticky
        // .jm-card-header in the container. Add the header height so the bottom of the
        // content (e.g. pagination bar) is not clipped.
        const headerEl = CardContainerElement.querySelector('.jm-card-header');
        cardHeight = cardHeight + (headerEl ? (headerEl.offsetHeight || 0) : 0);

        // Apply the maximum size to the container using CSS variables.
        CardContainerElement.style.setProperty('--card-height', `${{cardHeight}}px`);
        CardContainerElement.style.setProperty('--card-width', `${{cardWidth}}px`);
    }}
    else
    {{
        console.error('FacingSize element not found.');
    }}
    }}

function minimizeCardSize(id_unique_suffix){{
    
    const CardContainerElement = document.getElementById('cardContainer' + id_unique_suffix);
    const Front = CardContainerElement.querySelector('.front');
    const minHeight = 500;
    const minWidth = 300;
    
    let FacingSize = CardContainerElement.querySelector('.front');
    
    let cardIsFlipped = isCardFlipped(id_unique_suffix);
    
    if (cardIsFlipped)
    {{
        FacingSize = CardContainerElement.querySelector('.back');
    }}

    if (FacingSize) {{
        // Temporarily make the element visible for accurate measurement. ---
        const originalDisplay = FacingSize.style.display;
        const originalVisibility = FacingSize.style.visibility;
    
        // Show element to force reflow and get correct dimensions.
        FacingSize.style.setProperty('display', 'block', 'important');
        FacingSize.style.setProperty('visibility', 'hidden', 'important');
    
        let cardHeight = Math.min(minHeight, getMaxContentHeight(FacingSize));
        let cardWidth = Math.min(minWidth, getMaxContentWidth(FacingSize));
    
        // --- RESTORE: Restore original display/visibility status. ---
        FacingSize.style.display = originalDisplay;
        FacingSize.style.visibility = originalVisibility;
    
        // Fallback for safety, though getMaxContent should handle this now.
        cardHeight = cardHeight || FacingSize.offsetHeight || minHeight; // Use minimum safe height if 0 is returned
        cardWidth = cardWidth || FacingSize.offsetWidth || minWidth;   // Use minimum safe width if 0 is returned
    
        // Apply the maximum size to the container using CSS variables.
        CardContainerElement.style.setProperty('--card-height', `${{cardHeight}}px`);
        CardContainerElement.style.setProperty('--card-width', `${{cardWidth}}px`);
    }} 
    else 
    {{
        console.error('FacingSize element not found.');
    }}
        }}

function optimizeCardSizeInViewPort(id_unique_suffix){{

    const CardContainerElement = document.getElementById('cardContainer' + id_unique_suffix);
    const Front = CardContainerElement.querySelector('.front');
    const minHeight = 500;
    const minWidth = 300;
    // Use the parent page's viewport so that iframe auto-resize does not skew the measurement.
    const viewportRef = (window.parent && window.parent !== window) ? window.parent : window;
    // Get the visible viewport width (in pixels)
    const viewportWidth = viewportRef.innerWidth;
    // Get the visible viewport height (in pixels)
    const viewportHeight = viewportRef.innerHeight;
    
    let FacingSize = CardContainerElement.querySelector('.front');
    
    let cardIsFlipped = isCardFlipped(id_unique_suffix);
    
    if (cardIsFlipped)
    {{
        FacingSize = CardContainerElement.querySelector('.back');
    }}

    if (FacingSize) {{
        // Temporarily make the element visible for accurate measurement. ---
        const originalDisplay = FacingSize.style.display;
        const originalVisibility = FacingSize.style.visibility;
    
        // Show element to force reflow and get correct dimensions.
        FacingSize.style.setProperty('display', 'block', 'important');
        FacingSize.style.setProperty('visibility', 'hidden', 'important');
    
        let cardHeight = Math.min(getMaxContentHeight(FacingSize), viewportHeight * 0.8);
        let cardWidth = Math.min(getMaxContentWidth(FacingSize), viewportWidth * 0.7);
    
        // --- RESTORE: Restore original display/visibility status. ---
        FacingSize.style.display = originalDisplay;
        FacingSize.style.visibility = originalVisibility;
    
        // Fallback for safety, though getMaxContent should handle this now.
        cardHeight = cardHeight || FacingSize.offsetHeight || minHeight; // Use minimum safe height if 0 is returned
        cardWidth = cardWidth || FacingSize.offsetWidth || minWidth;   // Use minimum safe width if 0 is returned

        // Account for the sticky .jm-card-header height so the bottom of the content
        // (e.g. pagination bar) is not clipped.
        const headerEl = CardContainerElement.querySelector('.jm-card-header');
        cardHeight = cardHeight + (headerEl ? (headerEl.offsetHeight || 0) : 0);

        // Apply the maximum size to the container using CSS variables.
        CardContainerElement.style.setProperty('--card-height', `${{cardHeight}}px`);
        // Leave --card-width unset so the CSS fallback var(--card-width, 100%) fills the
        // allocated column in both inline and iframe rendering contexts.
    }}
    else
    {{
        console.error('FacingSize element not found.');
    }}
        }}

function increaseCardWidth(id_unique_suffix){{
    
    const CardContainerElement = document.getElementById('cardContainer' + id_unique_suffix);
    const CardElement = document.getElementById('myCard' + id_unique_suffix);
    const Front = CardContainerElement.querySelector('.front');
    
    if (CardElement)
        {{
        // Measure the initial size.
        let cardWidth = CardElement.offsetWidth ;
        cardWidth = cardWidth * 1.30 // To increase the card width from its current size.
        // Set the initial size of the container to the CardElement Front's size.
        CardContainerElement.style.setProperty('--card-width', `${{cardWidth}}px`);
        }}
    else
        {{
            console.error('CardElement not found.');
        }}
        }}

function reduceCardWidth(id_unique_suffix){{
    
    const CardContainerElement = document.getElementById('cardContainer' + id_unique_suffix);
    const CardElement = document.getElementById('myCard' + id_unique_suffix);
    const Front = CardContainerElement.querySelector('.front');
    
    if (CardElement)
        {{
        // Measure the initial size.
        let cardWidth = CardElement.offsetWidth ;
        cardWidth = cardWidth / 1.30 // To reduce the card width from its current size.
        // Set the initial size of the container to the CardElement Front's size.
        CardContainerElement.style.setProperty('--card-width', `${{cardWidth}}px`);
        }}
    else
        {{
            console.error('front not found.');
        }}
        }}
        
function flipCard(id_unique_suffix) {{
    
    const CardElement = document.getElementById('myCard' + id_unique_suffix);
    
    if (CardElement)
        {{
        const isFlipped = CardElement.classList.toggle('is-flipped');
        }}
        else
        {{
            console.error('CardElement not found.');
        }}
        
        optimizeCardSizeInViewPort(id_unique_suffix);
        if (window.Plotly && CardElement) {{
            const plotDivs = CardElement.querySelectorAll('.plotly-graph-div');
            const resizePlots = () => {{
                plotDivs.forEach((plotDiv) => {{
                    try {{
                        window.Plotly.Plots.resize(plotDiv);
                    }} catch (e) {{}}
                }});
            }};
            setTimeout(resizePlots, 0);
            setTimeout(resizePlots, 200);
            setTimeout(resizePlots, 700);
        }}
                }}

</script>
    '''
    )

    return view_content


def jm_render_flipping_card_initialization_scripts(view, id_unique_suffix, actions = ('optimize card',)):
    """
    Renders a script that initializes a flipping card.

    :param view: The view calling this function, to use its writing(w) and view rendering(wview) capabilities.
    :param id_unique_suffix: A unique suffix for the names of the card and its associated elements.
    :param actions: A list of actions to execute, from ('optimize card', 'maximize card', 'minimize card').

    :return: None
    """

    view_content = ''

    if 'optimize card' in actions:

        view_content += (
            f'''
    <script>
    
    optimizeCardSizeInViewPort({id_unique_suffix})
    
    </script>
    '''
        )

    if 'minimize card' in actions:

        view_content += (
            f'''
    <script>
    
    minimizeCardSize({id_unique_suffix})
    
    </script>
    '''
        )

    if 'maximize card' in actions:

        view_content += (
            f'''
    <script>
    
    maximizeCardSize({id_unique_suffix})
    
    </script>
    '''
        )

    return view_content


def _localize_support_content_labels(content: Any) -> str:
    """
    Best-effort i18n pass for common support-panel labels rendered on card backs.
    """
    if content is None:
        return ""
    content_text = str(content)
    if not content_text:
        return ""

    label_keys = [
        "Support",
        "Details",
        "Summary",
        "Query",
        "SQL Query",
        "Rows",
        "Columns",
        "Filters",
        "Result",
        "Results",
        "Error",
        "Errors",
        "Warning",
        "Execution time",
        "Steps",
        "Explanation",
    ]

    localized = content_text
    for label in label_keys:
        translated = _(label)
        # Replace occurrences like "Label:" both in HTML and plain-text contexts.
        localized = re.sub(
            rf"(?i)(^|[>\s]){re.escape(label)}(\s*:)",
            lambda m: f"{m.group(1)}{translated}{m.group(2)}",
            localized,
        )

    # Fileview/back-card configuration labels that often arrive as plain text tokens.
    fileview_label_map = {
        "row": _("row"),
        "sequence": _("sequence"),
        "view_id": _("view_id"),
        "shown_by_default": _("shown_by_default"),
        "html_formats_to_render": _("html_formats_to_render"),
        "view_query_string": _("view_query_string"),
        "executed sql": _("executed SQL"),
        "executed_sql": _("executed SQL"),
    }
    for raw_label, translated in fileview_label_map.items():
        # Replace token in common label forms:
        # "label:", "label =" and standalone "label" boundaries.
        localized = re.sub(
            rf"(?i)(^|[>\s]){re.escape(raw_label)}(\s*[:=])",
            lambda m: f"{m.group(1)}{translated}{m.group(2)}",
            localized,
        )
        localized = re.sub(
            rf"(?i)\b{re.escape(raw_label)}\b",
            translated,
            localized,
        )
    return localized


def jm_render_views(view, entity
                    , jm_render_views_content = None
                    , render_using_function = None
                    , render_using_flipping_cards = True
                    #, schema_relations = DataFrame()
                    , render_style = 'tabular'
                    , include_view_buttons = True
                    , view_initialization_actions = ('optimize card',)
                    ):
    """
    Renders multiple views in a table or rows with carousel, within a view (self), organized in specified rows and columns.

    :param view: The view calling this function, to use its writing(w) and view rendering(wview) capabilities.
    :param jm_render_views_content: a list of jm_render_view_content dicts,
                                    each with the content of the elements to render as views:
        element_to_render_as_view: The elements to render,
                                            which content must be according to each corresponding rsets_to_render_types.
        element_to_render_type: The type or element, either 'cw rset', 'cw rset decomposition, 'dataframe', 'HTML'.
        render_vid: The type or view to display it, like 'primary', 'text', 'csv', 'simplelist', 'list',
                         'sameetypelist', 'table', editable-table'.
        row_column: The row, column ordinal numbers you want for each view
                        to appear in the table, each starting with 1.
        view_load_method: The view_load_methods parameter you want for each element ('eager', 'lazy).
        html_format_to_render: The HTML code to display it,
                        like: 'min-width: 300px; padding: 2px; font-size: 14px; background-color: whitesmoke;'
        render_tab_id: The tab id to display it, only needed if view_load_methods is 'lazy'.
    :param render_style: The style to render the views in: 'tabular' or 'rows with carousel'.

    :param render_using_function: A function to be used to render the content in jm_render_views_content, if any.
    :param render_using_flipping_cards: True if we need the views to be rendered as flipping cards.

    :return: None.
    """

    def render_card_buttons(view):
        """
        Renders the buttons associated to the card: flip the card, auto size the card, and increase and decrease its width.

        :param view: The view calling this function.

        :return: None
        """

        view_content = ''
        button_style = (
            'style="height:24px; width:24px; min-width:24px; padding:0; '
            'border:1px solid var(--jm-btn-border, #d9d9d9); border-radius:6px; background:var(--jm-btn-bg, #fff); '
            'cursor:pointer; font-size:12px; line-height:1; '
            'display:inline-flex; align-items:center; justify-content:center; '
            'color:var(--jm-btn-text, rgba(0,0,0,0.88));"'
        )

        view_content += (
            '<div class="jm-card-header"><div class="jm-card-buttons">'
        )
        view_content += (f'<button '
               f'{button_style} '
               f'onclick="reduceCardWidth({str(id_unique_suffix)})">'
               f'{_(" ➖ ")}'
               f'</button>')
        view_content += (f'<button '
               f'{button_style} '
               f'onclick="increaseCardWidth({str(id_unique_suffix)})">'
               f'{_(" ➕ ")}'
               f'</button>')
        view_content += (f'<button '
               f'{button_style} '
               f'onclick="optimizeCardSizeInViewPort({str(id_unique_suffix)})">'
               f'{_(" 〇 ")}'
               f'</button>')
        view_content += (f'<button '
               f'{button_style} '
               f'onclick="maximizeCardSize({str(id_unique_suffix)})">'
               f'{_(" 🗖 ")}'
               f'</button>')
        view_content += (f'<button '
               f'{button_style} '
               f'onclick="minimizeCardSize({str(id_unique_suffix)})">'
               f'{_(" 🗕 ")}'
               f'</button>')
        view_content += (f'<button '
               f'{button_style} '
               f'onclick="flipCard({str(id_unique_suffix)})">'
               f'{_(" 📚 ")}'
               f'</button>')
        view_content += ('</div></div>')

        return view_content

    # _________________________________________________________________________________________________________
    # START of jm_render_views function.

    view_content = ''

    #try:
    if True:
        jm_config = jm_obtain_config()
        show_back_of_cards = jm_config.getboolean('views', 'show_back_of_cards')

        rows_columns = [jm_render_view_content['row_column'] for jm_render_view_content in jm_render_views_content]

        max_rows = max([row_column[0] for row_column in rows_columns]) if len(rows_columns) > 0 else 0
        max_columns = max([row_column[1] for row_column in rows_columns]) if len(rows_columns) > 0 else 0

        view_content += JM_CSS_VARS_ROOT
        view_content +=  jm_render_flipping_card_styles(view)
        view_content +=  jm_render_flipping_card_resizing_scripts(view)
        view_content +=  jm_render_carousel_styles(view)
        rendered_elements_in_column_count = 0

        for row in range(1, max_rows + 1):
            # render a table row.

            view_content += ('<table style="width:100%; background: transparent; border-collapse: separate; border-spacing: 0;">')
            view_content += ('<tr style="width:100%; text-align: left; vertical-align: top;">')
            rendered_elements_in_row_count = 0

            if render_style == 'rows with carousel':
                view_content += ('<td style="border-radius: 14px; padding: 0;">')
                view_content += ('<div class="carousel-container" data-carousel>')
                view_content += ('<div class="carousel-viewport">')
                view_content += ('<div class="carousel-track" id="carousel-track">')

            for column in range(1, max_columns + 1):
                rendered_elements_in_column_count = 0
                for element_idx, jm_render_view_content in enumerate(jm_render_views_content):
                    pk = getattr(entity, 'id', None) or getattr(entity, 'eid', None) or 1
                    id_unique_suffix = pk * 10000000 + row * 100 + column * 100 + element_idx
                    if jm_render_view_content['row_column'][0] == row:
                        if jm_render_view_content['row_column'][1] == column:
                            # Render the element or relation in this column of the row.

                            this_html_formats_to_render = jm_render_view_content['html_format_to_render']

                            if render_style == 'tabular':
                                view_content += ('<td style="'
                                       + 'border-radius: 16px; '
                                       + 'vertical-align: top; '
                                       + this_html_formats_to_render + '">')
                            elif render_style == 'rows with carousel':
                                slide_label = html.escape(
                                    str(jm_render_view_content.get('sentence_ask_text') or f"{_('File view')} {element_idx + 1}")
                                )
                                view_content += ('<div class="carousel-slide" '
                                       + 'data-slide-label="' + slide_label + '" '
                                       + 'style="' + this_html_formats_to_render + '"'
                                       + '>')

                            #try:
                            if True:
                                if jm_render_view_content['element_to_render_type'] == 'HTML':

                                    if render_using_flipping_cards:
                                        view_content += (f'<div class="container" id="cardContainer{id_unique_suffix}">')
                                        if include_view_buttons:
                                            view_content += render_card_buttons(view)
                                        view_content += (f'<div class="card" id="myCard{id_unique_suffix}">')

                                        view_content += ('<div class="front">')

                                        if render_using_function is not None:
                                            content_to_render = dict()
                                            content_to_render['sentence_ask_text'] = jm_render_view_content['sentence_ask_text']
                                            if len(jm_render_view_content['element_to_render_as_view']) > 0:
                                                content_to_render['answer_view_content'] = jm_render_view_content['element_to_render_as_view']
                                            else:
                                                content_to_render['answer_view_content'] = jm_render_view_content["element_support_content"]
                                            view_content += (
                                                render_using_function(content_to_render
                                                                      , view_content = ''
                                                                      , complete_nl_ask_sentence_text = entity.nl_sentence))
                                        else:
                                            view_content += (jm_render_view_content['element_to_render_as_view'])

                                        view_content += ('</div>')

                                        view_content += ('<div class="back">')
                                        view_content += ('<div class="back-content">')

                                        if show_back_of_cards:
                                            localized_support_content = _localize_support_content_labels(
                                                jm_render_view_content["element_support_content"]
                                            )
                                            view_content += (f'<h4>📚 {_("Support")} </h4>')
                                            view_content += (f'<div>{localized_support_content}</div>')

                                        view_content += ('</div>')  # close .back-content
                                        view_content += ('</div>')  # close .back

                                        view_content += ('</div>')  # close .card
                                        view_content += ('</div>')  # close .container

                                        # Always emit the card initialization script (e.g. "optimize card")
                                        # regardless of show_back_of_cards, so embedded Dynamic views
                                        # auto-size their result cards on render.
                                        view_content += jm_render_flipping_card_initialization_scripts(
                                            view = view
                                            , id_unique_suffix = id_unique_suffix
                                            , actions = view_initialization_actions)

                                    else:
                                        if render_using_function is not None:
                                            content_to_render = dict()
                                            content_to_render['sentence_ask_text'] = jm_render_view_content['sentence_ask_text']
                                            content_to_render['answer_view_content'] = jm_render_view_content['element_to_render_as_view']
                                            view_content += (
                                                render_using_function(content_to_render
                                                                      , view_content = ''
                                                                      , complete_nl_ask_sentence_text = entity.nl_sentence))
                                            view_content += (view_content)
                                        else:
                                            view_content += (jm_render_view_content['element_to_render_as_view'])

                                if (not render_using_flipping_cards
                                        and len(jm_render_view_content['element_support_content']) > 0):
                                    if render_using_function is not None:
                                        content_to_render = dict()
                                        content_to_render['answer_view_content'] = ''
                                        content_to_render['steps_view_content'] = jm_render_view_content['element_support_content']
                                        view_content += (
                                            render_using_function(content_to_render
                                                                  , view_content = ''
                                                                  , complete_nl_ask_sentence_text = entity.nl_sentence))

                            #except Exception as e:
                            else:
                                jm_log(1, 'Error in jm_render_views on element: %s' % element_idx)
                                jm_log(1, e)

                            if render_style == 'tabular':
                                view_content += ('</td>')
                            elif render_style == 'rows with carousel':
                                view_content += ('</div>') # carousel-slide slide-1

                            rendered_elements_in_column_count += 1
                            rendered_elements_in_row_count += 1

                if render_style == 'tabular' and rendered_elements_in_column_count == 0:
                    # Render an empty table data cell in this column of the row.
                    view_content += ('<td style="min-width:10px; vertical-align: top;">')
                    view_content += ('</td>')

            # End of row rendering.
            if render_style == 'rows with carousel':
                view_content += ('</div>') # carousel-track
                view_content += ('</div>') # carousel-viewport
                if rendered_elements_in_row_count > 1:
                    view_content += (f'<button class="carousel-nav-button carousel-prev-button" aria-label="{_("Previous Slide")}"> &lt; </button>')
                    view_content += (f'<button class="carousel-nav-button carousel-next-button" aria-label="{_("Next Slide")}"> &gt; </button>')
                view_content += ('</div>') # carousel-container
                view_content += ('</td>') # carousel's td

            if rendered_elements_in_row_count > 0:
                view_content += ('<br>') # As a separator at the end of each row.

            view_content += ('</tr>')
            view_content += ('</table>')

    #except Exception as e:
    else:
        jm_log(1, "An error has occurred in jm_render_views.", text_color='RED')
        jm_log(1, e)

    return view_content


def render_results_details_header(self, details_bar_text=None
                                  , render_jm_commands_results=True, shown_by_default=True
                                  , background_color='var(--jm-kpi-banner-bg, #E0FFFF)', text_color='var(--jm-text-tertiary, #666666)', font_size='13px'
                                  , render_delimiter_line=True):
    """
    Renders the result details header for a sentence in a standard and collapsible way.
    :param render_jm_commands_results: True if the results must be rendered in the page.
    :param self: The calling class, to use its self.w method.
    :param details_bar_text: The text that will be shown in the results details bar.
    :param shown_by_default: True if the collapsible section must be shown by default.
    :param background_color: The color for the summary style background.
    :param render_delimiter_line: True if we want delimiter lines <hr> at the start of the section.

    :return: None
    """

    if details_bar_text is None:
        details_bar_text = _('Show/Hide detailed results')

    view_content = ''

    if render_delimiter_line:
        view_content += ('<hr>')

    if shown_by_default:
        view_content += ('<details open align="left" style="color:var(--jm-text-tertiary, #666666);">')
    else:
        view_content += ('<details align="left" style="color:var(--jm-text-tertiary, #666666);">')
    view_content += f'<summary style="background-color:{background_color}; color:{text_color}; font-size:{font_size};">{details_bar_text}</summary>'

    # view_content += ('<br>')

    if render_jm_commands_results and hasattr(self, 'w'):
        self.w(view_content)

    return view_content


def render_results_details_footer(self, render_jm_commands_results=True, render_delimiter_line=True):
    """
    Renders the results details footer for a sentence in a standard and collapsible way.
    :param render_jm_commands_results: True if the results must be rendered in the page.
    :param self: The calling class, to use its self.w method.
    :param render_delimiter_line: True if we want delimiter lines <hr> by the end of the section.
    :return: None
    """

    view_content = ''

    view_content += ('</details>')
    #view_content += ('<br>')

    if render_delimiter_line:
        view_content += ('<hr>')
        view_content += ('<br>')

    if render_jm_commands_results and hasattr(self, 'w'):
        self.w(view_content)

    return view_content


def add_nodes_to_cause_effect_elements(
        nodes_to_add
        , Graph
        , number_of_levels
        , my_level
        , larger_vertical_elements
        , orientation = 'right to left'
        , default_colorbar_label = 'Progress'
        , marker_dict = {
            'marker_symbol': 'circle'
            , 'maker_color': 'lightblue'
            , 'marker_line_color': 'lightgray'
            , 'marker_line_width': 2
        }
):
    """

    :param nodes_to_add: and rset od a DataFrame with the entities to add to cause_effect_nodes
                            where column [0] has the nodes to add and column [1] has the node to link it to.
    :param Graph: the list of cause effect nodes to add the nodes_to_add to.
    :param number_of_levels: the total number of levels that will be added as columns in the cause_effect_chart-
    :param my_level: the level we are adding. The nodes_to_add will be added to that level.
    :param larger_vertical_elements: larger_vertical_elements: The maximum number of elements in all levels.
    :param orientation: 'right to left' or 'left to right' or 'bottom to top' or 'top to bottom'. Default is 'right to left'

    :return:
    """

    def xy_position_cause_effect_elements(
            number_of_levels
            , my_level
            , larger_vertical_elements
            , my_element_sequence
            , total_elements_in_my_level
            , orientation=orientation
    ):
        """

        Calculates the x and y positions for certain element on a list of elements
        to be plotted on a plot_cause_effect_chart (below)

        :param number_of_levels: The number of horizontal levels in the chart, from right to left.
        :param my_level: The level this element will be plotted in, from right to left.
        :param larger_vertical_elements: The maximum number of elements in all levels.
        :param my_element_sequence: the element sequence number this element has within my level.
        :param total_elements_in_my_level: The total number of elements in my level.
        :param orientation: 'right to left' or 'left to right' or 'bottom to top' or 'top to bottom'. Default is 'right to left'
        :return: a list with [x_position,y_position]
        """

        level_to_level_spare_proportion = number_of_levels * 4
        middle_of_larger_vertical_elements = larger_vertical_elements / 2

        x_position = (number_of_levels - my_level) * level_to_level_spare_proportion
        # apply a Nice! curve effect:)
        middle_total_elements_in_my_level = round(total_elements_in_my_level / 2)
        x_position_curve_adjustment = (
                middle_total_elements_in_my_level
                - abs(middle_total_elements_in_my_level - my_element_sequence)
        )

        # if the node element is at the upper side of the curve apply an offset to avoid text overlap
        if my_element_sequence > middle_total_elements_in_my_level:
            x_position_curve_adjustment = x_position_curve_adjustment - 1

        x_position = x_position - x_position_curve_adjustment

        # position each element vertically centered around the middle_of_larger_vertical_elements, plus an offset to avoid long names overlap
        y_position = (
                             (middle_of_larger_vertical_elements
                              - (total_elements_in_my_level / 2)
                              ) + my_element_sequence
                     ) * level_to_level_spare_proportion

        if orientation == 'right to left':
            y_position = y_position + my_level
            return [x_position, y_position]
        else:
            if orientation == 'left to right':
                y_position = y_position + my_level
                return [- x_position, -y_position]
            else:
                if orientation == 'bottom to top':
                    return [- y_position, - x_position]
                else:
                    if orientation == 'top to bottom':
                        return [y_position, x_position]
                    else:
                        return [x_position, y_position]

    def style_resultset_for_cause_effect_chart(nodes_resultset_to_style
                                               , marker_dict):
        """
        Styles a resultset to be used as styled nodes for a cause effect chart.

        :param nodes_resultset_to_style: The resultset to be styled, containing at least two columns
                                        for each cause-effect node pairs:
                                    column 0 must contain the entity ID (eid) of the entity for the "cause" (or "origin") node.
                                    column 1 must contain the entity ID (eid) of the entity for the "effect" (or destination) node.
        :param marker_dict: A dictionary containing the dictionary of visual styling elements for all the "cause" (or "origin") nodes.
                            The default if not provides is:

        :return: An equivalent DataFrame with the styling information to create a cause effect chart.
        """

        node_pairs_styled_for_cause_effect_df = DataFrame(nodes_resultset_to_style)
        node_pairs_styled_for_cause_effect_df['dc_title'] = ''
        node_pairs_styled_for_cause_effect_df['url'] = ''
        node_pairs_styled_for_cause_effect_df['progress'] = 0
        # DataFrames can only create columns that contain a dict when assigned to a specific cell.
        # So it is created with None at first.
        node_pairs_styled_for_cause_effect_df['marker_dict'] = None

        for rsetrow in range(0, nodes_resultset_to_style.rowcount):
            node_pairs_styled_for_cause_effect_df.at[rsetrow, 'dc_title'] = nodes_resultset_to_style.get_entity(rsetrow, 0).dc_title()
            node_pairs_styled_for_cause_effect_df.at[rsetrow, 'url'] = nodes_resultset_to_style.get_entity(rsetrow, 0).absolute_url()
            node_pairs_styled_for_cause_effect_df.at[rsetrow, 'progress'] = random.randint(0, 9)
            node_pairs_styled_for_cause_effect_df.at[rsetrow, 'color'] = node_pairs_styled_for_cause_effect_df.at[rsetrow, 'progress']

        for row in node_pairs_styled_for_cause_effect_df.index:
            node_pairs_styled_for_cause_effect_df.at[row, 'marker_dict'] = marker_dict

        return node_pairs_styled_for_cause_effect_df

    # START of add_nodes_to_cause_effect_elements

    default_marker_dict = dict(
        showscale=True,
        # colorscale options
        # 'Greys' | 'YlGnBu' | 'Greens' | 'YlOrRd' | 'Bluered' | 'RdBu' |
        # 'Reds' | 'Blues' | 'Picnic' | 'Rainbow' | 'Portland' | 'Jet' |
        # 'Hot' | 'Blackbody' | 'Earth' | 'Electric' | 'Viridis' |
        colorscale='Blues',
        reversescale=False,
        color=[],
        size=45,

        colorbar=dict(
            thickness=15,
            title=default_colorbar_label,
            xanchor='left',
            titleside='right'
        ),
        line_width=2,
        line_color='lightgray'
    )

    edge_labels = []

    if not isinstance(nodes_to_add, DataFrame):
        # The nodes_to_add is a resultset. Transform it into a styled DataFrame for a cause effect chart.
        nodes_to_add = style_resultset_for_cause_effect_chart(nodes_to_add, marker_dict)

    # Add the nodes_to_add DataFrame to the Graph and its complementary edge_labels.
    for dfrow in range(0, len(nodes_to_add.index)):

        # add nodes to cause effect elements from a DataFrame.
        Graph.add_node(nodes_to_add.iat[dfrow, 0])
        Graph.nodes[nodes_to_add.iat[dfrow, 0]]['label'] = nodes_to_add.iloc[dfrow]['dc_title']
        Graph.nodes[nodes_to_add.iat[dfrow, 0]]['position_xy'] = \
            xy_position_cause_effect_elements(number_of_levels, my_level, larger_vertical_elements, dfrow + 1,
                                              len(nodes_to_add.index), orientation=orientation)
        if 'progress' in nodes_to_add.columns:
            Graph.nodes[nodes_to_add.iat[dfrow, 0]]['progress'] = nodes_to_add.iloc[dfrow]['progress']
        else:
            Graph.nodes[nodes_to_add.iat[dfrow, 0]]['progress'] = random.randint(0, 9)
        if 'color' in nodes_to_add.columns:
            Graph.nodes[nodes_to_add.iat[dfrow, 0]]['color'] = nodes_to_add.iloc[dfrow]['color']
        else:
            Graph.nodes[nodes_to_add.iat[dfrow, 0]]['color'] = 'lightblue'
        if 'marker_dict' in nodes_to_add.columns:
            Graph.nodes[nodes_to_add.iat[dfrow, 0]]['marker_dict'] = nodes_to_add.iloc[dfrow]['marker_dict']
        else:
            Graph.nodes[nodes_to_add.iat[dfrow, 0]]['marker_dict'] = default_marker_dict
        Graph.nodes[nodes_to_add.iat[dfrow, 0]]['url'] = nodes_to_add.iloc[dfrow]['url']

        # if there are causes on nodes_to_add nodes_to_add column 1,
        # link the nodes on nodes_to_add column 1 as effects of cause on nodes_to_add column 0
        cause_node = nodes_to_add.iat[dfrow, 1]
        # Anchor rows (no parent cause) carry None/NaN in column 1; skip the edge so
        # networkx does not reject None as a node.
        if cause_node is None or pandas.isna(cause_node):
            continue
        try:
            Graph.add_edge(cause_node, nodes_to_add.iat[dfrow, 0])
            if 'edge_label' in nodes_to_add.columns:
                edge_labels.append((Graph.nodes[cause_node]
                                        , Graph.nodes[nodes_to_add.iat[dfrow, 0]]
                                        , nodes_to_add.iloc[dfrow]['edge_label']
                                    ))
        except Exception as e:
            jm_log(1, 'An error has occurred while cause_effect_nodes.add_edge in add_nodes_to_cause_effect_elements')
            jm_log(1, e)

    return Graph, edge_labels


def plot_cause_effect_chart(
        self, entity
        , Graph, edge_labels=[]
        , node_marker_symbol='circle'
        , plot_title='Benefit Realisation Map'
        , colorbar_label='Progress', render_plot = True):
    """
    Creates HTML view content for a plot cause-effect chart with nodes and lines connecting the nodes,
    which are provided in the Graph and edge_labels.

    :param self: The view class, to use its render capabilities.
    :param entity: The entity of the view calling this class, for logging purposes.
    :param Graph: A Graph object created with the nx library containing the nodes and their connections to plot.
    :param edge_labels: A list of labels for each line of the chart, because nx does not support names to the node connection lines.
    :param node_marker_symbol: The symbol to use as a marker for the nodes of the chart.
    :param plot_title: The title of the plot.
    :param colorbar_label: The color of the bar label of the chart.
    :param render_plot: True if we want the plot to be rendered.
                        False if we just need the HTML view content of the plot cause-effect chart.

    :return: plot_view_content, with the HTML view content of the plot cause-effect chart.
    """

    edge_x = []
    edge_y = []
    line_labels = []
    line_labels_x = []
    line_labels_y = []

    for edge in Graph.edges():
        # Only plot an edge if both sides have position_xy.
        if 'position_xy' in Graph.nodes[edge[0]].keys() and 'position_xy' in Graph.nodes[edge[1]].keys():
            x0, y0 = Graph.nodes[edge[0]]['position_xy']
            x1, y1 = Graph.nodes[edge[1]]['position_xy']

            edge_x.append(x0)
            edge_x.append(x1)
            edge_x.append(None)

            edge_y.append(y0)
            edge_y.append(y1)
            edge_y.append(None)

    edge_trace = go.Scatter(
        x=edge_x, y=edge_y,
        line=dict(width=0.5, color='#888'),
        mode='lines',
    )

    node_x = []
    node_y = []
    node_progress = []
    node_color = []
    node_marker_symbols = []
    node_marker_colors = []
    node_marker_sizes = []
    marker_line_widths = []
    marker_line_colors = []

    for node in Graph.nodes():
        # Only plot an edge if the node has position_xy.
        if 'position_xy' in Graph.nodes[node].keys():
            x, y = Graph.nodes[node]['position_xy']
            node_x.append(x)
            node_y.append(y)
            node_progress.append(Graph.nodes[node]['progress'])
            node_color.append(Graph.nodes[node]['color'])
            if 'marker_dict' in Graph.nodes[node].keys():
                if 'marker_symbol' in Graph.nodes[node]['marker_dict'].keys():
                    node_marker_symbols.append(Graph.nodes[node]['marker_dict']['marker_symbol'])
                else:
                    node_marker_symbols.append(node_marker_symbol)
                if 'marker_color' in Graph.nodes[node]['marker_dict'].keys():
                    node_marker_colors.append(Graph.nodes[node]['marker_dict']['marker_color'])
                else:
                    node_marker_colors.append('lightblue')
                if 'marker_size' in Graph.nodes[node]['marker_dict'].keys():
                    node_marker_sizes.append(Graph.nodes[node]['marker_dict']['marker_size'])
                else:
                    node_marker_sizes.append(45)
                if 'marker_line_width' in Graph.nodes[node]['marker_dict'].keys():
                    marker_line_widths.append(Graph.nodes[node]['marker_dict']['marker_line_width'])
                else:
                    marker_line_widths.append(1)
                if 'marker_line_color' in Graph.nodes[node]['marker_dict'].keys():
                    marker_line_colors.append(Graph.nodes[node]['marker_dict']['marker_line_color'])
                else:
                    marker_line_colors.append('lightgray')

    node_trace = go.Scatter(
        x=node_x, y=node_y,
        mode='text + markers',
        hoverinfo='text',
        text='Node',

        marker=dict(
            showscale=True,
            # colorscale options
            # 'Greys' | 'YlGnBu' | 'Greens' | 'YlOrRd' | 'Bluered' | 'RdBu' |
            # 'Reds' | 'Blues' | 'Picnic' | 'Rainbow' | 'Portland' | 'Jet' |
            # 'Hot' | 'Blackbody' | 'Earth' | 'Electric' | 'Viridis' |
            colorscale='Blues',
            reversescale=False,
            symbol=node_marker_symbols,
            color=node_marker_colors,
            size=node_marker_sizes,

            line=dict(
                width=marker_line_widths,
                color=marker_line_colors
            ),

            colorbar=dict(
                thickness=15,
                title=dict(
                    text=colorbar_label,
                    side='right'
                ),
                xanchor='left'
            ),
        ))

    node_text = []
    node_color = []
    node_progress = []

    for node in Graph.nodes():
        if 'label' in Graph.nodes[node].keys():
            raw_label = str(Graph.nodes[node].get('label', ''))
            safe_label = html.escape(raw_label).replace('&lt;br&gt;', '<br>')
            node_text.append(safe_label)
            node_color.append(Graph.nodes[node]['color'])
            node_progress.append(Graph.nodes[node]['progress'])

    node_trace.marker.color = node_color
    node_trace.text = node_text

    fig = go.Figure(data=[edge_trace, node_trace],
                    layout=go.Layout(
                        title=dict(
                            text='<br>' + plot_title,
                            font=dict(size=16),
                        ),
                        plot_bgcolor='rgba(0,0,0,0)',
                        paper_bgcolor='rgba(0,0,0,0)',
                        font=dict(family="sans-serif", size=12, color="#8a97a5"),
                        showlegend=False,
                        hovermode='closest',
                        margin=dict(b=20, l=5, r=5, t=40),
                        annotations=[dict(
                            text=entity.dc_title(),
                            showarrow=False,
                            xref="paper", yref="paper",
                            x=0.005, y=-0.002)],
                        xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
                        yaxis=dict(showgrid=False, zeroline=False, showticklabels=False))

                    )

    # Write the line_labels for the edge lines.
    for edge_label_sequence, edge_label in enumerate(edge_labels):
        #try:
        if True:
            x0, y0 = edge_label[0]['position_xy']
            x1, y1 = edge_label[1]['position_xy']
            edge_label_text = edge_label[2]

            if edge_label_text != '':
                # Only include the label if there is an edge line
                # having a start different from its end.
                if x0 != x1 or y0 != y1:
                    line_labels.append(edge_label_text)
                    # Set the line_labels_x and line_labels_y positions in the middle of the 0 and 1 edges.
                    line_labels_x.append((x0 + x1) / 2)
                    line_labels_y.append((y0 + y1) / 2)
        #except:
        else:
            jm_log(1,
                   'An error occurred in plot_cause_effect_chart: There edge_label data to plot in the node. Skipping Edge.')

    for line_labels_sequence, line_label in enumerate(line_labels):
        fig.add_annotation(
            x=line_labels_x[line_labels_sequence],
            y=line_labels_y[line_labels_sequence],
            text=line_labels[line_labels_sequence],
            font=dict(
                # family="sans serif",
                size=10,
                color="gray"
            ),
            showarrow=True,
            arrowhead=1,
            arrowcolor="lightgray",
            yshift=0
        )

    fig.update_traces(textposition='top center')

    htmlembeddableplot = pyo.plot(fig, include_plotlyjs=False, output_type='div')

    plot_view_content = jm_get_plotly_chart_embeddable_html(htmlembeddableplot)

    if render_plot:
        if plot_view_content and hasattr(self, 'w'):
            self.w(plot_view_content)

    return plot_view_content


def __getattr__(name):
    if name == "engine":
        from veloiq_framework.db import get_engine
        return get_engine()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
def jm_apply_standard_chart_layout(
    fig,
    title: str = "",
    xaxis_title: str = "",
    yaxis_title: str = "",
    hovermode=None,
    barmode=None,
    annotations=None,
    **extra_layout,
) -> None:
    """
    Apply the standard JM chart layout to a Plotly figure in-place.

    Sets compact margins (l=8, r=8, t=36, b=8), transparent backgrounds,
    font size 12, subtle grid lines on both axes, and a transparent legend.
    Chart-specific parameters (title, axis labels, barmode, hovermode,
    annotations) are forwarded to update_layout; additional keyword
    arguments in extra_layout are merged last so callers can override any
    standard value.  Tick font size 12 is applied to all axes.
    """
    layout: dict = dict(
        margin=dict(l=8, r=8, t=36, b=8),
        plot_bgcolor="rgba(0,0,0,0)",
        paper_bgcolor="rgba(0,0,0,0)",
        font=dict(size=12, color="#666666"),
        xaxis=dict(gridcolor="rgba(128,128,128,0.22)", zeroline=False, automargin=True),
        yaxis=dict(gridcolor="rgba(128,128,128,0.22)", zeroline=False, automargin=True),
        legend=dict(
            bgcolor="rgba(0,0,0,0)",
            bordercolor="rgba(128,128,128,0.35)",
            borderwidth=1,
            font=dict(size=12, color="#666666"),
        ),
    )
    if title:
        layout["title"] = title
    if xaxis_title:
        layout["xaxis_title"] = xaxis_title
    if yaxis_title:
        layout["yaxis_title"] = yaxis_title
    if hovermode is not None:
        layout["hovermode"] = hovermode
    if barmode is not None:
        layout["barmode"] = barmode
    if annotations is not None:
        layout["annotations"] = annotations
    layout.update(extra_layout)
    fig.update_layout(**layout)
    fig.update_xaxes(tickfont=dict(size=12, color="#666666"), automargin=True)
    fig.update_yaxes(tickfont=dict(size=12, color="#666666"), automargin=True)

