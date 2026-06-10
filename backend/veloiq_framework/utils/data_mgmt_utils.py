"""VeloIQ-native ``data_mgmt_utils`` substrate for the ported NLP engine.

Functions/classes below the header are extracted verbatim from JuiceMantics'
``app/utils/data_mgmt_utils.py`` (the pure-logic subset reached on the
single-sentence → SQL path). The DB/entity functions the engine calls
(``jm_execute_sql``, ``jm_connect_to_db``, ``jm_obtain_db_connector`` …) are
reimplemented at the bottom against VeloIQ's SQLAlchemy engine. RQL/ORM-dialect
and entity-mutation functions are stubbed (never reached on the SQL branch).
"""
import smtplib, ssl
import html
import re, time, os, sys, string, json, ast, copy, math
from datetime import datetime, date
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List, Dict, Any, Optional, Tuple
try:
    from numpy.core.defchararray import isnumeric
except Exception:  # numpy>=2 removed numpy.core.defchararray
    from numpy.char import isnumeric
import dateparser
import numpy
from numpy import random
import pandas as pd
from pandas import DataFrame, concat
from sqlalchemy import inspect, text, func, literal, bindparam, and_, or_, exists
from sqlalchemy.orm import aliased, object_session
from sqlalchemy.sql.dml import Insert, Update, Delete
from sqlmodel import SQLModel, Session, select
from dateutil.parser import parse
try:
    from colorama import Fore, Style, init
except Exception:  # colorama optional
    class _NoColor:
        def __getattr__(self, _n): return ""
    Fore = Style = _NoColor()
    def init(*a, **k): pass

from veloiq_framework.utils.i18n_utils import _


# JuiceMantics base-model class; SQLModel is the closest VeloIQ analog. Used only
# in isinstance / typing positions by the extracted code.
StandardModel = SQLModel

# Hook placeholders (JM SQLAlchemy event callbacks; no-ops in the NLP port).
def pre_save(*args, **kwargs):
    return None

def post_save(*args, **kwargs):
    return None
jm_action_db_query_prefix = 'jm_action: '


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
        if cause_node is None or pd.isna(cause_node):
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


def jm_identify_date_period_columns(df):
    """
    Identifies columns in a Pandas DataFrame that strictly adhere to common
    date or year-month Period formats.

    Args:
        df (pd.DataFrame): The input DataFrame.

    Returns:
        tuple: A tuple containing two lists:
               - date_columns: List of column names likely to be dates.
               - period_columns: List of column names likely to be year-month periods.
    """
    date_columns = []
    period_columns = []
    date_formats = ['%Y-%m-%d', '%Y/%m/%d', '%m-%d-%Y', '%m/%d/%Y',
                    '%Y-%m', '%Y/%m', '%m-%Y', '%m/%Y'] # Common date/period formats

    non_numeric_columns = df.select_dtypes(exclude=['number']).columns.tolist()

    for col in non_numeric_columns:
        is_date = False
        is_period = False

        # Try parsing as datetime with various formats
        for fmt in date_formats:
            try:
                pd.to_datetime(df[col], format=fmt, errors='raise')
                is_date = True
                break
            except (ValueError, TypeError):
                pass

        if is_date:
            date_columns.append(col)
            continue # Move to the next column

        # If not identified as a full date, specifically check for year-month periods
        try:
            pd.PeriodIndex(df[col], freq='M')
            is_period = True
        except (ValueError, TypeError):
            pass

        if is_period:
            period_columns.append(col)

    date_or_period_columns = date_columns + period_columns

    return date_or_period_columns


def jm_extract_date_from_any_format(any_format_date, languages = ('en', 'es')):
    """
    Extracts a date from any given format and returns it as a Python `date` object.

    The function uses `pandas.to_date` for automatic parsing of the input date.
    If automatic parsing fails, it falls back to a set of predefined common date
    formats to attempt parsing. If none of these formats work, it raises a
    `ValueError`.

    :param any_format_date: The date input in any format to be parsed into a
                            `date` object.
    :type any_format_date: Any
    :param languages: The languages the date might be written in.

    :return: A `date` object representing the parsed date.
    :rtype: date
    :raises ValueError: If the input date has an unrecognized or unsupported
                        format.
    """

    try:
        if len(languages) > 0:
            converted_date = dateparser.parse(any_format_date, languages = languages)
        else:
            # Looks into about 200 languages automatically based on the detected language, but runs slower.
            converted_date = dateparser.parse(any_format_date)

    except:

        try:
            converted_datetime = pd.to_datetime(any_format_date, errors='raise').to_pydatetime()
            converted_date = converted_datetime.date()

        except Exception:
            # Fallback to a set of common date formats if automatic parsing fails
            common_formats = (
                "%Y-%m-%d", "%Y/%m/%d",
                "%d/%m/%Y", "%m/%d/%Y",
                "%d-%m-%Y", "%m-%d-%Y",
                "%d %b %Y", "%d %B %Y",
                "%b %d, %Y", "%B %d, %Y",
            )

            for fmt in common_formats:
                try:
                    parsed_datetime = datetime.strptime(str(any_format_date), fmt)
                    converted_date = parsed_datetime.date()
                    break
                except Exception:
                    continue

    return converted_date


def jm_unique_list(list_to_make_unique: list):
    """
    Generate a list of unique elements from the input list_to_make_unique by removing
    duplicate elements while maintaining the order of first appearance.

    This function ensures that only the first occurrence of each element is
    included in the final list, effectively creating a collection of unique
    items based on their order in the original input.

    :param list: A list that may contain duplicate elements.
    :type list: list
    :return: A new list containing only unique elements from the input list,
        preserving the order of their first appearance.
    :rtype: list
    """

    unique_list = []
    for item in list_to_make_unique:
        if item not in unique_list:
            unique_list.append(item)

    return unique_list


class SimpleSignal:
    def __init__(self):
        self._receivers = []

    def connect(self, receiver):
        self._receivers.append(receiver)

    def send(self, sender=None, **kwargs):
        for receiver in self._receivers:
            try:
                receiver(sender=sender, **kwargs)
            except Exception as exc:
                jm_log(1, "Signal receiver error:", exc)


pre_save = SimpleSignal()


def _get_session(session=None):
    """
    Obtain a SQLModel session and indicate whether it was created internally.

    :param session: Existing session to reuse. If ``None``, a new session is created.
    :type session: Session | None
    :return: A tuple with the session and a boolean flag indicating if it was created here.
    :rtype: tuple[Session, bool]
    """
    created = False
    # Create a new session only when one was not supplied by the caller.
    if session is None:
        from veloiq_framework.db import get_engine
        # expire_on_commit=False so SQLModel instances returned from an INSERT
        # (e.g. a persisted DbQuery) keep their attributes — including the
        # autoincrement eid — readable after the session is committed/closed.
        session = Session(get_engine(), expire_on_commit=False)
        created = True
    return session, created


def _normalize_sql_query(sql, params):
    """
    Convert pyformat SQL parameters into SQLAlchemy named bind parameters.

    :param sql: SQL text that may contain placeholders like ``%(name)s``.
    :type sql: str
    :param params: Parameter dictionary used with the SQL statement.
    :type params: dict | None
    :return: SQL text normalized to ``:name`` placeholders.
    :rtype: str
    """
    if not params:
        return sql
    normalized = sql
    # Replace each "%(key)s" placeholder with SQLAlchemy's ":key" syntax.
    for key in params.keys():
        normalized = normalized.replace(f"%({key})s", f":{key}")
    return normalized


def _resolve_orm_model(model_name, model_map=None):
    """
    Resolve a model class from an alias map or by model name lookup.

    :param model_name: Name or alias of the ORM model to resolve.
    :type model_name: str
    :param model_map: Optional alias-to-model mapping.
    :type model_map: dict | None
    :return: The resolved model class, or ``None`` if no match is found.
    :rtype: type | None
    """
    # First honor explicit alias mappings provided by the query builder.
    if model_map and model_name in model_map:
        return model_map[model_name]
    # Fall back to dynamic model discovery by name.
    model = jm_obtain_model_by_name(model_name)
    if not model:
        jm_log(1, f"Model {model_name} not found")
    return model


def _resolve_orm_column(model_name, column_name, model_map=None):
    """
    Resolve a model attribute representing a column by model and column names.

    :param model_name: Name or alias of the model containing the column.
    :type model_name: str
    :param column_name: Name of the target column/attribute.
    :type column_name: str
    :param model_map: Optional alias-to-model mapping.
    :type model_map: dict | None
    :return: SQLAlchemy column attribute if found, otherwise ``None``.
    :rtype: Any | None
    """
    # Resolve the model first, then fetch the requested attribute safely.
    model = _resolve_orm_model(model_name, model_map=model_map)
    if model is None:
        return None
    return getattr(model, column_name, None)


def _resolve_orm_value(value):
    """
    Convert special value markers into SQLAlchemy bind parameters.

    :param value: Literal value or parameter marker (for example ``":status"``).
    :type value: Any
    :return: Bind parameter when value is a marker, otherwise the original value.
    :rtype: Any
    """
    # Interpret leading ":" values as named bind parameters.
    if isinstance(value, str) and value.startswith(":"):
        return bindparam(value[1:])
    return value


def _build_orm_condition(condition, model_map=None):
    """
    Build a SQLAlchemy boolean expression from a condition specification.

    Supported formats include plain column conditions and typed tuples such as
    ``("col", model, column, op, value)`` or
    ``("agg", func_name, model, column, op, value)``.

    :param condition: Tuple/list describing the condition.
    :type condition: list | tuple
    :param model_map: Optional alias-to-model mapping.
    :type model_map: dict | None
    :return: SQLAlchemy clause expression or ``None`` if the condition is invalid.
    :rtype: Any | None
    """
    if not condition:
        return None

    # Parse the condition tuple and resolve the left-hand expression.
    if condition[0] in ("col", "agg"):
        kind = condition[0]
        if kind == "col":
            if len(condition) < 5:
                return None
            _kind, model_name, column_name, op, value = condition[:5]
            left = _resolve_orm_column(model_name, column_name, model_map=model_map)
        else:
            if len(condition) < 6:
                return None
            _kind, func_name, model_name, column_name, op, value = condition[:6]
            column = _resolve_orm_column(model_name, column_name, model_map=model_map)
            if column is None:
                return None
            left = getattr(func, func_name)(column)
    else:
        if len(condition) < 4:
            return None
        model_name, column_name, op, value = condition[:4]
        left = _resolve_orm_column(model_name, column_name, model_map=model_map)

    if left is None:
        return None

    # Normalize operator text to dispatch to the corresponding SQLAlchemy operation.
    op = op.lower().strip()

    if op in ("=", "=="):
        return left == _resolve_orm_value(value)
    if op in ("!=", "<>"):
        return left != _resolve_orm_value(value)
    if op == ">":
        return left > _resolve_orm_value(value)
    if op == ">=":
        return left >= _resolve_orm_value(value)
    if op == "<":
        return left < _resolve_orm_value(value)
    if op == "<=":
        return left <= _resolve_orm_value(value)
    if op == "like":
        return left.like(_resolve_orm_value(value))
    if op == "ilike":
        return left.ilike(_resolve_orm_value(value))
    if op == "is":
        return left.is_(_resolve_orm_value(value))
    if op in ("is not", "is_not"):
        return left.isnot(_resolve_orm_value(value))
    if op in ("in", "not in", "not_in"):
        # Use expanding bind params for parameterized IN-list conditions.
        if isinstance(value, str) and value.startswith(":"):
            param = bindparam(value[1:], expanding=True)
        else:
            param = value
        if op == "in":
            return left.in_(param)
        return ~left.in_(param)

    return None


