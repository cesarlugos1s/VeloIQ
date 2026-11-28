"""Find the code that implements each specification element (`veloiq docs spec index-code`).

A marker comment above a function, class or component names the element it implements:
    # spec: bulk-reassign-tasks        (Python)
    // spec: features/bulk-reassign-tasks   (TypeScript; the element type may be given to disambiguate)
    # spec: bulk-reassign-tasks :: Reassign selected tasks   (one requirement of the element)
The scan writes `implemented-by` and the implementation status into the element's front matter, and builds reverse
views by module, by epic and by implementation status.

The implementation status is computed, never typed: no marker means `planned`; markers for some requirements mean
`partial`; markers for every requirement mean `implemented`, in the version of the oldest git tag that contains the
commit that added the last of those markers. A marker without a requirement covers every requirement of its element.

A requirement implemented in another application, or one whose status has to be set by hand, is listed in
`openspec/implementation-status-overrides.yaml` (see manual_implementation_statuses.py); that entry wins over the markers.
"""
from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

from veloiq_framework.documentation_workflow.manual_implementation_statuses import (
    ALL_REQUIREMENTS_KEY, MANUAL_STATUS_FILE_NAME, MANUAL_STATUS_IMPLEMENTED, ManualStatuses, read_manual_statuses,
)
from veloiq_framework.documentation_workflow.release_version_of_code_markers import (
    earliest_release_version, latest_release_version, release_tags_oldest_first, release_version_of_marker,
)
from veloiq_framework.documentation_workflow.specification_front_matter import (
    join_front_matter, split_front_matter,
)
from veloiq_framework.documentation_workflow.workflow_constants import (
    ALL_ELEMENT_TYPES, CODE_MARKER_KEYWORD, ELEMENT_TYPE_CAPABILITIES, ELEMENT_TYPE_DATA_MODEL, OPENSPEC_FOLDER_NAME,
    SPECIFICATION_FILE_NAME, SPECIFICATIONS_FOLDER_NAME, UNRELEASED_VERSION_LABEL,
)

REVERSE_VIEWS_FOLDER_NAME = "reverse-views"
MARKER_PATTERN = re.compile(r"^\s*(?:#|//)\s*" + re.escape(CODE_MARKER_KEYWORD) + r"\s*([A-Za-z0-9_./-]+)(?:\s*::\s*(.+?))?\s*$")
REQUIREMENT_HEADING_PATTERN = re.compile(r"^### Requirement:\s*(.+?)\s*$", re.MULTILINE)

IMPLEMENTATION_STATUS_PLANNED = "planned"
IMPLEMENTATION_STATUS_PARTIAL = "partial"
IMPLEMENTATION_STATUS_IMPLEMENTED = "implemented"
#: Front matter keys written by the scan from the code and git; nobody edits them.
IMPLEMENTATION_STATUS_KEYS = ("implementation-status", "requirements-implemented", "requirements-total",
                              "features-implemented", "features-total", "implemented-in-version", "requirements-marked-by-hand", "marked-by-hand-in")
PYTHON_DEFINITION_PATTERN = re.compile(r"^\s*(?:async\s+)?(def|class)\s+([A-Za-z_][A-Za-z0-9_]*)")
TYPESCRIPT_DEFINITION_PATTERN = re.compile(
    r"^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:function|class|const|let)\s+([A-Za-z_$][A-Za-z0-9_$]*)")
SCANNED_FOLDERS = (("backend", "app"), ("frontend", "src", "pages"))
SCANNED_SUFFIXES = {".py", ".ts", ".tsx"}
SKIPPED_NAMES = {"node_modules", "__pycache__", ".venv"}


@dataclass
class CodeReference:
    marker_name: str
    kind: str          # "functions", "classes" or "components"
    reference_text: str  # path::name relative to the project root
    requirement_name: str | None = None  # the requirement the marker covers; None covers every requirement of the element
    source_path: str = ""  # path relative to the project root
    marker_text: str = ""  # the marker line as written in the code


@dataclass
class IndexResult:
    references_by_element: dict[str, list[CodeReference]] = field(default_factory=dict)
    unresolved_markers: list[str] = field(default_factory=list)
    ambiguous_markers: list[str] = field(default_factory=list)
    manual_status_problems: list[str] = field(default_factory=list)


