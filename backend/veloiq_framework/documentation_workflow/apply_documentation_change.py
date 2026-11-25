"""Apply an approved change to the Product Specification (`veloiq docs change apply`).

OpenSpec does the merge and the archive. This module does what OpenSpec does not:
it prepares removed elements before the archive, and after the archive it stamps each new or changed
element with its front matter, copies extra files into the element folder and writes the changelog.
"""
from __future__ import annotations

import shutil
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

import yaml

from veloiq_framework.documentation_workflow.run_openspec_command import run_openspec_command
from veloiq_framework.documentation_workflow.specification_front_matter import (
    join_front_matter, read_front_matter_of_file, split_front_matter,
)
from veloiq_framework.documentation_workflow.validate_documentation_change import validate_documentation_change
from veloiq_framework.documentation_workflow.workflow_constants import (
    ARCHIVE_FOLDER_NAME, CHANGELOG_FILE_NAME, CHANGES_FOLDER_NAME, DELTA_HEADING_ADDED, ELEMENT_TYPE_SINGULAR_LABELS, DELTA_HEADING_MODIFIED,
    DELTA_HEADING_REMOVED, DELTA_HEADING_RENAMED, OPENSPEC_FOLDER_NAME, SPECIFICATION_FILE_NAME,
    SPECIFICATIONS_FOLDER_NAME, UNRELEASED_VERSION_LABEL,
)

#: Front matter keys of a delta that the stamping step handles itself instead of passing them through.
HANDLED_DELTA_KEYS = {"name", "type", "stories", "epics", "requires", "prerequisites"}


@dataclass
class DeltaElement:
    element_type: str
    element_name: str
    folder: Path
    front_matter: dict[str, Any]
    adds_or_modifies: bool
    removes: bool


@dataclass
class StampResult:
    added: list[str] = field(default_factory=list)
    modified: list[str] = field(default_factory=list)
    removed: list[str] = field(default_factory=list)


def list_delta_elements(change_folder: Path) -> list[DeltaElement]:
    """Return the specification elements a change folder (live or archived) carries deltas for."""
    elements: list[DeltaElement] = []
    specifications_folder = change_folder / SPECIFICATIONS_FOLDER_NAME
    if not specifications_folder.exists():
        return elements
    for type_folder in sorted(path for path in specifications_folder.iterdir() if path.is_dir()):
        for element_folder in sorted(path for path in type_folder.iterdir() if path.is_dir()):
            spec_file = element_folder / SPECIFICATION_FILE_NAME
            if not spec_file.exists():
                continue
            text = spec_file.read_text(encoding="utf-8")
            front_matter, _ = split_front_matter(text)
            elements.append(DeltaElement(
                type_folder.name, element_folder.name, element_folder, front_matter,
                adds_or_modifies=any(heading in text for heading in (DELTA_HEADING_ADDED, DELTA_HEADING_MODIFIED, DELTA_HEADING_RENAMED)),
                removes=DELTA_HEADING_REMOVED in text,
            ))
    return elements


def prepare_change_for_archive(change_folder: Path, specifications_root: Path) -> list[str]:
    """Strip the front matter of elements the change removes, which OpenSpec otherwise refuses to retire."""
    messages: list[str] = []
    removed_elements = [element for element in list_delta_elements(change_folder) if element.removes and not element.adds_or_modifies]
    for element in removed_elements:
        main_spec_file = specifications_root / element.element_type / element.element_name / SPECIFICATION_FILE_NAME
        if main_spec_file.exists():
            _, body_text = split_front_matter(main_spec_file.read_text(encoding="utf-8"))
            main_spec_file.write_text(body_text, encoding="utf-8")
            messages.append(f"front matter removed from {element.element_type}/{element.element_name}")
    if removed_elements:
        metadata_file = change_folder / ".openspec.yaml"
        metadata = yaml.safe_load(metadata_file.read_text(encoding="utf-8")) if metadata_file.exists() else {}
        metadata = metadata or {}
        if not metadata.get("retire_capabilities"):
            metadata["retire_capabilities"] = True
            metadata_file.write_text(yaml.safe_dump(metadata, sort_keys=False), encoding="utf-8")
            messages.append("retire_capabilities: true set in .openspec.yaml")
    return messages


def find_archived_change_folder(openspec_root: Path, change_name: str) -> Path | None:
    archive_folder = openspec_root / CHANGES_FOLDER_NAME / ARCHIVE_FOLDER_NAME
    candidates = sorted(archive_folder.glob(f"*-{change_name}")) if archive_folder.exists() else []
    return candidates[-1] if candidates else None