def _build_orm_clause(clause, model_map=None):
    """
    Build a SQLAlchemy clause from nested logical structures.

    Supports dict forms such as ``{"and": [...]}``, ``{"or": [...]}``,
    ``{"not": ...}``, ``{"exists": {...}}``, and raw SQL fragments.

    :param clause: Logical clause specification.
    :type clause: dict | list | tuple | None
    :param model_map: Optional alias-to-model mapping.
    :type model_map: dict | None
    :return: SQLAlchemy clause expression or ``None`` when invalid/empty.
    :rtype: Any | None
    """
    if clause is None:
        return None

    if isinstance(clause, dict):
        # Recursively compose boolean groups for AND/OR/NOT trees.
        if "and" in clause:
            parts = [ _build_orm_clause(c, model_map=model_map) for c in clause.get("and", []) ]
            parts = [p for p in parts if p is not None]
            return and_(*parts) if parts else None
        if "or" in clause:
            parts = [ _build_orm_clause(c, model_map=model_map) for c in clause.get("or", []) ]
            parts = [p for p in parts if p is not None]
            return or_(*parts) if parts else None
        if "not" in clause:
            inner = _build_orm_clause(clause.get("not"), model_map=model_map)
            return ~inner if inner is not None else None
        if "exists" in clause:
            sub_spec = clause.get("exists")
            if isinstance(sub_spec, dict):
                sub_stmt = jm_build_orm_query_from_spec(sub_spec)
                return exists(sub_stmt) if sub_stmt is not None else None
            return None
        if "not_exists" in clause:
            sub_spec = clause.get("not_exists")
            if isinstance(sub_spec, dict):
                sub_stmt = jm_build_orm_query_from_spec(sub_spec)
                return ~exists(sub_stmt) if sub_stmt is not None else None
            return None
        if "raw" in clause:
            raw_sql = clause.get("raw")
            return text(raw_sql) if raw_sql else None
        return None

    if isinstance(clause, (list, tuple)):
        # Support tuple/list shorthand for raw SQL and basic conditions.
        if len(clause) > 0 and clause[0] == "raw":
            raw_sql = clause[1] if len(clause) > 1 else None
            return text(raw_sql) if raw_sql else None
        return _build_orm_condition(clause, model_map=model_map)

    return None


def _build_orm_select_item(select_item, model_map=None):
    """
    Build a selectable SQLAlchemy expression from a select item specification.

    Supported item kinds: ``model``, ``col``, ``agg``, ``literal``, and ``raw``.

    :param select_item: Structured select item definition.
    :type select_item: list | tuple
    :param model_map: Optional alias-to-model mapping.
    :type model_map: dict | None
    :return: SQLAlchemy selectable expression or ``None`` if invalid.
    :rtype: Any | None
    """
    if not select_item:
        return None

    # Route by item kind to construct the correct selectable expression.
    kind = select_item[0]

    if kind == "model":
        model_name = select_item[1] if len(select_item) > 1 else ""
        return _resolve_orm_model(model_name, model_map=model_map)

    if kind == "col":
        if len(select_item) < 3:
            return None
        _kind, model_name, column_name = select_item[:3]
        alias = select_item[3] if len(select_item) > 3 else None
        column = _resolve_orm_column(model_name, column_name, model_map=model_map)
        if column is None:
            return None
        return column.label(alias) if alias else column

    if kind == "agg":
        if len(select_item) < 4:
            return None
        _kind, func_name, model_name, column_name = select_item[:4]
        alias = select_item[4] if len(select_item) > 4 else None
        column = _resolve_orm_column(model_name, column_name, model_map=model_map)
        if column is None:
            return None
        agg = getattr(func, func_name)(column)
        return agg.label(alias) if alias else agg

    if kind == "literal":
        if len(select_item) < 2:
            return None
        value = select_item[1]
        alias = select_item[2] if len(select_item) > 2 else None
        lit = literal(value)
        return lit.label(alias) if alias else lit

    if kind == "raw":
        raw_sql = select_item[1] if len(select_item) > 1 else None
        alias = select_item[2] if len(select_item) > 2 else None
        if not raw_sql:
            return None
        raw_expr = text(raw_sql)
        return raw_expr.label(alias) if alias else raw_expr

    return None


def jm_build_orm_query_from_spec(spec):
    """
    Build a SQLModel/SQLAlchemy ORM select statement from a spec dict.

    Supported keys:
      - select, from, joins (with optional type="outer"), where, group_by, having, order_by
      - union, union_all, limit, offset, distinct, aliases
      - where/having support grouped clauses with {"and":[...]} / {"or":[...]} / {"not":...}
      - raw fragments via ("raw", "sql") in select/where/having
    """

    if not isinstance(spec, dict):
        return None

    from_model_name = spec.get("from")
    alias_map = {}
    for alias_name, model_name in (spec.get("aliases") or {}).items():
        base_model = jm_obtain_model_by_name(model_name)
        if base_model:
            alias_map[alias_name] = aliased(base_model, name=alias_name)
    from_model = _resolve_orm_model(from_model_name, model_map=alias_map) if from_model_name else None
    if from_model is None:
        return None

    select_items = []
    for item in spec.get("select", []) or []:
        built_item = _build_orm_select_item(item, model_map=alias_map)
        if built_item is not None:
            select_items.append(built_item)

    if not select_items:
        select_items = [from_model]

    stmt = select(*select_items).select_from(from_model)

    for join_spec in spec.get("joins", []) or []:
        left_name = join_spec.get("left") or from_model_name
        rel_name = join_spec.get("rel")
        left_model = _resolve_orm_model(left_name, model_map=alias_map)
        if left_model is None or not rel_name:
            continue
        rel_attr = getattr(left_model, rel_name, None)
        if rel_attr is None:
            jm_log(1, f"Join relation {rel_name} not found on {left_name}")
            continue
        join_type = (join_spec.get("type") or "inner").lower()
        if join_type in ("left", "outer", "leftouter", "left_outer"):
            stmt = stmt.outerjoin(rel_attr)
        else:
            stmt = stmt.join(rel_attr)

    for condition in spec.get("where", []) or []:
        clause = _build_orm_clause(condition, model_map=alias_map)
        if clause is not None:
            stmt = stmt.where(clause)

    group_by_cols = []
    for group_item in spec.get("group_by", []) or []:
        if not group_item:
            continue
        if group_item[0] == "col":
            _kind, model_name, column_name = group_item[:3]
        else:
            model_name, column_name = group_item[:2]
        column = _resolve_orm_column(model_name, column_name, model_map=alias_map)
        if column is not None:
            group_by_cols.append(column)
    if group_by_cols:
        stmt = stmt.group_by(*group_by_cols)

    for condition in spec.get("having", []) or []:
        clause = _build_orm_clause(condition, model_map=alias_map)
        if clause is not None:
            stmt = stmt.having(clause)

    order_by_cols = []
    for order_item in spec.get("order_by", []) or []:
        if not order_item:
            continue
        if order_item[0] == "agg":
            _kind, func_name, model_name, column_name, direction = order_item[:5]
            column = _resolve_orm_column(model_name, column_name, model_map=alias_map)
            if column is None:
                continue
            expr = getattr(func, func_name)(column)
        else:
            model_name, column_name, direction = order_item[:3]
            expr = _resolve_orm_column(model_name, column_name, model_map=alias_map)
            if expr is None:
                continue
        direction = (direction or "asc").lower()
        order_by_cols.append(expr.desc() if direction == "desc" else expr.asc())
    if order_by_cols:
        stmt = stmt.order_by(*order_by_cols)

    limit_value = spec.get("limit")
    if limit_value is not None:
        stmt = stmt.limit(int(limit_value))

    offset_value = spec.get("offset")
    if offset_value is not None:
        stmt = stmt.offset(int(offset_value))

    if spec.get("distinct"):
        stmt = stmt.distinct()

    for other_spec in spec.get("union", []) or []:
        other_stmt = jm_build_orm_query_from_spec(other_spec)
        if other_stmt is not None:
            stmt = stmt.union(other_stmt)

    for other_spec in spec.get("union_all", []) or []:
        other_stmt = jm_build_orm_query_from_spec(other_spec)
        if other_stmt is not None:
            stmt = stmt.union_all(other_stmt)

    return stmt


def obtain_model_admin_url_from_model_object(model_object):
    """
    Obtains the Admin URL from a model object (model instance)
    :param model_object:
    :return: admin_url
    """

    model_name = model_object.__class__.__name__.lower()
    return f"/admin/{model_name}/details/{model_object.eid}"


def absolute_url(model_object):
    """
    Obtain the show absolute URL for a model instance.

    :param model_object: Model instance with an ``eid`` attribute.
    :type model_object: Any
    :return: Show URL for the provided model object.
    :rtype: str
    """

    try:
        model_name = model_object.__class__.__name__.lower()
        eid_value = int(getattr(model_object, "eid"))
        if model_name and eid_value > 0:
            return f"/{model_name}/show/{eid_value}"
    except Exception:
        pass

    # Fallback for legacy call sites when model metadata is not available.
    return obtain_model_admin_url_from_model_object(model_object)


def jm_obtain_model_by_name(model_name):
    """
    Gets a model by model_name, if any.
    :param model_name:

    :return: model
    """

    target_name = model_name.lower()

    def iter_models():
        seen = set()
        stack = [SQLModel]
        while stack:
            base = stack.pop()
            for sub in base.__subclasses__():
                if sub in seen:
                    continue
                seen.add(sub)
                stack.append(sub)
                yield sub

    for model in iter_models():
        name_matches = model.__name__.lower() == target_name
        table_matches = getattr(model, "__tablename__", "").lower() == target_name
        if name_matches or table_matches:
            return model

    return None


def jm_obtain_model_attribute_by_name(model_name, attribute_name):
    """
    Retrieves the value of a specified attribute from a given model. This function
    assumes the model is an accessible object and the attribute exists within it.

    :param model_name: The name of the model object.
    :type model_name: str
    :param attribute_name: The name of the attribute whose value is to be retrieved.
    :type attribute_name: str
    :return: attribute, db_attribute_name
    :rtype: tuple
    """
    model = jm_obtain_model_by_name(model_name)
    attribute = None
    db_attribute_name = None

    if not model:
        jm_log(1, f"Model {model_name} not found")

    attribute_name = attribute_name.lower()

    if model is None:
        return attribute, db_attribute_name

    mapper = inspect(model)
    for column in mapper.columns:
        if column.key.lower() == attribute_name or column.name.lower() == attribute_name:
            attribute = column
            db_attribute_name = column.name
            break

    return attribute, db_attribute_name


