"""veloiq docs — documentation workflow: OpenSpec for changes and merges, VeloIQ for metadata, data model and help."""
from __future__ import annotations

import subprocess
from pathlib import Path

import click

from veloiq_framework.documentation_workflow.workflow_constants import (
    CHANGES_FOLDER_NAME, CUSTOM_SCHEMA_NAME, OPENSPEC_FOLDER_NAME, SPECIFICATIONS_FOLDER_NAME, UNRELEASED_VERSION_LABEL,
)

PROJECT_ROOT_OPTION = click.option("--root", "-C", "project_root_option", default=None, type=click.Path(exists=True, file_okay=False),
                                   help="Project root (default: auto-detect from the current folder).")


def _resolve_project_root(project_root_option: str | None) -> Path:
    if project_root_option:
        return Path(project_root_option).resolve()
    from veloiq_framework.cli.explorer import _find_project_root
    project_root = _find_project_root()
    if project_root is None:
        raise click.ClickException("Not inside a VeloIQ project (no app/modules/ found).")
    return Path(project_root)


def _resolve_product_version(project_root: Path, product_version: str | None) -> str:
    if product_version:
        return product_version
    described = subprocess.run(["git", "describe", "--tags", "--abbrev=0"], cwd=project_root, capture_output=True, text=True)
    return described.stdout.strip() if described.returncode == 0 and described.stdout.strip() else UNRELEASED_VERSION_LABEL


PRODUCT_VERSION_OPTION = click.option("--product-version", default=None, help="Product version label (default: latest git tag, or 'unreleased').")


@click.group(name="docs")
def docs():
    """Documentation workflow: changes, Product Specification, data model, help and site."""


@docs.command(name="init")
@PROJECT_ROOT_OPTION
def initialize_documentation(project_root_option):
    """Install OpenSpec with the veloiq-docs schema, templates and assistant commands."""
    from veloiq_framework.documentation_workflow.install_documentation_workflow import install_documentation_workflow
    project_root = _resolve_project_root(project_root_option)
    try:
        for done in install_documentation_workflow(project_root):
            click.echo(f"  ✅ {done}")
    except RuntimeError as error:
        raise click.ClickException(str(error))


@docs.group(name="change")
def change():
    """Work with documentation changes."""


@change.command(name="new")
@click.argument("change_name")
@PROJECT_ROOT_OPTION
def create_change(change_name, project_root_option):
    """Create a change folder with the veloiq-docs schema."""
    from veloiq_framework.documentation_workflow.run_openspec_command import run_openspec_command
    project_root = _resolve_project_root(project_root_option)
    from veloiq_framework.documentation_workflow.scaffold_documentation_files import ScaffoldError, prefill_new_change_files
    result = run_openspec_command(project_root, ["new", "change", change_name, "--schema", CUSTOM_SCHEMA_NAME])
    click.echo(result.combined_output)
    if result.exit_code != 0:
        raise SystemExit(result.exit_code)
    try:
        for created in prefill_new_change_files(project_root, change_name):
            click.echo(f"  ✅ {Path(created).relative_to(project_root)}")
    except ScaffoldError as error:
        raise click.ClickException(str(error))
    click.echo("Next: veloiq docs epic new <epic-name> --change " + change_name
               + "   then   veloiq docs story new <story-name> --epic <epic-name> --change " + change_name)


def _echo_created(project_root: Path, created: str) -> None:
    click.echo(f"  ✅ {Path(created).relative_to(project_root)}")


@docs.group(name="epic")
def epic():
    """Epics of a change."""


@epic.command(name="new")
@click.argument("epic_name")
@click.option("--change", "change_name", required=True, help="The change the epic belongs to.")
@PROJECT_ROOT_OPTION
def create_epic_command(epic_name, change_name, project_root_option):
    """Create an epic with its front matter and sections filled in; write the text."""
    from veloiq_framework.documentation_workflow.scaffold_documentation_files import ScaffoldError, create_epic
    project_root = _resolve_project_root(project_root_option)
    try:
        _echo_created(project_root, create_epic(project_root, change_name, epic_name))
    except ScaffoldError as error:
        raise click.ClickException(str(error))
    click.echo("Next: write the goal and the business value, then add its stories with `veloiq docs story new`.")


@docs.group(name="story")
def story():
    """User stories of a change."""


@story.command(name="new")
@click.argument("story_name")
@click.option("--epic", "epic_name", required=True, help="The epic of this change the story belongs to.")
@click.option("--change", "change_name", required=True, help="The change the story belongs to.")
@PROJECT_ROOT_OPTION
def create_story_command(story_name, epic_name, change_name, project_root_option):
    """Create a user story linked to its epic, and list it in the epic; write the text."""
    from veloiq_framework.documentation_workflow.scaffold_documentation_files import ScaffoldError, create_story
    project_root = _resolve_project_root(project_root_option)
    try:
        _echo_created(project_root, create_story(project_root, change_name, story_name, epic_name))
    except ScaffoldError as error:
        raise click.ClickException(str(error))
    click.echo("Next: write the user story and its acceptance criteria, then create the elements it changes with `veloiq docs element new`.")


