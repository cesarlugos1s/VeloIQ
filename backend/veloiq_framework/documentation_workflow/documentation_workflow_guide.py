"""What the developer sees about the documentation workflow: the actions, their explanations and the project status.

The terminal explorer (`veloiq` with no arguments) and VeloIQ Studio both read this module, so they show the same
actions, the same helper messages and the same next-step advice.
"""
from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass
from pathlib import Path

from veloiq_framework.documentation_workflow.workflow_constants import (
    ALL_ELEMENT_TYPES, ARCHIVE_FOLDER_NAME, CHANGES_FOLDER_NAME, OPENSPEC_FOLDER_NAME, SPECIFICATIONS_FOLDER_NAME,
    SPECIFICATION_FILE_NAME,
)

SOURCE_TEXT = "text"
SOURCE_IN_PROGRESS_CHANGES = "in_progress_changes"
SOURCE_APPLIED_CHANGES = "applied_changes"
SAFE_ARGUMENT_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
SAFE_ADDRESS_PATTERN = re.compile(r"^https?://[A-Za-z0-9.:_-]+$")


@dataclass(frozen=True)
class DocumentationActionInput:
    """One value a command needs. `source` says where the choices come from (text means the developer types it)."""
    key: str
    label: str
    source: str = SOURCE_TEXT
    required: bool = True
    placeholder: str = ""
    help_text: str = ""
    is_address: bool = False  # a web address such as http://localhost:8000 instead of a name


@dataclass(frozen=True)
class DocumentationAction:
    identifier: str
    key: str
    label: str
    summary: str
    when_to_use: str
    command: str
    inputs: tuple[DocumentationActionInput, ...] = ()
    optional_argument_templates: tuple[tuple[str, str], ...] = ()  # (input key, text appended when the input has a value)


DOCUMENTATION_ACTIONS: tuple[DocumentationAction, ...] = (
    DocumentationAction(
        "install", "i", "Set up the documentation workflow",
        "Installs OpenSpec in this project with the veloiq-docs schema, the file templates and the assistant commands.",
        "Once per project. Needs Node.js, which VeloIQ projects already use for the frontend.",
        "veloiq docs init"),
    DocumentationAction(
        "new-change", "n", "Start a change",
        "Creates a change folder under openspec/changes/. A change holds the proposal, epics, user stories, designs and the "
        "specification deltas of one piece of work.",
        "Before building or changing a feature. Name it by its outcome in kebab-case, for example add-workload-balancing "
        "(never a number). Then ask Claude Code to fill it with /docs-propose.",
        "veloiq docs change new {change_name}",
        (DocumentationActionInput("change_name", "Change name", placeholder="add-workload-balancing",
                                  help_text="Descriptive kebab-case outcome name."),)),
    DocumentationAction(
        "validate", "v", "Validate a change",
        "Runs OpenSpec's validation and the VeloIQ checks: descriptive unique names, stories linked to epics, features "
        "linked to a capability, prerequisites that exist, no circular requirements.",
        "After writing the change and before applying it. Fix every reported problem first.",
        "veloiq docs change validate {change_name}",
        (DocumentationActionInput("change_name", "Change to validate", SOURCE_IN_PROGRESS_CHANGES),)),
    DocumentationAction(
        "apply", "a", "Apply a change to the Product Specification",
        "Merges the approved change into openspec/specs/ (OpenSpec archive), then stamps each new or changed element with "
        "its dates, version, origin and prerequisites, and adds the changelog entry.",
        "After the change is approved and implemented. Give the product version so the history can be traced by release.",
        "veloiq docs change apply {change_name}",
        (DocumentationActionInput("change_name", "Change to apply", SOURCE_IN_PROGRESS_CHANGES),
         DocumentationActionInput("product_version", "Product version", required=False, placeholder="1.4.0",
                                  help_text="Leave empty to use the latest git tag, or 'unreleased'.")),
        (("product_version", "--product-version {product_version}"),)),
    DocumentationAction(
        "data-model", "d", "Generate the data model",
        "Writes one specification per entity (fields, types, defaults, constraints, relations with cardinality and a "
        "diagram) from the application's models.",
        "After models change. The files are generated, so never edit them by hand.",
        "veloiq docs spec generate-data-model"),
    DocumentationAction(
        "index-code", "x", "Link specification to code",
        "Reads the `# spec: <element-name>` comments in the code, records which functions and components implement each "
        "element, and builds the traceability pages by module and by epic.",
        "After implementing. Put the comment above the function or component that implements the element, not above helpers.",
        "veloiq docs spec index-code"),
    DocumentationAction(
        "check", "c", "Check specification against code",
        "Fails when the generated data model or the code references differ from the code, or when a marker names an "
        "element that does not exist.",
        "Before a release, or in CI.",
        "veloiq docs spec check"),
    DocumentationAction(
        "help-sync", "h", "Draft help documents",
        "Writes help document drafts in openspec/help-drafts/ from the purpose, requirements and scenarios of the features "
        "and journeys of an applied change.",
        "After applying a change. Then complete each draft with action buttons and screenshots, and review it in the help editor.",
        "veloiq docs help sync {change_name}",
        (DocumentationActionInput("change_name", "Applied change", SOURCE_APPLIED_CHANGES),)),
    DocumentationAction(
        "help-screenshots", "p", "Capture help screenshots",
        "Logs in to the running application and captures the screenshots listed in the help drafts (the `screenshots` entries "
        "of their front matter) into frontend/public/help-screenshots/, then shows them in the draft.",
        "After a draft lists the pages to capture. The application must be running; the password comes from the "
        "VELOIQ_DOCS_PASSWORD environment variable (the terminal asks for it when the variable is not set). Needs Playwright.",
        "veloiq docs help screenshots",
        (DocumentationActionInput("base_url", "Application address", required=False, placeholder="http://localhost:8000",
                                  help_text="Leave empty for http://localhost:8000.", is_address=True),
         DocumentationActionInput("username", "User name", required=False, placeholder="admin",
                                  help_text="Leave empty for admin.")),
        (("base_url", "--base-url {base_url}"), ("username", "--username {username}"))),
    DocumentationAction(
        "help-import-preview", "r", "Preview the help import",
        "Shows which help documents would be created or updated and which actions added, without writing to the database.",
        "Before importing. Only drafts marked `status: reviewed` are imported; the preview lists the drafts it skips and why.",
        "veloiq docs help import --dry-run"),
    DocumentationAction(
        "help-import", "o", "Import reviewed help into the application",
        "Writes the reviewed drafts into the application's help documents (veloiq_help_document) and their action buttons. "
        "Each element owns one marked block in the help page, so importing again replaces it and never duplicates it.",
        "After an administrator has reviewed the draft and set `status: reviewed`. It writes to the application's database.",
        "veloiq docs help import"),
    DocumentationAction(
        "site", "s", "Build the documentation site",
        "Builds a browsable site of the Product Specification, with links from each element to its change, epic and story. "
        "Add a git tag to build the specification as it was at that release.",
        "To read or share the specification. Needs `pip install mkdocs-material`.",
        "veloiq docs site build",
        (DocumentationActionInput("git_tag", "Git tag (optional)", required=False, placeholder="1.4.0",
                                  help_text="Leave empty to build the current state."),),
        (("git_tag", "--git-tag {git_tag}"),)),
)


