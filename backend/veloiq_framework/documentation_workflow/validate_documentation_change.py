"""Checks on a documentation change that OpenSpec's own validator does not make."""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from veloiq_framework.documentation_workflow.data_specification_tables import (
    EntityDefinition, check_data_references, find_data_references, read_entity_definition, reverse_relation_problems,
)
from veloiq_framework.documentation_workflow.specification_front_matter import read_front_matter_of_file
from veloiq_framework.documentation_workflow.workflow_constants import (
    AUTHORED_ELEMENT_TYPES, CODE_NAMED_ELEMENT_TYPES, DELTA_HEADING_ADDED, DELTA_HEADING_MODIFIED,
    DATA_NOT_APPLICABLE_KEY, DATA_REFERENCE_KEYWORD, RELATION_REFERENCE_KEYWORD, ELEMENT_TYPE_CAPABILITIES, ELEMENT_TYPE_DATA_MODEL, ELEMENT_TYPE_ENTITY_DEFINITIONS,
    ELEMENT_TYPE_FEATURES, ENTITY_DEFINITION_FILE_NAME, SPECIFICATION_FILE_NAME,
    SPECIFICATIONS_FOLDER_NAME,
)

DESCRIPTIVE_NAME_PATTERN = re.compile(r"^[a-z][a-z0-9]*(-[a-z0-9]+)*$")
NUMBERED_NAME_PATTERN = re.compile(r"^[a-z]*-?\d+$", re.IGNORECASE)


@dataclass(frozen=True)
class DocumentationProblem:
    location: str
    message: str

    def __str__(self) -> str:
        return f"{self.location}: {self.message}"


def _element_names_by_type(specifications_root: Path) -> dict[str, set[str]]:
    names: dict[str, set[str]] = {}
    if not specifications_root.exists():
        return names
    for type_folder in specifications_root.iterdir():
        if not type_folder.is_dir():
            continue
        names[type_folder.name] = {
            element_folder.name for element_folder in type_folder.iterdir()
            if (element_folder / SPECIFICATION_FILE_NAME).exists()
        }
    return names


def _as_list(value) -> list[str]:
    if value is None:
        return []
    return [str(item) for item in value] if isinstance(value, (list, tuple)) else [str(value)]


def _find_requirement_cycle(requirements_by_element: dict[str, list[str]]) -> list[str] | None:
    visiting: list[str] = []
    finished: set[str] = set()

    def visit(element_name: str) -> list[str] | None:
        if element_name in finished:
            return None
        if element_name in visiting:
            return visiting[visiting.index(element_name):] + [element_name]
        visiting.append(element_name)
        for required_name in requirements_by_element.get(element_name, []):
            cycle = visit(required_name)
            if cycle:
                return cycle
        visiting.pop()
        finished.add(element_name)
        return None

    for element_name in requirements_by_element:
        cycle = visit(element_name)
        if cycle:
            return cycle
    return None


def _entity_definitions(specifications_root: Path, change_specifications_folder: Path) -> tuple[dict[str, EntityDefinition], list[DocumentationProblem]]:
    """Read the entity definitions of the product and of the change (the change's version wins), with the problems of the change's ones."""
    entities: dict[str, EntityDefinition] = {}
    problems: list[DocumentationProblem] = []
    for root, is_change in ((specifications_root, False), (change_specifications_folder, True)):
        type_folder = root / ELEMENT_TYPE_ENTITY_DEFINITIONS
        if not type_folder.exists():
            continue
        for entity_folder in sorted(path for path in type_folder.iterdir() if path.is_dir()):
            definition_file = entity_folder / ENTITY_DEFINITION_FILE_NAME
            location = f"specs/{ELEMENT_TYPE_ENTITY_DEFINITIONS}/{entity_folder.name}"
            if not definition_file.exists():
                if is_change and (entity_folder / SPECIFICATION_FILE_NAME).exists() and DELTA_HEADING_ADDED in (entity_folder / SPECIFICATION_FILE_NAME).read_text(encoding="utf-8"):
                    problems.append(DocumentationProblem(location, f"an entity definition needs {ENTITY_DEFINITION_FILE_NAME} with its fields and relations"))
                continue
            entity, entity_problems = read_entity_definition(entity_folder.name, definition_file.read_text(encoding="utf-8"))
            entities[entity_folder.name] = entity
            if is_change:
                problems += [DocumentationProblem(location, message) for message in entity_problems]
    for entity_name, message in reverse_relation_problems(entities, set(problems_entity_names(change_specifications_folder))):
        problems.append(DocumentationProblem(f"specs/{ELEMENT_TYPE_ENTITY_DEFINITIONS}/{entity_name}", message))
    return entities, problems