@docs.group(name="element")
def element():
    """Specification elements (journeys, capabilities, features, rules, ...) that a change adds, modifies or removes."""


@element.command(name="new")
@click.argument("element_type")
@click.argument("element_name")
@click.option("--change", "change_name", required=True, help="The change that adds or modifies the element.")
@click.option("--story", "story_names", multiple=True, help="A story of the change that asks for this element (repeatable).")
@click.option("--capability", "capability_name", default=None, help="Features only: the capability the feature belongs to.")
@PROJECT_ROOT_OPTION
def create_element_command(element_type, element_name, change_name, story_names, capability_name, project_root_option):
    """Create the delta of a specification element with its front matter filled in; write the requirements."""
    from veloiq_framework.documentation_workflow.scaffold_documentation_files import ScaffoldError, create_element_delta
    project_root = _resolve_project_root(project_root_option)
    try:
        _echo_created(project_root, create_element_delta(project_root, change_name, element_type, element_name,
                                                         list(story_names), capability_name))
    except ScaffoldError as error:
        raise click.ClickException(str(error))
    click.echo("Next: write the Purpose and the requirements with their scenarios, then run `veloiq docs change validate "
               + change_name + "`.")


@change.command(name="validate")
@click.argument("change_name")
@PROJECT_ROOT_OPTION
def validate_change(change_name, project_root_option):
    """Run openspec validate, then the VeloIQ checks (names, prerequisites, links)."""
    from veloiq_framework.documentation_workflow.run_openspec_command import run_openspec_command
    from veloiq_framework.documentation_workflow.validate_documentation_change import validate_documentation_change
    project_root = _resolve_project_root(project_root_option)
    openspec_root = project_root / OPENSPEC_FOLDER_NAME
    failed = False
    openspec_result = run_openspec_command(project_root, ["validate", change_name])
    click.echo(openspec_result.combined_output)
    failed = openspec_result.exit_code != 0
    problems = validate_documentation_change(openspec_root / CHANGES_FOLDER_NAME / change_name, openspec_root / SPECIFICATIONS_FOLDER_NAME)
    for problem in problems:
        click.echo(click.style(f"  ✗ {problem}", fg="red"))
    if problems or failed:
        raise SystemExit(1)
    click.echo(click.style("✓ The change passes OpenSpec's validation and the VeloIQ checks.", fg="green"))


@change.command(name="apply")
@click.argument("change_name")
@PRODUCT_VERSION_OPTION
@PROJECT_ROOT_OPTION
def apply_change(change_name, product_version, project_root_option):
    """Merge the change into the Product Specification (openspec archive), then stamp metadata."""
    from veloiq_framework.documentation_workflow.apply_documentation_change import apply_documentation_change
    project_root = _resolve_project_root(project_root_option)
    try:
        result = apply_documentation_change(project_root, change_name, _resolve_product_version(project_root, product_version))
    except RuntimeError as error:
        raise click.ClickException(str(error))
    click.echo(f"  added: {', '.join(result.added) or '-'}\n  modified: {', '.join(result.modified) or '-'}\n  removed: {', '.join(result.removed) or '-'}")


@docs.group(name="spec")
def spec():
    """Generate and check parts of the Product Specification."""


@spec.command(name="generate-data-model")
@PRODUCT_VERSION_OPTION
@PROJECT_ROOT_OPTION
def generate_data_model(product_version, project_root_option):
    """Generate the data model specification from the application's models."""
    from veloiq_framework.documentation_workflow.generate_data_model_specification import generate_data_model_specification
    project_root = _resolve_project_root(project_root_option)
    written, removed = generate_data_model_specification(project_root, _resolve_product_version(project_root, product_version))
    click.echo(f"  ✅ {len(written)} entities written, {len(removed)} stale removed")


@spec.command(name="index-code")
@PROJECT_ROOT_OPTION
def index_code(project_root_option):
    """Find the code markers and write implemented-by and the reverse views."""
    from veloiq_framework.documentation_workflow.index_code_markers_for_specifications import index_code_for_specifications
    result = index_code_for_specifications(_resolve_project_root(project_root_option))
    click.echo(f"  ✅ {sum(len(references) for references in result.references_by_element.values())} markers indexed")
    for problem in result.unresolved_markers + result.ambiguous_markers:
        click.echo(click.style(f"  ⚠️  {problem}", fg="yellow"))


