"""Tables for the pages of the documentation site that list many things: the home page, the changelog and the three traceability views.

The source files stay as they are (the changelog is appended by ``veloiq docs change apply``, the reverse views are written by ``veloiq docs spec index-code``);
this module turns them into markdown tables when the site is staged, so the pages can be scanned by column instead of read as a long bulleted list.
A line that does not have the expected form is kept as it was, below the table.
"""
from __future__ import annotations

import os
import re
from collections import Counter
from dataclasses import dataclass, field

IMPLEMENTED_LABEL, PARTIAL_LABEL, PLANNED_LABEL = "Implemented", "Partial", "Planned"
CHANGELOG_ENTRY_PATTERN = re.compile(r"^-\s+(?P<change>[a-z0-9][a-z0-9-]*)\s+\((?P<date>\d{4}-\d{2}-\d{2})\):\s*(?P<parts>.*)$")
BULLET_PATTERN = re.compile(r"^\s*-\s+(?P<text>.+?)\s*$")
STATUS_BULLET_PATTERN = re.compile(r"^\s*-\s+(?P<element>[a-z0-9-]+/[A-Za-z0-9_.-]+):\s*(?P<label>.+?)\s*$")
CHANGE_KINDS = ("added", "modified", "removed")


@dataclass
class TableLinks:
    """What a table cell can link to: element pages by ``type/name``, changes and epics by name; all relative to the docs folder."""
    elements: dict[str, str] = field(default_factory=dict)
    changes: dict[str, str] = field(default_factory=dict)
    epics: dict[str, str] = field(default_factory=dict)

    def link(self, kind: str, key: str, label: str, page_path: str) -> str:
        target = getattr(self, kind).get(key)
        return f"[{label}]({os.path.relpath(target, os.path.dirname(page_path))})" if target else label


def _cell(text: str) -> str:
    """Text for a table cell: a pipe would end the cell and a line break would end the row."""
    return str(text).replace("|", "\\|").replace("\n", " ")


