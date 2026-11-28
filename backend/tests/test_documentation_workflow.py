"""Tests of the documentation workflow (`veloiq docs`): front matter, checks, stamping, code markers, help, site, data model."""
from __future__ import annotations

import shutil
import subprocess
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
    check_code_markers, implementation_status_label, index_code_for_specifications, scan_code_markers,
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
    write_element(change, "features", "bulk-reassign-tasks",
                  {"capability": "task-assignment", "stories": ["manager-sees-load"], "data-not-applicable": "It changes only a user journey."})
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
    write_element(tmp_path, "features", "bulk-reassign-tasks", {"capability": "task-assignment", "data-not-applicable": "No data."})
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


TWO_REQUIREMENTS_BODY = ("## Purpose\n\nx\n\n## ADDED Requirements\n\n### Requirement: First step\nThe system SHALL a.\n\n"
                         "#### Scenario: A\n- **WHEN** a\n- **THEN** b\n\n### Requirement: Second step\nThe system SHALL b.\n\n"
                         "#### Scenario: B\n- **WHEN** a\n- **THEN** b\n")


def read_element_front_matter(root: Path, element_type: str, name: str) -> dict:
    return split_front_matter((root / "openspec" / "specs" / element_type / name / "spec.md").read_text())[0]


def test_status_is_planned_partial_or_implemented_from_the_requirements_the_markers_cover(tmp_path):
    write_element(tmp_path / "openspec", "features", "two-step-feature", {"name": "two-step-feature"}, TWO_REQUIREMENTS_BODY)
    index_code_for_specifications(tmp_path)
    assert read_element_front_matter(tmp_path, "features", "two-step-feature")["implementation-status"] == "planned"

    code_file = tmp_path / "backend" / "app" / "modules" / "work" / "custom_api.py"
    write_file(code_file, "# spec: two-step-feature :: First step\ndef first():\n    pass\n")
    index_code_for_specifications(tmp_path)
    front_matter = read_element_front_matter(tmp_path, "features", "two-step-feature")
    assert (front_matter["implementation-status"], front_matter["requirements-implemented"], front_matter["requirements-total"]) == ("partial", 1, 2)
    assert implementation_status_label(front_matter) == "Partially implemented: 1 of 2 requirements"

    write_file(code_file, code_file.read_text() + "\n# spec: two-step-feature :: Second step\ndef second():\n    pass\n")
    index_code_for_specifications(tmp_path)
    front_matter = read_element_front_matter(tmp_path, "features", "two-step-feature")
    assert front_matter["implementation-status"] == "implemented" and front_matter["implemented-in-version"] == "unreleased"
    assert "requirements-implemented" not in front_matter
    assert implementation_status_label(front_matter) == "Implemented in unreleased"
    assert check_code_markers(tmp_path) == []


def test_a_marker_without_a_requirement_covers_all_and_an_unknown_requirement_is_reported(tmp_path):
    write_element(tmp_path / "openspec", "features", "two-step-feature", {"name": "two-step-feature"}, TWO_REQUIREMENTS_BODY)
    write_file(tmp_path / "backend" / "app" / "work.py",
               "# spec: two-step-feature\ndef everything():\n    pass\n\n# spec: two-step-feature :: Third step\ndef other():\n    pass\n")
    index_code_for_specifications(tmp_path)
    assert read_element_front_matter(tmp_path, "features", "two-step-feature")["implementation-status"] == "implemented"
    assert any("no requirement named `Third step`" in problem for problem in check_code_markers(tmp_path))


def test_capability_status_is_rolled_up_from_its_features(tmp_path):
    write_element(tmp_path / "openspec", "capabilities", "task-assignment", {"name": "task-assignment"})
    write_element(tmp_path / "openspec", "features", "feature-one", {"capability": "task-assignment"})
    write_element(tmp_path / "openspec", "features", "feature-two", {"capability": "task-assignment"})
    write_file(tmp_path / "backend" / "app" / "work.py", "# spec: feature-one\ndef one():\n    pass\n")
    index_code_for_specifications(tmp_path)
    capability = read_element_front_matter(tmp_path, "capabilities", "task-assignment")
    assert (capability["implementation-status"], capability["features-implemented"], capability["features-total"]) == ("partial", 1, 2)
    write_file(tmp_path / "backend" / "app" / "work.py",
               "# spec: feature-one\ndef one():\n    pass\n\n# spec: feature-two\ndef two():\n    pass\n")
    index_code_for_specifications(tmp_path)
    assert read_element_front_matter(tmp_path, "capabilities", "task-assignment")["implementation-status"] == "implemented"


def run_git(root: Path, *arguments: str) -> None:
    subprocess.run(["git", "-c", "user.name=Test", "-c", "user.email=test@example.com", *arguments], cwd=root, check=True, capture_output=True)