def find_documentation_action(identifier: str) -> DocumentationAction | None:
    return next((action for action in DOCUMENTATION_ACTIONS if action.identifier == identifier), None)


def build_documentation_command(action: DocumentationAction, values: dict[str, str]) -> str:
    """Return the command line for an action and the developer's values; raise ValueError for a missing or unsafe value."""
    cleaned: dict[str, str] = {}
    for action_input in action.inputs:
        value = (values.get(action_input.key) or "").strip()
        if not value and action_input.required:
            raise ValueError(f"{action_input.label} is required.")
        if value and action_input.is_address and not SAFE_ADDRESS_PATTERN.match(value):
            raise ValueError(f"{action_input.label} must look like http://localhost:8000.")
        if value and not action_input.is_address and not SAFE_ARGUMENT_PATTERN.match(value):
            raise ValueError(f"{action_input.label} may only contain letters, digits, dots, hyphens and underscores.")
        cleaned[action_input.key] = value
    parts = [action.command.format(**cleaned)]
    for input_key, template in action.optional_argument_templates:
        if cleaned.get(input_key):
            parts.append(template.format(**cleaned))
    return " ".join(parts)


@dataclass
class DocumentationStatus:
    installed: bool
    in_progress_changes: list[str]
    applied_changes: list[str]
    element_counts: dict[str, int]
    help_draft_count: int
    latest_git_tag: str
    next_step: str


def _applied_change_name(folder_name: str) -> str:
    return re.sub(r"^\d{4}-\d{2}-\d{2}-", "", folder_name)


def read_documentation_status(project_root: Path) -> DocumentationStatus:
    openspec_root = project_root / OPENSPEC_FOLDER_NAME
    installed = (openspec_root / "config.yaml").exists()
    changes_folder = openspec_root / CHANGES_FOLDER_NAME
    in_progress = sorted(path.name for path in changes_folder.iterdir()
                         if path.is_dir() and path.name != ARCHIVE_FOLDER_NAME) if changes_folder.exists() else []
    archive_folder = changes_folder / ARCHIVE_FOLDER_NAME
    applied = [_applied_change_name(path.name) for path in sorted(archive_folder.iterdir()) if path.is_dir()] if archive_folder.exists() else []
    element_counts: dict[str, int] = {}
    specifications_root = openspec_root / SPECIFICATIONS_FOLDER_NAME
    for element_type in ALL_ELEMENT_TYPES:
        type_folder = specifications_root / element_type
        count = sum(1 for path in type_folder.iterdir() if (path / SPECIFICATION_FILE_NAME).exists()) if type_folder.exists() else 0
        if count:
            element_counts[element_type] = count
    drafts_folder = openspec_root / "help-drafts"
    help_draft_count = len(list(drafts_folder.glob("*.md"))) if drafts_folder.exists() else 0
    described = subprocess.run(["git", "describe", "--tags", "--abbrev=0"], cwd=project_root, capture_output=True, text=True) \
        if (project_root / ".git").exists() else None
    latest_tag = described.stdout.strip() if described is not None and described.returncode == 0 else ""
    return DocumentationStatus(installed, in_progress, applied, element_counts, help_draft_count, latest_tag,
                               _next_step_advice(installed, in_progress, applied, element_counts))


def _next_step_advice(installed: bool, in_progress: list[str], applied: list[str], element_counts: dict[str, int]) -> str:
    if not installed:
        return "Start with 'Set up the documentation workflow'. It installs OpenSpec and the templates in this project."
    if in_progress:
        return (f"Change '{in_progress[0]}' is in progress. Validate it, fix any problem, then apply it once it is approved "
                "and implemented.")
    if not element_counts.get("data-model"):
        return "Generate the data model first: it documents every entity of this application from the code, with no writing."
    if not applied:
        return "Start a change for the next feature or fix, then ask Claude Code to write it with /docs-propose."
    return "Everything applied so far is documented. Start a new change, or build the documentation site to read the specification."
