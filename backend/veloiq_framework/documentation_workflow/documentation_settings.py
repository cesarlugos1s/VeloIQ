"""Settings of the documentation workflow, read from the `[documentation]` table of the project's veloiq.toml."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from veloiq_framework.documentation_workflow.workflow_constants import REQUIRE_FEATURE_DATA_SETTING

PROJECT_SETTINGS_FILE_NAME = "veloiq.toml"
DOCUMENTATION_TABLE_NAME = "documentation"


@dataclass(frozen=True)
class DocumentationSettings:
    #: When true (the default), every feature carries its data (`data.md`) or says why it has none.
    require_feature_data: bool = True


def read_documentation_settings(project_root: Path) -> DocumentationSettings:
    """Read the settings; a missing file, table or key gives the default."""
    settings_file = project_root / PROJECT_SETTINGS_FILE_NAME
    if not settings_file.is_file():
        return DocumentationSettings()
    from veloiq_framework.extension_registry import _load_toml
    table = _load_toml(settings_file).get(DOCUMENTATION_TABLE_NAME, {})
    return DocumentationSettings(require_feature_data=bool(table.get(REQUIRE_FEATURE_DATA_SETTING, True)))
