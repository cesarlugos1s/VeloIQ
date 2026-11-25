"""Tests of the documentation workflow (`veloiq docs`): front matter, checks, stamping, code markers, help, site, data model."""
from __future__ import annotations

import shutil
import sys
from datetime import date
from pathlib import Path

import pytest
from click.testing import CliRunner

from veloiq_framework.documentation_workflow.apply_documentation_change import (
    StampResult, append_changelog_entry, list_delta_elements, prepare_change_for_archive, resolve_prerequisites,
    stamp_specification_metadata,
)
from veloiq_framework.documentation_workflow.build_documentation_site import stage_documentation_site
from veloiq_framework.documentation_workflow.draft_help_documents_from_features import draft_help_document
from veloiq_framework.documentation_workflow.index_code_markers_for_specifications import (
    check_code_markers, index_code_for_specifications, scan_code_markers,
)
from veloiq_framework.documentation_workflow.specification_front_matter import join_front_matter, split_front_matter
from veloiq_framework.documentation_workflow.validate_documentation_change import validate_documentation_change

TODAY = date(2026, 11, 25)
SPEC_BODY = "## Purpose\n\nWhat it is for.\n\n## ADDED Requirements\n\n### Requirement: Do it\nThe system SHALL do it.\n\n#### Scenario: Done\n- **WHEN** a\n- **THEN** b\n"


