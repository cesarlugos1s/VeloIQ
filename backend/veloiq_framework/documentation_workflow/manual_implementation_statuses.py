"""Manual implementation statuses of specification requirements (``openspec/implementation-status-overrides.yaml``).

The implementation status of a requirement is normally found from the ``# spec:`` marker above the code that implements it, and a marker is only
looked for in the application the specification belongs to. A requirement implemented in another application, or whose status has to be set by hand
for any other reason, is listed in this file instead:

    features/add-event-id-timestamp-and-origin-to-webhook-events:
      Event identity:
        status: implemented
        where: Advanced Development
        since: unreleased
      "*":                      # every requirement of the element
        status: planned

``status`` is ``implemented`` or ``planned`` (a requirement is built or it is not; an element with some of each is partial). ``where`` says where
the code is and ``since`` the product version that has it (``unreleased`` when omitted). An entry for a requirement wins over the markers; with no
entry the markers decide. ``"*"`` covers the requirements that have no entry of their own.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

import yaml

from veloiq_framework.documentation_workflow.workflow_constants import OPENSPEC_FOLDER_NAME, UNRELEASED_VERSION_LABEL

MANUAL_STATUS_FILE_NAME = "implementation-status-overrides.yaml"
ALL_REQUIREMENTS_KEY = "*"
MANUAL_STATUS_IMPLEMENTED = "implemented"
MANUAL_STATUS_PLANNED = "planned"
MANUAL_STATUSES = (MANUAL_STATUS_IMPLEMENTED, MANUAL_STATUS_PLANNED)


@dataclass(frozen=True)
class ManualStatus:
    """The status someone set by hand for one requirement."""
    status: str
    where: str = ""
    since: str = UNRELEASED_VERSION_LABEL


@dataclass
class ManualStatuses:
    """The manual statuses of a project: element key -> requirement name (or ``"*"``) -> status, and the problems found while reading the file."""
    by_element: dict[str, dict[str, ManualStatus]] = field(default_factory=dict)
    problems: list[str] = field(default_factory=list)

    def for_requirement(self, element_key: str, requirement_name: str) -> ManualStatus | None:
        """The manual status of a requirement: its own entry, else the element's ``"*"`` entry, else None."""
        entries = self.by_element.get(element_key, {})
        return entries.get(requirement_name) or entries.get(ALL_REQUIREMENTS_KEY)


def manual_status_file_of(project_root: Path) -> Path:
    return project_root / OPENSPEC_FOLDER_NAME / MANUAL_STATUS_FILE_NAME


def read_manual_statuses(project_root: Path) -> ManualStatuses:
    """Read the manual statuses; a missing file means there are none. A malformed entry is recorded as a problem and left out."""
    manual = ManualStatuses()
    status_file = manual_status_file_of(project_root)
    if not status_file.exists():
        return manual
    try:
        content = yaml.safe_load(status_file.read_text(encoding="utf-8")) or {}
    except yaml.YAMLError as invalid:
        manual.problems.append(f"{MANUAL_STATUS_FILE_NAME} is not valid YAML: {invalid}")
        return manual
    if not isinstance(content, dict):
        manual.problems.append(f"{MANUAL_STATUS_FILE_NAME} must map element names to their requirements")
        return manual
    for element_key, requirements in content.items():
        if not isinstance(requirements, dict):
            manual.problems.append(f"{MANUAL_STATUS_FILE_NAME}: `{element_key}` must map requirement names to a status")
            continue
        for requirement_name, entry in requirements.items():
            if not isinstance(entry, dict) or entry.get("status") not in MANUAL_STATUSES:
                manual.problems.append(f"{MANUAL_STATUS_FILE_NAME}: `{element_key}` / `{requirement_name}` needs a status of {' or '.join(MANUAL_STATUSES)}")
                continue
            manual.by_element.setdefault(str(element_key), {})[str(requirement_name)] = ManualStatus(
                entry["status"], str(entry.get("where") or ""), str(entry.get("since") or UNRELEASED_VERSION_LABEL))
    return manual
