"""Build the documentation site of the Product Specification for one product version (`veloiq docs site build`)."""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

from veloiq_framework.documentation_workflow.specification_front_matter import split_front_matter
from veloiq_framework.documentation_workflow.workflow_constants import (
    ALL_ELEMENT_TYPES, ARCHIVE_FOLDER_NAME, CHANGELOG_FILE_NAME, CHANGES_FOLDER_NAME, OPENSPEC_FOLDER_NAME, SPECIFICATION_FILE_NAME, SPECIFICATIONS_FOLDER_NAME,
)

SITE_BUILD_FOLDER_NAME = "documentation-site"
MERMAID_FENCE_CONFIGURATION = """markdown_extensions:
  - tables
  - toc:
      permalink: true
  - pymdownx.superfences:
      custom_fences:
        - name: mermaid
          class: mermaid
          format: !!python/name:pymdownx.superfences.fence_code_format
"""
METADATA_KEYS_SHOWN = ("type", "capability", "created", "created-in-version", "last-changed", "last-changed-in-version")


def export_openspec_folder_at_tag(project_root: Path, git_tag: str, destination: Path) -> Path:
    """Export the openspec folder as it was at a git tag; return the exported openspec folder."""
    destination.mkdir(parents=True, exist_ok=True)
    archive = subprocess.run(["git", "archive", git_tag, OPENSPEC_FOLDER_NAME], cwd=project_root, capture_output=True)
    if archive.returncode != 0:
        raise RuntimeError(f"git archive {git_tag} failed: {archive.stderr.decode('utf-8', 'replace').strip()}")
    subprocess.run(["tar", "-x", "-C", str(destination)], input=archive.stdout, check=True)
    return destination / OPENSPEC_FOLDER_NAME


ARCHIVE_DATE_PREFIX_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}-")


@dataclass
class LinkTargets:
    """Page paths (relative to the docs folder) that metadata values can link to, by kind and name."""
    elements: dict[str, str] = field(default_factory=dict)
    changes: dict[str, str] = field(default_factory=dict)
    epics: dict[str, str] = field(default_factory=dict)
    stories: dict[str, str] = field(default_factory=dict)

    def link(self, kind: str, name, page_path: str) -> str:
        """Return `name` as a markdown link relative to the page at page_path, or plain text when it has no page."""
        target = getattr(self, kind).get(str(name))
        if target is None:
            return str(name)
        return f"[{name}]({os.path.relpath(target, os.path.dirname(page_path))})"


def _metadata_table(front_matter: dict, links: LinkTargets, page_path: str) -> str:
    rows = [(key, front_matter[key]) for key in METADATA_KEYS_SHOWN if key in front_matter and key != "capability"]
    if front_matter.get("capability"):
        rows.insert(1, ("capability", links.link("elements", front_matter["capability"], page_path)))
    if front_matter.get("journeys"):
        rows.append(("journeys", ", ".join(links.link("elements", name, page_path) for name in front_matter["journeys"])))
    if front_matter.get("epic"):
        rows.append(("epic", links.link("epics", front_matter["epic"], page_path)))
    if front_matter.get("change"):
        rows.append(("change", links.link("changes", front_matter["change"], page_path)))
    origin = front_matter.get("origin") or {}
    for key, kind in (("changes", "changes"), ("epics", "epics"), ("stories", "stories")):
        if origin.get(key):
            rows.append((f"origin {key}", ", ".join(links.link(kind, value, page_path) for value in origin[key])))
    implemented_by = front_matter.get("implemented-by") or {}
    for key, values in implemented_by.items():
        rows.append((f"implemented by {key}", "<br>".join(f"`{value}`" for value in values)))
    for prerequisite in front_matter.get("prerequisites") or []:
        if isinstance(prerequisite, dict):
            text = str(prerequisite.get("text"))
            origin_text = str(prerequisite.get("inherited-from"))
            kind_word, _, origin_name = origin_text.partition(" ")
            linked_origin = links.link({"epic": "epics", "story": "stories"}.get(kind_word, "elements"), origin_name, page_path) if origin_name else origin_text
            rows.append(("prerequisite", f"{text} ({kind_word} {linked_origin})" if origin_name else f"{text} ({origin_text})"))
        else:
            rows.append(("prerequisite", str(prerequisite)))
    if front_matter.get("requires"):
        rows.append(("requires", ", ".join(links.link("elements", name, page_path) for name in front_matter["requires"])))
    if not rows:
        return ""
    return "| Property | Value |\n| --- | --- |\n" + "\n".join(f"| {key} | {value} |" for key, value in rows) + "\n\n"


LIST_ITEM_NAME_PATTERN = re.compile(r"^(\s*[-*]\s+)`?([a-z0-9][a-z0-9-]*(?:/[a-z0-9][a-z0-9_.-]*)?)`?(\s*:.*|\s*)$")