def jm_format_model_attribute_value(model_name, attribute_name, attribute_value):
    """
    This function formats the attribute value of a given model's attribute
    for displaying or processing purposes. The function takes in the name
    of the model, the name of the attribute, and the value of the attribute,
    and returns a formatted string.

    :param model_name: The name of the model.
    :type model_name: str
    :param attribute_name: The name of the attribute.
    :type attribute_name: str
    :param attribute_value: The value of the attribute to format.
    :type attribute_value: Any

    :return: A formatted string representing the model's attribute value.
    :rtype: str
    """

    formated_attribute_value = attribute_value

    today_operands = ['today()', 'now']
    yesterday_operands = ['today() - 1']
    tomorrow_operands = ['today() + 1']

    attribute = jm_obtain_model_attribute_by_name(model_name, attribute_name)[0]
    attribute_type = type(attribute.type).__name__ if attribute is not None else ''

    if attribute_type in ['String', 'VARCHAR', 'TEXT'
        , 'CharField', 'TextField']:
        attribute_value = attribute_value.replace('"','')
        formated_attribute_value = "'" + attribute_value + "'"

    elif attribute_type in ['Date', 'Datetime', 'DATE', 'TIMESTAMP'
        ,'DateField', 'DateTimeField', 'TimeField']:
        if attribute_value.lower() in today_operands:
            formated_attribute_value = 'NOW()'
        elif attribute_value.lower() in yesterday_operands:
            formated_attribute_value = 'NOW()'
        elif attribute_value.lower() in tomorrow_operands:
            formated_attribute_value = 'NOW()'
        elif jm_is_date(attribute_value):
            formated_attribute_value = "'" + attribute_value + "'"

    return formated_attribute_value


def SendMail(host, sender_email, password, receiver_email, port, subject, plain, html):
    """
    Send an email message using SMTP over SSL.

    :param host: SMTP server hostname.
    :type host: str
    :param sender_email: Sender email address used for authentication.
    :type sender_email: str
    :param password: Sender email password or app-specific token.
    :type password: str
    :param receiver_email: Destination email address.
    :type receiver_email: str
    :param port: SMTP SSL port.
    :type port: int
    :param subject: Email subject line.
    :type subject: str
    :param plain: Plain text body.
    :type plain: str
    :param html: HTML body.
    :type html: str
    :return: ``None``.
    :rtype: None
    """
    #print('host:', host)
    #print('sender_email:', sender_email)
    #print('password:', password)
    #print('receiver_email:', receiver_email)
    #print('port:', port)
    # Validate minimum SMTP configuration before trying to send the message.
    if host != "" and sender_email != "" and password != "" and receiver_email != "" and port > 0:
        # Create a multipart email with both plain-text and HTML alternatives.
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = sender_email
        message["To"] = receiver_email

        part1 = MIMEText(plain, "plain")
        part2 = MIMEText(html, "html")

        message.attach(part1)
        message.attach(part2)

        # Open a secure SMTP connection, authenticate, and send the message.
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(host, port, context=context) as server:
            server.login(sender_email, password)
            server.sendmail(
                sender_email, receiver_email, message.as_string()
            )
    else:
        jm_log(2,'************* No SendMail server config found *****************************************************************************************')


COLOR_MAP = {
    'RED': Fore.RED,
    'GREEN': Fore.GREEN,
    'BLUE': Fore.BLUE,
    'YELLOW': Fore.YELLOW,
    'CYAN': Fore.CYAN,
    'MAGENTA': Fore.MAGENTA,
    'WHITE': Fore.WHITE,
    'BLACK': Fore.BLACK
}


last_logged_process_time = round(time.process_time(),2)


def jm_log(relevance, *args, **kwargs):
    """
    Print log messages gated by configured relevance, including elapsed CPU time.

    :param relevance: Message importance level (lower means more important).
    :type relevance: int
    :param args: Message parts to concatenate and print.
    :type args: tuple
    :param kwargs: Optional formatting options such as ``text_color``.
    :type kwargs: dict
    :return: ``None``.
    :rtype: None
    """
    global last_logged_process_time

    # 1. Get Config (Assume global or fast access)
    jm_config = jm_obtain_config()
    log_up_to_relevance = int(jm_config.get('logging', 'log_up_to_relevance'))

    if relevance <= log_up_to_relevance:

        # 2. Capture time once (High Performance)
        current_time = time.process_time()

        # 3. Fast String Construction
        # .join is significantly faster than loop concatenation
        string_to_print = ' '.join(str(s) for s in args)

        # 4. Color Application
        # We assume the user might pass 'text_color' in kwargs
        if 'text_color' in kwargs:
            color_code = COLOR_MAP.get(kwargs['text_color'].upper())
            if color_code:
                # We manually add the Reset code at the end
                string_to_print = f"{color_code}{string_to_print}{Style.RESET_ALL}"

        # 5. Calculate Delta
        time_delta = current_time - last_logged_process_time

        # 6. Final Print
        # Using f-strings is faster than passing multiple args to print()
        print(f"{current_time:.2f} | {time_delta:.2f} | {string_to_print}")

        last_logged_process_time = current_time


def jm_execute_basic_sql(self, sql, sql_params, timeout_ms = None):
    """
    Execute a SQL statement using the shared engine and return fetched rows.

    :param self: Unused placeholder to keep call compatibility.
    :type self: Any
    :param sql: SQL statement to execute.
    :type sql: str
    :param sql_params: Named parameters for the SQL statement.
    :type sql_params: dict | None
    :param timeout_ms: Optional statement timeout in milliseconds.
    :type timeout_ms: int | None
    :return: Result rows for queries, or an empty list when no rows are fetchable.
    :rtype: list
    """
    # Normalize placeholder syntax before sending SQL to SQLAlchemy.
    normalized_sql = _normalize_sql_query(sql, sql_params)
    with engine.connect() as connection:
        # Apply per-statement timeout only when explicitly requested.
        if timeout_ms:
            connection.execute(text('SET statement_timeout TO :timeout_ms'), {'timeout_ms': timeout_ms})
        # Execute the statement and attempt to fetch all rows when available.
        result = connection.execute(text(normalized_sql), sql_params)
        try:
            rset = result.fetchall()
        except Exception:
            rset = []

    return rset


def obtain_query_within_level_clauses(rql_string, section_keyword, base_query_level = 0, base_query_level_offset = 0
                                      , section_delimiter_keywords = None
                                      , obtain_section_keyword_modifiers_separately = True
                                      , split_characters = (',',)
                                      , level_start_characters = ('(',), level_end_characters = (')',)):
    """
    This function obtains the RQL query clause from the provided RQL (Resource Query Language) string
    of the base_query_level + base_query_level_offset of the rql string (not those in inner levels). This is used
    to separate the sub-queries of the next query level that might be embedded within.

    :param rql_string: The Resource Query Language (RQL) string to parse and
        process for extracting sub-queries.
    :type rql_string: str
    :param base_query_level_offset: the number of levels inside the same query_level to obtain the clause from.
    :type base_query_level_offset: int
    :param section_keyword: The keyword that identifies the section, either Any, WHERE, BEING, UNION or EXISTS.
    :type section_keyword: str
    :param section_delimiter_keywords: Determined automatically if you provide a known section_keyword (see above).
                                        These are the keywords that delimit the end
                                        of the query clause section of the section_keyword being obtained,
                                        as long as they are found in the same base_query_level of the section_keyword.
                                        Do not include the section_keyword in the section_delimiter_keywords list,
                                        or it would get an empty result.
    :type section_delimiter_keywords: list
    :param obtain_section_keyword_modifiers_separately: True if we need to obtain the modifiers preceding the section_keyword.
                                            useful for EXISTS keywords, like in 'AND NOT EXISTS'.
    :type obtain_section_keyword_modifiers_separately: boolean

    :return: query_clauses_list: A list of sub-queries strings found in the RQL string.
    :rtype: list
    """

    rql_string = rql_string.strip()
    rql_string = rql_string.replace('(', ' ( ').replace(')', ' ) ').replace(',', ' , ')

    if not section_delimiter_keywords:
        if section_keyword == 'ANY':
            section_delimiter_keywords = ['ORDERBY', 'GROUPBY', 'LIMIT', 'WHERE', 'WITH', 'HAVING', 'UNION']
        elif section_keyword == 'WHERE':
            section_delimiter_keywords = ['WITH', 'HAVING', 'UNION']
        elif section_keyword == 'BEING':
            section_delimiter_keywords = ['HAVING']
        elif section_keyword == '__SUB_CLAUSE_':
            section_delimiter_keywords = [')']
        elif section_keyword == 'UNION':
            section_delimiter_keywords = [')']
        elif section_keyword == 'EXISTS':
            section_delimiter_keywords = [')']

    if section_keyword in section_delimiter_keywords:
        raise ValueError('Do not include the section_keyword in the section_delimiter_keywords list, '
                         'or it would get an empty result.')

    words_in_rql_string = rql_string.split()

    current_query_level = base_query_level

    in_clause_section = False
    query_clause_words_list = []
    query_clauses_list = []
    query_clause_words = []
    query_clause_words_added = False
    previous_word = ''

    in_keyword_modifiers = False
    section_keyword_modifiers_list = []

    local_content = False
    for idx_word, word in enumerate(words_in_rql_string):
        word = word.strip()

        # Identify if we are in a next current_query_level or back.
        if previous_word in split_characters:
            local_content = False

        if word in level_start_characters:
            # When obtaining a __SUB_CLAUSE_', we are in the in_clause_section if we immediately find a '('
            # containing the sub-clause.
            if section_keyword == '__SUB_CLAUSE_' and idx_word ==  0:
                in_clause_section = True
        if previous_word in level_start_characters:
            if not local_content:
                current_query_level += 1

        if word in level_end_characters:
            if not local_content:
                current_query_level -= 1
            else:
                local_content = False

        # The section starts when the section_keyword is found in the query level.
        if current_query_level == base_query_level:
            # Obtain the modifiers preceding the section_keyword.
            # Useful for EXISTS keywords, like in 'AND NOT EXISTS'.
            if obtain_section_keyword_modifiers_separately:
                if previous_word in split_characters:
                    in_keyword_modifiers = True
                    section_keyword_modifiers_list = []
                if in_keyword_modifiers and word.upper() != section_keyword:
                    section_keyword_modifiers_list.append(word)

            if word.upper() == section_keyword:
                in_clause_section = True
                query_clause_words = []
                query_clause_words_added = False
                in_keyword_modifiers = False

        target_query_level = base_query_level + base_query_level_offset
        if in_clause_section:
            # We want all the words within the target_query_level.
            if current_query_level >= target_query_level:
                if word.upper() not in section_delimiter_keywords:
                    if word.upper() != section_keyword or not obtain_section_keyword_modifiers_separately:
                        query_clause_words.append(word)
                else:
                    # If in_clause_section and back in the base query_level,
                    # we need to close the level_end_characters when it is found,
                    # which happens where the level_end_characters is in the section_delimiter_keywords,
                    # (like in EXISTS section_keyword).
                    if word in level_end_characters and word in section_delimiter_keywords:
                        query_clause_words.append(word)

        if current_query_level == base_query_level:
            # The section ends when one of the section_delimiter_keywords in the query level.
            if ((word.upper() in section_delimiter_keywords or idx_word == len(words_in_rql_string) - 1)
                    and not query_clause_words_added):
                if len(query_clause_words) > 0:
                    query_clause_words_list.append(query_clause_words)

                    query_clause_text = ' '.join(query_clause_words)
                    # Format the query_clause_text for easier visualization or editing when saved.
                    query_clause_text = (query_clause_text.replace(' ( ', '(')
                                         .replace(' ) ', ')')
                                         .replace(' , ', ','))
                    query_clause_text = (query_clause_text.replace(',','\n,')
                                         .replace('BEING','\nBEING')
                                         .replace('UNION','\nUNION')
                                         .replace('EXISTS','\nEXISTS')
                                         .replace('WHERE','\nWHERE')
                                         .replace('GROUPBY','\nGROUPBY')
                                         .replace('ORDERBY','\nORDERBY'))

                    query_clause = dict()
                    query_clause['section_keyword'] = section_keyword
                    query_clause['section_keyword_modifiers_list'] = section_keyword_modifiers_list
                    if obtain_section_keyword_modifiers_separately:
                        if len(query_clause['section_keyword_modifiers_list']) > 0:
                            if (not 'AND' in query_clause['section_keyword_modifiers_list']
                                    and not 'OR' in query_clause['section_keyword_modifiers_list']):
                                query_clause['section_keyword_with_modifiers'] = (
                                        'AND' + ' '
                                        + ' '.join(query_clause['section_keyword_modifiers_list'])
                                        + ' ' + section_keyword)
                        else:
                            query_clause['section_keyword_with_modifiers'] = 'AND' + ' ' + section_keyword
                    else:
                        query_clause['section_keyword_with_modifiers'] = section_keyword
                    query_clause['query_clause_text'] = query_clause_text
                    query_clause['query_clause_words'] = query_clause_words

                    query_clauses_list.append(query_clause)

                # Initialize for another keyword section.
                in_clause_section = False
                query_clause_words_added = True
                section_keyword_modifiers_list = []
                in_keyword_modifiers = False

        previous_word = word.upper()

    return query_clauses_list


