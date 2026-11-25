"""Draft help documents from the features and journeys a change touched (`veloiq docs help sync`).

The draft is a starting point written from the specification (purpose, requirements and scenarios).
The Code Assistant completes it with action buttons and screenshots, and administrators review it in the help editor.
An existing draft is kept unless `--overwrite` is given, and a draft marked `status: reviewed` is never overwritten.
"""
from __future__ import annotations

import re
from pathlib import Path

from veloiq_framework.documentation_workflow.apply_documentation_change import find_archived_change_folder, list_delta_elements
from veloiq_framework.documentation_workflow.help_document_contract import HELP_ACTION_KEYS, HELP_STATUS_DRAFT
from veloiq_framework.documentation_workflow.specification_front_matter import join_front_matter, split_front_matter
from veloiq_framework.documentation_workflow.workflow_constants import (
    ELEMENT_TYPE_FEATURES, ELEMENT_TYPE_JOURNEYS, OPENSPEC_FOLDER_NAME, SPECIFICATION_FILE_NAME, SPECIFICATIONS_FOLDER_NAME,
)

HELP_DRAFTS_FOLDER_NAME = "help-drafts"
HELP_ELEMENT_TYPES = (ELEMENT_TYPE_FEATURES, ELEMENT_TYPE_JOURNEYS)
PURPOSE_PATTERN = re.compile(r"^## Purpose\s*\n(.*?)(?=^## )", re.S | re.M)
REQUIREMENT_PATTERN = re.compile(r"^### Requirement:\s*(.+?)\n(.*?)(?=^### Requirement:|^## |\Z)", re.S | re.M)
SCENARIO_PATTERN = re.compile(r"^#### Scenario:\s*(.+?)\n(.*?)(?=^#### |^### |^## |\Z)", re.S | re.M)


def draft_help_document(element_name: str, specification_text: str, source_element: str) -> str:
    """Return the text of a help document draft built from one feature or journey specification."""
    specification_front_matter, body_text = split_front_matter(specification_text)
    purpose_match = PURPOSE_PATTERN.search(body_text)
    purpose = purpose_match.group(1).strip() if purpose_match else ""
    lines = [f"# {element_name.replace('-', ' ').capitalize()}", ""]
    if purpose:
        lines += [purpose, ""]
    for requirement in REQUIREMENT_PATTERN.finditer(body_text):
        lines += [f"## {requirement.group(1).strip()}", ""]
        statement = requirement.group(2).strip().split("\n\n")[0].strip()
        if statement and not statement.startswith("####"):
            lines += [statement, ""]
        for scenario in SCENARIO_PATTERN.finditer(requirement.group(0)):
            lines += [f"**{scenario.group(1).strip()}**", ""]
            lines += [scenario_line.strip() for scenario_line in scenario.group(2).strip().splitlines()] + [""]
    lines += ["## Actions", "",
              "<!-- One action button per line: `- <action_key>: <button label>`. Valid keys: " + ", ".join(HELP_ACTION_KEYS) + " -->", "",
              "## Screenshots", "",
              "<!-- List each screenshot as {file, route, caption} under `screenshots` in the front matter, then run "
              "`veloiq docs help screenshots`; the images appear here. -->", ""]
    front_matter = {"page_keys": [str(key) for key in (specification_front_matter.get("help-pages") or [])],
                    "source-element": source_element, "status": HELP_STATUS_DRAFT, "screenshots": []}
    return join_front_matter(front_matter, "\n".join(lines))


def sync_help_documents_for_change(project_root: Path, change_name: str, overwrite: bool = False) -> tuple[list[str], list[str]]:
    """Write a help draft for every feature and journey of an archived change.

    Returns (files written, files skipped because a draft already exists). An existing draft may hold work (actions,
    screenshots, edits), so it is only replaced when `overwrite` is true; a reviewed draft is never replaced."""
    openspec_root = project_root / OPENSPEC_FOLDER_NAME
    archived_folder = find_archived_change_folder(openspec_root, change_name)
    if archived_folder is None:
        raise RuntimeError(f"Archived change {change_name!r} was not found; apply the change first.")
    drafts_folder = openspec_root / HELP_DRAFTS_FOLDER_NAME
    drafts_folder.mkdir(parents=True, exist_ok=True)
    written: list[str] = []
    skipped: list[str] = []
    for delta in list_delta_elements(archived_folder):
        if delta.element_type not in HELP_ELEMENT_TYPES:
            continue
        main_spec_file = openspec_root / SPECIFICATIONS_FOLDER_NAME / delta.element_type / delta.element_name / SPECIFICATION_FILE_NAME
        if not main_spec_file.exists():
            continue
        draft_file = drafts_folder / f"help-{delta.element_name}.md"
        if draft_file.exists():
            existing_status = split_front_matter(draft_file.read_text(encoding="utf-8"))[0].get("status")
            if existing_status == "reviewed" or not overwrite:
                skipped.append(f"{draft_file.relative_to(project_root).as_posix()} ({'reviewed' if existing_status == 'reviewed' else 'already exists; use --overwrite'})")
                continue
        draft_file.write_text(
            draft_help_document(delta.element_name, main_spec_file.read_text(encoding="utf-8"), f"{delta.element_type}/{delta.element_name}"),
            encoding="utf-8")
        written.append(draft_file.relative_to(project_root).as_posix())
    return written, skipped
