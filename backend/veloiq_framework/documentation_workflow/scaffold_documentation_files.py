"""Create the files of a change pre-filled, so the developer only writes the content (`veloiq docs ... new`).

Each file starts with the front matter the standard requires: name, type, change, dates and links already filled in.
The body comes from the project's own template (openspec/schemas/veloiq-docs/templates/) or, when the project has none,
from the template that ships with the framework.
"""
from __future__ import annotations

from datetime import date
from pathlib import Path

from veloiq_framework.documentation_workflow.specification_front_matter import join_front_matter, split_front_matter
from veloiq_framework.documentation_workflow.validate_documentation_change import DESCRIPTIVE_NAME_PATTERN, NUMBERED_NAME_PATTERN
from veloiq_framework.documentation_workflow.workflow_constants import (
    ARCHIVE_FOLDER_NAME, AUTHORED_ELEMENT_TYPES, CODE_NAMED_ELEMENT_TYPES, CHANGES_FOLDER_NAME, CUSTOM_SCHEMA_NAME,
    DATA_NOT_APPLICABLE_KEY, ELEMENT_TYPE_ENTITY_DEFINITIONS, ELEMENT_TYPE_FEATURES, ENTITY_DEFINITION_FILE_NAME,
    OPENSPEC_FOLDER_NAME, SPECIFICATION_FILE_NAME, SPECIFICATIONS_FOLDER_NAME,
)

PACKAGED_TEMPLATES_FOLDER = Path(__file__).parent / "schema_template" / "templates"
NEW_CAPABILITIES_HEADING = "### New Capabilities"
MODIFIED_CAPABILITIES_HEADING = "### Modified Capabilities"


class ScaffoldError(ValueError):
    """Raised with a message that tells the developer what to correct."""


def _change_folder(project_root: Path, change_name: str) -> Path:
    change_folder = project_root / OPENSPEC_FOLDER_NAME / CHANGES_FOLDER_NAME / change_name
    if change_name == ARCHIVE_FOLDER_NAME or not change_folder.is_dir():
        raise ScaffoldError(f"Change {change_name!r} does not exist. Create it first with `veloiq docs change new {change_name}`.")
    return change_folder


def _checked_name(name: str, what: str, code_named: bool = False) -> str:
    if code_named:
        return name
    if not DESCRIPTIVE_NAME_PATTERN.match(name) or NUMBERED_NAME_PATTERN.match(name):
        raise ScaffoldError(f"{what} name {name!r} must be descriptive kebab-case (for example add-workload-balancing), never numbered.")
    return name


def _template_body(project_root: Path, template_file_name: str) -> str:
    project_template = project_root / OPENSPEC_FOLDER_NAME / "schemas" / CUSTOM_SCHEMA_NAME / "templates" / template_file_name
    template = project_template if project_template.exists() else PACKAGED_TEMPLATES_FOLDER / template_file_name
    return split_front_matter(template.read_text(encoding="utf-8"))[1]


def _write_new_file(path: Path, text: str) -> str:
    if path.exists():
        raise ScaffoldError(f"{path.name} already exists in {path.parent}; edit it instead.")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return path.as_posix()


def create_epic(project_root: Path, change_name: str, epic_name: str, today: date | None = None) -> str:
    """Create epics/<epic-name>.md with the front matter filled in; return the file path."""
    change_folder = _change_folder(project_root, change_name)
    _checked_name(epic_name, "Epic")
    front_matter = {"name": epic_name, "type": "epic", "change": change_name, "created": (today or date.today()).isoformat()}
    return _write_new_file(change_folder / "epics" / f"{epic_name}.md",
                           join_front_matter(front_matter, _template_body(project_root, "epic.md")))


def create_story(project_root: Path, change_name: str, story_name: str, epic_name: str, today: date | None = None) -> str:
    """Create stories/<story-name>.md linked to an epic of the change, and list the story in the epic; return the file path."""
    change_folder = _change_folder(project_root, change_name)
    _checked_name(story_name, "Story")
    epic_file = change_folder / "epics" / f"{epic_name}.md"
    if not epic_file.exists():
        existing = sorted(path.stem for path in (change_folder / "epics").glob("*.md"))
        raise ScaffoldError(f"Epic {epic_name!r} is not an epic of change {change_name!r}"
                            + (f" (epics: {', '.join(existing)})." if existing else f". Create it first with `veloiq docs epic new {epic_name} --change {change_name}`."))
    # `design` lists the technical design files of the change this story is built from (a story may use several).
    # The high-level design always exists, so it is listed from the start; add `low-level-design/<file>` entries as they are written.
    front_matter = {"name": story_name, "type": "story", "epic": epic_name, "change": change_name,
                    "created": (today or date.today()).isoformat(), "design": ["high-level-design"]}
    created = _write_new_file(change_folder / "stories" / f"{story_name}.md",
                              join_front_matter(front_matter, _template_body(project_root, "story.md")))
    _list_story_in_epic(epic_file, story_name)
    return created


def _list_story_in_epic(epic_file: Path, story_name: str) -> None:
    text = epic_file.read_text(encoding="utf-8")
    heading = "## User stories\n"
    start = text.find(heading)
    if start == -1 or f"- {story_name}\n" in text:
        return
    after = start + len(heading)
    following = text.find("\n## ", after)
    end = following if following != -1 else len(text)
    section_lines = [line for line in text[after:end].split("\n")]
    items = [line for line in section_lines if line.strip() not in ("", "-")]
    new_section = "\n" + "\n".join(items + [f"- {story_name}"]) + "\n"
    epic_file.write_text(text[:after] + new_section + text[end:], encoding="utf-8")