def test_implemented_in_version_is_the_oldest_tag_containing_the_commit_of_the_last_requirement_marker(tmp_path):
    write_element(tmp_path / "openspec", "features", "two-step-feature", {"name": "two-step-feature"}, TWO_REQUIREMENTS_BODY)
    code_file = tmp_path / "backend" / "app" / "work.py"
    run_git(tmp_path, "init", "-q")
    write_file(code_file, "# spec: two-step-feature :: First step\ndef first():\n    pass\n")
    run_git(tmp_path, "add", "-A"); run_git(tmp_path, "commit", "-q", "-m", "first")
    run_git(tmp_path, "tag", "v1.0.0")
    write_file(code_file, code_file.read_text() + "\n# spec: two-step-feature :: Second step\ndef second():\n    pass\n")
    index_code_for_specifications(tmp_path)
    assert read_element_front_matter(tmp_path, "features", "two-step-feature")["implementation-status"] == "implemented"
    assert read_element_front_matter(tmp_path, "features", "two-step-feature")["implemented-in-version"] == "unreleased"  # second marker not committed

    run_git(tmp_path, "add", "-A"); run_git(tmp_path, "commit", "-q", "-m", "second")
    run_git(tmp_path, "tag", "v1.1.0")
    run_git(tmp_path, "tag", "v1.2.0")
    index_code_for_specifications(tmp_path)
    assert read_element_front_matter(tmp_path, "features", "two-step-feature")["implemented-in-version"] == "v1.1.0"


def test_site_shows_the_implementation_status_and_the_status_view_lists_it_by_epic(tmp_path):
    write_element(tmp_path / "openspec", "features", "two-step-feature",
                  {"name": "two-step-feature", "type": "feature", "origin": {"epics": ["team-balance"]}}, TWO_REQUIREMENTS_BODY)
    write_file(tmp_path / "openspec" / "CHANGELOG.md", "# Changelog\n")
    index_code_for_specifications(tmp_path)
    status_view = (tmp_path / "openspec" / "reverse-views" / "implementation-status-by-epic.md").read_text()
    assert "- features/two-step-feature: Planned, not implemented yet" in status_view
    stage_documentation_site(tmp_path / "openspec", tmp_path / "build", "Demo 0.1.0")
    assert "| implementation | 🕓 Planned, not implemented yet |" in (tmp_path / "build" / "docs" / "features" / "two-step-feature.md").read_text()


ENTITY_DEFINITION_TEXT = (
    "## Fields\n\n| Field | Description | Type | Required | Allowed values | Default |\n| --- | --- | --- | --- | --- | --- |\n"
    "| name | Name of the flow | text | yes | free | none |\n| max_attempts | Attempts before a record is dead-lettered | number | yes | 1 to 10 | 3 |\n"
    "| is_enabled | Whether the flow runs | yes or no | yes | true, false | true |\n| started_at | When it last started | date and time | no | free | none |\n"
    "| end_date | When it stops | date | no | free | none |\n\n"
    "## Relations\n\n| Subject entity | Relation | Object entity | Subject cardinality | Object cardinality |\n| --- | --- | --- | --- | --- |\n"
    "| Flow | flow_has_step | Step | one | one or more |\n")


def make_data_change(root: Path, requirement_lines: str, front_matter: dict | None = None) -> Path:
    change = root / "changes" / "c"
    write_file(change / "stories" / "s.md", join_front_matter({"epic": "e"}, "x"))
    write_file(change / "epics" / "e.md", join_front_matter({}, "x"))
    write_element(root, "capabilities", "the-capability")
    write_element(root, "entity-definitions", "Flow", {"name": "Flow"})
    write_file(root / "specs" / "entity-definitions" / "Flow" / "definition.md", ENTITY_DEFINITION_TEXT)
    body = SPEC_BODY.replace("The system SHALL do it.\n", "The system SHALL do it.\n" + requirement_lines)
    write_element(change, "features", "do-it", {"capability": "the-capability", "stories": ["s"], **(front_matter or {})}, body)
    return change


def test_a_feature_needs_to_point_to_its_data_or_give_a_reason_and_the_setting_can_turn_this_off(tmp_path):
    change = make_data_change(tmp_path, "")
    assert any("needs to point to its data" in str(problem) for problem in validate_documentation_change(change, tmp_path / "specs"))
    assert validate_documentation_change(change, tmp_path / "specs", require_feature_data=False) == []
    write_element(change, "features", "do-it", {"capability": "the-capability", "stories": ["s"], "data-not-applicable": "It changes a business rule only."})
    assert validate_documentation_change(change, tmp_path / "specs") == []


def test_requirements_must_point_to_fields_and_relations_the_entity_defines(tmp_path):
    change = make_data_change(tmp_path, "Data: Flow.max_attempts, Flow.name\nRelation: Flow > flow_has_step > Step\n")
    assert validate_documentation_change(change, tmp_path / "specs") == []
    bad = make_data_change(tmp_path, "Data: Flow.retries, Missing.name, not a reference\nRelation: Flow > flow_owns_step > Step\n")
    messages = " | ".join(str(problem) for problem in validate_documentation_change(bad, tmp_path / "specs"))
    assert "field `retries` is not defined by entity `Flow`" in messages and "entity `Missing` has no entity definition" in messages
    assert "`not a reference` is not `Entity.field`" in messages and "relation `Flow > flow_owns_step > Step` is not defined" in messages