def _link_names_in_lists(body_text: str, links: LinkTargets, page_path: str) -> str:
    """Turn list items that are only the name of a story, epic or specification element (optionally `type/name`) into links."""
    linked_lines: list[str] = []
    for line in body_text.split("\n"):
        match = LIST_ITEM_NAME_PATTERN.match(line)
        if match:
            bullet, token, remainder = match.groups()
            name = token.split("/", 1)[1] if "/" in token else token
            for kind in ("stories", "epics", "elements"):
                known_pages = getattr(links, kind)
                if name in known_pages and ("/" not in token or known_pages[name].startswith(token.split("/", 1)[0] + "/")):
                    line = f"{bullet}{links.link(kind, name, page_path) if '/' not in token else '[' + token + '](' + os.path.relpath(known_pages[name], os.path.dirname(page_path)) + ')'}{remainder}"
                    break
        linked_lines.append(line)
    return "\n".join(linked_lines)


def _link_epic_headings(body_text: str, links: LinkTargets, page_path: str) -> str:
    """Turn a `## name` heading that is the name of an epic into a link to the epic page."""
    return "\n".join(
        f"## {links.link('epics', line[3:].strip(), page_path)}" if line.startswith("## ") and line[3:].strip() in links.epics else line
        for line in body_text.split("\n"))


def _archived_changes(openspec_folder: Path) -> list[tuple[str, Path]]:
    """Return (change name, archived folder) pairs, oldest first; the name has the archive date prefix removed."""
    archive_folder = openspec_folder / CHANGES_FOLDER_NAME / ARCHIVE_FOLDER_NAME
    if not archive_folder.exists():
        return []
    return [(ARCHIVE_DATE_PREFIX_PATTERN.sub("", folder.name), folder) for folder in sorted(archive_folder.iterdir()) if folder.is_dir()]


def _collect_link_targets(openspec_folder: Path) -> LinkTargets:
    links = LinkTargets()
    specifications_root = openspec_folder / SPECIFICATIONS_FOLDER_NAME
    for element_type in ALL_ELEMENT_TYPES:
        type_folder = specifications_root / element_type
        if type_folder.exists():
            for element_folder in type_folder.iterdir():
                if (element_folder / SPECIFICATION_FILE_NAME).exists():
                    links.elements[element_folder.name] = f"{element_type}/{element_folder.name}.md"
    for change_name, archived_folder in _archived_changes(openspec_folder):
        links.changes[change_name] = f"changes/{change_name}/index.md"
        for epic_file in sorted((archived_folder / "epics").glob("*.md")):
            links.epics[epic_file.stem] = f"changes/{change_name}/epics/{epic_file.name}"
        for story_file in sorted((archived_folder / "stories").glob("*.md")):
            links.stories[story_file.stem] = f"changes/{change_name}/stories/{story_file.name}"
    return links


def _stage_change_pages(openspec_folder: Path, docs_folder: Path, links: LinkTargets) -> list[str]:
    """Write one page per archived change (proposal, epics, stories, designs, tasks); return navigation lines."""
    navigation: list[str] = []
    changes = _archived_changes(openspec_folder)
    if not changes:
        return navigation
    navigation.append("  - Changes:")
    for change_name, archived_folder in changes:
        change_pages: list[tuple[str, str]] = []  # (title, page path)
        page_sources = [("Proposal", "index.md", archived_folder / "proposal.md")]
        page_sources += [(f"Epic: {path.stem}", f"epics/{path.name}", path) for path in sorted((archived_folder / "epics").glob("*.md"))]
        page_sources += [(f"Story: {path.stem}", f"stories/{path.name}", path) for path in sorted((archived_folder / "stories").glob("*.md"))]
        page_sources += [("High-level design", "design/high-level-design.md", archived_folder / "design" / "high-level-design.md")]
        page_sources += [(f"Low-level design: {path.stem}", f"design/low-level-design/{path.name}", path)
                         for path in sorted((archived_folder / "design" / "low-level-design").glob("*.md"))]
        page_sources += [("Tasks", "tasks.md", archived_folder / "tasks.md")]
        for title, relative_page, source_file in page_sources:
            if not source_file.exists():
                continue
            page_path = f"changes/{change_name}/{relative_page}"
            front_matter, body_text = split_front_matter(source_file.read_text(encoding="utf-8"))
            page = docs_folder / page_path
            page.parent.mkdir(parents=True, exist_ok=True)
            elements_text = ""
            if relative_page == "index.md":
                changed = [(element_type, element_folder.name)
                           for element_type in ALL_ELEMENT_TYPES
                           for element_folder in sorted((archived_folder / SPECIFICATIONS_FOLDER_NAME / element_type).glob("*"))] \
                    if (archived_folder / SPECIFICATIONS_FOLDER_NAME).exists() else []
                if changed:
                    elements_text = "\n\n## Specification elements of this change\n\n" + "\n".join(
                        f"- {links.link('elements', name, page_path)} ({element_type})" for element_type, name in changed)
            body_text = _link_names_in_lists(body_text, links, page_path)
            page.write_text(f"# {title}\n\n" + _metadata_table(front_matter, links, page_path) + body_text + elements_text, encoding="utf-8")
            change_pages.append((title, page_path))
        navigation.append(f"    - {change_name}:")
        navigation += [f"      - '{title}': {page_path}" for title, page_path in change_pages]
    return navigation


