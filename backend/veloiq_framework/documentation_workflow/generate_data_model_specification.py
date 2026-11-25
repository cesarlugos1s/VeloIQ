"""Generate the data model specification from the application's models (`veloiq docs spec generate-data-model`).

One file per entity at openspec/specs/data-model/<Entity>/spec.md. The files are fully generated:
the Purpose comes from the model's docstring and the Meaning of each field from its description in the code,
so the specification can never differ from the code. `check_data_model_specification` fails on any difference.
"""
from __future__ import annotations

import importlib
import inspect
import shutil
import sys
import warnings
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any

from veloiq_framework.documentation_workflow.specification_front_matter import join_front_matter, split_front_matter
from veloiq_framework.documentation_workflow.workflow_constants import (
    ELEMENT_TYPE_DATA_MODEL, ELEMENT_TYPE_SINGULAR_LABELS, OPENSPEC_FOLDER_NAME, SPECIFICATION_FILE_NAME, SPECIFICATIONS_FOLDER_NAME,
    UNRELEASED_VERSION_LABEL,
)

EXACTLY_ONE = "exactly 1"
ZERO_OR_ONE = "0 to 1"
ZERO_TO_MANY = "0 to many"
MERMAID_LEFT_SYMBOL = {EXACTLY_ONE: "||", ZERO_OR_ONE: "o|", ZERO_TO_MANY: "}o"}
MERMAID_RIGHT_SYMBOL = {EXACTLY_ONE: "||", ZERO_OR_ONE: "|o", ZERO_TO_MANY: "o{"}


@dataclass(frozen=True)
class FieldDescription:
    name: str
    type_text: str
    mandatory: bool
    unique_text: str
    default_text: str
    constraints_text: str
    meaning: str


@dataclass(frozen=True)
class RelationDescription:
    name: str
    target: str
    kind: str
    this_side: str
    other_side: str


@dataclass(frozen=True)
class EntityDescription:
    name: str
    module_name: str
    purpose: str
    models_file: str
    fields: tuple[FieldDescription, ...]
    relations: tuple[RelationDescription, ...]


def load_application_entity_classes(project_root: Path) -> list[tuple[str, type]]:
    """Import the application's models and return (module name, entity class) pairs, link tables excluded."""
    from sqlmodel import SQLModel
    from veloiq_framework.api_schema_gen import _is_link_model, _iter_subclasses

    backend_folder = project_root / "backend"
    modules_folder = backend_folder / "app" / "modules"
    if str(backend_folder) not in sys.path:
        sys.path.insert(0, str(backend_folder))
    try:
        import veloiq_framework.auth.models  # noqa: F401  registers the framework's own tables first
    except Exception:
        pass
    module_names = sorted(
        folder.name for folder in modules_folder.iterdir()
        if folder.is_dir() and not folder.name.startswith("__") and (folder / "models.py").exists()
    )
    for module_name in module_names:
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore")
            try:
                importlib.import_module(f"app.modules.{module_name}.models")
            except Exception:
                pass
    from sqlalchemy.orm import configure_mappers
    configure_mappers()

    entity_classes: list[tuple[str, type]] = []
    for module_name in module_names:
        dotted_name = f"app.modules.{module_name}.models"
        classes = sorted(
            (cls for cls in _iter_subclasses(SQLModel)
             if getattr(cls, "__module__", "") == dotted_name and getattr(cls, "__tablename__", None) and not _is_link_model(cls)),
            key=lambda cls: cls.__name__,
        )
        entity_classes.extend((module_name, cls) for cls in classes)
    return entity_classes


def _describe_column_type(column) -> str:
    from sqlalchemy import Boolean, Date, DateTime, Enum, Float, Integer, JSON, Numeric, String, Text
    column_type = column.type
    if column_type.__class__.__name__ == "AutoString":
        return "text"
    if isinstance(column_type, Enum):
        return "enumeration"
    if isinstance(column_type, String) and not isinstance(column_type, Text):
        return f"text, up to {column_type.length} characters" if column_type.length else "text"
    if isinstance(column_type, Text):
        return "long text"
    if isinstance(column_type, Boolean):
        return "yes or no"
    if isinstance(column_type, Integer):
        return "whole number"
    if isinstance(column_type, (Float, Numeric)):
        return "decimal number"
    if isinstance(column_type, DateTime):
        return "date and time"
    if isinstance(column_type, Date):
        return "date"
    if isinstance(column_type, JSON):
        return "structured data (JSON)"
    return str(column_type).lower()


def _describe_enumeration_values(column) -> list[str]:
    enum_class = getattr(column.type, "enum_class", None)
    if enum_class is not None:
        return [str(member.value) for member in enum_class]
    return [str(value) for value in getattr(column.type, "enums", [])]


