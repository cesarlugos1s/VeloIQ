"""Install the documentation workflow into a VeloIQ project (`veloiq docs init`)."""
from __future__ import annotations

import shutil
from pathlib import Path

from veloiq_framework.documentation_workflow.run_openspec_command import run_openspec_command
from veloiq_framework.documentation_workflow.workflow_constants import (
    ALL_ELEMENT_TYPES, CUSTOM_SCHEMA_NAME, OPENSPEC_FOLDER_NAME, SPECIFICATIONS_FOLDER_NAME,
)

PACKAGE_FOLDER = Path(__file__).parent
SCHEMA_TEMPLATE_FOLDER = PACKAGE_FOLDER / "schema_template"
ASSISTANT_COMMANDS_FOLDER = PACKAGE_FOLDER / "assistant_commands"
ASSISTANT_COMMANDS_TARGET = Path(".claude") / "commands"


def install_documentation_workflow(project_root: Path) -> list[str]:
    """Install OpenSpec, the veloiq-docs schema and the assistant commands; return what was done."""
    done: list[str] = []
    openspec_folder = project_root / OPENSPEC_FOLDER_NAME

    if not (openspec_folder / "config.yaml").exists():
        result = run_openspec_command(project_root, ["init", "--tools", "none", "--scope", "project", "--no-animation"])
        if result.exit_code != 0:
            raise RuntimeError(f"openspec init failed:\n{result.combined_output}")
        done.append("openspec init")

    schema_target = openspec_folder / "schemas" / CUSTOM_SCHEMA_NAME
    shutil.copytree(SCHEMA_TEMPLATE_FOLDER, schema_target, dirs_exist_ok=True)
    done.append(f"{OPENSPEC_FOLDER_NAME}/schemas/{CUSTOM_SCHEMA_NAME}")

    config_file = openspec_folder / "config.yaml"
    config_text = config_file.read_text(encoding="utf-8")
    schema_line = f"schema: {CUSTOM_SCHEMA_NAME}"
    if schema_line not in config_text:
        lines = [line for line in config_text.splitlines() if not line.startswith("schema:")]
        config_file.write_text("\n".join([schema_line] + lines) + "\n", encoding="utf-8")
        done.append("config.yaml schema")

    for element_type in ALL_ELEMENT_TYPES:
        element_folder = openspec_folder / SPECIFICATIONS_FOLDER_NAME / element_type
        element_folder.mkdir(parents=True, exist_ok=True)
        (element_folder / ".gitkeep").touch()

    commands_target = project_root / ASSISTANT_COMMANDS_TARGET
    commands_target.mkdir(parents=True, exist_ok=True)
    for command_file in sorted(ASSISTANT_COMMANDS_FOLDER.glob("*.md")):
        target_file = commands_target / command_file.name
        if not target_file.exists():
            shutil.copy2(command_file, target_file)
            done.append(f"{ASSISTANT_COMMANDS_TARGET}/{command_file.name}")

    validation = run_openspec_command(project_root, ["schema", "validate", CUSTOM_SCHEMA_NAME])
    if validation.exit_code != 0:
        raise RuntimeError(f"The veloiq-docs schema is not valid:\n{validation.combined_output}")
    done.append("schema validated")
    return done