def _as_list(value) -> list:
    if value is None:
        return []
    return list(value) if isinstance(value, (list, tuple)) else [value]


def _prerequisites_of_epic_or_story(front_matter: dict[str, Any], origin_label: str) -> tuple[list[str], list[dict[str, str]]]:
    required_names = [str(name) for name in _as_list(front_matter.get("requires"))]
    statements = [{"text": str(text), "inherited-from": origin_label} for text in _as_list(front_matter.get("prerequisites"))]
    return required_names, statements


def resolve_prerequisites(change_folder: Path, delta: DeltaElement) -> tuple[list[str], list[dict[str, str]]]:
    """Return (required element names, prerequisite statements) for an element of a change.

    A list stated in the delta wins. Otherwise the element gets the combined prerequisites of the stories that
    change it, and each story starts with its epic's prerequisites minus the ones it marks as not applicable.
    """
    if delta.front_matter.get("requires") or delta.front_matter.get("prerequisites"):
        return _prerequisites_of_epic_or_story(delta.front_matter, f"delta {delta.element_name}")
    required_names: list[str] = []
    statements: list[dict[str, str]] = []
    for story_name in _as_list(delta.front_matter.get("stories")):
        story_file = change_folder / "stories" / f"{story_name}.md"
        if not story_file.exists():
            continue
        story_front_matter = read_front_matter_of_file(story_file)
        not_applicable = {str(entry.get("item")) for entry in _as_list(story_front_matter.get("not-applicable")) if isinstance(entry, dict)}
        inherited_names: list[str] = []
        inherited_statements: list[dict[str, str]] = []
        epic_name = story_front_matter.get("epic")
        epic_file = change_folder / "epics" / f"{epic_name}.md"
        if epic_name and epic_file.exists():
            inherited_names, inherited_statements = _prerequisites_of_epic_or_story(read_front_matter_of_file(epic_file), f"epic {epic_name}")
        own_names, own_statements = _prerequisites_of_epic_or_story(story_front_matter, f"story {story_name}")
        for name in inherited_names + own_names:
            if name not in not_applicable and name not in required_names:
                required_names.append(name)
        for statement in inherited_statements + own_statements:
            if statement["text"] not in not_applicable and statement not in statements:
                statements.append(statement)
    return required_names, statements


BOOKKEEPING_KEYS = ("created", "created-in-version", "last-changed", "last-changed-in-version", "origin", "requires", "prerequisites", "implemented-by")


def _in_reading_order(front_matter: dict[str, Any]) -> dict[str, Any]:
    """Descriptive keys first (name, type, capability, ...), then dates and origin, prerequisites and code references."""
    descriptive = {key: value for key, value in front_matter.items() if key not in BOOKKEEPING_KEYS}
    bookkeeping = {key: front_matter[key] for key in BOOKKEEPING_KEYS if key in front_matter}
    return {**descriptive, **bookkeeping}


def _union(existing: list, new_values: list) -> list:
    merged = list(existing)
    for value in new_values:
        if value not in merged:
            merged.append(value)
    return merged