def write_file(path: Path, text: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return path


def write_element(root: Path, element_type: str, name: str, front_matter: dict | None = None, body: str = SPEC_BODY) -> Path:
    return write_file(root / "specs" / element_type / name / "spec.md", join_front_matter(front_matter or {}, body))


def test_front_matter_round_trip_and_file_without_front_matter():
    text = join_front_matter({"name": "x", "requires": ["a", "b"]}, "body\n")
    assert split_front_matter(text) == ({"name": "x", "requires": ["a", "b"]}, "body\n")
    assert split_front_matter("no front matter\n") == ({}, "no front matter\n")


def test_validation_accepts_a_correct_change(tmp_path):
    change = tmp_path / "changes" / "c"
    write_file(change / "epics" / "team-balance.md", join_front_matter({"name": "team-balance"}, "x"))
    write_file(change / "stories" / "manager-sees-load.md", join_front_matter({"epic": "team-balance"}, "x"))
    write_element(change, "capabilities", "task-assignment", {"stories": ["manager-sees-load"]})
    write_element(change, "features", "bulk-reassign-tasks", {"capability": "task-assignment", "stories": ["manager-sees-load"]})
    assert validate_documentation_change(change, tmp_path / "specs") == []


def test_validation_reports_numbered_names_missing_links_cycles_and_data_model_deltas(tmp_path):
    change = tmp_path / "changes" / "c"
    write_file(change / "stories" / "story-1.md", join_front_matter({"name": "story-1"}, "x"))
    write_element(change, "features", "feat-12", {"stories": ["unknown-story"]})
    write_element(change, "business-rules", "rule-a", {"requires": ["rule-b"]})
    write_element(change, "business-rules", "rule-b", {"requires": ["rule-a"]})
    write_element(change, "data-model", "Task")
    messages = " | ".join(str(problem) for problem in validate_documentation_change(change, tmp_path / "specs"))
    assert "stories/story-1.md: name must be descriptive" in messages
    assert "front matter key `epic` is missing" in messages
    assert "specs/features/feat-12: name must be descriptive" in messages
    assert "needs the front matter key `capability`" in messages
    assert "story `unknown-story` is not a story of this change" in messages
    assert "circular requirement" in messages
    assert "the data model is generated from the code" in messages


def test_modified_feature_takes_its_capability_from_the_existing_specification(tmp_path):
    write_element(tmp_path, "features", "bulk-reassign-tasks", {"capability": "task-assignment"})
    write_element(tmp_path, "capabilities", "task-assignment")
    change = tmp_path / "changes" / "c"
    write_element(change, "features", "bulk-reassign-tasks", {}, "## MODIFIED Requirements\n\n### Requirement: Do it\nThe system SHALL do more.\n")
    assert validate_documentation_change(change, tmp_path / "specs") == []


def make_change_with_inheritance(change: Path) -> None:
    write_file(change / "epics" / "team-balance.md", join_front_matter({"requires": ["task-assignment"], "prerequisites": ["The recruiter role exists"]}, "x"))
    write_file(change / "stories" / "manager-sees-load.md", join_front_matter(
        {"epic": "team-balance", "prerequisites": ["The team has members"], "not-applicable": [{"item": "The recruiter role exists", "reason": "no recruiters here"}]}, "x"))
    write_file(change / "stories" / "manager-moves-tasks.md", join_front_matter({"epic": "team-balance"}, "x"))


def test_prerequisites_are_inherited_from_epic_through_story_and_can_be_marked_not_applicable(tmp_path):
    change = tmp_path / "c"
    make_change_with_inheritance(change)
    write_element(change, "features", "bulk-reassign-tasks", {"stories": ["manager-sees-load", "manager-moves-tasks"]})
    delta = list_delta_elements(change)[0]
    required, statements = resolve_prerequisites(change, delta)
    assert required == ["task-assignment"]
    assert [(entry["text"], entry["inherited-from"]) for entry in statements] == [
        ("The team has members", "story manager-sees-load"), ("The recruiter role exists", "epic team-balance")]


def test_prerequisites_stated_in_the_delta_replace_the_inherited_ones(tmp_path):
    change = tmp_path / "c"
    make_change_with_inheritance(change)
    write_element(change, "features", "bulk-reassign-tasks", {"stories": ["manager-moves-tasks"], "prerequisites": ["Own statement"]})
    required, statements = resolve_prerequisites(change, list_delta_elements(change)[0])
    assert required == [] and statements == [{"text": "Own statement", "inherited-from": "delta bulk-reassign-tasks"}]


def test_stamping_creates_and_updates_front_matter_and_copies_extra_files(tmp_path):
    archived = tmp_path / "archive" / "2026-11-25-first"
    make_change_with_inheritance(archived)
    write_element(archived, "features", "bulk-reassign-tasks", {"capability": "task-assignment", "stories": ["manager-moves-tasks"]})
    write_file(archived / "specs" / "features" / "bulk-reassign-tasks" / "journey.json", "{}")
    specifications_root = tmp_path / "specs"
    write_element(tmp_path, "features", "bulk-reassign-tasks", {}, "# body kept\n")  # what OpenSpec leaves after a new spec: no front matter

    first = stamp_specification_metadata(archived, specifications_root, "first", "0.1.0", TODAY)
    assert first.added == ["features/bulk-reassign-tasks"]
    stamped, body = split_front_matter((specifications_root / "features" / "bulk-reassign-tasks" / "spec.md").read_text())
    assert body == "# body kept\n"
    assert list(stamped)[:3] == ["name", "type", "capability"]
    assert stamped["type"] == "feature" and stamped["created-in-version"] == "0.1.0"
    assert stamped["origin"] == {"changes": ["first"], "epics": ["team-balance"], "stories": ["manager-moves-tasks"]}
    assert (specifications_root / "features" / "bulk-reassign-tasks" / "journey.json").exists()

    second_archive = tmp_path / "archive" / "2026-12-01-second"
    write_file(second_archive / "stories" / "other-story.md", join_front_matter({"epic": "other-epic"}, "x"))
    write_element(second_archive, "features", "bulk-reassign-tasks", {"stories": ["other-story"]})
    second = stamp_specification_metadata(second_archive, specifications_root, "second", "0.2.0", date(2026, 12, 1))
    assert second.modified == ["features/bulk-reassign-tasks"]
    updated, _ = split_front_matter((specifications_root / "features" / "bulk-reassign-tasks" / "spec.md").read_text())
    assert updated["created-in-version"] == "0.1.0" and updated["last-changed-in-version"] == "0.2.0"
    assert updated["origin"]["changes"] == ["first", "second"] and updated["origin"]["epics"] == ["team-balance", "other-epic"]
    assert updated["capability"] == "task-assignment"


def test_stamping_removes_the_leftover_folder_of_a_retired_element(tmp_path):
    archived = tmp_path / "archive" / "2026-11-25-rename"
    write_element(archived, "business-rules", "old-rule", {}, "## REMOVED Requirements\n\n### Requirement: X\n**Reason**: renamed\n")
    leftover = write_file(tmp_path / "specs" / "business-rules" / "old-rule" / "rule.json", "{}")
    result = stamp_specification_metadata(archived, tmp_path / "specs", "rename", "0.2.0", TODAY)
    assert result.removed == ["business-rules/old-rule"] and not leftover.parent.exists()


def test_prepare_strips_front_matter_of_removed_elements_and_sets_retire_flag(tmp_path):
    change = tmp_path / "changes" / "rename"
    write_element(change, "business-rules", "old-rule", {}, "## REMOVED Requirements\n\n### Requirement: X\n**Reason**: r\n")
    write_file(change / ".openspec.yaml", "schema: veloiq-docs\n")
    main = write_element(tmp_path, "business-rules", "old-rule", {"name": "old-rule", "created": "2026-01-01"}, "# body\n")
    prepare_change_for_archive(change, tmp_path / "specs")
    assert split_front_matter(main.read_text())[0] == {}
    assert "retire_capabilities: true" in (change / ".openspec.yaml").read_text()


def test_changelog_lists_newest_version_first_and_groups_entries_by_version(tmp_path):
    append_changelog_entry(tmp_path, "first", "0.1.0", TODAY, StampResult(added=["features/a"]))
    append_changelog_entry(tmp_path, "second", "0.2.0", TODAY, StampResult(modified=["features/a"], removed=["features/b"]))
    append_changelog_entry(tmp_path, "third", "0.2.0", TODAY, StampResult())
    lines = (tmp_path / "CHANGELOG.md").read_text().splitlines()
    assert lines.index("## 0.2.0") < lines.index("## 0.1.0")
    assert lines[lines.index("## 0.2.0") + 2].startswith("- third")
    assert any("modified features/a; removed features/b" in line for line in lines)


def make_project_with_marked_code(root: Path) -> None:
    write_element(root / "openspec", "features", "bulk-reassign-tasks", {"name": "bulk-reassign-tasks", "origin": {"epics": ["team-balance"]}})
    write_file(root / "backend" / "app" / "modules" / "tasks" / "custom_api.py",
               "# spec: bulk-reassign-tasks\n@router.post('/x')\nasync def reassign_tasks_in_bulk():\n    pass\n\n# spec: missing-element\ndef orphan():\n    pass\n")
    write_file(root / "frontend" / "src" / "pages" / "tasks" / "BulkDialog.tsx",
               "// spec: features/bulk-reassign-tasks\nexport const BulkReassignDialog = () => null;\n")


def test_code_markers_are_resolved_unresolved_ones_are_reported_and_front_matter_is_indexed(tmp_path):
    make_project_with_marked_code(tmp_path)
    result = scan_code_markers(tmp_path)
    assert set(result.references_by_element) == {"features/bulk-reassign-tasks"}
    assert len(result.unresolved_markers) == 1 and "missing-element" in result.unresolved_markers[0]
    assert any("out of date" in problem for problem in check_code_markers(tmp_path))

    index_code_for_specifications(tmp_path)
    front_matter, _ = split_front_matter((tmp_path / "openspec" / "specs" / "features" / "bulk-reassign-tasks" / "spec.md").read_text())
    assert front_matter["implemented-by"] == {
        "functions": ["backend/app/modules/tasks/custom_api.py::reassign_tasks_in_bulk"],
        "components": ["frontend/src/pages/tasks/BulkDialog.tsx::BulkReassignDialog"]}
    assert "tasks" in (tmp_path / "openspec" / "reverse-views" / "implemented-by-module.md").read_text()
    assert "team-balance" in (tmp_path / "openspec" / "reverse-views" / "implemented-by-epic.md").read_text()
    assert check_code_markers(tmp_path) == [problem for problem in check_code_markers(tmp_path) if "missing-element" in problem]


def test_help_draft_is_built_from_purpose_requirements_and_scenarios():
    draft = draft_help_document("bulk-reassign-tasks", join_front_matter({"name": "x"}, SPEC_BODY), "features/bulk-reassign-tasks")
    front_matter, body = split_front_matter(draft)
    assert front_matter == {"page_keys": [], "source-element": "features/bulk-reassign-tasks", "status": "draft", "screenshots": []}
    for expected in ("# Bulk reassign tasks", "What it is for.", "## Do it", "The system SHALL do it.", "**Done**", "## Actions", "## Screenshots"):
        assert expected in body


def test_site_staging_writes_pages_with_metadata_table_navigation_and_mermaid_configuration(tmp_path):
    openspec_folder = tmp_path / "openspec"
    write_element(openspec_folder, "features", "bulk-reassign-tasks", {"type": "feature", "created": "2026-11-25"})
    write_file(openspec_folder / "CHANGELOG.md", "# Changelog\n")
    configuration = stage_documentation_site(openspec_folder, tmp_path / "build", "Demo 0.1.0")
    page = (tmp_path / "build" / "docs" / "features" / "bulk-reassign-tasks.md").read_text()
    assert "| created | 2026-11-25 |" in page and "## Purpose" in page
    configuration_text = configuration.read_text()
    assert "name: material" in configuration_text and "mermaid" in configuration_text and "features/bulk-reassign-tasks.md" in configuration_text


def test_site_links_origin_prerequisites_and_relations_to_their_pages(tmp_path):
    openspec_folder = tmp_path / "openspec"
    archived = openspec_folder / "changes" / "archive" / "2026-11-25-add-feature"
    write_file(archived / "proposal.md", "## Why\n\nx\n")
    write_file(archived / "epics" / "the-epic.md", join_front_matter({"name": "the-epic", "change": "add-feature"}, "## Goal\nx\n\n## User stories\n\n- the-story\n- not-a-known-story\n"))
    write_file(archived / "stories" / "the-story.md", join_front_matter({"epic": "the-epic", "change": "add-feature"}, "## User story\nx\n\n## Specification elements this story changes\n\n- features/do-it\n"))
    write_element(archived, "features", "do-it", {"capability": "the-capability"})
    write_element(openspec_folder, "capabilities", "the-capability", {"type": "capability"})
    write_element(openspec_folder, "features", "do-it", {
        "type": "feature", "capability": "the-capability", "requires": ["the-capability"],
        "origin": {"changes": ["add-feature"], "epics": ["the-epic"], "stories": ["the-story", "unknown-story"]},
        "prerequisites": [{"text": "A role exists", "inherited-from": "epic the-epic"}]})
    write_file(openspec_folder / "reverse-views" / "implemented-by-epic.md", "# Specification elements by epic\n\n## the-epic\n\n- features/do-it\n- features/missing\n")
    write_element(openspec_folder, "features", "second-feature", {"type": "feature", "capability": "the-capability"})
    write_element(openspec_folder, "capabilities", "lonely-capability", {"type": "capability"})
    stage_documentation_site(openspec_folder, tmp_path / "build", "Demo")
    docs = tmp_path / "build" / "docs"
    capability_page = (docs / "capabilities" / "the-capability.md").read_text()
    assert "## Features of this capability" in capability_page
    assert "- [do-it](../features/do-it.md)\n- [second-feature](../features/second-feature.md)" in capability_page
    assert "No feature is specified for this capability yet." in (docs / "capabilities" / "lonely-capability.md").read_text()
    reverse_view = (docs / "implemented-by-epic.md").read_text()
    assert "## [the-epic](changes/add-feature/epics/the-epic.md)" in reverse_view
    assert "- [features/do-it](features/do-it.md)" in reverse_view and "- features/missing" in reverse_view
    feature_page = (docs / "features" / "do-it.md").read_text()
    assert "[add-feature](../changes/add-feature/index.md)" in feature_page
    assert "[the-epic](../changes/add-feature/epics/the-epic.md)" in feature_page
    assert "[the-story](../changes/add-feature/stories/the-story.md), unknown-story" in feature_page
    assert "[the-capability](../capabilities/the-capability.md)" in feature_page
    assert "A role exists (epic [the-epic](../changes/add-feature/epics/the-epic.md))" in feature_page
    story_page = (docs / "changes" / "add-feature" / "stories" / "the-story.md").read_text()
    assert "[the-epic](../epics/the-epic.md)" in story_page and "[add-feature](../index.md)" in story_page
    epic_page = (docs / "changes" / "add-feature" / "epics" / "the-epic.md").read_text()
    assert "- [the-story](../stories/the-story.md)" in epic_page and "- not-a-known-story" in epic_page
    assert "- [features/do-it](../../../features/do-it.md)" in story_page
    index_page = (docs / "changes" / "add-feature" / "index.md").read_text()
    assert "[do-it](../../features/do-it.md) (features)" in index_page
    assert "Changes:" in (tmp_path / "build" / "mkdocs.yml").read_text()


def test_cli_group_lists_every_documented_command():
    from veloiq_framework.cli.main import cli
    output = CliRunner().invoke(cli, ["docs", "--help"]).output
    for command_name in ("init", "change", "spec", "help", "site"):
        assert command_name in output
    spec_output = CliRunner().invoke(cli, ["docs", "spec", "--help"]).output
    assert "generate-data-model" in spec_output and "index-code" in spec_output and "check" in spec_output


def _application_module_names() -> list[str]:
    return [name for name in sys.modules if name == "app" or name.startswith("app.")]


def _forget_shop_tables() -> None:
    from sqlmodel import SQLModel
    for table_name in ("docs_shop_order", "docs_shop_customer"):
        if table_name in SQLModel.metadata.tables:
            SQLModel.metadata.remove(SQLModel.metadata.tables[table_name])


@pytest.fixture
def shop_project(tmp_path):
    """A one-module application whose models are imported as app.modules.docs_shop.models.

    Other tests may have imported their own `app` package, so it is set aside during this test and put back afterwards."""
    set_aside = {name: sys.modules.pop(name) for name in _application_module_names()}
    _forget_shop_tables()
    module_folder = tmp_path / "backend" / "app" / "modules" / "docs_shop"
    write_file(tmp_path / "backend" / "app" / "__init__.py", "")
    write_file(tmp_path / "backend" / "app" / "modules" / "__init__.py", "")
    write_file(module_folder / "__init__.py", "")
    write_file(module_folder / "models.py", '''
from typing import List, Optional
from sqlalchemy import UniqueConstraint
from sqlmodel import Field, Relationship, SQLModel


class DocsShopCustomer(SQLModel, table=True):
    """A person who buys from the shop"""
    __tablename__ = "docs_shop_customer"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(description="Customer name", max_length=80)
    orders: List["DocsShopOrder"] = Relationship(back_populates="customer")


class DocsShopOrder(SQLModel, table=True):
    """An order placed by one customer"""
    __tablename__ = "docs_shop_order"
    __table_args__ = (UniqueConstraint("number", "customer_id"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    number: str = Field(description="Order number")
    status: str = Field(default="open", description="Where the order is")
    customer_id: int = Field(foreign_key="docs_shop_customer.id")
    customer: Optional[DocsShopCustomer] = Relationship(back_populates="orders")
''')
    yield tmp_path
    for name in _application_module_names():
        del sys.modules[name]
    sys.modules.update(set_aside)
    _forget_shop_tables()
    sys.path[:] = [entry for entry in sys.path if entry != str(tmp_path / "backend")]


def test_data_model_is_generated_from_the_models_and_drift_is_detected(shop_project):
    from veloiq_framework.documentation_workflow.generate_data_model_specification import (
        check_data_model_specification, generate_data_model_specification,
    )
    written, removed = generate_data_model_specification(shop_project, "0.1.0", TODAY)
    assert written == ["DocsShopCustomer", "DocsShopOrder"] and removed == []
    front_matter, body = split_front_matter((shop_project / "openspec/specs/data-model/DocsShopOrder/spec.md").read_text())
    assert front_matter["type"] == "entity" and front_matter["generated"] is True
    assert "An order placed by one customer" in body
    assert "| status | text | yes | no | open |  | Where the order is |" in body
    assert "| number | text | yes | with customer_id | none |" in body
    assert "| DocsShopOrder.customer | DocsShopCustomer | many-to-one | exactly 1 | 0 to many |" in body
    assert "DocsShopOrder }o--|| DocsShopCustomer : customer" in body
    customer_body = split_front_matter((shop_project / "openspec/specs/data-model/DocsShopCustomer/spec.md").read_text())[1]
    assert "| DocsShopCustomer.orders | DocsShopOrder | one-to-many | 0 to many | exactly 1 |" in customer_body
    assert check_data_model_specification(shop_project) == []

    order_file = shop_project / "openspec/specs/data-model/DocsShopOrder/spec.md"
    order_file.write_text(order_file.read_text().replace("Where the order is", "Edited by hand"))
    assert check_data_model_specification(shop_project) == ["data-model/DocsShopOrder differs from the code"]


@pytest.mark.skipif(shutil.which("npx") is None, reason="Node's npx is needed to run OpenSpec")
def test_full_loop_with_openspec_init_validate_apply_rename_and_modify(tmp_path):
    from veloiq_framework.documentation_workflow.apply_documentation_change import apply_documentation_change
    from veloiq_framework.documentation_workflow.install_documentation_workflow import install_documentation_workflow
    from veloiq_framework.documentation_workflow.run_openspec_command import run_openspec_command

    install_documentation_workflow(tmp_path)
    run_openspec_command(tmp_path, ["new", "change", "add-feature", "--schema", "veloiq-docs"])
    change = tmp_path / "openspec" / "changes" / "add-feature"
    why = "## Why\n\nA reason that is long enough to pass the length check of the proposal.\n\n## What Changes\n\n- x\n\n## Capabilities\n\n### New Capabilities\n\n- `features/do-it`: x\n\n### Modified Capabilities\n\n## Impact\n\nx\n"
    write_file(change / "proposal.md", why)
    write_file(change / "epics" / "the-epic.md", join_front_matter({"name": "the-epic", "prerequisites": ["A role exists"]}, "## Goal\nx\n"))
    write_file(change / "stories" / "the-story.md", join_front_matter({"epic": "the-epic"}, "## User story\nx\n"))
    write_element(change, "capabilities", "the-capability", {"stories": ["the-story"]})
    write_element(change, "features", "do-it", {"capability": "the-capability", "stories": ["the-story"]})
    write_file(change / "specs" / "features" / "do-it" / "extra.json", "{}")
    write_file(change / "design" / "high-level-design.md", "x\n")
    write_file(change / "design" / "low-level-design" / "component.md", "x\n")
    write_file(change / "tasks.md", "## 1. Work\n\n- [x] 1.1 done\n")

    result = apply_documentation_change(tmp_path, "add-feature", "0.1.0", TODAY)
    assert sorted(result.added) == ["capabilities/the-capability", "features/do-it"]
    feature_front_matter, feature_body = split_front_matter((tmp_path / "openspec/specs/features/do-it/spec.md").read_text())
    assert feature_front_matter["origin"]["epics"] == ["the-epic"]
    assert feature_front_matter["prerequisites"][0]["inherited-from"] == "epic the-epic"
    assert "### Requirement: Do it" in feature_body and (tmp_path / "openspec/specs/features/do-it/extra.json").exists()
    assert list((tmp_path / "openspec/changes/archive").glob("*-add-feature"))

    run_openspec_command(tmp_path, ["new", "change", "rename-it", "--schema", "veloiq-docs"])
    rename = tmp_path / "openspec" / "changes" / "rename-it"
    write_file(rename / "proposal.md", why.replace("features/do-it", "features/do-it-better"))
    write_file(rename / "epics" / "rename-epic.md", join_front_matter({"name": "rename-epic"}, "x"))
    write_file(rename / "stories" / "rename-story.md", join_front_matter({"epic": "rename-epic"}, "x"))
    write_element(rename, "features", "do-it", {}, "## REMOVED Requirements\n\n### Requirement: Do it\n**Reason**: renamed\n**Migration**: use do-it-better\n")
    write_element(rename, "features", "do-it-better", {"capability": "the-capability", "stories": ["rename-story"]})
    write_file(rename / "design" / "high-level-design.md", "x\n")
    write_file(rename / "design" / "low-level-design" / "component.md", "x\n")
    write_file(rename / "tasks.md", "## 1. Work\n\n- [x] 1.1 done\n")
    renamed = apply_documentation_change(tmp_path, "rename-it", "0.2.0", TODAY)
    assert renamed.removed == ["features/do-it"] and renamed.added == ["features/do-it-better"]
    assert not (tmp_path / "openspec/specs/features/do-it").exists()
    assert (tmp_path / "openspec/specs/features/do-it-better/spec.md").exists()


# ── Developer-facing guides: the shared actions, the terminal explorer and VeloIQ Studio ─────────────────────────

def test_actions_build_safe_commands_and_reject_unsafe_values():
    from veloiq_framework.documentation_workflow.documentation_workflow_guide import (
        DOCUMENTATION_ACTIONS, build_documentation_command, find_documentation_action,
    )
    apply_action = find_documentation_action("apply")
    assert build_documentation_command(apply_action, {"change_name": "add-x", "product_version": "1.4.0"}) == \
        "veloiq docs change apply add-x --product-version 1.4.0"
    assert build_documentation_command(apply_action, {"change_name": "add-x"}) == "veloiq docs change apply add-x"
    assert build_documentation_command(find_documentation_action("site"), {"git_tag": "0.1.0"}) == "veloiq docs site build --git-tag 0.1.0"
    with pytest.raises(ValueError, match="required"):
        build_documentation_command(apply_action, {"change_name": " "})
    with pytest.raises(ValueError, match="may only contain"):
        build_documentation_command(apply_action, {"change_name": "x; rm -rf /"})
    screenshots = find_documentation_action("help-screenshots")
    assert build_documentation_command(screenshots, {"base_url": "http://localhost:8001", "username": "admin"}) == \
        "veloiq docs help screenshots --base-url http://localhost:8001 --username admin"
    assert build_documentation_command(screenshots, {}) == "veloiq docs help screenshots"
    with pytest.raises(ValueError, match="must look like"):
        build_documentation_command(screenshots, {"base_url": "file:///etc/passwd"})
    keys = [action.key for action in DOCUMENTATION_ACTIONS]
    assert len(set(keys)) == len(keys) and not set(keys) & {"j", "k", "b", "q"}


def test_status_gives_the_next_step_for_each_stage_of_the_workflow(tmp_path):
    from veloiq_framework.documentation_workflow.documentation_workflow_guide import read_documentation_status
    assert not read_documentation_status(tmp_path).installed
    assert "Set up the documentation workflow" in read_documentation_status(tmp_path).next_step
    write_file(tmp_path / "openspec" / "config.yaml", "schema: veloiq-docs\n")
    assert "data model" in read_documentation_status(tmp_path).next_step
    write_element(tmp_path / "openspec", "data-model", "Task")
    assert "Start a change" in read_documentation_status(tmp_path).next_step
    (tmp_path / "openspec" / "changes" / "add-x").mkdir(parents=True)
    (tmp_path / "openspec" / "changes" / "archive" / "2026-11-25-old-change").mkdir(parents=True)
    status = read_documentation_status(tmp_path)
    assert status.in_progress_changes == ["add-x"] and status.applied_changes == ["old-change"]
    assert status.element_counts == {"data-model": 1} and "add-x" in status.next_step


def test_terminal_explorer_documentation_screen_asks_for_values_and_builds_the_command(tmp_path, monkeypatch):
    import curses
    from veloiq_framework.cli.explorer import AppData, Explorer, _Frame
    write_file(tmp_path / "openspec" / "config.yaml", "schema: veloiq-docs\n")
    (tmp_path / "openspec" / "changes" / "add-x").mkdir(parents=True)
    explorer = Explorer(AppData(name="demo", root=tmp_path))
    explorer.nav.append(_Frame("docs"))
    asked: list[str] = []
    monkeypatch.setattr(explorer, "_get_input", lambda stdscr, max_y, max_x, prompt, default="": asked.append(prompt) or (default or "1.4.0"))
    monkeypatch.setattr(explorer, "_confirm", lambda *arguments: True)

    assert explorer._handle(ord("v"), None, 40, 120) == "veloiq docs change validate add-x"
    assert "add-x" in asked[0]
    assert explorer._handle(ord("a"), None, 40, 120) == "veloiq docs change apply add-x --product-version 1.4.0"
    assert explorer._handle(ord("d"), None, 40, 120) == "veloiq docs spec generate-data-model"
    assert explorer._handle(ord("n"), None, 40, 120) == "veloiq docs change new 1.4.0"
    assert explorer._handle(ord("h"), None, 40, 120) is None and "No applied change" in explorer._docs_message


def test_terminal_explorer_blocks_actions_until_the_workflow_is_set_up(tmp_path, monkeypatch):
    from veloiq_framework.cli.explorer import AppData, Explorer, _Frame
    explorer = Explorer(AppData(name="demo", root=tmp_path))
    explorer.nav.append(_Frame("docs"))
    monkeypatch.setattr(explorer, "_confirm", lambda *arguments: True)
    assert explorer._handle(ord("d"), None, 40, 120) is None and "press [i]" in explorer._docs_message
    assert explorer._handle(ord("i"), None, 40, 120) == "veloiq docs init"


def test_home_menu_opens_the_documentation_screen():
    import curses
    from veloiq_framework.cli.explorer import AppData, Explorer
    explorer = Explorer(AppData(name="demo", root=Path("/nonexistent")))
    explorer._handle(ord("d"), None, 40, 120)
    assert explorer._f.screen == "docs"
    explorer.nav.pop()
    explorer._f.cursor = 3
    explorer._handle(ord("\n"), None, 40, 120)
    assert explorer._f.screen == "docs"


def test_studio_allows_only_the_documentation_commands_with_safe_arguments():
    from veloiq_framework.studio.router import _is_allowed_command
    for command in ("veloiq docs help import --dry-run", "veloiq docs help screenshots --base-url http://localhost:8001 --username admin",
                    "veloiq docs init", "veloiq docs change new add-x", "veloiq docs change apply add-x --product-version 1.4.0",
                    "veloiq docs spec generate-data-model", "veloiq docs help sync add-x", "veloiq docs site build --git-tag 0.1.0"):
        assert _is_allowed_command(command), command
    for command in ("veloiq docs help screenshots --base-url file:///etc/passwd", "veloiq docs help import --root /etc",
                    "veloiq docs change new x --root /etc", "veloiq docs change apply x; rm -rf /", "veloiq docs change new $(id)",
                    "veloiq docs bogus", "veloiq docs spec check --evil"):
        assert not _is_allowed_command(command), command


def test_studio_documentation_endpoint_returns_actions_and_status(tmp_path, monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from veloiq_framework.auth.utils import create_access_token
    from veloiq_framework.config import VeloIQConfig
    from veloiq_framework.studio import router as studio_router

    configuration = VeloIQConfig(auth_secret="studio-test-secret")
    monkeypatch.setattr(studio_router, "_get_root", lambda: tmp_path)
    write_file(tmp_path / "openspec" / "config.yaml", "schema: veloiq-docs\n")
    application = FastAPI()
    application.include_router(studio_router.make_studio_router(configuration))
    client = TestClient(application)
    assert client.get("/veloiq-studio/api/documentation").status_code == 401
    token = create_access_token({"sub": "admin", "roles": ["Admin"]}, "studio-test-secret")
    response = client.get("/veloiq-studio/api/documentation", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    body = response.json()
    assert [action["identifier"] for action in body["actions"]][:3] == ["install", "new-change", "validate"]
    apply_action = next(action for action in body["actions"] if action["identifier"] == "apply")
    assert apply_action["inputs"][0]["source"] == "in_progress_changes" and apply_action["when_to_use"]
    assert body["status"]["installed"] is True


# ── Help documents: the draft contract, the import and the screenshots ───────────────────────────────────────────

HELP_DRAFT = """---
page_keys: [job_posting:show]
source-element: features/generate-public-application-link
status: reviewed
screenshots: [{file: job-posting-show.png, route: /job_posting/show/1, caption: A vacancy}]
---
# Generate public application link

Give each vacancy a public application link.

## Public application link

The system SHALL generate a public application link for each vacancy.

## Actions

<!-- comment -->
- go_to_edit: Edit the vacancy
- not_a_real_action: Nothing

## Screenshots

![A vacancy](/help-screenshots/job-posting-show.png)
"""


def test_help_draft_parses_into_page_keys_actions_screenshots_and_problems():
    from veloiq_framework.documentation_workflow.help_document_contract import parse_help_draft
    draft = parse_help_draft(HELP_DRAFT)
    assert draft.page_keys == ["job_posting:show"] and draft.status == "reviewed"
    assert draft.title == "Generate public application link"
    assert draft.actions == [("go_to_edit", "Edit the vacancy")]
    assert any("not_a_real_action" in problem for problem in draft.problems)
    assert draft.screenshot_lines == ["![A vacancy](/help-screenshots/job-posting-show.png)"]
    assert "## Actions" not in draft.body_markdown and "Give each vacancy" in draft.body_markdown
    assert any("page_keys is empty" in problem for problem in parse_help_draft("---\nstatus: draft\n---\n# T\n").problems)


def test_managed_section_is_replaced_not_duplicated_and_keeps_the_rest_of_the_help_page():
    from veloiq_framework.documentation_workflow.help_document_contract import merge_managed_section
    generic = "Generic text about the page."
    first = merge_managed_section(generic, "features/a", "<!-- veloiq-docs:begin features/a -->\nOne\n<!-- veloiq-docs:end features/a -->")
    second = merge_managed_section(first, "features/a", "<!-- veloiq-docs:begin features/a -->\nTwo\n<!-- veloiq-docs:end features/a -->")
    other = merge_managed_section(second, "features/b", "<!-- veloiq-docs:begin features/b -->\nB\n<!-- veloiq-docs:end features/b -->")
    assert second.startswith(generic) and "Two" in second and "One" not in second and second.count("begin features/a") == 1
    assert "B" in other and "Two" in other


def test_this_help_action_list_equals_the_catalog_of_the_ui_package():
    import re
    from veloiq_framework.documentation_workflow.help_document_contract import HELP_ACTION_KEYS
    catalog = Path(__file__).resolve().parents[2] / "packages" / "ui" / "src" / "components" / "Help" / "actionCatalog.ts"
    if not catalog.exists():
        pytest.skip("the UI package is not next to the backend")
    catalog_text = catalog.read_text(encoding="utf-8")
    block = catalog_text[catalog_text.index("HELP_ACTION_CATALOG"):]
    catalog_keys = re.findall(r'^    "?([a-z_]+(?::[a-z]+)?)"?: \{', block, re.M)
    assert sorted(catalog_keys) == sorted(HELP_ACTION_KEYS)


def test_import_writes_reviewed_drafts_keeps_generic_text_and_is_repeatable(tmp_path):
    from sqlalchemy import create_engine
    from sqlmodel import Session, SQLModel, select
    from veloiq_framework.documentation_workflow.import_help_documents import import_help_documents
    from veloiq_framework.help.models import HelpAction, HelpDocument

    (tmp_path / "backend").mkdir()
    valid_draft = HELP_DRAFT.replace("- not_a_real_action: Nothing\n", "")
    write_file(tmp_path / "openspec" / "help-drafts" / "help-generate-public-application-link.md", valid_draft)
    write_file(tmp_path / "openspec" / "help-drafts" / "help-other.md", valid_draft.replace("status: reviewed", "status: draft").replace("job_posting:show", "other:show"))
    engine = create_engine(f"sqlite:///{tmp_path / 'help.db'}")
    SQLModel.metadata.create_all(engine, tables=[HelpDocument.__table__, HelpAction.__table__])
    with Session(engine) as session:
        session.add(HelpDocument(page_key="job_posting:show", title="job_posting - show", body="Generic text."))
        session.commit()

    preview = import_help_documents(tmp_path, dry_run=True, engine=engine)
    assert preview.updated_documents == ["job_posting:show"] and any("help-other.md" in skipped for skipped in preview.skipped)
    with Session(engine) as session:
        assert "veloiq-docs" not in session.exec(select(HelpDocument)).first().body

    report = import_help_documents(tmp_path, engine=engine)
    assert report.updated_documents == ["job_posting:show"] and report.added_actions == ["job_posting:show: go_to_edit"]
    again = import_help_documents(tmp_path, engine=engine)
    assert again.added_actions == []
    with Session(engine) as session:
        document = session.exec(select(HelpDocument)).first()
        assert document.body.startswith("Generic text.") and document.body.count("veloiq-docs:begin") == 1
        assert "![A vacancy](/help-screenshots/job-posting-show.png)" in document.body
        assert "#### Public application link" in document.body and "\n## Public" not in document.body
        assert len(session.exec(select(HelpAction)).all()) == 1
    with_unreviewed = import_help_documents(tmp_path, include_unreviewed=True, engine=engine)
    assert with_unreviewed.created_documents == ["other:show"]


def test_screenshots_section_is_rebuilt_from_the_listed_screenshots():
    from veloiq_framework.documentation_workflow.capture_help_screenshots import replace_screenshots_section
    updated = replace_screenshots_section(HELP_DRAFT, [{"file": "a.png", "caption": "First"}, {"file": "b.png"}])
    assert "![First](/help-screenshots/a.png)\n![b.png](/help-screenshots/b.png)" in updated
    assert "job-posting-show.png)" not in updated.split("## Screenshots")[1]
    assert split_front_matter(updated)[0]["status"] == "reviewed"


def test_help_sync_keeps_existing_drafts_unless_overwrite_is_given(tmp_path):
    from veloiq_framework.documentation_workflow.draft_help_documents_from_features import sync_help_documents_for_change
    archived = tmp_path / "openspec" / "changes" / "archive" / "2026-11-25-add-feature"
    write_element(archived, "features", "do-it", {"name": "do-it"})
    write_element(tmp_path / "openspec", "features", "do-it", {"name": "do-it", "help-pages": ["job_posting:show"]})
    written, skipped = sync_help_documents_for_change(tmp_path, "add-feature")
    draft_file = tmp_path / "openspec" / "help-drafts" / "help-do-it.md"
    assert written and not skipped and split_front_matter(draft_file.read_text())[0]["page_keys"] == ["job_posting:show"]
    draft_file.write_text(draft_file.read_text().replace("## Actions", "## Actions\n\n- go_to_edit: Mine"))
    assert sync_help_documents_for_change(tmp_path, "add-feature") == ([], ["openspec/help-drafts/help-do-it.md (already exists; use --overwrite)"])
    assert "Mine" in draft_file.read_text()
    assert sync_help_documents_for_change(tmp_path, "add-feature", overwrite=True)[0]
    draft_file.write_text(draft_file.read_text().replace("status: draft", "status: reviewed"))
    assert "reviewed" in sync_help_documents_for_change(tmp_path, "add-feature", overwrite=True)[1][0]
