"""Many-to-one relations implemented through a link table.

A relation declared with ``jm_relationship(link_model=..., max_items=1)`` is stored in a link
table, yet each row of the model has at most one related row, so it behaves like a foreign key.
This module finds those relations and lets the generic CRUD layer treat each one as a field
of the model whose value is the id of the related row — the same value a foreign-key column
holds — so lists, show pages and edit forms handle it like a foreign key.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy import delete, insert, select
from sqlalchemy.inspection import inspect as sa_inspect
from sqlalchemy.orm import MANYTOMANY


@dataclass(frozen=True)
class LinkTableManyToOneRelation:
    """One many-to-one relation of a model that is stored in a link table."""

    field_key: str
    """The relationship's attribute name on the model; the key of the field in rows and payloads."""
    related_model: type
    link_table: Any
    main_row_column_name: str
    """The link table column holding the id of the model's own row."""
    related_row_column_name: str
    """The link table column holding the id of the related row."""
    main_row_key: str
    """The attribute of the model the link table column refers to (its primary key)."""
    is_required: bool


def link_table_many_to_one_relations(model_class: type) -> list[LinkTableManyToOneRelation]:
    """The relations of *model_class* stored in a link table that allow at most one related row."""
    try:
        mapper = sa_inspect(model_class)
        relationships = list(mapper.relationships)
    except Exception:
        return []
    found = []
    for relationship in relationships:
        if relationship.direction is not MANYTOMANY or relationship.secondary is None:
            continue
        cardinality = (relationship.info or {}).get("cardinality")
        if cardinality is None or cardinality.max_items != 1:
            continue
        main_pairs = list(relationship.synchronize_pairs)
        related_pairs = list(relationship.secondary_synchronize_pairs)
        if not main_pairs or not related_pairs:
            continue
        main_row_column, main_link_column = main_pairs[0]
        _related_row_column, related_link_column = related_pairs[0]
        found.append(LinkTableManyToOneRelation(
            field_key=relationship.key,
            related_model=relationship.mapper.class_,
            link_table=relationship.secondary,
            main_row_column_name=main_link_column.name,
            related_row_column_name=related_link_column.name,
            main_row_key=mapper.get_property_by_column(main_row_column).key,
            is_required=cardinality.min_items >= 1 or bool(cardinality.required),
        ))
    return found


def add_link_table_related_ids(rows: list[dict], model_class: type, session) -> None:
    """Add to each row of *rows* the id of its related row, under each relation's field key.

    A row without a related row gets ``None``. One query per relation covers all the rows.
    """
    relations = link_table_many_to_one_relations(model_class)
    if not relations or not rows:
        return
    for relation in relations:
        main_ids = [row.get(relation.main_row_key) for row in rows if row.get(relation.main_row_key) is not None]
        related_id_by_main_id: dict = {}
        if main_ids:
            main_column = relation.link_table.c[relation.main_row_column_name]
            related_column = relation.link_table.c[relation.related_row_column_name]
            for main_id, related_id in session.execute(
                    select(main_column, related_column).where(main_column.in_(main_ids))):
                related_id_by_main_id.setdefault(main_id, related_id)
        for row in rows:
            row[relation.field_key] = related_id_by_main_id.get(row.get(relation.main_row_key))


def split_link_table_selections(payload: dict, model_class: type) -> tuple[dict, dict[str, Any]]:
    """Separate the link-table relations' values from a write *payload*.

    Returns the payload without them, and the selected related id by relation field key
    (``None`` meaning no related row).
    """
    relations = link_table_many_to_one_relations(model_class)
    if not relations:
        return payload, {}
    keys = {relation.field_key for relation in relations}
    selections = {key: (None if value in ("", None) else value) for key, value in payload.items() if key in keys}
    remaining = {key: value for key, value in payload.items() if key not in keys}
    return remaining, selections


def _coerce_related_id(relation: LinkTableManyToOneRelation, value: Any) -> Any:
    if not isinstance(value, str):
        return value
    column_type = relation.link_table.c[relation.related_row_column_name].type
    try:
        python_type = column_type.python_type
    except NotImplementedError:
        return value
    try:
        return python_type(value)
    except (TypeError, ValueError):
        return value


def _mapped_model_of_table(table: Any) -> type | None:
    """The SQLModel class mapped to *table*, if the link table is declared as a model."""
    from sqlmodel import SQLModel
    for mapper in SQLModel._sa_registry.mappers:
        if mapper.local_table is table and hasattr(mapper.class_, "model_validate"):
            return mapper.class_
    return None


def write_link_table_selections(session, row: Any, model_class: type, selections: dict[str, Any]) -> None:
    """Make each selected relation of *row* point to the chosen related row, in the open transaction.

    The link table's existing rows for *row* are replaced; ``None`` leaves the row with no related row.
    """
    if not selections:
        return
    for relation in link_table_many_to_one_relations(model_class):
        if relation.field_key not in selections:
            continue
        main_id = getattr(row, relation.main_row_key)
        related_id = _coerce_related_id(relation, selections[relation.field_key])
        session.execute(delete(relation.link_table).where(
            relation.link_table.c[relation.main_row_column_name] == main_id))
        if related_id is None:
            continue
        link_values = {relation.main_row_column_name: main_id, relation.related_row_column_name: related_id}
        link_model = _mapped_model_of_table(relation.link_table)
        if link_model is not None:
            # The mapped link model applies its own defaults (e.g. an id or a creation date).
            session.add(link_model.model_validate(link_values))
        else:
            session.execute(insert(relation.link_table).values(link_values))