def stamp_specification_metadata(archived_folder: Path, specifications_root: Path, change_name: str,
                                 product_version: str, today: date) -> StampResult:
    """After OpenSpec's archive: write front matter on new and changed elements and copy extra files."""
    result = StampResult()
    for delta in list_delta_elements(archived_folder):
        element_label = f"{delta.element_type}/{delta.element_name}"
        main_folder = specifications_root / delta.element_type / delta.element_name
        main_spec_file = main_folder / SPECIFICATION_FILE_NAME
        if not main_spec_file.exists():
            if delta.removes:
                result.removed.append(element_label)
                if main_folder.exists():
                    shutil.rmtree(main_folder)  # only extra files (such as rule.json) are left once OpenSpec retires the spec
            continue
        main_front_matter, body_text = split_front_matter(main_spec_file.read_text(encoding="utf-8"))
        is_new = "created" not in main_front_matter

        origin = main_front_matter.get("origin") or {}
        story_names = [str(name) for name in _as_list(delta.front_matter.get("stories"))]
        epic_names = [str(name) for name in _as_list(delta.front_matter.get("epics"))]
        for story_name in story_names:
            story_file = archived_folder / "stories" / f"{story_name}.md"
            if story_file.exists():
                epic_of_story = read_front_matter_of_file(story_file).get("epic")
                if epic_of_story and epic_of_story not in epic_names:
                    epic_names.append(str(epic_of_story))
        required_names, statements = resolve_prerequisites(archived_folder, delta)

        stamped: dict[str, Any] = {"name": delta.element_name, "type": ELEMENT_TYPE_SINGULAR_LABELS.get(delta.element_type, delta.element_type)}
        for key, value in delta.front_matter.items():
            if key not in HANDLED_DELTA_KEYS:
                stamped[key] = value
        stamped["created"] = main_front_matter.get("created", today.isoformat())
        stamped["created-in-version"] = main_front_matter.get("created-in-version", product_version)
        stamped["last-changed"] = today.isoformat()
        stamped["last-changed-in-version"] = product_version
        stamped["origin"] = {
            "changes": _union(_as_list(origin.get("changes")), [change_name]),
            "epics": _union(_as_list(origin.get("epics")), epic_names),
            "stories": _union(_as_list(origin.get("stories")), story_names),
        }
        stamped["requires"] = required_names if (required_names or statements) else _as_list(main_front_matter.get("requires"))
        stamped["prerequisites"] = statements if (required_names or statements) else _as_list(main_front_matter.get("prerequisites"))
        for key, value in main_front_matter.items():
            stamped.setdefault(key, value)
        for empty_key in [key for key in ("requires", "prerequisites") if not stamped.get(key)]:
            stamped.pop(empty_key)

        main_spec_file.write_text(join_front_matter(_in_reading_order(stamped), body_text), encoding="utf-8")
        for extra_file in sorted(delta.folder.iterdir()):
            if extra_file.is_file() and extra_file.name != SPECIFICATION_FILE_NAME:
                shutil.copy2(extra_file, main_folder / extra_file.name)
        (result.added if is_new else result.modified).append(element_label)
    return result


def append_changelog_entry(openspec_root: Path, change_name: str, product_version: str, today: date, result: StampResult) -> None:
    """Add the change under its product version heading in openspec/CHANGELOG.md (newest version first)."""
    changelog_file = openspec_root / CHANGELOG_FILE_NAME
    text = changelog_file.read_text(encoding="utf-8") if changelog_file.exists() else "# Changelog\n"
    parts = [f"{label} {', '.join(names)}" for label, names in (("added", result.added), ("modified", result.modified), ("removed", result.removed)) if names]
    entry = f"- {change_name} ({today.isoformat()}): " + ("; ".join(parts) if parts else "no element changes")
    heading = f"## {product_version}"
    lines = text.rstrip("\n").split("\n")
    if heading in lines:
        insert_at = lines.index(heading) + 2
        lines.insert(insert_at, entry)
    else:
        lines[1:1] = ["", heading, "", entry]
    changelog_file.write_text("\n".join(lines).rstrip("\n") + "\n", encoding="utf-8")


def apply_documentation_change(project_root: Path, change_name: str, product_version: str = UNRELEASED_VERSION_LABEL,
                               today: date | None = None) -> StampResult:
    """Validate, prepare, archive with OpenSpec, then stamp. Raises RuntimeError on any failure."""
    today = today or date.today()
    openspec_root = project_root / OPENSPEC_FOLDER_NAME
    specifications_root = openspec_root / SPECIFICATIONS_FOLDER_NAME
    change_folder = openspec_root / CHANGES_FOLDER_NAME / change_name
    if not change_folder.exists():
        raise RuntimeError(f"Change {change_name!r} does not exist at {change_folder}")

    problems = validate_documentation_change(change_folder, specifications_root)
    if problems:
        raise RuntimeError("The change has problems:\n" + "\n".join(f"  - {problem}" for problem in problems))
    validation = run_openspec_command(project_root, ["validate", change_name])
    if validation.exit_code != 0:
        raise RuntimeError(f"openspec validate failed:\n{validation.combined_output}")

    prepare_change_for_archive(change_folder, specifications_root)
    archive = run_openspec_command(project_root, ["archive", change_name, "--yes"])
    if archive.exit_code != 0:
        raise RuntimeError(f"openspec archive failed:\n{archive.combined_output}")

    archived_folder = find_archived_change_folder(openspec_root, change_name)
    if archived_folder is None:
        raise RuntimeError("The archived change folder was not found after the archive.")
    result = stamp_specification_metadata(archived_folder, specifications_root, change_name, product_version, today)
    append_changelog_entry(openspec_root, change_name, product_version, today, result)
    return result
