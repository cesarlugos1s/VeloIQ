"""What a help draft contains and how it maps onto the application's help documents (veloiq_help_document).

A draft lives in openspec/help-drafts/ as markdown with this front matter:
    page_keys:       the help pages it belongs to, using the help page_key convention ("job_posting:show", or any
                     string for a custom page). They come from the element's `help-pages` front matter.
    source-element:  the specification element it was drafted from.
    status:          draft, or reviewed once an administrator approved the text. Only reviewed drafts are imported.
    screenshots:     [{file, route, caption}] captured by `veloiq docs help screenshots`.
The body holds the title, the text, `## Actions` (one `- <action_key>: <button label>` per line) and `## Screenshots`.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from veloiq_framework.documentation_workflow.specification_front_matter import split_front_matter

#: The runnable actions a help document may offer; kept equal to HELP_ACTION_CATALOG in the UI package (a test compares them).
HELP_ACTION_KEYS = (
    "create_new", "export_csv", "open_import", "open_metadata", "open_view_config",
    "switch_view_type:gallery", "switch_view_type:calendar", "switch_view_type:kanban", "switch_view_type:map",
    "go_to_list", "go_to_show", "go_to_edit", "pin_to_dashboard", "open_explore",
)

HELP_STATUS_DRAFT = "draft"
HELP_STATUS_REVIEWED = "reviewed"
SCREENSHOTS_FOLDER_IN_FRONTEND = ("frontend", "public", "help-screenshots")
SCREENSHOTS_URL_PREFIX = "/help-screenshots/"
ACTIONS_HEADING = "## Actions"
SCREENSHOTS_HEADING = "## Screenshots"
SECTION_PATTERN = re.compile(r"^## (.+)$", re.M)
ACTION_LINE_PATTERN = re.compile(r"^\s*[-*]\s+([a-z_]+(?::[a-z]+)?)\s*:\s*(.+?)\s*$")
IMAGE_LINE_PATTERN = re.compile(r"^\s*!\[[^\]]*\]\([^)]+\)\s*$")


@dataclass
class HelpDraft:
    page_keys: list[str]
    source_element: str
    status: str
    title: str
    body_markdown: str                 # everything except the actions and the screenshots sections
    actions: list[tuple[str, str]]     # (action_key, label)
    screenshot_lines: list[str]        # markdown image lines of the screenshots section
    screenshot_specs: list[dict] = field(default_factory=list)
    problems: list[str] = field(default_factory=list)


def _section_text(body_text: str, heading: str) -> tuple[str, int, int]:
    """Return (section content, start, end) of a `## heading` section, or ('', -1, -1) when it is absent."""
    start = body_text.find(heading + "\n")
    if start == -1:
        return "", -1, -1
    content_start = start + len(heading) + 1
    following = SECTION_PATTERN.search(body_text, content_start)
    end = following.start() if following else len(body_text)
    return body_text[content_start:end], start, end


def parse_help_draft(draft_text: str) -> HelpDraft:
    """Read a help draft; `problems` lists everything that stops it from being imported."""
    front_matter, body_text = split_front_matter(draft_text)
    problems: list[str] = []
    page_keys = [str(key) for key in (front_matter.get("page_keys") or [])]
    if not page_keys:
        problems.append("page_keys is empty: add `help-pages` to the element, or list the help pages of this draft")
    title_match = re.match(r"^# (.+)$", body_text, re.M)
    title = title_match.group(1).strip() if title_match else ""

    actions_text, actions_start, actions_end = _section_text(body_text, ACTIONS_HEADING)
    actions: list[tuple[str, str]] = []
    for line in actions_text.splitlines():
        match = ACTION_LINE_PATTERN.match(line)
        if match:
            action_key, label = match.groups()
            if action_key not in HELP_ACTION_KEYS:
                problems.append(f"action `{action_key}` is not in the catalog ({', '.join(HELP_ACTION_KEYS)})")
            else:
                actions.append((action_key, label))
    screenshots_text, screenshots_start, screenshots_end = _section_text(body_text, SCREENSHOTS_HEADING)
    screenshot_lines = [line.strip() for line in screenshots_text.splitlines() if IMAGE_LINE_PATTERN.match(line)]

    kept = body_text
    for start, end in sorted([(actions_start, actions_end), (screenshots_start, screenshots_end)], reverse=True):
        if start != -1:
            kept = kept[:start] + kept[end:]
    kept = re.sub(r"^# .+\n+", "", kept, count=1).strip()
    return HelpDraft(page_keys, str(front_matter.get("source-element", "")), str(front_matter.get("status", HELP_STATUS_DRAFT)),
                     title, kept, actions, screenshot_lines, list(front_matter.get("screenshots") or []), problems)


def managed_section(source_element: str, draft: HelpDraft) -> str:
    """The block of markdown this draft owns inside a help document; it is replaced, never duplicated, on each import."""
    # The block sits under a `###` title inside a help page, so the draft's own `##` headings become `####`.
    nested_body = re.sub(r"^## ", "#### ", draft.body_markdown, flags=re.M)
    lines = [f"<!-- veloiq-docs:begin {source_element} -->", f"### {draft.title}", "", nested_body]
    if draft.screenshot_lines:
        lines += ["", *draft.screenshot_lines]
    lines.append(f"<!-- veloiq-docs:end {source_element} -->")
    return "\n".join(lines)


def merge_managed_section(existing_body: str, source_element: str, section: str) -> str:
    """Put `section` into a help document body: replace this element's block when present, otherwise append it."""
    begin_marker = f"<!-- veloiq-docs:begin {source_element} -->"
    end_marker = f"<!-- veloiq-docs:end {source_element} -->"
    begin = existing_body.find(begin_marker)
    end = existing_body.find(end_marker)
    if begin != -1 and end != -1 and end > begin:
        return existing_body[:begin] + section + existing_body[end + len(end_marker):]
    separator = "\n\n" if existing_body.strip() else ""
    return existing_body.rstrip("\n") + separator + section + "\n"