def test_a_capability_does_not_point_to_data_but_its_features_do(tmp_path):
    change = tmp_path / "changes" / "c"
    write_file(change / "stories" / "s.md", join_front_matter({"epic": "e"}, "x"))
    write_file(change / "epics" / "e.md", join_front_matter({}, "x"))
    write_element(tmp_path, "entity-definitions", "Flow", {"name": "Flow"})
    write_file(tmp_path / "specs" / "entity-definitions" / "Flow" / "definition.md", ENTITY_DEFINITION_TEXT)
    write_element(change, "capabilities", "the-capability", {"stories": ["s"]}, SPEC_BODY.replace("The system SHALL do it.\n", "The system SHALL do it.\nData: Flow.name\n"))
    assert any("a capability does not point to data" in str(problem) for problem in validate_documentation_change(change, tmp_path / "specs"))


def test_entity_definitions_check_cardinalities_and_subject(tmp_path):
    change = tmp_path / "changes" / "c"
    write_file(change / "stories" / "s.md", join_front_matter({"epic": "e"}, "x"))
    write_file(change / "epics" / "e.md", join_front_matter({}, "x"))
    write_element(change, "entity-definitions", "Step", {"name": "Step", "stories": ["s"]})
    write_file(change / "specs" / "entity-definitions" / "Step" / "definition.md",
               ENTITY_DEFINITION_TEXT.replace("| Flow | flow_has_step | Step | one | one or more |", "| Flow | belongs to | Step | many | one |"))
    messages = " | ".join(str(problem) for problem in validate_documentation_change(change, tmp_path / "specs"))
    assert "subject `Flow`; it must be this entity, `Step`" in messages and "cardinality `many` is not one of" in messages


def test_names_follow_the_conventions_of_the_applications():
    from veloiq_framework.documentation_workflow.data_specification_tables import read_entity_definition, snake_case_of_entity
    assert snake_case_of_entity("CashAccount") == "cash_account"
    bad_text = ("## Fields\n\n| Field | Description | Type | Required | Allowed values | Default |\n| --- | --- | --- | --- | --- | --- |\n"
                "| Name | x | text | yes | free | none |\n| enabled | x | yes or no | yes | true, false | true |\n"
                "| started | x | date and time | no | free | none |\n| ends | x | date | no | free | none |\n\n"
                "## Relations\n\n| Subject entity | Relation | Object entity | Subject cardinality | Object cardinality |\n| --- | --- | --- | --- | --- |\n"
                "| cash_account | has steps | Step | one | one or more |\n| cash_account | steps | Step | one | one or more |\n")
    _, problems = read_entity_definition("cash_account", bad_text)
    messages = " | ".join(problems)
    for expected in ("must be singular PascalCase", "field `Name`", "yes or no field `enabled`", "must end with _at", "must end with _date"):
        assert expected in messages
    _, problems = read_entity_definition("CashAccount", ENTITY_DEFINITION_TEXT.replace("Flow", "CashAccount").replace("flow_has", "cash_account_has").replace("Step", "Entry").replace("cash_account_has_step", "cash_account_has_entry"))
    assert problems == []
    _, problems = read_entity_definition("CashAccount", ENTITY_DEFINITION_TEXT.replace("Flow", "CashAccount").replace("flow_has_step", "has_entry"))
    assert any("cash_account_<verb phrase>_step" in problem for problem in problems)


def test_each_relation_is_listed_on_both_entities_with_swapped_cardinalities(tmp_path):
    change = tmp_path / "changes" / "c"
    write_file(change / "stories" / "s.md", join_front_matter({"epic": "e"}, "x"))
    write_file(change / "epics" / "e.md", join_front_matter({}, "x"))
    fields = "## Fields\n\n| Field | Description | Type | Required | Allowed values | Default |\n| --- | --- | --- | --- | --- | --- |\n| name | x | text | yes | free | none |\n\n"
    header = "## Relations\n\n| Subject entity | Relation | Object entity | Subject cardinality | Object cardinality |\n| --- | --- | --- | --- | --- |\n"
    def define(entity: str, relation_rows: str) -> None:
        write_element(change, "entity-definitions", entity, {"name": entity, "stories": ["s"]})
        write_file(change / "specs" / "entity-definitions" / entity / "definition.md", fields + header + relation_rows)
    define("Flow", "| Flow | flow_has_step | Step | one | one or more |\n")
    define("Step", "")
    messages = " | ".join(str(problem) for problem in validate_documentation_change(change, tmp_path / "specs"))
    assert "relation `flow_has_step` of `Flow` needs its other side `flow_has_step_reverse` listed here" in messages
    define("Step", "| Step | flow_has_step_reverse | Flow | one | one or more |\n")
    assert "must have subject `Step`, object `Flow` and the cardinalities one or more / one" in " ".join(str(problem) for problem in validate_documentation_change(change, tmp_path / "specs"))
    define("Step", "| Step | flow_has_step_reverse | Flow | one or more | one |\n")
    assert validate_documentation_change(change, tmp_path / "specs") == []