def _iter_source_files(project_root: Path):
    for folder_parts in SCANNED_FOLDERS:
        folder = project_root.joinpath(*folder_parts)
        if not folder.exists():
            continue
        for source_file in sorted(folder.rglob("*")):
            if source_file.suffix in SCANNED_SUFFIXES and not (SKIPPED_NAMES & set(source_file.parts)) \
                    and not source_file.name.endswith(".gen.ts"):
                yield source_file


def _scan_file(project_root: Path, source_file: Path) -> list[CodeReference]:
    references: list[CodeReference] = []
    lines = source_file.read_text(encoding="utf-8", errors="replace").splitlines()
    relative_path = source_file.relative_to(project_root).as_posix()
    for line_number, line in enumerate(lines):
        marker = MARKER_PATTERN.match(line)
        if not marker:
            continue
        for following_line in lines[line_number + 1:line_number + 8]:
            stripped = following_line.strip()
            if not stripped or stripped.startswith(("@", "#", "//", "/*", "*")):
                continue
            if source_file.suffix == ".py":
                definition = PYTHON_DEFINITION_PATTERN.match(following_line)
                if definition:
                    kind = "classes" if definition.group(1) == "class" else "functions"
                    references.append(CodeReference(marker.group(1), kind, f"{relative_path}::{definition.group(2)}",
                                                    marker.group(2), relative_path, line.strip()))
            else:
                definition = TYPESCRIPT_DEFINITION_PATTERN.match(following_line)
                if definition:
                    references.append(CodeReference(marker.group(1), "components", f"{relative_path}::{definition.group(1)}",
                                                    marker.group(2), relative_path, line.strip()))
            break
    return references


def _element_files(project_root: Path) -> dict[str, Path]:
    """Return {'type/name': spec file} for every authored element of the Product Specification."""
    specifications_root = project_root / OPENSPEC_FOLDER_NAME / SPECIFICATIONS_FOLDER_NAME
    element_files: dict[str, Path] = {}
    for element_type in ALL_ELEMENT_TYPES:
        if element_type == ELEMENT_TYPE_DATA_MODEL:
            continue
        type_folder = specifications_root / element_type
        if type_folder.exists():
            for element_folder in sorted(path for path in type_folder.iterdir() if path.is_dir()):
                spec_file = element_folder / SPECIFICATION_FILE_NAME
                if spec_file.exists():
                    element_files[f"{element_type}/{element_folder.name}"] = spec_file
    return element_files


def _requirement_names_of(spec_file: Path) -> list[str]:
    return REQUIREMENT_HEADING_PATTERN.findall(split_front_matter(spec_file.read_text(encoding="utf-8"))[1])


def scan_code_markers(project_root: Path) -> IndexResult:
    element_files = _element_files(project_root)
    elements_by_name: dict[str, list[str]] = defaultdict(list)
    for element_key in element_files:
        elements_by_name[element_key.split("/", 1)[1]].append(element_key)
    result = IndexResult()
    for source_file in _iter_source_files(project_root):
        for reference in _scan_file(project_root, source_file):
            if "/" in reference.marker_name:
                element_key = reference.marker_name if reference.marker_name in element_files else None
            else:
                candidates = elements_by_name.get(reference.marker_name, [])
                element_key = candidates[0] if len(candidates) == 1 else None
                if len(candidates) > 1:
                    result.ambiguous_markers.append(f"{reference.reference_text}: `{reference.marker_name}` matches {', '.join(candidates)}")
                    continue
            if element_key is None:
                result.unresolved_markers.append(f"{reference.reference_text}: no element named `{reference.marker_name}`")
                continue
            if reference.requirement_name and reference.requirement_name not in _requirement_names_of(element_files[element_key]):
                result.unresolved_markers.append(
                    f"{reference.reference_text}: `{element_key}` has no requirement named `{reference.requirement_name}`")
                continue
            result.references_by_element.setdefault(element_key, []).append(reference)
    return result