@spec.command(name="check")
@PROJECT_ROOT_OPTION
def check_specification(project_root_option):
    """Fail when the data model or the code references differ from the code."""
    from veloiq_framework.documentation_workflow.generate_data_model_specification import check_data_model_specification
    from veloiq_framework.documentation_workflow.index_code_markers_for_specifications import check_code_markers
    project_root = _resolve_project_root(project_root_option)
    problems = check_data_model_specification(project_root) + check_code_markers(project_root)
    for problem in problems:
        click.echo(click.style(f"  ✗ {problem}", fg="red"))
    if problems:
        raise SystemExit(1)
    click.echo(click.style("✓ The specification matches the code.", fg="green"))


@docs.group(name="help")
def help_group():
    """Help documents derived from the specification."""


@help_group.command(name="sync")
@click.argument("change_name")
@click.option("--overwrite", is_flag=True, help="Replace existing drafts (a reviewed draft is never replaced).")
@PROJECT_ROOT_OPTION
def sync_help(change_name, overwrite, project_root_option):
    """Draft help documents for the features and journeys of an applied change."""
    from veloiq_framework.documentation_workflow.draft_help_documents_from_features import sync_help_documents_for_change
    try:
        written, skipped = sync_help_documents_for_change(_resolve_project_root(project_root_option), change_name, overwrite)
    except RuntimeError as error:
        raise click.ClickException(str(error))
    for draft in written:
        click.echo(f"  ✅ {draft}")
    for draft in skipped:
        click.echo(click.style(f"  ⏭️  {draft}", fg="yellow"))
    click.echo(f"{len(written)} help drafts written, {len(skipped)} kept. "
               "Next: list the help pages (page_keys), actions and screenshots in each draft, then set `status: reviewed`.")


@help_group.command(name="screenshots")
@click.option("--base-url", default="http://localhost:8000", show_default=True, help="Address of the running application.")
@click.option("--username", default="admin", show_default=True, help="User that logs in to take the screenshots.")
@PROJECT_ROOT_OPTION
def capture_screenshots(base_url, username, project_root_option):
    """Capture the screenshots listed in the drafts, from a running app (password: VELOIQ_DOCS_PASSWORD or a prompt)."""
    import os
    import sys
    from veloiq_framework.documentation_workflow.capture_help_screenshots import (
        PlaywrightUnavailableError, capture_help_screenshots,
    )
    password = os.environ.get("VELOIQ_DOCS_PASSWORD")
    if not password:
        if not sys.stdin.isatty():
            raise click.ClickException("Set the VELOIQ_DOCS_PASSWORD environment variable: there is no terminal to ask for the password.")
        password = click.prompt(f"Password of {username}", hide_input=True)
    try:
        written = capture_help_screenshots(_resolve_project_root(project_root_option), base_url, username, password)
    except (PlaywrightUnavailableError, OSError, KeyError) as error:
        raise click.ClickException(f"Could not capture screenshots: {error}")
    for screenshot in written:
        click.echo(f"  ✅ {screenshot}")
    click.echo(f"{len(written)} screenshots captured." if written else "No draft lists any screenshots.")


@help_group.command(name="import")
@click.option("--include-unreviewed", is_flag=True, help="Also import drafts whose status is still draft.")
@click.option("--dry-run", is_flag=True, help="Show what would change without writing to the database.")
@PROJECT_ROOT_OPTION
def import_help(include_unreviewed, dry_run, project_root_option):
    """Import reviewed drafts into the application's help documents (veloiq_help_document)."""
    from veloiq_framework.documentation_workflow.import_help_documents import import_help_documents
    try:
        report = import_help_documents(_resolve_project_root(project_root_option), include_unreviewed, dry_run)
    except RuntimeError as error:
        raise click.ClickException(str(error))
    label = "Would " if dry_run else ""
    for page_key in report.created_documents:
        click.echo(f"  ✅ {label}create help document {page_key}")
    for page_key in report.updated_documents:
        click.echo(f"  ✅ {label}update help document {page_key}")
    for action in report.added_actions:
        click.echo(f"  ✅ {label}add action {action}")
    for skipped in report.skipped:
        click.echo(click.style(f"  ⏭️  {skipped}", fg="yellow"))
    if not (report.created_documents or report.updated_documents):
        click.echo("Nothing imported.")


@docs.group(name="site")
def site():
    """Documentation site of the Product Specification."""


@site.command(name="build")
@PRODUCT_VERSION_OPTION
@click.option("--git-tag", default=None, help="Build from the specification as it was at this git tag.")
@PROJECT_ROOT_OPTION
def build_site(product_version, git_tag, project_root_option):
    """Build the documentation site for a product version (MkDocs Material)."""
    from veloiq_framework.documentation_workflow.build_documentation_site import build_documentation_site
    project_root = _resolve_project_root(project_root_option)
    version = product_version or git_tag or _resolve_product_version(project_root, None)
    try:
        click.echo(build_documentation_site(project_root, version, git_tag))
    except RuntimeError as error:
        raise click.ClickException(str(error))
