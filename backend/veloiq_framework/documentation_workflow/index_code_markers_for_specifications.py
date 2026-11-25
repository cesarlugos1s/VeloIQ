"""Find the code that implements each specification element (`veloiq docs spec index-code`).

A marker comment above a function, class or component names the element it implements:
    # spec: bulk-reassign-tasks        (Python)
    // spec: features/bulk-reassign-tasks   (TypeScript; the element type may be given to disambiguate)
The scan writes `implemented-by` into the element's front matter and builds reverse views by module and epic.
"""
from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

from veloiq_framework.documentation_workflow.specification_front_matter import (
    join_front_matter, split_front_matter,
)
from veloiq_framework.documentation_workflow.workflow_constants import (
    ALL_ELEMENT_TYPES, CODE_MARKER_KEYWORD, ELEMENT_TYPE_DATA_MODEL, OPENSPEC_FOLDER_NAME, SPECIFICATION_FILE_NAME,
    SPECIFICATIONS_FOLDER_NAME,
)

REVERSE_VIEWS_FOLDER_NAME = "reverse-views"
MARKER_PATTERN = re.compile(r"^\s*(?:#|//)\s*" + re.escape(CODE_MARKER_KEYWORD) + r"\s*([A-Za-z0-9_./-]+)\s*$")
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


@dataclass
class IndexResult:
    references_by_element: dict[str, list[CodeReference]] = field(default_factory=dict)
    unresolved_markers: list[str] = field(default_factory=list)
    ambiguous_markers: list[str] = field(default_factory=list)


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
                    references.append(CodeReference(marker.group(1), kind, f"{relative_path}::{definition.group(2)}"))
            else:
                definition = TYPESCRIPT_DEFINITION_PATTERN.match(following_line)
                if definition:
                    references.append(CodeReference(marker.group(1), "components", f"{relative_path}::{definition.group(1)}"))
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
            result.references_by_element.setdefault(element_key, []).append(reference)
    return result


def _implemented_by_for(existing: dict, references: list[CodeReference]) -> dict:
    implemented_by = {key: value for key, value in (existing or {}).items() if key not in ("functions", "classes", "components")}
    for kind in ("functions", "classes", "components"):
        values = sorted({reference.reference_text for reference in references if reference.kind == kind})
        if values:
            implemented_by[kind] = values
    return implemented_by


def compute_front_matter_updates(project_root: Path) -> tuple[dict[Path, dict], IndexResult]:
    """Return ({spec file: new front matter}, scan result) for the elements whose implemented-by changes."""
    result = scan_code_markers(project_root)
    updates: dict[Path, dict] = {}
    for element_key, spec_file in _element_files(project_root).items():
        front_matter, _ = split_front_matter(spec_file.read_text(encoding="utf-8"))
        references = result.references_by_element.get(element_key, [])
        new_implemented_by = _implemented_by_for(front_matter.get("implemented-by"), references)
        if new_implemented_by != (front_matter.get("implemented-by") or {}):
            changed = dict(front_matter)
            if new_implemented_by:
                changed["implemented-by"] = new_implemented_by
            else:
                changed.pop("implemented-by", None)
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
    """Write openspec/reverse-views/ pages: which elements each module and each epic implements."""
    by_module: dict[str, set[str]] = defaultdict(set)
    by_epic: dict[str, set[str]] = defaultdict(set)
    for element_key, spec_file in _element_files(project_root).items():
        front_matter, _ = split_front_matter(spec_file.read_text(encoding="utf-8"))
        implemented_by = front_matter.get("implemented-by") or {}
        for kind in ("functions", "classes", "components"):
            for reference_text in implemented_by.get(kind, []):
                by_module[_module_of_reference(reference_text)].add(element_key)
        for epic_name in (front_matter.get("origin") or {}).get("epics", []):
            by_epic[str(epic_name)].add(element_key)
    folder = project_root / OPENSPEC_FOLDER_NAME / REVERSE_VIEWS_FOLDER_NAME
    folder.mkdir(parents=True, exist_ok=True)
    for file_name, title, groups in (("implemented-by-module.md", "Specification elements by code module", by_module),
                                     ("implemented-by-epic.md", "Specification elements by epic", by_epic)):
        lines = [f"# {title}", "", "Generated by `veloiq docs spec index-code`; do not edit.", ""]
        for group_name in sorted(groups):
            lines += [f"## {group_name}", ""] + [f"- {element_key}" for element_key in sorted(groups[group_name])] + [""]
        (folder / file_name).write_text("\n".join(lines), encoding="utf-8")


def check_code_markers(project_root: Path) -> list[str]:
    """Return problems: unresolved or ambiguous markers, and elements whose implemented-by is out of date."""
    updates, result = compute_front_matter_updates(project_root)
    problems = list(result.unresolved_markers) + list(result.ambiguous_markers)
    problems += [f"{spec_file.parent.parent.name}/{spec_file.parent.name}: implemented-by is out of date; run `veloiq docs spec index-code`"
                 for spec_file in updates]
    return problems
