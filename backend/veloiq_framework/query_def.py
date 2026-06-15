"""Declarative named query definitions loaded from named_queries.json.

These complement hand-written queries.py files.  Studio writes
``named_queries.json`` into each module directory; the framework reads it at
startup and code-generation time.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


# ── Declarative dataclasses ───────────────────────────────────────────────────

@dataclass
class NamedQueryJoinDef:
    resource: str       # target model __tablename__
    alias: str          # field-key prefix used in this query (defaults to resource)


@dataclass
class NamedQueryFieldSpec:
    from_alias: str     # "root" or a join alias
    key: str            # attribute name on that model
    alias: str = ""     # output column key (auto-derived if blank)
    label: str = ""     # display label  (auto-derived if blank)
    type: str = "string"

    def __post_init__(self) -> None:
        if not self.alias:
            self.alias = self.key if self.from_alias == "root" else f"{self.from_alias}_{self.key}"
        if not self.label:
            self.label = self.alias.replace("_", " ").title()


@dataclass
class NamedQueryFilterSpec:
    field: str          # output column alias or "alias.key"
    operator: str = "eq"
    value: Any = None


@dataclass
class NamedQuerySortSpec:
    field: str
    order: str = "asc"   # "asc" | "desc"


@dataclass
class NamedQueryDef:
    name: str
    label: str
    module: str
    root_resource: str
    joins: list[NamedQueryJoinDef] = field(default_factory=list)
    fields: list[NamedQueryFieldSpec] = field(default_factory=list)
    default_filters: list[NamedQueryFilterSpec] = field(default_factory=list)
    default_sort: list[NamedQuerySortSpec] = field(default_factory=list)
    list_view_type: str = "table"


# ── JSON persistence ──────────────────────────────────────────────────────────

def load_defs(json_path: Path) -> list[NamedQueryDef]:
    """Parse a named_queries.json file; returns [] on missing or bad file."""
    if not json_path.exists():
        return []
    try:
        raw: list[dict] = json.loads(json_path.read_text()) or []
    except Exception as exc:
        print(f"  ⚠️  Could not parse {json_path}: {exc}")
        return []
    defs: list[NamedQueryDef] = []
    for item in raw:
        try:
            defs.append(_parse_one(item))
        except Exception as exc:
            print(f"  ⚠️  Skipping named query def '{item.get('name', '?')}': {exc}")
    return defs


def save_defs(json_path: Path, defs: list[NamedQueryDef]) -> None:
    """Write NamedQueryDef list to JSON, creating the file if needed."""
    raw = [_def_to_dict(d) for d in defs]
    json_path.write_text(json.dumps(raw, indent=2, ensure_ascii=False))


def _parse_one(item: dict) -> NamedQueryDef:
    joins = [
        NamedQueryJoinDef(resource=j["resource"], alias=j.get("alias", j["resource"]))
        for j in item.get("joins", [])
    ]
    fields = [
        NamedQueryFieldSpec(
            from_alias=f["from_alias"],
            key=f["key"],
            alias=f.get("alias", ""),
            label=f.get("label", ""),
            type=f.get("type", "string"),
        )
        for f in item.get("fields", [])
    ]
    filters = [
        NamedQueryFilterSpec(
            field=flt["field"],
            operator=flt.get("operator", "eq"),
            value=flt.get("value"),
        )
        for flt in item.get("default_filters", [])
    ]
    sort_raw = item.get("default_sort", [])
    # Accept both a list [{field, order}, ...] and the legacy single {field, order}.
    if isinstance(sort_raw, dict):
        sort_raw = [sort_raw]
    sort = [NamedQuerySortSpec(field=s["field"], order=s.get("order", "asc")) for s in sort_raw]
    return NamedQueryDef(
        name=item["name"],
        label=item.get("label", item["name"].replace("_", " ").title()),
        module=item.get("module", ""),
        root_resource=item["root_resource"],
        joins=joins,
        fields=fields,
        default_filters=filters,
        default_sort=sort,
        list_view_type=item.get("list_view_type", "table"),
    )


def _def_to_dict(d: NamedQueryDef) -> dict:
    out: dict = {
        "name": d.name,
        "label": d.label,
        "root_resource": d.root_resource,
        "joins": [{"resource": j.resource, "alias": j.alias} for j in d.joins],
        "fields": [
            {"from_alias": f.from_alias, "key": f.key, "alias": f.alias,
             "label": f.label, "type": f.type}
            for f in d.fields
        ],
        "default_filters": [
            {"field": flt.field, "operator": flt.operator, "value": flt.value}
            for flt in d.default_filters
        ],
        "list_view_type": d.list_view_type,
    }
    if d.default_sort:
        out["default_sort"] = [{"field": s.field, "order": s.order} for s in d.default_sort]
    return out


# ── Build NamedQuery from a NamedQueryDef ─────────────────────────────────────

def build_named_query(qdef: NamedQueryDef, module: str) -> "Any | None":
    """Convert a NamedQueryDef to a live NamedQuery.

    Called after all SQLModel classes have been imported so the registry is
    populated.  Returns None and prints a warning on any resolution failure.
    """
    from veloiq_framework.queries import NamedQuery, NamedQueryField

    root_cls = _model_by_tablename(qdef.root_resource)
    if root_cls is None:
        print(f"  ⚠️  named query '{qdef.name}': root '{qdef.root_resource}' not found")
        return None

    # Resolve join models and the ORM relationship attr that links them.
    alias_to_cls: dict[str, Any] = {"root": root_cls}
    join_steps: list[tuple[Any, str]] = []   # (from_cls, rel_attr)

    prev_cls = root_cls
    for j in qdef.joins:
        target_cls = _model_by_tablename(j.resource)
        if target_cls is None:
            print(f"  ⚠️  named query '{qdef.name}': join model '{j.resource}' not found")
            return None
        rel_attr = _rel_attr(prev_cls, target_cls) or _rel_attr(target_cls, prev_cls)
        if rel_attr is None:
            print(f"  ⚠️  named query '{qdef.name}': "
                  f"no ORM relationship between '{prev_cls.__tablename__}' and '{j.resource}'")
            return None
        join_steps.append((prev_cls, rel_attr))
        alias_to_cls[j.alias] = target_cls
        prev_cls = target_cls

    # Determine the root model's pk attribute name.
    from veloiq_framework.models import get_pk_field_name
    pk_attr = get_pk_field_name(root_cls)  # e.g. "id"

    # Build projected columns and NamedQueryField list.
    from sqlmodel import select
    col_specs: list[Any] = []
    nq_fields: list[NamedQueryField] = []
    for fs in qdef.fields:
        model_cls = alias_to_cls.get(fs.from_alias)
        if model_cls is None:
            print(f"  ⚠️  named query '{qdef.name}': unknown alias '{fs.from_alias}'")
            continue
        col = getattr(model_cls, fs.key, None)
        if col is None:
            print(f"  ⚠️  named query '{qdef.name}': '{fs.key}' not on {model_cls.__name__}")
            continue
        col_specs.append(col.label(fs.alias))
        nq_fields.append(NamedQueryField(
            key=fs.alias,
            label=fs.label,
            type=fs.type,
            source_model=model_cls,
            source_attr=fs.key,
            read_only=(fs.from_alias != "root"),
        ))

    # Always ensure the root pk is in the SELECT so _row_to_dict can set eid.
    # If the user didn't include it, prepend it as a hidden (read-only) field.
    pk_included = any(
        f.source_model is root_cls and f.source_attr == pk_attr
        for f in nq_fields
    )
    if not pk_included:
        pk_col = getattr(root_cls, pk_attr, None)
        if pk_col is not None:
            col_specs.insert(0, pk_col.label(pk_attr))
            nq_fields.insert(0, NamedQueryField(
                key=pk_attr,
                label="ID",
                type="number",
                source_model=root_cls,
                source_attr=pk_attr,
                read_only=True,
            ))

    if not nq_fields:
        print(f"  ⚠️  named query '{qdef.name}': no valid fields resolved")
        return None

    # Build default filter WHERE clauses.
    where_clauses: list[Any] = []
    for flt in qdef.default_filters:
        # field is an output alias — find the source col via nq_fields.
        nqf = next((f for f in nq_fields if f.key == flt.field), None)
        if nqf is None:
            continue
        col = getattr(nqf.source_model, nqf.source_attr, None)
        if col is None:
            continue
        clause = _make_filter_clause(col, flt.operator, flt.value)
        if clause is not None:
            where_clauses.append(clause)

    # Build ORDER BY expressions from default_sort list.
    from sqlalchemy import asc, desc
    order_clauses: list[Any] = []
    for s in qdef.default_sort:
        nqf = next((f for f in nq_fields if f.key == s.field), None)
        if nqf is None:
            continue
        col = getattr(nqf.source_model, nqf.source_attr, None)
        if col is None:
            continue
        order_clauses.append(desc(col) if s.order == "desc" else asc(col))

    # Capture loop-local names in the closure to avoid late-binding issues.
    _root = root_cls
    _steps = list(join_steps)
    _cols = list(col_specs)
    _where = list(where_clauses)
    _order = list(order_clauses)

    def query_factory(session: Any, user: Any) -> Any:
        q = select(*_cols).select_from(_root)
        for from_cls, rel_attr in _steps:
            q = q.join(getattr(from_cls, rel_attr), isouter=True)
        for clause in _where:
            q = q.where(clause)
        for order in _order:
            q = q.order_by(order)
        return q

    # Pass only the primary sort to NamedQuery for TypeScript schema (single-field contract).
    primary_sort = (qdef.default_sort[0].field, qdef.default_sort[0].order) if qdef.default_sort else None

    return NamedQuery(
        name=qdef.name,
        label=qdef.label,
        module=module,
        primary_model=root_cls,
        participating_models=[root_cls] + [alias_to_cls[j.alias] for j in qdef.joins],
        fields=nq_fields,
        query_factory=query_factory,
        list_view_type=qdef.list_view_type,
        default_sort=primary_sort,
    )


# ── Private helpers ───────────────────────────────────────────────────────────

def _model_by_tablename(tablename: str) -> Any:
    from sqlmodel import SQLModel
    for mapper in SQLModel._sa_registry.mappers:
        cls = mapper.class_
        if getattr(cls, "__tablename__", None) == tablename:
            return cls
    return None


def _rel_attr(from_cls: Any, to_cls: Any) -> str | None:
    """Return the first ORM relationship attribute on from_cls that targets to_cls."""
    from sqlalchemy import inspect as sa_inspect
    try:
        for rel in sa_inspect(from_cls).relationships:
            if rel.mapper.class_.__tablename__ == to_cls.__tablename__:
                return rel.key
    except Exception:
        pass
    return None


def _make_filter_clause(col: Any, operator: str, value: Any) -> Any:
    try:
        if operator in ("eq", "="):
            return col == value
        if operator in ("ne", "!="):
            return col != value
        if operator in ("gt", ">"):
            return col > value
        if operator in ("gte", ">="):
            return col >= value
        if operator in ("lt", "<"):
            return col < value
        if operator in ("lte", "<="):
            return col <= value
        if operator in ("contains", "ilike"):
            return col.ilike(f"%{value}%")
    except Exception:
        pass
    return None