def jm_split_text_within_levels(text, levels_to_split = (1,)
                                , split_characters = (',',)
                                , level_start_characters = ('(',), level_end_characters = (')',)):
    """
    Splits a given text within the defined 'levels_to_split', based on nested delimiters and split characters.
    The function processes the text and splits those that are within the levels determined
    by the `levels_to_split` parameter.

    :param text: The text to be split into multiple levels.
    :type text: str
    :param levels_to_split: A tuple of integers corresponding to the levels of
                            nesting to be processed.
    :param split_characters: A tuple of words used to split the text at the
                             respective levels.
    :param level_start_characters: A tuple of characters marking the start of a level
                                    in nested structures.
    :param level_end_characters: A tuple of characters marking the end of a level in
                                  nested structures.
    :return: The split text.
    :rtype: list
    """

    # Make sure the split and level delimiting elements are words.
    for split_or_delimiter_character in split_characters + level_start_characters + level_end_characters:
        # Add leading and trailing spaces next to delimiter characters.
        text = text.replace(split_or_delimiter_character, ' ' + split_or_delimiter_character + ' ')
        # The following is another alternative to try if we want whole words as split delimiters,
        # like (',', 'and', 'or')
        # pattern = r"\b" + re.escape(split_or_delimiter_character) + r"\b"
        # text = regex.sub(pattern, ' ' + split_or_delimiter_character + ' ', text)

    text_words = text.split()

    split_elements_texts_list = []
    split_elements_words_list = []
    current_level = 1

    split_text_element_words = []
    split_text_element_words_added = False
    for word in text_words:
        if word in level_start_characters:
            current_level += 1

        if word in split_characters:
            if current_level in levels_to_split:
                split_elements_words_list.append(split_text_element_words)
                split_text_element_words_added = True
                split_text_element_words = []
            else:
                split_text_element_words_added = False

        if not word in split_characters or not current_level in levels_to_split:
            split_text_element_words.append(word)

        if word in level_end_characters:
            current_level -= 1

    # Add the last split_text_element_words if not already added,
    # which happens when there are no split_characters in text.
    if not split_text_element_words_added:
        split_elements_words_list.append(split_text_element_words)

    for split_text_element_words in split_elements_words_list:
        split_element_text = ' '.join(split_text_element_words)
        # Remove the leading and trailing spaces next to delimiter characters.
        for split_or_delimiter_character in split_characters + level_start_characters + level_end_characters:
            split_element_text = split_element_text.replace( ' ' + split_or_delimiter_character + ' ', split_or_delimiter_character)
            # The following is another alternative to try if we want whole words as split delimiters,
            # like (',', 'and', 'or')
            # delimiter_pattern = r"\s*\b" + re.escape(split_or_delimiter_character) + r"\b\s*"
            # text = regex.sub(delimiter_pattern, split_or_delimiter_character, text)

        split_elements_texts_list.append(split_element_text)

    return split_elements_texts_list


def jm_extract_variable_and_function(select_segment):
    """
    Extracts the variable and summary function from a SQL SELECT segment.
    If there is no summary function, return the select_segment as the variable_name.

    Args:
        select_segment (str): The SQL select segment to parse.

    Returns:
        tuple: variable_name, function, variable_entity_is_optional; the variable name
                , the summary function name, if any.
    """

    variable_name, function = None, None

    pattern = r"(\w+)\(([\w\.]+)\)"
    match = re.match(pattern, select_segment)

    if match:
        function, variable_name = match.groups()
    else:
        variable_name = select_segment

    return variable_name, function


def jm_is_a_variable_name(word: str) -> bool:
    """
    Determine if a given word is a valid variable name in Python. A valid
    variable name must start with a letter (a-z, A-Z) or an underscore (_),
    and can be followed by letters, numbers (0-9), or underscores.

    :param word: The word to test for validity as a Python variable name.
    :type word: str
    :return: A boolean indicating whether the word is a valid variable name.
    :rtype: bool
    """
    pattern = r"^[a-zA-Z_][a-zA-Z0-9_]*$"
    return re.match(pattern, word) is not None


def jm_extract_variable_segments_from_query_section(sql: str) -> List[Dict]:
    """
    Extract variable segments from a RQL (Relational Query Language) statement.
    Each variable segment is a variable name or an expression involving variables, like:
    From an ANY or SELECT statement:
    'ITEM', 'VENDOR', 'ITEM.VENDOR', 'ITEM.VENDOR.NAME', 'ITEM.VENDOR.ADDRESS.CITY', 'MAX(ITEM.initial_retail_price)', etc.
    or from a WHERE, SET or INSERT statement:
    "ITEM.name = 'yogurts'", 'ITEM.initial_retail_price >=0', "VENDOR.name ILIKE '%Wholesaler Pro Max%'", etc.

    The function takes a RQL or SQL statement as input (only the ANY, SELECT, SET or INSERT part)
     and extracts segments that are used in the SELECT or equivalent clauses. Specifically, it
    matches segments such as 'Any', 'SET', and others typically found at
    the beginning of SQL-like queries, and captures the variable assignments
    or column names specified. It returns these variable segments as a list
    of strings.

    :param sql: The RQL SQL statement to extract variable segments from.
    :type sql: str

    :return: variables_segments: A list of strings where each string is a variable segment or
             column name extracted from the given SQL statement.
    :rtype: List[Dict]
    """

    select_pattern = r'((\bAny\b|\bWITH\b|\bSET\b|\bINSERT\b|\bGROUPBY\b|\bORDERBY\b)\s+.*?)(?=(\bGROUPBY\b|\bORDERBY\b|\bLIMIT\b|\bWHERE\b|\bWITH\b|\bBEING\b|\bHAVING\b|\bUNION\b|$))'
    match = re.search(select_pattern, sql, re.IGNORECASE | re.DOTALL)

    if not match:
        return []

    select_clause = match.group(1).strip()
    # Remove the Any and SET keywords, remove trailing all starting and spaces,
    # and split the comma separated variables (and their assignments in SET).
    select_clause = re.sub(r'\bAny\b','', select_clause, 1)
    select_clause = re.sub(r'\bANY\b','', select_clause, 1)
    select_clause = re.sub(r'\bSET\b','', select_clause, 1)
    select_clause = re.sub(r'\bINSERT\b','', select_clause, 1)
    select_clause = re.sub(r'\bGROUPBY\b','', select_clause, 1)
    select_clause = re.sub(r'\bORDERBY\b','', select_clause, 1)
    select_clause = re.sub(r'\bWITH\b','', select_clause, 1)

    # Split the select clause into individual variables_segments/elements
    raw_variables_segments = [var.strip() for var in select_clause.split(",")]

    variables_segments = []
    for variable_segment in raw_variables_segments:
        variable_name, function = jm_extract_variable_and_function(variable_segment)
        variable_segment_dict = dict()
        variable_segment_dict['variable_name'] = variable_name
        variable_segment_dict['function'] = function
        variables_segments.append(variable_segment_dict)

    return variables_segments


def jm_create_df_from_rset(self, rset
                           , rql_command
                           , rql_column_names = None
                           , get_rql_column_names_from_rset = False
                           , pretty_df_column_names = False
                           , df_values_with_rset_entity_names = False):
    """
    Create a DataFrame from an RQL/SQL result set and optional column metadata.

    :param self: Unused placeholder to keep call compatibility.
    :type self: Any
    :param rset: Result set object or iterable rows.
    :type rset: Any
    :param rql_command: RQL command string used to infer column names when needed.
    :type rql_command: str
    :param rql_column_names: Explicit column names to apply to the DataFrame.
    :type rql_column_names: list | None
    :param get_rql_column_names_from_rset: Whether to prefer names from the result-set metadata.
    :type get_rql_column_names_from_rset: bool
    :param pretty_df_column_names: Whether to format resulting DataFrame column names for display.
    :type pretty_df_column_names: bool
    :param df_values_with_rset_entity_names: Reserved flag to replace entity values with display names.
    :type df_values_with_rset_entity_names: bool
    :return: DataFrame built from the provided result set.
    :rtype: DataFrame
    """

    rset_df = DataFrame()

    # Prefer explicitly provided column names when they are available.
    if not rql_column_names is None:
        try:
            if isinstance(rset, JM_Rset):
                rset_df = DataFrame(rset.rset)
            else:
                rset_df = DataFrame(rset)
            if len(rql_column_names) == len(rset_df.columns):
                rset_df.columns = rql_column_names
        except:
            jm_log(1, 'An exception has occurred in jm_create_df_from_rset while assigning rql_column_names.')
            jm_log(1, 'Using defaults.')

    else:
        # Extract the column name from the rql_command.
        rql_column_names = [vs['variable_name'] for vs in jm_extract_variable_segments_from_query_section(rql_command)]

        if len(rql_column_names) > 0:
            try:
                # Optionally replace parsed names with names discovered from result metadata.
                if get_rql_column_names_from_rset and rset.rowcount() > 0:
                    rql_columns_names_from_rset = rset.description[0]
                    for column_seq, rql_column_name_from_rset in enumerate(rql_columns_names_from_rset):
                        # replace the column name gathered from the rql_command
                        # with the corresponding from rql_columns_names_from_rset
                        # and using the i18n translation for that name.
                        if (rql_column_name_from_rset
                                not in ['String', 'RichString'
                                    , 'Date', 'Datetime'
                                    , 'Int', 'Float', 'Decimal', 'Boolean', 'Time']):
                            try:
                                rql_column_names[column_seq] = _('%s' % rql_column_name_from_rset).capitalize()
                            except:
                                rql_column_names[column_seq] = rql_column_name_from_rset.capitalize()

                # Assign the best rql_column_names as the column names of the resulting DataFrame to return.
                rset_df = DataFrame(rset, columns = rql_column_names)

            except:
                if rset.count > 0:
                    rset_df = DataFrame(rset)
                else:
                    rset_df = DataFrame()
        else:
            if rset.count > 0:
                rset_df = DataFrame(rset)
            else:
                rset_df = DataFrame()

    if pretty_df_column_names:
        # Apply display-friendly formatting to output column names.
        rset_df.columns = jm_pretty_df_column_names(rset_df.columns)

    # if df_values_with_rset_entity_names:
    #     rset_df = replace_df_values_with_rset_entity_names(rset_df, rset)

    return rset_df