def problems_entity_names(change_specifications_folder: Path) -> list[str]:
    """Names of the entity definitions the change carries."""
    type_folder = change_specifications_folder / ELEMENT_TYPE_ENTITY_DEFINITIONS
    return sorted(path.name for path in type_folder.iterdir() if path.is_dir()) if type_folder.exists() else []


def validate_documentation_change(change_folder: Path, specifications_root: Path, require_feature_data: bool = True) -> list[DocumentationProblem]:
    """Return every problem found in a change folder; an empty list means the change passes.

    With `require_feature_data` (the project setting, default true) every feature that is added or modified must point to the shared
    data its requirements use (`Data:` and `Relation:` lines) or say why it has none with the front matter key `data-not-applicable`.
    """
    problems: list[DocumentationProblem] = []
    existing_names = _element_names_by_type(specifications_root)
    change_specifications_folder = change_folder / SPECIFICATIONS_FOLDER_NAME
    change_names = _element_names_by_type(change_specifications_folder)
    entities, entity_problems = _entity_definitions(specifications_root, change_specifications_folder)
    problems += entity_problems
    generated_entity_names = existing_names.get("data-model", set())

    all_known_names: set[str] = set()
    for names in list(existing_names.values()) + list(change_names.values()):
        all_known_names |= names

    epic_names = {epic_file.stem for epic_file in (change_folder / "epics").glob("*.md")}
    story_names = {story_file.stem for story_file in (change_folder / "stories").glob("*.md")}
    requirements_by_element: dict[str, list[str]] = {}

    for kind_folder_name, names in (("epics", epic_names), ("stories", story_names)):
        for name in sorted(names):
            if not DESCRIPTIVE_NAME_PATTERN.match(name) or NUMBERED_NAME_PATTERN.match(name):
                problems.append(DocumentationProblem(f"{kind_folder_name}/{name}.md", "name must be descriptive kebab-case, not numbered"))

    for story_name in sorted(story_names):
        story_file = change_folder / "stories" / f"{story_name}.md"
        front_matter = read_front_matter_of_file(story_file)
        epic_name = front_matter.get("epic")
        if not epic_name:
            problems.append(DocumentationProblem(f"stories/{story_name}.md", "front matter key `epic` is missing"))
        elif epic_name not in epic_names:
            problems.append(DocumentationProblem(f"stories/{story_name}.md", f"epic `{epic_name}` is not an epic of this change"))
        requirements_by_element[story_name] = _as_list(front_matter.get("requires"))
    for epic_name in sorted(epic_names):
        front_matter = read_front_matter_of_file(change_folder / "epics" / f"{epic_name}.md")
        requirements_by_element[epic_name] = _as_list(front_matter.get("requires"))

    seen_in_change: dict[str, str] = {}
    for element_type, names in sorted(change_names.items()):
        if element_type == ELEMENT_TYPE_DATA_MODEL:
            problems.append(DocumentationProblem(f"specs/{element_type}", "the data model is generated from the code; remove this delta"))
            continue
        if element_type not in AUTHORED_ELEMENT_TYPES:
            problems.append(DocumentationProblem(f"specs/{element_type}", "unknown element type"))
            continue
        for name in sorted(names):
            location = f"specs/{element_type}/{name}"
            if element_type not in CODE_NAMED_ELEMENT_TYPES:
                if not DESCRIPTIVE_NAME_PATTERN.match(name) or NUMBERED_NAME_PATTERN.match(name):
                    problems.append(DocumentationProblem(location, "name must be descriptive kebab-case, not numbered"))
            if name in seen_in_change and seen_in_change[name] != element_type:
                problems.append(DocumentationProblem(location, f"name is also used by an element of type {seen_in_change[name]}"))
            seen_in_change[name] = element_type
            for other_type, other_names in existing_names.items():
                if other_type != element_type and name in other_names:
                    problems.append(DocumentationProblem(location, f"name is already used by {other_type}/{name}"))

            spec_file = change_specifications_folder / element_type / name / SPECIFICATION_FILE_NAME
            front_matter = read_front_matter_of_file(spec_file)
            spec_text = spec_file.read_text(encoding="utf-8")
            adds_or_modifies = DELTA_HEADING_ADDED in spec_text or DELTA_HEADING_MODIFIED in spec_text

            if adds_or_modifies:
                existing_spec_file = specifications_root / element_type / name / SPECIFICATION_FILE_NAME
                existing_text = existing_spec_file.read_text(encoding="utf-8") if existing_spec_file.exists() else ""
                references = find_data_references(spec_text)
                problems += [DocumentationProblem(location, message) for message in check_data_references(references, entities, generated_entity_names)]
                if element_type == ELEMENT_TYPE_CAPABILITIES and not references.is_empty():
                    problems.append(DocumentationProblem(
                        location, f"a capability does not point to data: remove its `{DATA_REFERENCE_KEYWORD}` and `{RELATION_REFERENCE_KEYWORD}` "
                                  "lines; its features do"))
                if element_type == ELEMENT_TYPE_FEATURES:
                    existing_front_matter = read_front_matter_of_file(existing_spec_file) if existing_spec_file.exists() else {}
                    capability_name = front_matter.get("capability") or existing_front_matter.get("capability")
                    if not capability_name:
                        problems.append(DocumentationProblem(location, "a feature needs the front matter key `capability`"))
                    elif capability_name not in change_names.get(ELEMENT_TYPE_CAPABILITIES, set()) | existing_names.get(ELEMENT_TYPE_CAPABILITIES, set()):
                        problems.append(DocumentationProblem(location, f"capability `{capability_name}` does not exist"))
                    has_reason = str(front_matter.get(DATA_NOT_APPLICABLE_KEY) or existing_front_matter.get(DATA_NOT_APPLICABLE_KEY) or "").strip()
                    if require_feature_data and not has_reason and references.is_empty() and find_data_references(existing_text).is_empty():
                        problems.append(DocumentationProblem(
                            location, f"a feature needs to point to its data: a `{DATA_REFERENCE_KEYWORD}` or `{RELATION_REFERENCE_KEYWORD}` line in the "
                                      f"requirements that use data, or the front matter key `{DATA_NOT_APPLICABLE_KEY}` with the reason"))
            for story_name in _as_list(front_matter.get("stories")):
                if story_name not in story_names:
                    problems.append(DocumentationProblem(location, f"story `{story_name}` is not a story of this change"))
            requirements_by_element[name] = _as_list(front_matter.get("requires"))

    for element_name, required_names in requirements_by_element.items():
        for required_name in required_names:
            if required_name not in all_known_names and required_name not in epic_names | story_names:
                problems.append(DocumentationProblem(element_name, f"required element `{required_name}` does not exist"))
    cycle = _find_requirement_cycle(requirements_by_element)
    if cycle:
        problems.append(DocumentationProblem(cycle[0], "circular requirement: " + " -> ".join(cycle)))
    return problems
