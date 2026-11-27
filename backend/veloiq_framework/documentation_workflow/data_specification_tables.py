"""Read and check the shared data of the Product Specification: entity definitions and the references requirements make to them.

An entity (`specs/entity-definitions/<Entity>/definition.md`) defines its data once, in a `## Fields` table and a `## Relations` table:

    | Field | Description | Type | Required | Allowed values | Default |
    | Subject entity | Relation | Object entity | Subject cardinality | Object cardinality |

A requirement points to the data it relies on with lines inside the requirement, and never copies the values (the documentation site
shows them next to the requirement):

    Data: IntegrationFlow.name, IntegrationFlow.max_attempts
    Relation: IntegrationFlow > has steps > FlowStep

Every reference must be defined by its entity; cardinalities are one of the closed list in `RELATION_CARDINALITIES`.

Names follow the conventions of the VeloIQ applications (models.py of the vertical apps and of JuiceMantics):
- an entity is a singular PascalCase name (`CashAccount`); its table is the same name in snake_case (`cash_account`);
- a field is lowercase snake_case (`risk_tolerance`); a yes/no field starts with `is_` or `has_`, a timestamp ends with `_at`
  and a date with `_date`;
- a relation is named from its subject: the subject in snake_case, the verb phrase, then the object in snake_case, all joined by
  underscores (`allocation_strategy_has_allocation_plan`); the other side is the same name with `_reverse`.
- both entities of a relation list it: the subject its own relation, the object the `_reverse` one with the cardinalities swapped.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from veloiq_framework.documentation_workflow.workflow_constants import (
    DATA_REFERENCE_KEYWORD, RELATION_CARDINALITIES, RELATION_REFERENCE_KEYWORD,
)

ENTITY_FIELDS_HEADING = "## Fields"
ENTITY_RELATIONS_HEADING = "## Relations"
ENTITY_FIELD_COLUMNS = ("Field", "Description", "Type", "Required", "Allowed values", "Default")
RELATION_COLUMNS = ("Subject entity", "Relation", "Object entity", "Subject cardinality", "Object cardinality")
REQUIREMENT_HEADING_PREFIX = "### Requirement:"
ENTITY_NAME_PATTERN = re.compile(r"^[A-Z][a-z0-9]*(?:[A-Z][a-z0-9]*)*$")
FIELD_NAME_PATTERN = re.compile(r"^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$")
FIELD_REFERENCE_PATTERN = re.compile(r"^[A-Z][A-Za-z0-9]*\.[a-z][a-z0-9_]*$")
BOOLEAN_FIELD_TYPE = "yes or no"
BOOLEAN_FIELD_PREFIXES = ("is_", "has_")
TIMESTAMP_FIELD_TYPE = "date and time"
TIMESTAMP_FIELD_SUFFIX = "_at"
DATE_FIELD_TYPE = "date"
DATE_FIELD_SUFFIX = "_date"


def snake_case_of_entity(entity_name: str) -> str:
    """`CashAccount` -> `cash_account`."""
    return re.sub(r"(?<!^)(?=[A-Z])", "_", entity_name).lower()


def field_name_problems(entity_name: str, row: list[str]) -> list[str]:
    """Return the naming problems of one field row (Field, Description, Type, ...)."""
    field_name, field_type = row[0], row[2]
    if not FIELD_NAME_PATTERN.match(field_name):
        return [f"field `{field_name}` of `{entity_name}` must be lowercase words joined by underscores"]
    if field_type == BOOLEAN_FIELD_TYPE and not field_name.startswith(BOOLEAN_FIELD_PREFIXES):
        return [f"yes or no field `{field_name}` of `{entity_name}` must start with {' or '.join(BOOLEAN_FIELD_PREFIXES)}"]
    if field_type == TIMESTAMP_FIELD_TYPE and not field_name.endswith(TIMESTAMP_FIELD_SUFFIX):
        return [f"date and time field `{field_name}` of `{entity_name}` must end with {TIMESTAMP_FIELD_SUFFIX}"]
    if field_type == DATE_FIELD_TYPE and not field_name.endswith(DATE_FIELD_SUFFIX):
        return [f"date field `{field_name}` of `{entity_name}` must end with {DATE_FIELD_SUFFIX}"]
    return []


REVERSE_SUFFIX = "_reverse"


def relation_name_problems(subject: str, relation: str, object_entity: str) -> list[str]:
    """A relation is `<subject>_<verb phrase>_<object>` in snake case, with a verb phrase between the two entities.

    On the object's entity the same relation is listed as `<that name>_reverse`, whose subject is the original object.
    """
    if relation.endswith(REVERSE_SUFFIX):
        return relation_name_problems(object_entity, relation[:-len(REVERSE_SUFFIX)], subject)
    subject_part, object_part = snake_case_of_entity(subject) + "_", "_" + snake_case_of_entity(object_entity)
    if not FIELD_NAME_PATTERN.match(relation) or not relation.startswith(subject_part) or not relation.endswith(object_part) \
            or len(relation) <= len(subject_part) + len(object_part) - 1:
        return [f"relation `{relation}` must be `{subject_part}<verb phrase>{object_part}`, lowercase words joined by underscores"]
    return []


@dataclass
class EntityDefinition:
    name: str
    field_rows: dict[str, list[str]] = field(default_factory=dict)  # field name -> its row of ENTITY_FIELD_COLUMNS
    relations: list[tuple[str, str, str, str, str]] = field(default_factory=list)  # subject, relation, object, subject side, object side

    @property
    def field_names(self) -> set[str]:
        return set(self.field_rows)


@dataclass
class DataReferences:
    """The data references found in the requirements of one spec: (requirement name, entity, field) and (requirement name, subject, relation, object)."""
    fields: list[tuple[str, str, str]] = field(default_factory=list)
    relations: list[tuple[str, str, str, str]] = field(default_factory=list)
    malformed: list[str] = field(default_factory=list)

    def is_empty(self) -> bool:
        return not self.fields and not self.relations


def read_table_under_heading(markdown_text: str, heading: str) -> tuple[list[str], list[list[str]]]:
    """Return (column names, rows of cell texts) of the first table under the heading; ([], []) when there is none."""
    lines = markdown_text.splitlines()
    start = next((index for index, line in enumerate(lines) if line.strip() == heading), None)
    if start is None:
        return [], []
    table_lines: list[str] = []
    for line in lines[start + 1:]:
        if line.startswith("## "):
            break
        if line.strip().startswith("|"):
            table_lines.append(line.strip())
        elif table_lines:
            break
    if len(table_lines) < 2:
        return [], []

    def cells(line: str) -> list[str]:
        return [cell.strip() for cell in line.strip().strip("|").split("|")]
    return cells(table_lines[0]), [row for row in (cells(line) for line in table_lines[2:]) if any(row)]


def _is_placeholder(cell_text: str) -> bool:
    return cell_text.startswith("<") and cell_text.endswith(">")


def read_entity_definition(entity_name: str, definition_text: str) -> tuple[EntityDefinition, list[str]]:
    """Return the entity and the problems found in its definition text."""
    problems: list[str] = []
    entity = EntityDefinition(entity_name)
    if not ENTITY_NAME_PATTERN.match(entity_name):
        problems.append(f"entity name `{entity_name}` must be singular PascalCase, such as CashAccount")
    columns, rows = read_table_under_heading(definition_text, ENTITY_FIELDS_HEADING)
    if tuple(columns) != ENTITY_FIELD_COLUMNS:
        problems.append(f"`{ENTITY_FIELDS_HEADING}` needs a table with the columns {' | '.join(ENTITY_FIELD_COLUMNS)}")
        rows = []
    for row in rows:
        if len(row) != len(ENTITY_FIELD_COLUMNS):
            problems.append(f"field row `{row[0]}` needs {len(ENTITY_FIELD_COLUMNS)} cells")
        elif any(_is_placeholder(cell) for cell in row):
            problems.append(f"field row `{row[0]}` still has placeholders")
        else:
            problems += field_name_problems(entity_name, row)
            entity.field_rows[row[0]] = row
    if not entity.field_rows:
        problems.append("an entity needs at least one field")
    relation_columns, relation_rows = read_table_under_heading(definition_text, ENTITY_RELATIONS_HEADING)
    if relation_rows and tuple(relation_columns) != RELATION_COLUMNS:
        problems.append(f"`{ENTITY_RELATIONS_HEADING}` needs the columns {' | '.join(RELATION_COLUMNS)}")
        relation_rows = []
    for row in relation_rows:
        if len(row) != len(RELATION_COLUMNS):
            problems.append(f"a relation row needs {len(RELATION_COLUMNS)} cells")
            continue
        subject, relation, object_entity, subject_side, object_side = row
        if any(_is_placeholder(cell) for cell in row):
            problems.append(f"relation row `{relation}` still has placeholders")
            continue
        if subject != entity_name:
            problems.append(f"relation `{relation}` has subject `{subject}`; it must be this entity, `{entity_name}`")
        for side in (subject_side, object_side):
            if side not in RELATION_CARDINALITIES:
                problems.append(f"relation `{relation}`: cardinality `{side}` is not one of {', '.join(RELATION_CARDINALITIES)}")
        problems += relation_name_problems(subject, relation, object_entity)
        entity.relations.append((subject, relation, object_entity, subject_side, object_side))
    return entity, problems


def reverse_relation_problems(entities: dict[str, EntityDefinition], only_entities: set[str] | None = None) -> list[tuple[str, str]]:
    """Return (entity, message) for each relation whose object entity does not list the `_reverse` side with swapped cardinalities.

    Only relations that touch one of `only_entities` (when given) are checked.
    """
    problems: list[tuple[str, str]] = []
    for entity_name, entity in entities.items():
        for subject, relation, object_entity, subject_side, object_side in entity.relations:
            if relation.endswith(REVERSE_SUFFIX) or object_entity not in entities:
                continue
            if only_entities is not None and entity_name not in only_entities and object_entity not in only_entities:
                continue
            reverse = next((known for known in entities[object_entity].relations if known[1] == relation + REVERSE_SUFFIX), None)
            if reverse is None:
                problems.append((object_entity, f"relation `{relation}` of `{entity_name}` needs its other side `{relation + REVERSE_SUFFIX}` listed here"))
            elif (reverse[0], reverse[2], reverse[3], reverse[4]) != (object_entity, entity_name, object_side, subject_side):
                problems.append((object_entity, f"`{reverse[1]}` must have subject `{object_entity}`, object `{entity_name}` and the cardinalities "
                                                f"{object_side} / {subject_side} (those of `{relation}`, swapped)"))
    return problems


def find_data_references(spec_text: str) -> DataReferences:
    """Find the `Data:` and `Relation:` lines of every requirement in a spec text."""
    references = DataReferences()
    requirement_name = ""
    for line in spec_text.splitlines():
        stripped = line.strip()
        if stripped.startswith(REQUIREMENT_HEADING_PREFIX):
            requirement_name = stripped[len(REQUIREMENT_HEADING_PREFIX):].strip()
        elif stripped.startswith(DATA_REFERENCE_KEYWORD):
            for item in (part.strip() for part in stripped[len(DATA_REFERENCE_KEYWORD):].split(",")):
                if FIELD_REFERENCE_PATTERN.match(item):
                    entity_name, field_name = item.split(".")
                    references.fields.append((requirement_name, entity_name, field_name))
                else:
                    references.malformed.append(f"requirement `{requirement_name}`: `{item}` is not `Entity.field`")
        elif stripped.startswith(RELATION_REFERENCE_KEYWORD):
            parts = [part.strip() for part in stripped[len(RELATION_REFERENCE_KEYWORD):].split(">")]
            if len(parts) == 3 and ENTITY_NAME_PATTERN.match(parts[0]) and parts[1] and ENTITY_NAME_PATTERN.match(parts[2]):
                references.relations.append((requirement_name, parts[0], parts[1], parts[2]))
            else:
                references.malformed.append(f"requirement `{requirement_name}`: `{stripped}` is not `Relation: Subject > relation > Object`")
    return references


def check_data_references(references: DataReferences, entities: dict[str, EntityDefinition], generated_entity_names: set[str]) -> list[str]:
    """Return the problems of the data references of a spec against the known entity definitions."""
    problems = list(references.malformed)
    for requirement_name, entity_name, field_name in references.fields:
        if entity_name in entities:
            if field_name not in entities[entity_name].field_rows:
                problems.append(f"requirement `{requirement_name}`: field `{field_name}` is not defined by entity `{entity_name}`")
        elif entity_name not in generated_entity_names:
            problems.append(f"requirement `{requirement_name}`: entity `{entity_name}` has no entity definition")
    for requirement_name, subject, relation, object_entity in references.relations:
        if subject in entities:
            if not any(known[1] == relation and known[2] == object_entity for known in entities[subject].relations):
                problems.append(f"requirement `{requirement_name}`: relation `{subject} > {relation} > {object_entity}` is not defined by entity `{subject}`")
        elif subject not in generated_entity_names:
            problems.append(f"requirement `{requirement_name}`: entity `{subject}` has no entity definition")
    return problems