def _implemented_by_for(existing: dict, references: list[CodeReference]) -> dict:
    implemented_by = {key: value for key, value in (existing or {}).items() if key not in ("functions", "classes", "components")}
    for kind in ("functions", "classes", "components"):
        values = sorted({reference.reference_text for reference in references if reference.kind == kind})
        if values:
            implemented_by[kind] = values
    return implemented_by


def _implementation_of_element(project_root: Path, spec_file: Path, references: list[CodeReference],
                               tags_oldest_first: list[str], element_key: str = "", manual_statuses: ManualStatuses | None = None) -> dict:
    """Return the implementation status keys of one element: for each requirement, its manual status when it has one, else the markers that cover it."""
    manual_statuses = manual_statuses or ManualStatuses()
    requirement_names = _requirement_names_of(spec_file)
    covering_references: dict[str | None, list[CodeReference]] = {}
    manual_versions: list[str] = []
    marked_by_hand: dict[str, str] = {}
    if requirement_names:
        whole_element_references = [reference for reference in references if reference.requirement_name is None]
        for requirement_name in requirement_names:
            manual = manual_statuses.for_requirement(element_key, requirement_name)
            if manual is not None:
                marked_by_hand[requirement_name] = manual.where
                if manual.status == MANUAL_STATUS_IMPLEMENTED:
                    covering_references[requirement_name] = []
                    manual_versions.append(manual.since)
                continue
            own_references = [reference for reference in references if reference.requirement_name == requirement_name]
            if own_references or whole_element_references:
                covering_references[requirement_name] = own_references + whole_element_references
    elif references:
        covering_references[None] = references
    total = len(requirement_names) or 1
    implemented_count = len(covering_references)
    by_hand_keys = {"requirements-marked-by-hand": len(marked_by_hand), "marked-by-hand-in": sorted({where for where in marked_by_hand.values() if where})} if marked_by_hand else {}
    if implemented_count == 0:
        return {"implementation-status": IMPLEMENTATION_STATUS_PLANNED, **by_hand_keys}
    if implemented_count < total:
        return {"implementation-status": IMPLEMENTATION_STATUS_PARTIAL,
                "requirements-implemented": implemented_count, "requirements-total": total, **by_hand_keys}
    versions_by_requirement = [
        earliest_release_version([release_version_of_marker(project_root, reference.source_path, reference.marker_text)
                                  for reference in covering], tags_oldest_first)
        for covering in covering_references.values() if covering] + manual_versions
    return {"implementation-status": IMPLEMENTATION_STATUS_IMPLEMENTED,
            "implemented-in-version": latest_release_version(versions_by_requirement, tags_oldest_first), **by_hand_keys}


def _implementation_of_capability(features: list[dict], tags_oldest_first: list[str]) -> dict:
    """Roll the status of a capability up from its features."""
    implemented = [feature for feature in features if feature.get("implementation-status") == IMPLEMENTATION_STATUS_IMPLEMENTED]
    started = [feature for feature in features if feature.get("implementation-status") != IMPLEMENTATION_STATUS_PLANNED]
    if not started:
        return {"implementation-status": IMPLEMENTATION_STATUS_PLANNED}
    if len(implemented) < len(features):
        return {"implementation-status": IMPLEMENTATION_STATUS_PARTIAL,
                "features-implemented": len(implemented), "features-total": len(features)}
    return {"implementation-status": IMPLEMENTATION_STATUS_IMPLEMENTED,
            "implemented-in-version": latest_release_version([str(feature["implemented-in-version"]) for feature in implemented], tags_oldest_first)}


def implementation_status_label(front_matter: dict) -> str | None:
    """Return the status as a sentence for readers, or None when the element has no status yet."""
    status = front_matter.get("implementation-status")
    by_hand = front_matter.get("requirements-marked-by-hand")
    where = ", ".join(front_matter.get("marked-by-hand-in") or [])
    by_hand_note = f" ({by_hand} marked by hand{' in ' + where if where else ''})" if by_hand else ""
    if status == IMPLEMENTATION_STATUS_PLANNED:
        return "Planned, not implemented yet" + by_hand_note
    if status == IMPLEMENTATION_STATUS_PARTIAL:
        if "features-total" in front_matter:
            return f"Partially implemented: {front_matter.get('features-implemented')} of {front_matter.get('features-total')} features"
        return f"Partially implemented: {front_matter.get('requirements-implemented')} of {front_matter.get('requirements-total')} requirements" + by_hand_note
    if status == IMPLEMENTATION_STATUS_IMPLEMENTED:
        return f"Implemented in {front_matter.get('implemented-in-version', UNRELEASED_VERSION_LABEL)}" + by_hand_note
    return None