def _element_exists(project_root: Path, change_folder: Path, element_name: str) -> str | None:
    for root in (project_root / OPENSPEC_FOLDER_NAME / SPECIFICATIONS_FOLDER_NAME, change_folder / SPECIFICATIONS_FOLDER_NAME):
        if root.exists():
            for type_folder in root.iterdir():
                if (type_folder / element_name / SPECIFICATION_FILE_NAME).exists():
                    return type_folder.name
    return None


def create_element_delta(project_root: Path, change_name: str, element_type: str, element_name: str,
                         story_names: list[str] | None = None, capability_name: str | None = None,
                         data_not_applicable_reason: str | None = None) -> str:
    """Create specs/<type>/<name>/spec.md in the change with its front matter filled in; return the file path.

    An entity definition also gets `definition.md` (its fields and relations; an existing one is copied as the start). A feature whose
    requirements use no data is given the front matter key `data-not-applicable` when a reason is passed.
    """
    change_folder = _change_folder(project_root, change_name)
    if element_type not in AUTHORED_ELEMENT_TYPES:
        raise ScaffoldError(f"Element type {element_type!r} is not one of: {', '.join(AUTHORED_ELEMENT_TYPES)} "
                            "(the data model is generated from the code).")
    _checked_name(element_name, "Element", code_named=element_type in CODE_NAMED_ELEMENT_TYPES)
    existing_type = _element_exists(project_root, change_folder, element_name)
    is_modification = existing_type == element_type
    if existing_type and not is_modification:
        raise ScaffoldError(f"The name {element_name!r} is already used by an element of type {existing_type}.")
    story_names = story_names or []
    for story_name in story_names:
        if not (change_folder / "stories" / f"{story_name}.md").exists():
            raise ScaffoldError(f"Story {story_name!r} is not a story of change {change_name!r}.")
    front_matter: dict = {"name": element_name, "type": element_type}
    if element_type == ELEMENT_TYPE_FEATURES:
        known_capability = capability_name and _element_exists(project_root, change_folder, capability_name) == "capabilities"
        if not is_modification and not known_capability:
            raise ScaffoldError("A new feature needs --capability with the name of an existing capability "
                                "(or one created in this change with `veloiq docs element new capabilities <name>`).")
        if capability_name:
            front_matter["capability"] = capability_name
    if story_names:
        front_matter["stories"] = story_names
    if data_not_applicable_reason and element_type != ELEMENT_TYPE_FEATURES:
        raise ScaffoldError("`--data-not-applicable` is only for features.")
    if data_not_applicable_reason:
        front_matter[DATA_NOT_APPLICABLE_KEY] = data_not_applicable_reason
    body = _template_body(project_root, "entity-definition-spec.md" if element_type == ELEMENT_TYPE_ENTITY_DEFINITIONS else "spec.md")
    if element_type == ELEMENT_TYPE_ENTITY_DEFINITIONS:
        body = body.replace("<EntityName>", element_name)
    if is_modification:
        body = body.replace("## ADDED Requirements", "## MODIFIED Requirements", 1)
    created = _write_new_file(change_folder / SPECIFICATIONS_FOLDER_NAME / element_type / element_name / SPECIFICATION_FILE_NAME,
                              join_front_matter(front_matter, body))
    if element_type == ELEMENT_TYPE_ENTITY_DEFINITIONS:
        existing_definition = project_root / OPENSPEC_FOLDER_NAME / SPECIFICATIONS_FOLDER_NAME / element_type / element_name / ENTITY_DEFINITION_FILE_NAME
        definition_text = existing_definition.read_text(encoding="utf-8") if existing_definition.exists() \
            else _template_body(project_root, ENTITY_DEFINITION_FILE_NAME)
        (change_folder / SPECIFICATIONS_FOLDER_NAME / element_type / element_name / ENTITY_DEFINITION_FILE_NAME).write_text(definition_text, encoding="utf-8")
    _list_element_in_proposal(change_folder / "proposal.md", element_type, element_name, is_modification)
    return created


def _list_element_in_proposal(proposal_file: Path, element_type: str, element_name: str, is_modification: bool) -> None:
    """Add `- type/name` under the proposal's New or Modified Capabilities, replacing the template's placeholder line."""
    if not proposal_file.exists():
        return
    text = proposal_file.read_text(encoding="utf-8")
    entry = f"- `{element_type}/{element_name}`: "
    if f"`{element_type}/{element_name}`" in text:
        return
    heading = MODIFIED_CAPABILITIES_HEADING if is_modification else NEW_CAPABILITIES_HEADING
    start = text.find(heading + "\n")
    if start == -1:
        return
    after = start + len(heading) + 1
    following = text.find("\n##", after)
    end = following if following != -1 else len(text)
    kept = [line for line in text[after:end].split("\n") if line.strip() and "<element-type>" not in line]
    proposal_file.write_text(text[:after] + "\n" + "\n".join(kept + [entry]) + "\n" + text[end:], encoding="utf-8")


def prefill_new_change_files(project_root: Path, change_name: str) -> list[str]:
    """Create proposal.md, design/high-level-design.md and tasks.md in a new change from the templates; return their paths."""
    change_folder = _change_folder(project_root, change_name)
    created: list[str] = []
    for relative_path, template_name in (("proposal.md", "proposal.md"), ("design/high-level-design.md", "design.md"), ("tasks.md", "tasks.md")):
        target = change_folder / relative_path
        if not target.exists():
            created.append(_write_new_file(target, _template_body(project_root, template_name)))
    return created