def stage_documentation_site(openspec_folder: Path, staging_folder: Path, site_name: str) -> Path:
    """Write the MkDocs project (docs folder and mkdocs.yml) into staging_folder; return the mkdocs.yml path."""
    docs_folder = staging_folder / "docs"
    if staging_folder.exists():
        shutil.rmtree(staging_folder)
    docs_folder.mkdir(parents=True)
    specifications_root = openspec_folder / SPECIFICATIONS_FOLDER_NAME
    links = _collect_link_targets(openspec_folder)
    navigation: list[str] = ["  - Home: index.md"]
    home_lines = [f"# {site_name}", "", "Product Specification, current state at this version.", ""]
    for element_type in ALL_ELEMENT_TYPES:
        type_folder = specifications_root / element_type
        element_folders = sorted(path for path in type_folder.iterdir() if (path / SPECIFICATION_FILE_NAME).exists()) if type_folder.exists() else []
        if not element_folders:
            continue
        navigation.append(f"  - {element_type}:")
        home_lines.append(f"- {element_type}: {len(element_folders)} elements")
        for element_folder in element_folders:
            front_matter, body_text = split_front_matter((element_folder / SPECIFICATION_FILE_NAME).read_text(encoding="utf-8"))
            page = docs_folder / element_type / f"{element_folder.name}.md"
            page.parent.mkdir(parents=True, exist_ok=True)
            page.write_text(_metadata_table(front_matter, links, f"{element_type}/{element_folder.name}.md") + body_text, encoding="utf-8")
            navigation.append(f"    - {element_folder.name}: {element_type}/{element_folder.name}.md")
            for extra_file in sorted(element_folder.iterdir()):
                if extra_file.is_file() and extra_file.name != SPECIFICATION_FILE_NAME:
                    shutil.copy2(extra_file, page.parent / f"{element_folder.name}-{extra_file.name}")
    navigation += _stage_change_pages(openspec_folder, docs_folder, links)
    for extra_name, source_path in ((CHANGELOG_FILE_NAME, openspec_folder / CHANGELOG_FILE_NAME),):
        if source_path.exists():
            shutil.copy2(source_path, docs_folder / extra_name)
            navigation.append(f"  - Changelog: {extra_name}")
    reverse_views_folder = openspec_folder / "reverse-views"
    if reverse_views_folder.exists():
        navigation.append("  - Traceability:")
        for view_file in sorted(reverse_views_folder.glob("*.md")):
            view_text = _link_names_in_lists(view_file.read_text(encoding="utf-8"), links, view_file.name)
            (docs_folder / view_file.name).write_text(_link_epic_headings(view_text, links, view_file.name), encoding="utf-8")
            navigation.append(f"    - {view_file.stem}: {view_file.name}")
    (docs_folder / "index.md").write_text("\n".join(home_lines) + "\n", encoding="utf-8")
    configuration_file = staging_folder / "mkdocs.yml"
    configuration_file.write_text(
        f"site_name: {site_name}\nuse_directory_urls: false\ntheme:\n  name: material\n{MERMAID_FENCE_CONFIGURATION}nav:\n" + "\n".join(navigation) + "\n",
        encoding="utf-8")
    return configuration_file


def build_documentation_site(project_root: Path, product_version: str, git_tag: str | None = None) -> str:
    """Stage the site and build it with MkDocs when installed; return a message saying where the result is."""
    build_root = project_root / SITE_BUILD_FOLDER_NAME
    staging_folder = build_root / "source" / product_version
    with tempfile.TemporaryDirectory() as export_folder:
        openspec_folder = export_openspec_folder_at_tag(project_root, git_tag, Path(export_folder)) if git_tag \
            else project_root / OPENSPEC_FOLDER_NAME
        configuration_file = stage_documentation_site(openspec_folder, staging_folder, f"{project_root.name} specification {product_version}")
    output_folder = build_root / "site" / product_version
    result = subprocess.run([sys.executable, "-m", "mkdocs", "build", "-q", "-f", str(configuration_file), "-d", str(output_folder)],
                            capture_output=True, text=True)
    if result.returncode != 0:
        return (f"Site source staged at {staging_folder}. MkDocs Material is not available or failed "
                f"({(result.stderr or result.stdout).strip().splitlines()[-1:]}); install it with `pip install mkdocs-material` and run `mkdocs build -f {configuration_file}`.")
    return f"Site built at {output_folder}"