def count_elements_by_implementation_status(project_root: Path) -> dict[str, int]:
    """Return how many elements are implemented, partial and planned, as written in their front matter."""
    counts = {IMPLEMENTATION_STATUS_IMPLEMENTED: 0, IMPLEMENTATION_STATUS_PARTIAL: 0, IMPLEMENTATION_STATUS_PLANNED: 0}
    for spec_file in _element_files(project_root).values():
        status = split_front_matter(spec_file.read_text(encoding="utf-8"))[0].get("implementation-status", IMPLEMENTATION_STATUS_PLANNED)
        counts[status] = counts.get(status, 0) + 1
    return counts


def _problems_of_manual_statuses(project_root: Path, manual_statuses: ManualStatuses, result: IndexResult) -> list[str]:
    """Problems of the manual statuses: a malformed entry, an element or requirement that does not exist, and an implemented entry that a marker of this
    application already covers (the entry is then redundant and hides the marker)."""
    problems = list(manual_statuses.problems)
    element_files = _element_files(project_root)
    for element_key, entries in manual_statuses.by_element.items():
        if element_key not in element_files:
            problems.append(f"{MANUAL_STATUS_FILE_NAME}: no element named `{element_key}`")
            continue
        requirement_names = _requirement_names_of(element_files[element_key])
        marked_requirements = {reference.requirement_name for reference in result.references_by_element.get(element_key, [])}
        for requirement_name, manual in entries.items():
            if requirement_name != ALL_REQUIREMENTS_KEY and requirement_name not in requirement_names:
                problems.append(f"{MANUAL_STATUS_FILE_NAME}: `{element_key}` has no requirement named `{requirement_name}`")
            elif manual.status == MANUAL_STATUS_IMPLEMENTED and (None in marked_requirements or requirement_name in marked_requirements):
                problems.append(f"{MANUAL_STATUS_FILE_NAME}: `{element_key}` / `{requirement_name}` has a marker in this application; remove the manual entry")
    return problems


def compute_front_matter_updates(project_root: Path) -> tuple[dict[Path, dict], IndexResult]:
    """Return ({spec file: new front matter}, scan result) for the elements whose implemented-by or status changes."""
    result = scan_code_markers(project_root)
    manual_statuses = read_manual_statuses(project_root)
    result.manual_status_problems = _problems_of_manual_statuses(project_root, manual_statuses, result)
    tags_oldest_first = release_tags_oldest_first(project_root)
    element_files = _element_files(project_root)
    current: dict[str, dict] = {key: split_front_matter(spec_file.read_text(encoding="utf-8"))[0] for key, spec_file in element_files.items()}
    computed: dict[str, dict] = {}
    for element_key, spec_file in element_files.items():
        if not element_key.startswith(ELEMENT_TYPE_CAPABILITIES + "/"):
            computed[element_key] = _implementation_of_element(
                project_root, spec_file, result.references_by_element.get(element_key, []), tags_oldest_first, element_key, manual_statuses)
    for element_key, spec_file in element_files.items():
        if element_key.startswith(ELEMENT_TYPE_CAPABILITIES + "/"):
            capability_name = element_key.split("/", 1)[1]
            features = [computed[key] for key, front_matter in current.items()
                        if key in computed and front_matter.get("capability") == capability_name]
            computed[element_key] = _implementation_of_capability(features, tags_oldest_first) if features else \
                _implementation_of_element(project_root, spec_file, result.references_by_element.get(element_key, []), tags_oldest_first, element_key, manual_statuses)
    updates: dict[Path, dict] = {}
    for element_key, spec_file in element_files.items():
        front_matter = current[element_key]
        references = result.references_by_element.get(element_key, [])
        new_implemented_by = _implemented_by_for(front_matter.get("implemented-by"), references)
        changed = {key: value for key, value in front_matter.items() if key not in IMPLEMENTATION_STATUS_KEYS and key != "implemented-by"}
        if new_implemented_by:
            changed["implemented-by"] = new_implemented_by
        changed.update(computed[element_key])
        if changed != front_matter:
            updates[spec_file] = changed
    return updates, result