def jm_extract_column_names_from_SQL(sql_statement):
    """
    Extracts the column names from a given SQL statement.
    Useful to populate DataFrame's columns.

    Usage example:
    given a sql_statement sql_statement:
    my_columns = extract_column_names_from_RQL(sql_statement)

    rset = self._cw.execute(sql, {'eid': entity.eid})
    print(DataFrame(rset), columns = extract_column_names_from_SQL(sql))

    :param sql_statement:
    :return: a list_of_possible_column_names extracted from the SQL.
    """

    # eliminate \n \r
    sql_statement = sql_statement.replace('\n', " ").replace('\r', " ").lower()

    end_word_after_column_names = 'from'

    list_of_possible_column_names = list()

    if 'select' in sql_statement:
        list_of_possible_column_names = re.findall(r'select(.+?)' + end_word_after_column_names, sql_statement)[0]
        list_of_possible_column_names = list_of_possible_column_names.split(',')

    # If a column name has an alias (as), extract the alias name as the column name.
    list_of_column_names = []
    for column_name in list_of_possible_column_names:
        if ' as ' in column_name.lower():
            column_name_elements = column_name.split(' as ')
            column_name = column_name_elements[-1]

        column_name = column_name.strip().replace(' ','_')
        list_of_column_names.append(column_name)

    return list_of_column_names


def jm_pretty_df_column_names(rset_df_columns, strings_to_replace = ['_','-'], capitalize_column_names = True):
    """
    Reformats a DataFrame's column names.
    :param rset_df_columns: A list with the columns to be replaced with pretty columns.
    :param strings_to_replace: A list with the strings to be replaced.
    :param capitalize_column_names: True if the pretty columns should be capitalized.
    :return: A list with the pretty_df_columns.
    """

    pretty_df_columns = []
    for pretty_df_column in rset_df_columns:
        new_pretty_df_column = pretty_df_column
        for string_to_replace in strings_to_replace:
            if capitalize_column_names:
                new_pretty_df_column = str(pretty_df_column).replace(string_to_replace,' ').capitalize()
            else:
                new_pretty_df_column = str(pretty_df_column).replace(string_to_replace,' ')
        pretty_df_columns.append(new_pretty_df_column)

    return pretty_df_columns


def jm_rowcount(element):
    """
    Returns the size in rows on the element, either if it is a list, set or a resultset.
    :param element: The element to determine the number of rows
    :return: The number of rows in the element.
    """
    if isinstance(element, (list, set, dict, tuple)):
        rowcount = len(element)
    elif isinstance(element, DataFrame):
        rowcount = element.shape[0]
    elif hasattr(element, "__len__"):
        try:
            rowcount = len(element)
        except Exception:
            rowcount = 0
    else:
        rowcount = 0

    return rowcount


class JM_Rset:
    """
    Represents a result set obtained from a query to the database,
    typically obtained from a jm_execute_rql function in this module, in order to add convenience methods to it
    to get specific entities from it or to get the row count.

    rset.rowcount() returns the number of rows in the result set.
    rset.get_entity(row, col) returns the entity in a column of a row in the result set (sequences starting from 0).
    """

    rset = None
    rset_df = None
    description: list
    rowcount: int
    query_command: str

    def __init__(self, rset, rset_df = None, query_command = '', rows_affected_or_fetched = 0):
        self.rset = rset
        if rset_df is not None:
            self.rset_df = rset_df
        else:
            self.rset_df = DataFrame(rset)
        self.query_command = query_command
        self.rowcount = rows_affected_or_fetched
        if hasattr(self, 'description'):
            self.description = rset.description

    def __len__(self):
        return self.rowcount

    def __iter__(self):
        """
        Creates an iterator for the associated 'rset' attribute.

        This method allows the object to be iterable by implementing the ``__iter__``
        method, which is a standard method in Python to return an iterator.
        It provides access to the `rset` object for iteration.

        :return: The iterator object for `rset`.
        :rtype: Any
        """
        if self.rset is not None:
            return self.rset.__iter__()
            #return iter(self.rset)
        else:
            raise ValueError("The result set (rset) is not iterable or has not been initialized.")

    def __getitem__(self, index):
        """
        JM_Rset class provides an iterator and item access functionality over the
        'rset' attribute. Instances of this class act as iterable objects
        and allow element retrieval by index using the __getitem__ method.
        This class does not define or initialize its attributes; its correct
        usage assumes pre-defined attributes or externally managed attribute setup.
        """
        return self.rset[index]

    def __str__(self):
        """
        Provides a string representation of the object.

        This method is used to return a human-readable representation of the
        object. The string output is typically customized to display relevant
        attributes of the object in a format that is easy to interpret.

        :return: A string representation of the object.
        :rtype: str
        """
        return str(self.rset)

    def count(self):
        """
        Returns the current row count.

        This method serves as a getter for the ``rowcount`` attribute, which holds
        the count of rows in the 'rset' attribute.
        It does not take any arguments and simply returns the value of the ``rowcount``
        attribute.

        :return: The number of rows affected by the operation or query, either from a SELECT, UPDATE or INSERT statement.
        :rtype: int
        """
        return self.rowcount

    def printable_query_command(self):
        """
        Returns the query command that was used to create the rset.

        This method provides the query command in a format that is printable and
        can be easily logged or displayed to the user. It is intended to use
        internally or for debugging purposes where a human-readable version of
        the query command is required.

        :return: A string representing the query command.
        :rtype: str
        """
        return self.query_command

    def printable_rql(self):
        """
        Returns the printable representation of the query command that was used to create the rset.
        Used for backwards compatibility. Going forward use printable_query_command instead.

        This method returns a formatted, user-readable string representation
        of a query command. It retrieves the printable version using another
        method that handles the actual formatting.

        :return: The formatted, printable string representation of the RQL
            query command.
        :rtype: str
        """
        return self.printable_query_command()

    def get_entity(self, row, col):
        """
        Retrieve an entity (model instance) based on the specified row and column from the
        result set, if it contains a valid pk (primary key) of a model instance.

        This function attempts to fetch an entity ID from a predefined
        result set using the given row and column indices. It then queries
        a database for this entity's details, including its type. If the
        entity is found, it uses the type information to fetch the
        complete entity object from the corresponding model.

        :param row: The row index in the result set from which to retrieve
                    the entity ID.
        :param col: The column index in the result set from which to
                    retrieve the entity ID.
        :return: The entity object if found, otherwise None.
        """
        entity = None

        def _normalize_entity_id(raw_value):
            if raw_value is None or isinstance(raw_value, bool):
                return None
            if isinstance(raw_value, (int, numpy.integer)):
                return int(raw_value)
            if isinstance(raw_value, float):
                return int(raw_value) if raw_value.is_integer() else None
            if isinstance(raw_value, str):
                value = raw_value.strip()
                if re.fullmatch(r"\d+", value):
                    return int(value)
            return None

        def _resolve_cell_value_from_row(row_value, col_idx):
            if isinstance(row_value, SQLModel):
                if col_idx == 0:
                    return row_value
                return None

            if isinstance(row_value, (list, tuple)):
                if 0 <= col_idx < len(row_value):
                    return row_value[col_idx]
                return None

            if hasattr(row_value, "_mapping"):
                mapping = row_value._mapping
                if 0 <= col_idx < len(mapping):
                    try:
                        return list(mapping.values())[col_idx]
                    except Exception:
                        pass
                try:
                    column_name = self.rset_df.columns[col_idx] if self.rset_df is not None else None
                    if column_name in mapping:
                        return mapping[column_name]
                except Exception:
                    pass
                return None

            if isinstance(row_value, dict):
                try:
                    column_name = self.rset_df.columns[col_idx] if self.rset_df is not None else None
                    if column_name in row_value:
                        return row_value[column_name]
                except Exception:
                    pass
                if 0 <= col_idx < len(row_value):
                    try:
                        return list(row_value.values())[col_idx]
                    except Exception:
                        pass
                return None

            if col_idx == 0:
                return row_value
            return None

        try:
            row_value = self.rset[row]
        except Exception:
            row_value = None

        if row_value is not None:
            cell_value = _resolve_cell_value_from_row(row_value, col)

            if isinstance(cell_value, SQLModel):
                entity = cell_value
            elif hasattr(cell_value, "eid") and hasattr(cell_value, "__class__"):
                entity = cell_value
            else:
                entity_id = _normalize_entity_id(cell_value)
                if entity_id is not None:
                    entity_rset = jm_execute_basic_sql(
                        None,
                        "SELECT eid, type FROM entities WHERE eid = :entity_id",
                        {'entity_id': entity_id},
                    )
                    if len(entity_rset) > 0:
                        entity_type = entity_rset[0][1]
                        entity_model = jm_obtain_model_by_name(entity_type)
                        if entity_model:
                            local_session, created = _get_session()
                            try:
                                entity = local_session.get(entity_model, entity_id)
                            finally:
                                if created:
                                    local_session.close()

        jm_log(2, '')
        jm_log(2, 'Entity obtained in get_entity:', entity)
        jm_log(2, '')

        return entity


jm_rql_executions = DataFrame(columns = ['entity_eid','jm_action','start_time','end_time','duration'])