def _describe_default(cls: type, column) -> str:
    from pydantic_core import PydanticUndefined
    field_info = getattr(cls, "model_fields", {}).get(column.key)
    if field_info is not None:
        if field_info.default_factory is not None:
            return f"computed by {getattr(field_info.default_factory, '__name__', 'a function')}"
        if field_info.default is not PydanticUndefined and field_info.default is not None:
            default_value = field_info.default
            return str(getattr(default_value, "value", default_value))
    if column.default is not None:
        if getattr(column.default, "is_callable", False):
            return f"computed by {getattr(column.default.arg, '__name__', 'a function')}"
        if getattr(column.default, "is_scalar", False):
            return str(column.default.arg)
    if column.server_default is not None:
        return f"set by the database ({getattr(column.server_default.arg, 'text', column.server_default.arg)})"
    return "none"


def _describe_unique(cls: type, column) -> str:
    from sqlalchemy import UniqueConstraint
    if column.unique:
        return "yes"
    compositions = []
    for constraint in cls.__table__.constraints:
        if isinstance(constraint, UniqueConstraint) and column.key in constraint.columns.keys() and len(constraint.columns) > 1:
            other_names = [name for name in constraint.columns.keys() if name != column.key]
            compositions.append("with " + ", ".join(other_names))
    for index in cls.__table__.indexes:
        if index.unique and column.key in index.columns.keys() and len(index.columns) > 1:
            compositions.append("with " + ", ".join(name for name in index.columns.keys() if name != column.key))
    return "; ".join(compositions) if compositions else "no"


def _describe_constraints(column) -> str:
    parts: list[str] = []
    if column.primary_key:
        parts.append("primary key")
    enumeration_values = _describe_enumeration_values(column) if column.type.__class__.__name__ == "Enum" else []
    if enumeration_values:
        parts.append("values: " + ", ".join(f"`{value}`" for value in enumeration_values))
    for foreign_key in column.foreign_keys:
        parts.append(f"references {foreign_key.column.table.name}")
    return "; ".join(parts)


def _describe_relation(entity_class: type, relationship) -> RelationDescription:
    target_name = relationship.mapper.class_.__name__
    direction_name = relationship.direction.name
    if relationship.secondary is not None or direction_name == "MANYTOMANY":
        return RelationDescription(relationship.key, target_name, "many-to-many", ZERO_TO_MANY, ZERO_TO_MANY)
    if direction_name == "MANYTOONE":
        optional = all(column.nullable for column in relationship.local_columns)
        return RelationDescription(relationship.key, target_name, "many-to-one", ZERO_OR_ONE if optional else EXACTLY_ONE, ZERO_TO_MANY)
    if direction_name == "ONETOMANY":
        optional = all(column.nullable for column in relationship.remote_side)
        other_side = ZERO_OR_ONE if optional else EXACTLY_ONE
        if not relationship.uselist:
            return RelationDescription(relationship.key, target_name, "one-to-one", ZERO_OR_ONE, other_side)
        return RelationDescription(relationship.key, target_name, "one-to-many", ZERO_TO_MANY, other_side)
    return RelationDescription(relationship.key, target_name, direction_name.lower(), ZERO_TO_MANY, ZERO_TO_MANY)


def describe_entity(module_name: str, entity_class: type, project_root: Path) -> EntityDescription:
    from sqlalchemy import inspect as sqlalchemy_inspect
    model_fields = getattr(entity_class, "model_fields", {})
    fields = []
    for column in entity_class.__table__.columns:
        field_info = model_fields.get(column.key)
        meaning = (field_info.description if field_info is not None and field_info.description else column.doc) or ""
        fields.append(FieldDescription(
            name=column.key, type_text=_describe_column_type(column), mandatory=not column.nullable,
            unique_text=_describe_unique(entity_class, column), default_text=_describe_default(entity_class, column),
            constraints_text=_describe_constraints(column), meaning=str(meaning).replace("|", "/").replace("\n", " "),
        ))
    relations = tuple(
        _describe_relation(entity_class, relationship)
        for relationship in sorted(sqlalchemy_inspect(entity_class).relationships, key=lambda relationship: relationship.key)
    )
    docstring = inspect.getdoc(entity_class) or ""
    purpose = docstring.split("\n\n")[0].replace("\n", " ").strip() if docstring and not docstring.startswith(entity_class.__name__ + "(") else ""
    models_file = Path(inspect.getsourcefile(entity_class) or "")
    try:
        models_file_text = models_file.resolve().relative_to(project_root.resolve()).as_posix()
    except ValueError:
        models_file_text = models_file.as_posix()
    return EntityDescription(entity_class.__name__, module_name, purpose, models_file_text, tuple(fields), relations)


def _render_diagram(entity: EntityDescription) -> str:
    lines = ["erDiagram"]
    for relation in entity.relations:
        left = MERMAID_LEFT_SYMBOL[relation.other_side]
        right = MERMAID_RIGHT_SYMBOL[relation.this_side]
        lines.append(f"    {entity.name} {left}--{right} {relation.target} : {relation.name}")
    if len(lines) == 1:
        lines.append(f"    {entity.name}")
    return "\n".join(lines)