def index_code_for_specifications(project_root: Path) -> IndexResult:
    """Write implemented-by into the elements' front matter and rebuild the reverse views."""
    updates, result = compute_front_matter_updates(project_root)
    for spec_file, front_matter in updates.items():
        _, body_text = split_front_matter(spec_file.read_text(encoding="utf-8"))
        spec_file.write_text(join_front_matter(front_matter, body_text), encoding="utf-8")
    write_reverse_views(project_root)
    return result


def _module_of_reference(reference_text: str) -> str:
    parts = reference_text.split("::")[0].split("/")
    if len(parts) >= 4 and parts[:3] == ["backend", "app", "modules"]:
        return parts[3]
    if len(parts) >= 4 and parts[:3] == ["frontend", "src", "pages"]:
        return parts[3]
    return parts[0]


def write_reverse_views(project_root: Path) -> None:
    """Write openspec/reverse-views/ pages: which elements each module and each epic implements, and the status per epic."""
    by_module: dict[str, set[str]] = defaultdict(set)
    by_epic: dict[str, set[str]] = defaultdict(set)
    status_by_epic: dict[str, dict[str, str]] = defaultdict(dict)
    for element_key, spec_file in _element_files(project_root).items():
        front_matter, _ = split_front_matter(spec_file.read_text(encoding="utf-8"))
        implemented_by = front_matter.get("implemented-by") or {}
        for kind in ("functions", "classes", "components"):
            for reference_text in implemented_by.get(kind, []):
                by_module[_module_of_reference(reference_text)].add(element_key)
        for epic_name in (front_matter.get("origin") or {}).get("epics", []):
            if implemented_by:  # only elements that have code; the status view below lists all of them
                by_epic[str(epic_name)].add(element_key)
            status_label = implementation_status_label(front_matter)
            if status_label:
                status_by_epic[str(epic_name)][element_key] = status_label
    folder = project_root / OPENSPEC_FOLDER_NAME / REVERSE_VIEWS_FOLDER_NAME
    folder.mkdir(parents=True, exist_ok=True)
    for file_name, title, groups in (("implemented-by-module.md", "Specification elements by code module", by_module),
                                     ("implemented-by-epic.md", "Implemented specification elements by epic", by_epic)):
        lines = [f"# {title}", "", "Generated by `veloiq docs spec index-code`; do not edit.", ""]
        if not groups:
            lines += ["No specification element has code markers yet.", ""]
        for group_name in sorted(groups):
            lines += [f"## {group_name}", ""] + [f"- {element_key}" for element_key in sorted(groups[group_name])] + [""]
        (folder / file_name).write_text("\n".join(lines), encoding="utf-8")
    status_lines = ["# Implementation status by epic", "",
                    "Generated by `veloiq docs spec index-code` from the code markers and the git tags; do not edit.", ""]
    for epic_name in sorted(status_by_epic):
        status_lines += [f"## {epic_name}", ""]
        for element_key, status_label in sorted(status_by_epic[epic_name].items(), key=lambda item: (item[1].startswith("Implemented"), item[0])):
            status_lines.append(f"- {element_key}: {status_label}")
        status_lines.append("")
    (folder / "implementation-status-by-epic.md").write_text("\n".join(status_lines), encoding="utf-8")


def check_code_markers(project_root: Path) -> list[str]:
    """Return problems: unresolved or ambiguous markers, and elements whose implemented-by or implementation status is out of date."""
    updates, result = compute_front_matter_updates(project_root)
    problems = list(result.unresolved_markers) + list(result.ambiguous_markers) + list(result.manual_status_problems)
    problems += [f"{spec_file.parent.parent.name}/{spec_file.parent.name}: implemented-by or the implementation status is out of date; run `veloiq docs spec index-code`"
                 for spec_file in updates]
    return problems