def replace_df_values_with_entity_names(df, create_entity_hyperlink = True):
    """
    In a DataFrame df resulting from a db result set, typically obtained from jm_execute_sql() function,
    replace the cell content containing entity objects with their entity __str__,
    and as a navigable hyperlink to the entity view.

    :param df: The DataFrame to replace the
    :param create_entity_hyperlink: True if the cell content containing entity objects
                                    should be replaced as a navigable entity hyperlink.
    :return:
    """

    # By conventions with the way our nlp Natural Language Process app generates the result sets,
    # we know that a column is a model when the column name generated in the DataFrame ends with the entity_name_suffix.
    # And the model_name is the name without the entity_name_suffix.

    resulting_df = df.copy()

    entity_name_suffix = '_entity'

    # Collect all (model, col_idx) pairs and the EIDs needed per model so we
    # can fetch them in bulk instead of one session per cell.
    model_columns: list[tuple[int, type]] = []
    for col_idx, column in enumerate(resulting_df.columns):
        if not isinstance(column, str):
            continue
        if column.endswith(entity_name_suffix):
            model_name = column.replace(entity_name_suffix, '')
            model = jm_obtain_model_by_name(model_name)
            if model:
                model_columns.append((col_idx, model))

    if not model_columns:
        return resulting_df

    # Gather unique EIDs per model across all relevant columns.
    model_eids: dict[type, set[int]] = {}
    for col_idx, model in model_columns:
        eids = model_eids.setdefault(model, set())
        for row_idx in range(len(resulting_df)):
            try:
                eids.add(int(resulting_df.iat[row_idx, col_idx]))
            except Exception:
                pass

    # Batch-fetch all entities in a single session.
    entity_cache: dict[tuple[type, int], object] = {}
    local_session, created = _get_session()
    try:
        for model, eids in model_eids.items():
            if not eids:
                continue
            pk_col = inspect(model).primary_key[0]
            results = local_session.exec(
                select(model).where(pk_col.in_(list(eids)))
            ).all()
            for obj in results:
                entity_cache[(model, int(getattr(obj, "eid", getattr(obj, "id", 0))))] = obj
    finally:
        if created:
            local_session.close()

    # Replace cell values using the cache.
    for col_idx, model in model_columns:
        for row_idx in range(len(resulting_df)):
            try:
                eid_value = int(resulting_df.iat[row_idx, col_idx])
                entity_object = entity_cache.get((model, eid_value))
                if entity_object is not None:
                    resulting_df.iat[row_idx, col_idx] = (
                        '<a href="'
                        + absolute_url(entity_object)
                        + '">'
                        + str(entity_object)
                        + '</a>'
                    )
            except Exception:
                pass

    return resulting_df


def executable_command_is_mutable(sql_query_command):
    """
    Determines if the provided SQL query command is considered mutable.

    SQL commands that alter the database such as `INSERT`, `UPDATE`, `DELETE`, or
    `CREATE` are categorized as mutable commands. This function analyzes the given
    `sql_query_command` string to identify if it falls into this category.

    :param sql_query_command: The SQL query command to be checked for mutability.
    :type sql_query_command: str

    :return: command_is_mutable, command_type. command_is_mutable True if the SQL command is mutable, otherwise False.
    :rtype: tuple
    """

    parsed_query_sections = parse_query_sections(sql_query_command)

    mutable_commands = ('INSERT', 'SET', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'RENAME')

    command_is_mutable = False
    command_type = ''

    for mutable_command in mutable_commands:
        if mutable_command in parsed_query_sections.keys():
            if parsed_query_sections[mutable_command]:
                command_is_mutable = True
                command_type = mutable_command
                break

    return command_is_mutable, command_type


def executable_orm_command_is_mutable(orm_query_command):
    """
    Determine if an ORM command/spec is mutable for safe auto-execution decisions.

    Non-executable ORM dict specs are treated as mutable to prevent execution in
    guards that check ``not executable_orm_command_is_mutable(...)[0]``.
    """

    # Dict specs are currently built through jm_build_orm_query_from_spec, which
    # is SELECT-oriented. Empty/invalid specs are treated as non-executable.
    if isinstance(orm_query_command, dict):
        built_stmt = jm_build_orm_query_from_spec(orm_query_command)
        if built_stmt is None:
            return True, 'NON_EXECUTABLE'
        return _orm_command_is_mutable(built_stmt)

    return _orm_command_is_mutable(orm_query_command)


def _orm_command_is_mutable(orm_query_command):
    """
    Determines if the provided ORM command is considered mutable.

    Mutable commands include INSERT/UPDATE/DELETE statements or operations that
    add SQLModel instances to the session.
    """

    if isinstance(orm_query_command, (Insert, Update, Delete)):
        return True, orm_query_command.__class__.__name__.upper()

    if isinstance(orm_query_command, SQLModel):
        return True, 'INSERT'

    if isinstance(orm_query_command, (list, tuple)) and all(
            isinstance(item, SQLModel) for item in orm_query_command
    ):
        return True, 'INSERT'

    return False, ''


def jm_is_float(element: any) -> bool:
    """
    Determines if a string contains and can be converted to a float number.
    :param element: The string to be checked as a float number.
    :return: True if the string is a float. False if not.
    """

    if element is None:
        return False
    try:
        float(element)
        return True
    except ValueError:
        return False


def jm_is_date(string, fuzzy=False):
    """
    Return whether the string can be interpreted as a date.

    :param string: str, string to check for date
    :param fuzzy: bool, ignore unknown tokens in string if True
    """
    try:
        parse(string, fuzzy=fuzzy)
        return True

    except ValueError:
        return False


def obtain_model_main_attribute_names(model, maximum_model_main_attribute_names = 1
                                      , preferred_model_field__names_suffixes =
                                      ('eid', '_name', '_id', 'name', 'id', '_description', 'description')):
    """
    Obtain the Model's model_main_attribute_names based on the preferred_model_field_db_names_suffixes,
    up to the maximum_model_main_attribute_names.

    :param model: The model to obtain the model_main_attribute_names for.
    :param maximum_model_main_attribute_names: Obtain up to this number of model attribute names.
    :param preferred_model_field__names_suffixes: ('eid', '_name', '_id', 'name', 'id', '_description', 'description')

    :return: model_main_attribute_names
    """
    model_field_db_names = []
    if model is None:
        return model_field_db_names
    mapper = inspect(model)
    for column in mapper.columns:
        model_field_db_names.append(column.key)

    preferred_model_field_names = []
    remaining_model_field_names = []
    for preferred_model_field_db_names_suffix in preferred_model_field__names_suffixes:
        for field_name in model_field_db_names:
            if field_name not in preferred_model_field_names + remaining_model_field_names:
                if field_name.endswith(preferred_model_field_db_names_suffix):
                    preferred_model_field_names.append(field_name)
                else:
                    remaining_model_field_names.append(field_name)
    prioritized_model_field_db_names = preferred_model_field_names
    prioritized_model_field_db_names.extend(remaining_model_field_names)
    model_main_attribute_names = prioritized_model_field_db_names[0: maximum_model_main_attribute_names]

    return model_main_attribute_names


def obtain_table_main_attribute_names(table_name, inspector, maximum_model_main_attribute_names = 1
                                      , preferred_model_field__names_suffixes =
                                      ('eid', '_name', '_id', 'name', 'id', '_description', 'description')):
    """
    Obtain the Model's model_main_attribute_names based on the preferred_model_field_db_names_suffixes,
    up to the maximum_model_main_attribute_names.

    :param model: The model to obtain the model_main_attribute_names for.
    :param maximum_model_main_attribute_names: Obtain up to this number of model attribute names.
    :param preferred_model_field__names_suffixes: ('eid', '_name', '_id', 'name', 'id', '_description', 'description')

    :return: model_main_attribute_names
    """
    table_field_names = []
    table_fields = inspector.get_columns(table_name)

    for field in table_fields:
        field_name = field.get('name')
        table_field_names.append(field_name)

    preferred_model_field_names = []
    remaining_model_field_names = []
    for preferred_model_field_db_names_suffix in preferred_model_field__names_suffixes:
        for field_name in table_field_names:
            if field_name not in preferred_model_field_names + remaining_model_field_names:
                if field_name.endswith(preferred_model_field_db_names_suffix):
                    preferred_model_field_names.append(field_name)
                else:
                    remaining_model_field_names.append(field_name)
    prioritized_model_field_db_names = preferred_model_field_names
    prioritized_model_field_db_names.extend(remaining_model_field_names)
    model_main_attribute_names = prioritized_model_field_db_names[0: maximum_model_main_attribute_names]

    return model_main_attribute_names


def detect_language(text):
    """
    Detects the language of a given text.

    :param text: The input string whose language needs to be detected.
    :type text: str

    :return: Detected language of the input text as a string.
    :rtype: str
    """

    from langdetect import detect

    if text and len(text.strip()) > 0:
        try:
            language = detect(text)
        except:
            language = 'en'
    else:
        language = 'en'

    return language


def jm_unique_list_of_objects(list_of_objects):
    """
    Create a unique list of classes from a list of classes.
    :param list_of_objects:
    :return: unique_list_of_objects
    """

    unique_list_of_objects = []
    for object_element in list_of_objects:
        if object_element not in unique_list_of_objects:
            unique_list_of_objects.append(object_element)

    return unique_list_of_objects


def parse_query_sections(rql_string: str) -> Dict[str, str]:
    """
    Parses an RQL string to extract different sections as per predefined RQL clause
    definitions and their respective contexts.

    Detailed clause properties such as offsets and allowed delimiters guide the
    parsing process to correctly separate individual sections within the given RQL
    string. The output dictionary maps clause names to their respective extracted
    query components.

    :param rql_string: str
        The RQL string to be parsed into its respective sections.
    :return: Dict[str, str]
        A dictionary mapping RQL clause names to their contained query components.
        If a section is not found, its value in the dictionary will be None.
    """

    rql_sections = dict()

    rql_sections_definitions = {
        'DISTINCT': (0, False, ['Any']),
        'ANY': (0, False, ['GROUPBY', 'ORDERBY', ' LIMIT', 'WHERE', 'WITH', 'HAVING', 'UNION']),
        'SET': (0, False, ['GROUPBY', 'ORDERBY', 'LIMIT', 'WHERE', 'WITH', 'HAVING', 'UNION']),
        'DELETE': (0, False, ['GROUPBY', 'ORDERBY', 'LIMIT', 'WHERE', 'WITH', 'HAVING', 'UNION']),
        'INSERT':(0, False, ['GROUPBY', 'ORDERBY', 'LIMIT', 'WHERE', 'WITH', 'HAVING', 'UNION']),
        'GROUPBY':(0, False, ['ORDERBY', 'LIMIT', 'WHERE', 'WITH', 'HAVING', 'UNION']),
        'ORDERBY':(0, False, ['LIMIT', 'WHERE', 'WITH', 'HAVING', 'UNION']),
        'LIMIT':(0, False, ['WHERE', 'WITH', 'HAVING', 'UNION']),
        'WHERE':(0, False, ['WITH', 'HAVING', 'UNION']),
        'EXISTS': (0, True, [')']),
        'WITH':(0, False, ['BEING']),
        'BEING':(0, False, ['HAVING']),
        'HAVING':(0, False, ['UNION']),
        'UNION':(0, False, [])
    }

    rql_string = rql_string.strip()
    for section, section_parameters in rql_sections_definitions.items():
        sections_matches_list = (
            obtain_query_within_level_clauses(rql_string, section
                                              , base_query_level_offset= section_parameters[0]
                                              , section_delimiter_keywords = section_parameters[2]
                                              , obtain_section_keyword_modifiers_separately= section_parameters[1]
                                              ))
        if len(sections_matches_list) > 0:
            for query_clause in sections_matches_list:
                rql_sections[section] = query_clause['query_clause_text']
        else:
            rql_sections[section] = None

    return rql_sections