def test_scaffold_creates_the_entity_definition_and_the_site_shows_the_values_next_to_the_requirement(tmp_path):
    from veloiq_framework.documentation_workflow.scaffold_documentation_files import create_element_delta
    change = tmp_path / "openspec" / "changes" / "c"
    write_file(change / "stories" / "s.md", join_front_matter({"epic": "e"}, "x"))
    write_file(change / "proposal.md", "## Capabilities\n\n### New Capabilities\n\n### Modified Capabilities\n")
    create_element_delta(tmp_path, "c", "entity-definitions", "Flow", ["s"])
    create_element_delta(tmp_path, "c", "capabilities", "the-capability", ["s"])
    create_element_delta(tmp_path, "c", "features", "no-data-feature", ["s"], "the-capability", "It changes a user journey only.")
    assert (change / "specs" / "entity-definitions" / "Flow" / "definition.md").exists()
    assert not (change / "specs" / "features" / "no-data-feature" / "data.md").exists()
    assert split_front_matter((change / "specs" / "features" / "no-data-feature" / "spec.md").read_text())[0]["data-not-applicable"] == "It changes a user journey only."
    # the values are written once, in the entity definition; the product page of the feature repeats them from there
    openspec_folder = tmp_path / "openspec"
    write_element(openspec_folder, "entity-definitions", "Flow", {"type": "entity-definition"})
    write_file(openspec_folder / "specs" / "entity-definitions" / "Flow" / "definition.md", ENTITY_DEFINITION_TEXT)
    write_element(openspec_folder, "features", "do-it", {"type": "feature"},
                  SPEC_BODY.replace("The system SHALL do it.\n", "The system SHALL do it.\nData: Flow.max_attempts\nRelation: Flow > flow_has_step > Step\n"))
    write_element(openspec_folder, "features", "no-data-feature", {"type": "feature", "data-not-applicable": "It changes a user journey only."})
    write_file(openspec_folder / "CHANGELOG.md", "# Changelog\n")
    stage_documentation_site(openspec_folder, tmp_path / "build", "Demo")
    page = (tmp_path / "build" / "docs" / "features" / "do-it.md").read_text()
    assert "[Flow](../entity-definitions/Flow.md).max_attempts | Attempts before a record is dead-lettered | number | yes | 1 to 10 | 3 |" in page
    assert "| [Flow](../entity-definitions/Flow.md) | flow_has_step | Step | one | one or more |" in page and "Data: Flow" not in page
    assert "Not applicable: It changes a user journey only." in (tmp_path / "build" / "docs" / "features" / "no-data-feature.md").read_text()
    assert "# Definition" in (tmp_path / "build" / "docs" / "entity-definitions" / "Flow.md").read_text()
    assert "| [Flow](Flow.md) | flow_has_step | Step | one | one or more |" in (tmp_path / "build" / "docs" / "entity-definitions" / "Flow.md").read_text()


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
    assert "| [the-epic](changes/add-feature/epics/the-epic.md) | features | [do-it](features/do-it.md) |" in reverse_view
    assert "| [the-epic](changes/add-feature/epics/the-epic.md) | features | features/missing |" in reverse_view
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
    write_element(change, "features", "do-it", {"capability": "the-capability", "stories": ["the-story"], "data-not-applicable": "No data."})
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
    write_element(rename, "features", "do-it-better", {"capability": "the-capability", "stories": ["rename-story"], "data-not-applicable": "No data."})
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
    element = find_documentation_action("new-element")
    assert build_documentation_command(element, {"change_name": "add-x", "element_type": "features", "element_name": "bulk-reassign-tasks",
                                                 "story_name": "s1", "capability_name": "task-assignment"}) == \
        "veloiq docs element new features bulk-reassign-tasks --change add-x --story s1 --capability task-assignment"
    assert build_documentation_command(find_documentation_action("new-story"),
                                       {"change_name": "add-x", "epic_name": "e1", "story_name": "s1"}) == \
        "veloiq docs story new s1 --epic e1 --change add-x"
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
    for command in ("veloiq docs epic new team-balance --change add-x", "veloiq docs story new s1 --epic e1 --change add-x",
                    "veloiq docs element new features bulk-reassign-tasks --change add-x --story s1 --capability task-assignment",
                    "veloiq docs help import --dry-run", "veloiq docs help screenshots --base-url http://localhost:8001 --username admin",
                    "veloiq docs init", "veloiq docs change new add-x", "veloiq docs change apply add-x --product-version 1.4.0",
                    "veloiq docs spec generate-data-model", "veloiq docs help sync add-x", "veloiq docs site build --git-tag 0.1.0"):
        assert _is_allowed_command(command), command
    for command in ("veloiq docs epic new x --change add-x --root /etc", "veloiq docs element new features x --change add-x --evil",
                    "veloiq docs help screenshots --base-url file:///etc/passwd", "veloiq docs help import --root /etc",
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
    assert [action["identifier"] for action in body["actions"]][:5] == ["install", "new-change", "new-epic", "new-story", "new-element"]
    apply_action = next(action for action in body["actions"] if action["identifier"] == "apply")
    assert apply_action["inputs"][0]["source"] == "in_progress_changes" and apply_action["when_to_use"]
    assert body["status"]["installed"] is True and body["status"]["element_types"][0] == "journeys"
    story_action = next(action for action in body["actions"] if action["identifier"] == "new-story")
    assert story_action["inputs"][1]["source"] == "epics_of_change" and story_action["inputs"][1]["depends_on"] == "change_name"


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


# ── Scaffolds: pre-filled epic, story and element files ───────────────────────────────────────────────────────────

@pytest.fixture
def project_with_change(tmp_path):
    (tmp_path / "openspec" / "changes" / "add-x").mkdir(parents=True)
    return tmp_path


def test_epic_and_story_are_created_pre_filled_and_the_story_is_listed_in_its_epic(project_with_change):
    from veloiq_framework.documentation_workflow.scaffold_documentation_files import create_epic, create_story
    epic_file = Path(create_epic(project_with_change, "add-x", "team-balance", TODAY))
    front_matter, body = split_front_matter(epic_file.read_text())
    assert front_matter == {"name": "team-balance", "type": "epic", "change": "add-x", "created": "2026-11-25"}
    assert "## Goal" in body and "## User stories" in body

    story_file = Path(create_story(project_with_change, "add-x", "manager-sees-load", "team-balance", TODAY))
    story_front_matter, story_body = split_front_matter(story_file.read_text())
    assert story_front_matter == {"name": "manager-sees-load", "type": "story", "epic": "team-balance", "change": "add-x", "created": "2026-11-25",
                                  "design": ["high-level-design"]}
    assert "As a <role>" in story_body
    create_story(project_with_change, "add-x", "another-story", "team-balance", TODAY)
    epic_text = epic_file.read_text()
    assert "- manager-sees-load\n- another-story\n\n## Out of scope" in epic_text and "\n- \n" not in epic_text


def test_scaffolds_reject_bad_names_missing_parents_and_existing_files(project_with_change):
    from veloiq_framework.documentation_workflow.scaffold_documentation_files import ScaffoldError, create_epic, create_story
    for bad_name in ("epic-1", "Team Balance", "12"):
        with pytest.raises(ScaffoldError, match="descriptive kebab-case"):
            create_epic(project_with_change, "add-x", bad_name)
    with pytest.raises(ScaffoldError, match="Create it first with `veloiq docs change new"):
        create_epic(project_with_change, "no-such-change", "team-balance")
    with pytest.raises(ScaffoldError, match="Create it first with `veloiq docs epic new"):
        create_story(project_with_change, "add-x", "manager-sees-load", "missing-epic")
    create_epic(project_with_change, "add-x", "team-balance")
    with pytest.raises(ScaffoldError, match="already exists"):
        create_epic(project_with_change, "add-x", "team-balance")
    with pytest.raises(ScaffoldError, match="epics: team-balance"):
        create_story(project_with_change, "add-x", "manager-sees-load", "missing-epic")


def test_element_delta_is_pre_filled_checked_and_listed_in_the_proposal(project_with_change):
    from veloiq_framework.documentation_workflow.scaffold_documentation_files import (
        ScaffoldError, create_element_delta, create_story, create_epic, prefill_new_change_files,
    )
    assert len(prefill_new_change_files(project_with_change, "add-x")) == 3
    assert prefill_new_change_files(project_with_change, "add-x") == []
    create_epic(project_with_change, "add-x", "team-balance")
    create_story(project_with_change, "add-x", "manager-sees-load", "team-balance")
    with pytest.raises(ScaffoldError, match="needs --capability"):
        create_element_delta(project_with_change, "add-x", "features", "bulk-reassign-tasks")
    capability_file = Path(create_element_delta(project_with_change, "add-x", "capabilities", "task-assignment", ["manager-sees-load"]))
    assert split_front_matter(capability_file.read_text())[0] == {"name": "task-assignment", "type": "capabilities", "stories": ["manager-sees-load"]}
    feature_file = Path(create_element_delta(project_with_change, "add-x", "features", "bulk-reassign-tasks",
                                             ["manager-sees-load"], "task-assignment"))
    feature_front_matter, feature_body = split_front_matter(feature_file.read_text())
    assert feature_front_matter["capability"] == "task-assignment" and "## ADDED Requirements" in feature_body
    proposal = (project_with_change / "openspec" / "changes" / "add-x" / "proposal.md").read_text()
    assert "- `capabilities/task-assignment`: \n- `features/bulk-reassign-tasks`: " in proposal and "<element-type>" not in proposal.split("### Modified")[0]
    with pytest.raises(ScaffoldError, match="already used by an element of type capabilities"):
        create_element_delta(project_with_change, "add-x", "journeys", "task-assignment")
    with pytest.raises(ScaffoldError, match="not a story of change"):
        create_element_delta(project_with_change, "add-x", "journeys", "plan-a-sprint", ["unknown-story"])
    with pytest.raises(ScaffoldError, match="data model is generated"):
        create_element_delta(project_with_change, "add-x", "data-model", "Task")


def test_element_delta_of_an_existing_element_is_a_modification(project_with_change):
    from veloiq_framework.documentation_workflow.scaffold_documentation_files import create_element_delta
    write_element(project_with_change / "openspec", "capabilities", "task-assignment", {"name": "task-assignment"})
    write_element(project_with_change / "openspec", "features", "bulk-reassign-tasks", {"capability": "task-assignment"})
    feature_file = Path(create_element_delta(project_with_change, "add-x", "features", "bulk-reassign-tasks"))
    assert "## MODIFIED Requirements" in feature_file.read_text() and "## ADDED Requirements" not in feature_file.read_text()


def test_terminal_explorer_offers_the_epics_and_stories_of_the_chosen_change(tmp_path, monkeypatch):
    from veloiq_framework.cli.explorer import AppData, Explorer, _Frame
    write_file(tmp_path / "openspec" / "config.yaml", "schema: veloiq-docs\n")
    write_file(tmp_path / "openspec" / "changes" / "add-x" / "epics" / "team-balance.md", "x")
    write_file(tmp_path / "openspec" / "changes" / "add-x" / "stories" / "manager-sees-load.md", "x")
    (tmp_path / "openspec" / "changes" / "empty-change").mkdir(parents=True)
    explorer = Explorer(AppData(name="demo", root=tmp_path))
    explorer.nav.append(_Frame("docs"))
    prompts: list[str] = []
    answers = iter(["add-x", "team-balance", "another-story"])
    monkeypatch.setattr(explorer, "_get_input", lambda stdscr, max_y, max_x, prompt, default="": prompts.append(prompt) or next(answers))
    monkeypatch.setattr(explorer, "_confirm", lambda *arguments: True)
    assert explorer._handle(ord("t"), None, 40, 120) == "veloiq docs story new another-story --epic team-balance --change add-x"
    assert "team-balance" in prompts[1] and "empty-change" in prompts[0]

    answers = iter(["empty-change"])
    assert explorer._handle(ord("t"), None, 40, 120) is None and "no epic yet" in explorer._docs_message
    answers = iter(["add-x", "features", "bulk-reassign-tasks", "manager-sees-load", "task-assignment"])
    assert explorer._handle(ord("l"), None, 40, 120) == \
        "veloiq docs element new features bulk-reassign-tasks --change add-x --story manager-sees-load --capability task-assignment"
    assert "features" in prompts[-4] and "optional" in prompts[-2]


def test_a_story_may_name_several_design_files_and_each_must_exist(tmp_path):
    change = tmp_path / "changes" / "c"
    write_file(change / "epics" / "team-balance.md", join_front_matter({"name": "team-balance"}, "x"))
    write_file(change / "design" / "high-level-design.md", "## Overview\n")
    write_file(change / "design" / "low-level-design" / "engine.md", "## Interfaces\n")
    write_file(change / "stories" / "manager-sees-load.md",
               join_front_matter({"epic": "team-balance", "design": ["high-level-design", "low-level-design/engine"]}, "x"))
    write_element(change, "capabilities", "task-assignment", {"stories": ["manager-sees-load"]})
    write_element(change, "features", "bulk-reassign-tasks",
                  {"capability": "task-assignment", "stories": ["manager-sees-load"], "data-not-applicable": "A journey only."})
    assert validate_documentation_change(change, tmp_path / "specs") == []
    write_file(change / "stories" / "manager-sees-load.md",
               join_front_matter({"epic": "team-balance", "design": ["high-level-design", "low-level-design/missing"]}, "x"))
    problems = [str(problem) for problem in validate_documentation_change(change, tmp_path / "specs")]
    assert any("`low-level-design/missing`" in problem and "not a design file" in problem for problem in problems)


def test_a_new_story_lists_the_high_level_design_from_the_start(tmp_path):
    from veloiq_framework.documentation_workflow.scaffold_documentation_files import create_epic, create_story
    (tmp_path / "openspec" / "changes" / "c").mkdir(parents=True)
    write_file(tmp_path / "openspec" / "schemas" / "veloiq-docs" / "templates" / "epic.md", "## Goal\n\n## User stories\n\n")
    write_file(tmp_path / "openspec" / "schemas" / "veloiq-docs" / "templates" / "story.md", "## User story\n")
    create_epic(tmp_path, "c", "team-balance")
    story_file = Path(create_story(tmp_path, "c", "manager-sees-load", "team-balance"))
    assert split_front_matter(story_file.read_text())[0]["design"] == ["high-level-design"]


def test_the_site_links_a_story_to_its_designs_and_a_design_back_to_its_stories(tmp_path):
    archived = tmp_path / "openspec" / "changes" / "archive" / "2026-01-01-the-change"
    write_file(archived / "proposal.md", "## Why\n\nBecause.\n")
    write_file(archived / "epics" / "team-balance.md", join_front_matter({"name": "team-balance", "type": "epic", "change": "the-change"}, "## Goal\n"))
    write_file(archived / "stories" / "manager-sees-load.md", join_front_matter(
        {"name": "manager-sees-load", "type": "story", "epic": "team-balance", "change": "the-change",
         "design": ["high-level-design", "low-level-design/engine"]}, "## User story\n"))
    write_file(archived / "design" / "high-level-design.md", "## Overview\n")
    write_file(archived / "design" / "low-level-design" / "engine.md", "## Interfaces\n")
    write_file(tmp_path / "openspec" / "CHANGELOG.md", "# Changelog\n")
    stage_documentation_site(tmp_path / "openspec", tmp_path / "build", "Demo 0.1.0")
    docs = tmp_path / "build" / "docs" / "changes" / "the-change"
    story_page = (docs / "stories" / "manager-sees-load.md").read_text()
    assert "| technical design | [high-level-design](../design/high-level-design.md)<br>[low-level-design/engine](../design/low-level-design/engine.md) |" in story_page
    assert "[manager-sees-load](../../stories/manager-sees-load.md)" in (docs / "design" / "low-level-design" / "engine.md").read_text() or \
        "manager-sees-load" in (docs / "design" / "low-level-design" / "engine.md").read_text()


def write_manual_statuses(root: Path, text: str) -> None:
    write_file(root / "openspec" / "implementation-status-overrides.yaml", text)


def test_a_requirement_implemented_in_another_application_is_marked_by_hand_and_rolls_up_with_the_markers(tmp_path):
    write_element(tmp_path / "openspec", "features", "two-step-feature", {"name": "two-step-feature"}, TWO_REQUIREMENTS_BODY)
    write_manual_statuses(tmp_path, "features/two-step-feature:\n  First step:\n    status: implemented\n    where: Advanced Development\n    since: unreleased\n")
    index_code_for_specifications(tmp_path)
    front_matter = read_element_front_matter(tmp_path, "features", "two-step-feature")
    assert (front_matter["implementation-status"], front_matter["requirements-implemented"], front_matter["requirements-total"]) == ("partial", 1, 2)
    assert front_matter["requirements-marked-by-hand"] == 1 and front_matter["marked-by-hand-in"] == ["Advanced Development"]
    assert implementation_status_label(front_matter) == "Partially implemented: 1 of 2 requirements (1 marked by hand in Advanced Development)"

    write_file(tmp_path / "backend" / "app" / "modules" / "work" / "custom_api.py", "# spec: two-step-feature :: Second step\ndef second():\n    pass\n")
    index_code_for_specifications(tmp_path)
    front_matter = read_element_front_matter(tmp_path, "features", "two-step-feature")
    assert front_matter["implementation-status"] == "implemented" and front_matter["implemented-in-version"] == "unreleased"
    assert implementation_status_label(front_matter) == "Implemented in unreleased (1 marked by hand in Advanced Development)"
    assert check_code_markers(tmp_path) == []


def test_a_manual_entry_wins_over_a_marker_and_star_covers_the_requirements_without_an_entry(tmp_path):
    write_element(tmp_path / "openspec", "features", "two-step-feature", {"name": "two-step-feature"}, TWO_REQUIREMENTS_BODY)
    write_file(tmp_path / "backend" / "app" / "modules" / "work" / "custom_api.py", "# spec: two-step-feature :: First step\ndef first():\n    pass\n")
    write_manual_statuses(tmp_path, "features/two-step-feature:\n  First step:\n    status: planned\n  '*':\n    status: implemented\n    where: the framework\n")
    index_code_for_specifications(tmp_path)
    front_matter = read_element_front_matter(tmp_path, "features", "two-step-feature")
    assert (front_matter["implementation-status"], front_matter["requirements-implemented"]) == ("partial", 1)      # only the second step: the first is planned by hand
    write_manual_statuses(tmp_path, "features/two-step-feature:\n  '*':\n    status: planned\n")
    index_code_for_specifications(tmp_path)
    assert read_element_front_matter(tmp_path, "features", "two-step-feature")["implementation-status"] == "planned"


def test_the_check_reports_manual_entries_that_are_malformed_unknown_or_redundant_with_a_marker(tmp_path):
    write_element(tmp_path / "openspec", "features", "two-step-feature", {"name": "two-step-feature"}, TWO_REQUIREMENTS_BODY)
    write_file(tmp_path / "backend" / "app" / "modules" / "work" / "custom_api.py", "# spec: two-step-feature :: First step\ndef first():\n    pass\n")
    write_manual_statuses(tmp_path, "features/two-step-feature:\n  First step:\n    status: implemented\n  Third step:\n    status: implemented\n  Second step:\n    status: maybe\n"
                                    "features/missing-element:\n  Anything:\n    status: planned\n")
    index_code_for_specifications(tmp_path)
    problems = " | ".join(check_code_markers(tmp_path))
    assert "no requirement named `Third step`" in problems and "needs a status of implemented or planned" in problems
    assert "no element named `features/missing-element`" in problems and "has a marker in this application; remove the manual entry" in problems


def test_without_a_manual_statuses_file_nothing_changes(tmp_path):
    write_element(tmp_path / "openspec", "features", "two-step-feature", {"name": "two-step-feature"}, TWO_REQUIREMENTS_BODY)
    index_code_for_specifications(tmp_path)
    front_matter = read_element_front_matter(tmp_path, "features", "two-step-feature")
    assert front_matter["implementation-status"] == "planned" and "requirements-marked-by-hand" not in front_matter


def test_the_home_page_the_changelog_and_the_traceability_views_are_tables_with_links_and_counts(tmp_path):
    openspec = tmp_path / "openspec"
    write_element(openspec, "features", "two-step-feature", {"name": "two-step-feature", "implementation-status": "partial", "origin": {"epics": ["team-balance"]}}, TWO_REQUIREMENTS_BODY)
    write_element(openspec, "features", "other-feature", {"name": "other-feature", "implementation-status": "implemented"}, TWO_REQUIREMENTS_BODY)
    write_element(openspec, "business-rules", "a-rule", {"name": "a-rule", "implementation-status": "planned"}, "## Purpose\n\nx\n")
    write_file(openspec / "CHANGELOG.md", "# Changelog\n\n## unreleased\n\n- second-change (2026-11-02): added features/other-feature; modified features/two-step-feature; removed features/gone-feature\n"
                                          "- first-change (2026-11-01): added features/two-step-feature\n- a line that is not an entry\n\n## 0.1.0\n\n- old-change (2026-10-01): no element changes\n")
    write_file(openspec / "reverse-views" / "implemented-by-module.md", "# Elements by module\n\nGenerated.\n\n## tasks\n\n- features/two-step-feature\n- features/other-feature\n")
    write_file(openspec / "reverse-views" / "implemented-by-epic.md", "# By epic\n\nGenerated.\n\n## team-balance\n\n- features/two-step-feature\n")
    write_file(openspec / "reverse-views" / "implementation-status-by-epic.md",
               "# Status\n\nGenerated.\n\n## team-balance\n\n- features/two-step-feature: Partially implemented: 1 of 2 requirements (1 marked by hand in Elsewhere)\n"
               "- features/other-feature: Implemented in 0.1.0\n- business-rules/a-rule: Planned, not implemented yet\n")
    stage_documentation_site(openspec, tmp_path / "build", "Demo")
    docs = tmp_path / "build" / "docs"

    home = (docs / "index.md").read_text()
    assert "| Element type | Elements | Implemented | Partial | Planned |" in home and "| features | 2 | 1 | 1 | 0 |" in home and "| business-rules | 1 | 0 | 0 | 1 |" in home

    changelog = (docs / "CHANGELOG.md").read_text()
    assert "| Change | Date | Added | Modified | Removed |" in changelog and "## 0.1.0" in changelog
    row = next(line for line in changelog.splitlines() if line.startswith("| second-change"))
    assert "[other-feature](features/other-feature.md)" in row and "[two-step-feature](features/two-step-feature.md)" in row and "features/gone-feature" in row
    assert "- a line that is not an entry" in changelog and "| old-change | 2026-10-01 |" in changelog

    by_module = (docs / "implemented-by-module.md").read_text()
    assert "| Code module | Element type | Element |" in by_module and "| tasks | features | [two-step-feature](features/two-step-feature.md) |" in by_module
    by_epic = (docs / "implemented-by-epic.md").read_text()
    assert "| Epic | Element type | Element |" in by_epic and "| team-balance | features | [two-step-feature](features/two-step-feature.md) |" in by_epic

    status = (docs / "implementation-status-by-epic.md").read_text()
    assert "| Implemented | 1 |" in status and "| Partial | 1 |" in status and "| Planned | 1 |" in status
    assert "| Epic | Element type | Element | Status | Detail |" in status
    assert "| Partial | 1 of 2 requirements (1 marked by hand in Elsewhere) |" in status and "| Implemented | 0.1.0 |" in status and "| Planned | not implemented yet |" in status


def test_a_pipe_in_a_cell_does_not_split_the_row():
    from veloiq_framework.documentation_workflow.documentation_site_tables import render_status_view, TableLinks
    page = render_status_view("# S\n\n## e\n\n- features/a: Partially implemented: 1 of 2 (a | b)\n", TableLinks(), "x.md")
    assert "(a \\| b)" in page