def _table(headers: list[str], rows: list[list[str]]) -> str:
    lines = ["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _header in headers) + " |"]
    lines += ["| " + " | ".join(_cell(value) for value in row) + " |" for row in rows]
    return "\n".join(lines)


def _element_link(links: TableLinks, element_key: str, page_path: str) -> str:
    """The element's name as a link to its page; an element with no page (one that was removed) is shown as ``type/name``."""
    if element_key not in links.elements:
        return element_key
    return links.link("elements", element_key, element_key.split("/", 1)[1] if "/" in element_key else element_key, page_path)


def _element_cell(links: TableLinks, element_keys: list[str], page_path: str) -> str:
    """The elements of a change as links, one under the other (a ``<br>`` keeps them in one cell)."""
    return "<br>".join(_element_link(links, key, page_path) for key in element_keys)


def _split_sections(text: str) -> tuple[list[str], list[tuple[str, list[str]]]]:
    """The lines before the first ``## heading`` and the sections ``(heading, lines)`` after it."""
    before: list[str] = []
    sections: list[tuple[str, list[str]]] = []
    for line in text.split("\n"):
        if line.startswith("## "):
            sections.append((line[3:].strip(), []))
        elif sections:
            sections[-1][1].append(line)
        else:
            before.append(line)
    return before, sections


def render_home_page(site_name: str, rows: list[tuple[str, int, Counter]]) -> str:
    """The home page: what the specification has, by element type, with how much of it is built.

    :param rows: ``(element type, number of elements, counts by implementation status)``; the counts are empty for a type that is not built.
    """
    has_status = any(counts for _type, _total, counts in rows)
    headers = ["Element type", "Elements"] + (["Implemented", "Partial", "Planned"] if has_status else [])
    table_rows = [[element_type, str(total)] + ([str(counts.get(IMPLEMENTED_LABEL, 0)) if counts else "", str(counts.get(PARTIAL_LABEL, 0)) if counts else "",
                                                str(counts.get(PLANNED_LABEL, 0)) if counts else ""] if has_status else [])
                  for element_type, total, counts in rows]
    return f"# {site_name}\n\nProduct Specification, current state at this version.\n\n" + _table(headers, table_rows) + "\n"


def render_changelog_page(changelog_text: str, links: TableLinks, page_path: str) -> str:
    """The changelog: for each version a table with the change, its date and the elements it added, modified and removed."""
    before, sections = _split_sections(changelog_text)
    output = ["\n".join(before).rstrip(), ""]
    for version, lines in sections:
        rows: list[list[str]] = []
        unparsed: list[str] = []
        for line in lines:
            if not line.strip():
                continue
            entry = CHANGELOG_ENTRY_PATTERN.match(line.strip())
            if entry is None:
                unparsed.append(line)
                continue
            by_kind: dict[str, list[str]] = {kind: [] for kind in CHANGE_KINDS}
            for part in (piece.strip() for piece in entry.group("parts").split(";") if piece.strip()):
                kind, _space, names = part.partition(" ")
                if kind in by_kind:
                    by_kind[kind] = [name.strip() for name in names.split(",") if name.strip()]
            rows.append([links.link("changes", entry.group("change"), entry.group("change"), page_path), entry.group("date"),
                         *(_element_cell(links, by_kind[kind], page_path) for kind in CHANGE_KINDS)])
        output += [f"## {version}", ""]
        if rows:
            output += [_table(["Change", "Date", "Added", "Modified", "Removed"], rows), ""]
        output += [*unparsed, ""] if unparsed else []
    return "\n".join(output).rstrip("\n") + "\n"


def render_module_view(text: str, links: TableLinks, page_path: str) -> str:
    """The view of the elements by code module: one row for each module and element."""
    return _render_grouped_view(text, links, page_path, "Code module", group_link_kind=None)


def render_epic_view(text: str, links: TableLinks, page_path: str) -> str:
    """The view of the implemented elements by epic: one row for each epic and element."""
    return _render_grouped_view(text, links, page_path, "Epic", group_link_kind="epics")


def _render_grouped_view(text: str, links: TableLinks, page_path: str, group_header: str, group_link_kind: str | None) -> str:
    before, sections = _split_sections(text)
    rows: list[list[str]] = []
    unparsed: list[str] = []
    for group, lines in sections:
        group_cell = links.link(group_link_kind, group, group, page_path) if group_link_kind else group
        for line in lines:
            bullet = BULLET_PATTERN.match(line)
            if bullet is None:
                if line.strip() and not line.startswith("No specification element"):
                    unparsed.append(line)
                continue
            key = bullet.group("text").strip("`")
            element_type = key.split("/", 1)[0] if "/" in key else ""
            rows.append([group_cell, element_type, _element_link(links, key, page_path)])
    intro = "\n".join(line for line in before if line.strip())
    body = _table([group_header, "Element type", "Element"], rows) if rows else "No specification element has code markers yet."
    return f"{intro}\n\n{body}\n" + ("\n" + "\n".join(unparsed) + "\n" if unparsed else "")


def split_status_label(label: str) -> tuple[str, str]:
    """The status a label states and the rest of it: ``Partially implemented: 7 of 11 requirements`` is (Partial, 7 of 11 requirements)."""
    if label.startswith("Planned"):
        return PLANNED_LABEL, label[len("Planned"):].lstrip(", ")
    if label.startswith("Partially implemented"):
        return PARTIAL_LABEL, label[len("Partially implemented"):].lstrip(": ")
    if label.startswith("Implemented"):
        detail = label[len("Implemented"):].strip()
        return IMPLEMENTED_LABEL, detail[len("in "):] if detail.startswith("in ") else detail
    return label, ""


def render_status_view(text: str, links: TableLinks, page_path: str) -> str:
    """The implementation status by epic: a summary of the statuses, then one row for each epic and element."""
    before, sections = _split_sections(text)
    rows: list[list[str]] = []
    counts: Counter = Counter()
    seen: set[str] = set()
    unparsed: list[str] = []
    for epic, lines in sections:
        for line in lines:
            match = STATUS_BULLET_PATTERN.match(line)
            if match is None:
                if line.strip():
                    unparsed.append(line)
                continue
            element_key = match.group("element")
            status, detail = split_status_label(match.group("label"))
            if element_key not in seen:                           # an element in several epics counts once in the summary
                seen.add(element_key)
                counts[status] += 1
            rows.append([links.link("epics", epic, epic, page_path), element_key.split("/", 1)[0], _element_link(links, element_key, page_path), status, detail])
    intro = "\n".join(line for line in before if line.strip())
    summary = _table(["Status", "Elements"], [[label, str(counts.get(label, 0))] for label in (IMPLEMENTED_LABEL, PARTIAL_LABEL, PLANNED_LABEL)])
    table = _table(["Epic", "Element type", "Element", "Status", "Detail"], rows) if rows else "No element has a status yet."
    return f"{intro}\n\n{summary}\n\n{table}\n" + ("\n" + "\n".join(unparsed) + "\n" if unparsed else "")


TABLE_RENDERERS = {
    "implemented-by-module": render_module_view,
    "implemented-by-epic": render_epic_view,
    "implementation-status-by-epic": render_status_view,
}