# ============================================================================
# VeloIQ-native DB / entity substrate (SQL-only branch).
# Reimplements the JuiceMantics functions the engine calls, against the host
# app's SQLAlchemy engine instead of Postgres/CubicWeb cw_ tables + RQL.
# ============================================================================
import configparser as _configparser
from sqlalchemy.engine.url import make_url as _make_url
from veloiq_framework.db import get_engine


# Environment variables that, when set, override the corresponding ini value.
# Keeps deployments tunable without editing jm_config.ini, while the defaults
# themselves live in the config file (not hard-coded here).
_JM_CONFIG_ENV_OVERRIDES = {
    ("nlp", "llm_provider"): "LLM_PROVIDER",
    ("nlp", "answer_asks_via_llm"): "VELOIQ_NLP_ANSWER_VIA_LLM",
    ("nlp", "render_load_type"): "VELOIQ_NLP_RENDER_LOAD_TYPE",
    ("logging", "log_up_to_relevance"): "VELOIQ_NLP_LOG_LEVEL",
}

# Memoized config: jm_obtain_config() is called on every jm_log() line (hundreds
# to thousands of times per chat), so re-parsing the .ini files each time is pure
# overhead. We cache the parsed ConfigParser and only re-parse when the inputs
# actually change, detected via a cheap signature (cwd + each candidate file's
# mtime + the resolved override env values). This preserves the live-override
# semantics (host config edits / env changes are picked up) while replacing the
# per-call "open+parse 4 files" with "getcwd + a few os.stat + a tuple compare".
_jm_config_cache = None
_jm_config_cache_signature = None


def _jm_config_signature(config_paths):
    """Cheap fingerprint of everything jm_obtain_config() depends on."""
    path_stamps = []
    for path in config_paths:
        try:
            path_stamps.append((path, os.path.getmtime(path)))
        except OSError:
            # Missing file: configparser silently skips it, so represent absence.
            path_stamps.append((path, None))
    env_values = tuple(
        os.getenv(env_name) for env_name in _JM_CONFIG_ENV_OVERRIDES.values()
    )
    return (tuple(path_stamps), env_values)


def jm_resolve_nlp_config_file(host_path, package_relative_path):
    """Resolve an nlp config file, preferring the host's own copy.

    The deterministic NL parser reads its CSV config (synonyms, entity/attribute
    classification) from ``<cwd>/../config/...`` so deployments can supply their
    own. When the host has not provided a file, fall back to the template shipped
    inside the iqvigilant package at ``modules/nlp/config/<package_relative_path>``
    (e.g. the generic synonyms vocabulary), so a fresh host works out of the box.

    :param host_path: The host working-directory path the caller would normally read.
    :param package_relative_path: Path of the packaged template, relative to
        ``modules/nlp/config/``.
    :return: ``host_path`` if it exists, otherwise the packaged template path.
    """
    if os.path.exists(host_path):
        return host_path
    return os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),  # .../modules/nlp
        "config", package_relative_path)


def jm_obtain_config():
    """Load the NLP module configuration from jm_config.ini.

    Resolution order (later paths override earlier ones):
      1. The default jm_config.ini shipped with the iqvigilant package
         (modules/nlp/jm_config.ini).
      2. config/jm_config.ini or jm_config.ini in the host app's working
         directory, so deployments can override without touching the package.

    A small set of environment variables (see _JM_CONFIG_ENV_OVERRIDES) override
    the file values when set.

    The parsed config is memoized and only re-read when a config file's mtime or
    an override env var changes, so the hot logging path does not re-parse the
    .ini files on every call.
    """
    global _jm_config_cache, _jm_config_cache_signature

    # Packaged defaults: VeloIQ framework ships a minimal jm_config.ini
    # next to this utils directory (veloiq_framework/jm_config.ini).
    # IQVigilant extension may also ship a richer one at
    # iqvigilant/modules/nlp/jm_config.ini (discovered at runtime by
    # ConfigParser.read() if the package is installed in site-packages).
    _vf_package = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "jm_config.ini",
    )
    _cwd = os.getcwd()
    config_paths = [
        _vf_package,
        os.path.join(_cwd, "config", "jm_config.ini"),
        os.path.join(_cwd, "jm_config.ini"),
        "jm_config.ini",
    ]

    # Return the cached config unless the inputs changed since we parsed it.
    signature = _jm_config_signature(config_paths)
    if _jm_config_cache is not None and signature == _jm_config_cache_signature:
        return _jm_config_cache

    cfg = _configparser.ConfigParser()
    cfg.read(config_paths)

    # Apply environment-variable overrides where provided.
    for (section, key), env_name in _JM_CONFIG_ENV_OVERRIDES.items():
        value = os.getenv(env_name)
        if value is not None:
            if not cfg.has_section(section):
                cfg.add_section(section)
            cfg.set(section, key, value)

    _jm_config_cache = cfg
    _jm_config_cache_signature = signature
    return cfg


# Regular expression to identify entity-ID columns from column names.
# Matches patterns like MyEntity_id, my_entity__eid, myentity_id.
_ENTITY_ID_COLUMN_RE = re.compile(r"^(?P<etype>.+?)_{1,2}(?:eid|id)$", re.IGNORECASE)


def _parse_entity_type_from_column(name) -> Optional[str]:
    """Return the entity-type token a result column name encodes, or None.

    ``HORSE__id`` -> ``HORSE`` (matched to a model by table/class name). Columns
    that are not ``<type>_id`` / ``<type>__id`` / ``<type>__eid`` (attributes like
    ``barn_name``, aggregates like ``count``) return None and are left untouched.
    """
    n = str(name or "").strip()
    if not n:
        return None
    match = _ENTITY_ID_COLUMN_RE.match(n)
    if not match:
        return None
    etype = match.group("etype").strip("_")
    return etype or None


def _coerce_eid_value(value):
    """Coerce a cell value to an integer eid, or None if it is not an integer id."""
    try:
        if isinstance(value, bool):
            return None
        if isinstance(value, int):
            return int(value)
        if isinstance(value, float):
            return int(value) if float(value).is_integer() else None
        s = str(value).strip()
        if s.isdigit():
            return int(s)
    except Exception:
        return None
    return None


def replace_df_values_with_rset_entity_names(rset_df, rset=None):
    """Replace entity primary-key (eid) values in a result DataFrame with the
    object's title (``dc_title()`` / ``str()``), so charts and dataframe-based
    views show readable object labels instead of raw primary keys.

    Object columns are detected from their name: ``<TYPE>__id`` columns are
    resolved to the model for ``TYPE`` and each eid replaced with that object's
    title. Attribute / aggregate columns (no ``<type>_id`` pattern, or whose type
    does not map to a model) are left untouched. Chart axis labels are plain text,
    so this produces titles (not links); the tabular/object views add the
    navigable links separately (see views_utils._resolve_entity_eid_cells).

    Returns the DataFrame (mutated in place when object columns are found).
    """
    try:
        if rset_df is None or getattr(rset_df, "empty", True) or len(rset_df.columns) == 0:
            return rset_df
    except Exception:
        return rset_df

    # Map each object column to its model via the type encoded in the column name.
    col_models: Dict[Any, Any] = {}
    for col in rset_df.columns:
        etype = _parse_entity_type_from_column(col)
        if not etype:
            continue
        model = jm_obtain_model_by_name(etype)
        if model is not None:
            col_models[col] = model
    if not col_models:
        return rset_df

    try:
        from veloiq_framework.db import get_engine
        with Session(get_engine()) as session:
            label_cache: Dict[tuple, Any] = {}

            def _label_for(model, value):
                eid = _coerce_eid_value(value)
                if eid is None:
                    return value
                key = (model.__name__, eid)
                if key not in label_cache:
                    try:
                        obj = session.get(model, eid)
                    except Exception:
                        obj = None
                    if obj is None:
                        label_cache[key] = value
                    else:
                        label_cache[key] = obj.dc_title() if hasattr(obj, "dc_title") else str(obj)
                cached = label_cache[key]
                return cached if cached is not None else value

            for col, model in col_models.items():
                rset_df[col] = rset_df[col].map(lambda v, m=model: _label_for(m, v))
    except Exception as resolve_error:
        jm_log(1, f"replace_df_values_with_rset_entity_names: could not resolve entity eids: {resolve_error}")

    return rset_df


def replace_query_results_with_object_labels(sql_statement=None, sql_columns=None, sql_rows=None, *args, **kwargs):
    """Identity: without the cw_ entity registry, return the result rows unchanged.

    Signature mirrors the JM call ``(sql_statement, sql_columns, sql_rows)`` used
    by the dashboard renderer; it must return the rows (list of dicts), not the
    statement."""
    if sql_rows is not None:
        return sql_rows
    return [] if sql_rows is None else sql_rows


def jm_execute_rql(*args, **kwargs):
    raise NotImplementedError("RQL execution is disabled in the VeloIQ NLP port (SQL-only branch).")


def orm_execution_supported() -> bool:
    """Whether ORM-dialect execution (jm_execute_orm) is available.

    Implemented in this package against the host app's SQLModel engine, so
    features that depend on it — notably cached DbQuery reuse
    (``use_db_query_in_nlp_if_available``) — are available.
    """
    return True