def render_entity_specification(entity: EntityDescription, existing_front_matter: dict[str, Any], product_version: str, today: date) -> str:
    front_matter = {
        "name": entity.name, "type": ELEMENT_TYPE_SINGULAR_LABELS[ELEMENT_TYPE_DATA_MODEL], "generated": True, "module": entity.module_name,
        "created": existing_front_matter.get("created", today.isoformat()),
        "created-in-version": existing_front_matter.get("created-in-version", product_version),
        "implemented-by": {"models": [f"{entity.models_file}::{entity.name}"]},
    }
    purpose = entity.purpose or f"{entity.name} has no description in the code; add a class docstring."
    field_rows = "\n".join(
        f"| {field.name} | {field.type_text} | {'yes' if field.mandatory else 'no'} | {field.unique_text} | {field.default_text} | {field.constraints_text} | {field.meaning} |"
        for field in entity.fields
    )
    relation_rows = "\n".join(
        f"| {entity.name}.{relation.name} | {relation.target} | {relation.kind} | {relation.this_side} | {relation.other_side} |"
        for relation in entity.relations
    ) or "| none | | | | |"
    body = (
        f"# data-model/{entity.name} Specification\n\n"
        f"## Purpose\n\n{purpose}\n\n"
        f"## Requirements\n\n"
        f"### Requirement: {entity.name} structure\n"
        f"The system SHALL store {entity.name} records with the fields and relations described below.\n\n"
        f"#### Scenario: A record is stored\n"
        f"- **WHEN** a {entity.name} record is created\n"
        f"- **THEN** its mandatory fields are present and its relations follow the cardinalities below\n\n"
        f"## Fields\n\n"
        f"| Field | Type | Mandatory | Unique | Default value | Constraints | Meaning |\n| --- | --- | --- | --- | --- | --- | --- |\n{field_rows}\n\n"
        f"## Relations\n\n"
        f"\"This side\" is how many related records one {entity.name} has; \"Other side\" is how many {entity.name} records one related record has.\n\n"
        f"| Relation | Target | Kind | This side | Other side |\n| --- | --- | --- | --- | --- |\n{relation_rows}\n\n"
        f"## Diagram\n\n```mermaid\n{_render_diagram(entity)}\n```\n"
    )
    return join_front_matter(front_matter, body)


def _data_model_folder(project_root: Path) -> Path:
    return project_root / OPENSPEC_FOLDER_NAME / SPECIFICATIONS_FOLDER_NAME / ELEMENT_TYPE_DATA_MODEL


def render_all_entity_specifications(project_root: Path, product_version: str, today: date) -> dict[str, str]:
    """Return {entity name: file text} for every entity of the application."""
    rendered: dict[str, str] = {}
    for module_name, entity_class in load_application_entity_classes(project_root):
        entity = describe_entity(module_name, entity_class, project_root)
        existing_file = _data_model_folder(project_root) / entity.name / SPECIFICATION_FILE_NAME
        existing_front_matter = split_front_matter(existing_file.read_text(encoding="utf-8"))[0] if existing_file.exists() else {}
        rendered[entity.name] = render_entity_specification(entity, existing_front_matter, product_version, today)
    return rendered


def generate_data_model_specification(project_root: Path, product_version: str = UNRELEASED_VERSION_LABEL,
                                      today: date | None = None) -> tuple[list[str], list[str]]:
    """Write the entity files; return (entities written, stale generated entities removed)."""
    today = today or date.today()
    rendered = render_all_entity_specifications(project_root, product_version, today)
    data_model_folder = _data_model_folder(project_root)
    data_model_folder.mkdir(parents=True, exist_ok=True)
    for entity_name, file_text in rendered.items():
        entity_folder = data_model_folder / entity_name
        entity_folder.mkdir(exist_ok=True)
        (entity_folder / SPECIFICATION_FILE_NAME).write_text(file_text, encoding="utf-8")
    removed: list[str] = []
    for entity_folder in sorted(path for path in data_model_folder.iterdir() if path.is_dir() and path.name not in rendered):
        spec_file = entity_folder / SPECIFICATION_FILE_NAME
        if spec_file.exists() and split_front_matter(spec_file.read_text(encoding="utf-8"))[0].get("generated"):
            shutil.rmtree(entity_folder)
            removed.append(entity_folder.name)
    return sorted(rendered), removed


def check_data_model_specification(project_root: Path) -> list[str]:
    """Return the differences between the committed data model files and what the code generates now."""
    differences: list[str] = []
    rendered = render_all_entity_specifications(project_root, UNRELEASED_VERSION_LABEL, date.today())
    data_model_folder = _data_model_folder(project_root)
    for entity_name, file_text in rendered.items():
        spec_file = data_model_folder / entity_name / SPECIFICATION_FILE_NAME
        if not spec_file.exists():
            differences.append(f"data-model/{entity_name} is missing; run `veloiq docs spec generate-data-model`")
            continue
        committed_front_matter, committed_body = split_front_matter(spec_file.read_text(encoding="utf-8"))
        generated_front_matter, generated_body = split_front_matter(file_text)
        if committed_body != generated_body or committed_front_matter.get("implemented-by") != generated_front_matter.get("implemented-by"):
            differences.append(f"data-model/{entity_name} differs from the code")
    if data_model_folder.exists():
        for entity_folder in sorted(path for path in data_model_folder.iterdir() if path.is_dir() and path.name not in rendered):
            differences.append(f"data-model/{entity_folder.name} no longer exists in the code")
    return differences