def jm_execute_orm(self, entity
                   , orm_query_command
                   , orm_command_parameters=None
                   , jm_action=''
                   , jm_log_message=''
                   , sql_column_names=None
                   , pretty_df_column_names=False
                   , get_sql_column_names_from_rset=True
                   , max_retries=2
                   , retries_sleep_seconds=5
                   , log_level=2
                   , log_sql_command=False
                   , log_rset=False
                   , log_rset_df=False
                   , log_column_separator='|'
                   , use_db_query_if_available=True
                   , results_row_limit=None
                   , readable_df_values_with_entity_names=True
                   , execute_command=True
                   , execute_mutable_command=True
                   , timeout_ms=None
                   , session=None
                   , commit_session=True
                   ):
    """Execute an ORM command against the host app database using SQLModel.

    ``orm_query_command`` may be a SQLAlchemy/SQLModel statement (select/update/
    delete/insert), a SQLModel instance, a list/tuple of SQLModel instances, a
    callable ``(session, params) -> statement``, or a dict ORM spec (converted
    via :func:`jm_build_orm_query_from_spec`). Results are returned as a
    ``(JM_Rset, DataFrame, cursor, connection, ok)`` tuple, mirroring
    :func:`jm_execute_sql`.
    """

    if orm_command_parameters is None:
        orm_command_parameters = {}

    rset = None
    results_df = DataFrame()
    cursor = None
    db_connection = None
    sql_execution_success = False
    rows_affected_or_fetched = 0
    query_command_str = str(orm_query_command)

    db_query_is_available = False

    def _sqlmodel_to_dict(model_instance):
        if hasattr(model_instance, "model_dump"):
            return model_instance.model_dump()
        if hasattr(model_instance, "dict"):
            return model_instance.dict()
        return {k: v for k, v in model_instance.__dict__.items() if not k.startswith('_')}

    def _df_from_orm_rset(rset_rows, result_keys=None):
        if not rset_rows:
            return DataFrame(columns=sql_column_names or (result_keys or []))

        first_row = rset_rows[0]
        if isinstance(first_row, SQLModel):
            return DataFrame([_sqlmodel_to_dict(row) for row in rset_rows])

        if isinstance(first_row, (list, tuple)) or hasattr(first_row, "_mapping") or hasattr(first_row, "_fields"):
            rows = list(rset_rows)
            normalized_rows = []
            for row in rows:
                if isinstance(row, (list, tuple)):
                    normalized_rows.append(tuple(row))
                elif hasattr(row, "_mapping") or hasattr(row, "_fields"):
                    normalized_rows.append(tuple(row))
                else:
                    normalized_rows.append((row,))

            rows = normalized_rows
            lengths = [len(row) for row in rows if isinstance(row, (list, tuple))]
            max_len = max(lengths) if lengths else len(first_row)

            if any(length != max_len for length in lengths):
                padded_rows = []
                for row in rows:
                    if not isinstance(row, (list, tuple)):
                        padded_rows.append((row,))
                        continue
                    if len(row) < max_len:
                        padded_rows.append(tuple(list(row) + [None] * (max_len - len(row))))
                    else:
                        padded_rows.append(tuple(row))
                rows = padded_rows

            columns = None
            if sql_column_names and len(sql_column_names) == max_len:
                columns = sql_column_names
            elif result_keys and len(result_keys) == max_len:
                columns = list(result_keys)
            return DataFrame(rows, columns=columns)

        return DataFrame(rset_rows, columns=sql_column_names or None)

    def _normalize_rset_rows(rset_rows):
        if not isinstance(rset_rows, list):
            return rset_rows
        normalized = []
        for row in rset_rows:
            if isinstance(row, SQLModel):
                normalized.append(row)
            elif isinstance(row, (list, tuple)):
                normalized.append(tuple(row))
            elif hasattr(row, "_mapping") or hasattr(row, "_fields"):
                normalized.append(tuple(row))
            else:
                normalized.append((row,))
        return normalized

    # Try to get the results from a named DbQuery, if requested (disabled in port).
    if use_db_query_if_available and jm_action != '':
        rset, rset_df, db_query_is_available = (
            jm_execute_query_from_db_query(self, entity
                                           , db_query_name=jm_action, column_names=sql_column_names
                                           , variables_values=orm_command_parameters))
        sql_execution_success = True

    # Otherwise, execute the ORM command directly.
    if not use_db_query_if_available or not db_query_is_available:
        local_session, created = _get_session(session)
        try:
            command_to_execute = orm_query_command
            if isinstance(orm_query_command, dict):
                command_to_execute = jm_build_orm_query_from_spec(orm_query_command)
            if callable(orm_query_command):
                command_to_execute = orm_query_command(local_session, orm_command_parameters)

            # A dict spec referencing an unknown model/table (e.g. DbQuery, which
            # is a value object rather than a persisted table in this port) builds
            # to None. Treat that as an empty result instead of an execution error.
            if command_to_execute is None:
                raise _OrmModelUnavailable(orm_query_command)

            query_command_str = str(command_to_execute)

            command_is_mutable, command_type = _orm_command_is_mutable(command_to_execute)

            if log_sql_command:
                jm_log(log_level, 'ORM command:', str(command_to_execute))

            if execute_command and (not command_is_mutable or execute_mutable_command):
                if isinstance(command_to_execute, SQLModel):
                    local_session.add(command_to_execute)
                    if commit_session:
                        local_session.commit()
                    rset = [command_to_execute]
                    rows_affected_or_fetched = 1
                    results_df = _df_from_orm_rset(rset)
                    sql_execution_success = True

                elif isinstance(command_to_execute, (list, tuple)) and all(
                        isinstance(item, SQLModel) for item in command_to_execute
                ):
                    local_session.add_all(list(command_to_execute))
                    if commit_session:
                        local_session.commit()
                    rset = list(command_to_execute)
                    rows_affected_or_fetched = len(rset)
                    results_df = _df_from_orm_rset(rset)
                    sql_execution_success = True

                else:
                    if timeout_ms:
                        try:
                            local_session.exec(
                                text('SET statement_timeout TO :timeout_ms'),
                                {'timeout_ms': timeout_ms},
                            )
                        except Exception:
                            pass

                    if orm_command_parameters:
                        try:
                            command_to_execute = command_to_execute.params(**orm_command_parameters)
                        except Exception:
                            pass

                    result = local_session.exec(command_to_execute)

                    result_keys = None
                    if get_sql_column_names_from_rset:
                        try:
                            result_keys = list(result.keys())
                        except Exception:
                            result_keys = None

                    try:
                        rset_all = result.all()
                    except Exception:
                        try:
                            rset_all = result.fetchall()
                        except Exception:
                            rset_all = []

                    if results_row_limit:
                        rset = rset_all[:results_row_limit]
                    else:
                        rset = rset_all

                    rows_affected_or_fetched = getattr(result, 'rowcount', None)
                    if not command_is_mutable:
                        rows_affected_or_fetched = len(rset)
                    elif rows_affected_or_fetched is None or rows_affected_or_fetched < 0:
                        rows_affected_or_fetched = len(rset_all)

                    if command_is_mutable and commit_session:
                        local_session.commit()

                    results_df = _df_from_orm_rset(rset, result_keys=result_keys)
                    sql_execution_success = True

            else:
                rset = []
                results_df = DataFrame(columns=sql_column_names or [])

        except _OrmModelUnavailable:
            # Expected when a spec targets a model/table that does not exist in
            # this port (e.g. the DbQuery reuse cache). Return empty quietly so
            # callers fall back to generating the query fresh.
            rset = []
            results_df = DataFrame(columns=sql_column_names or [])
            sql_execution_success = False

        except Exception as e:
            rset = []
            results_df = DataFrame(columns=sql_column_names or [])
            try:
                local_session.rollback()
            except Exception:
                pass

            jm_log(1, e)
            jm_log(1, 'jm_action:', jm_action)
            jm_log(1, 'orm_query_command:', orm_query_command)
            jm_log(1, 'orm_command_parameters:', orm_command_parameters)
            jm_log(1, 'An error has occurred while executing an ORM command.')

        finally:
            if created:
                local_session.close()

    if not rset:
        rset = []
        results_df = DataFrame(columns=sql_column_names or [])

    rset = _normalize_rset_rows(rset)

    if pretty_df_column_names:
        results_df.columns = jm_pretty_df_column_names(results_df.columns)

    if readable_df_values_with_entity_names:
        results_df = replace_df_values_with_entity_names(results_df, create_entity_hyperlink=True)

    rset_instance = JM_Rset(rset, results_df, query_command_str, rows_affected_or_fetched)

    # On mutable commands, fire the pre_save signal so post_save-decorated
    # actions run, mirroring jm_execute_sql behavior.
    command_is_mutable, command_type = _orm_command_is_mutable(orm_query_command)
    if command_is_mutable and isinstance(rset, list):
        for rset_row in rset:
            entity_instance = None
            if isinstance(rset_row, SQLModel):
                entity_instance = rset_row
            elif isinstance(rset_row, (list, tuple)) and len(rset_row) > 0 and isinstance(rset_row[0], SQLModel):
                entity_instance = rset_row[0]

            if entity_instance is None:
                continue

            entity_instance_model = entity_instance.__class__
            if command_type in ('SET', 'UPDATE'):
                pre_save.send(sender=entity_instance_model, instance=entity_instance
                              , event='before_update_entity')
            elif command_type == 'INSERT':
                pre_save.send(sender=entity_instance_model, instance=entity_instance
                              , event='before_add_entity')
            elif command_type == 'DELETE':
                pre_save.send(sender=entity_instance_model, instance=entity_instance
                              , event='before_delete_entity')

    return rset_instance, results_df, cursor, db_connection, sql_execution_success


def create_entity_instance(*args, **kwargs):
    raise NotImplementedError("Entity creation is not supported in the VeloIQ NLP port.")


def obtain_entity_instance(*args, **kwargs):
    raise NotImplementedError("Entity instance lookup is not supported in the VeloIQ NLP port.")


def __getattr__(name):
    if name == "engine":
        from veloiq_framework.db import get_engine
        return get_engine()
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
def jm_obtain_entity_by_eid(self, calling_class_entity, entity_eid, of_entity_types=('*',)):
    """Best-effort: without the cw_ entity registry, label resolution is skipped;
    query results display raw values. Returns None so callers fall back."""
    return None


def jm_summarize_df(df, group_cols=None, sum_cols=None, mean_cols=None, exclude_cols=None):
    """
    Summarizes a DataFrame by grouping and aggregating specific columns.

    This function allows for flexible aggregation. If `sum_cols` is not provided,
    the function automatically detects and sums all available numeric columns that
    are not already being grouped, averaged, or explicitly excluded.

    It handles two primary modes:
    1. Grouped Aggregation: If `group_cols` is provided.
    2. Global Aggregation: If `group_cols` is empty (summarizes the whole DF to one row).

    Args:
        df (pd.DataFrame): The input DataFrame to summarize.
        group_cols (list[str], optional): A list of column names to group by.
            If None or empty, the function performs a global aggregation on the
            entire DataFrame. Defaults to None.
        sum_cols (list[str], optional): A list of specific column names to sum.
            If None, the function calculates this list automatically by selecting
            all numeric columns not present in `group_cols`, `mean_cols`, or
            `exclude_cols`. Defaults to None.
        mean_cols (list[str], optional): A list of column names to calculate the
            mean (average). Defaults to None.
        exclude_cols (list[str], optional): A list of column names to explicitly
            exclude from the automatic `sum_cols` calculation. Defaults to None.

    Returns:
        pd.DataFrame: A new DataFrame containing the summarized data.
            If `group_cols` was empty, returns a single-row DataFrame.
    """

    from pandas.api.types import is_numeric_dtype

    if exclude_cols is None:
        exclude_cols = []
    if mean_cols is None:
        mean_cols = []
    if group_cols is None:
        group_cols = []

    if not sum_cols:
        # 1. Identify candidate columns (those not already handled)
        all_cols = df.columns.tolist()
        candidate_cols = [c for c in all_cols if c not in group_cols and c not in mean_cols and c not in exclude_cols]

        # 2. Filter candidates to keep ONLY numeric columns
        # This prevents the function from trying to sum dates, strings, or URLs
        sum_cols = [c for c in candidate_cols if is_numeric_dtype(df[c])]

    # Construct the aggregation dictionary safely
    agg_dict = {}
    if sum_cols:
        agg_dict.update({col: 'sum' for col in sum_cols})
    if mean_cols:
        agg_dict.update({col: 'mean' for col in mean_cols})

    # Create the summary dataframe with Conditional Logic
    if not agg_dict:
        # Handle edge case: No aggregation columns defined
        if group_cols:
            summarized_df = df[group_cols].drop_duplicates().reset_index(drop=True)
        else:
            summarized_df = pd.DataFrame()
    else:
        # Handle normal aggregation
        if group_cols:
            summarized_df = df.groupby(group_cols).agg(agg_dict).reset_index()
        else:
            # Case B: No grouping -> Aggregate entire dataframe
            summarized_df = df.agg(agg_dict).to_frame().T

    return summarized_df
