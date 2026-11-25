"""Run the OpenSpec command line tool for a project, with its usage statistics switched off."""
from __future__ import annotations

import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from veloiq_framework.documentation_workflow.workflow_constants import PINNED_OPENSPEC_PACKAGE


class OpenSpecUnavailableError(RuntimeError):
    """Raised when Node's npx is not installed, so the OpenSpec tool cannot be run."""


@dataclass
class OpenSpecCommandResult:
    exit_code: int
    standard_output: str
    standard_error: str

    @property
    def combined_output(self) -> str:
        return (self.standard_output + self.standard_error).strip()


def run_openspec_command(project_root: Path, arguments: list[str]) -> OpenSpecCommandResult:
    """Run `npx @fission-ai/openspec@<pinned> <arguments>` inside the project and return its result."""
    if shutil.which("npx") is None:
        raise OpenSpecUnavailableError("npx was not found. Install Node.js, which VeloIQ projects already need for the frontend.")
    environment = dict(os.environ, OPENSPEC_TELEMETRY="0")
    completed = subprocess.run(
        ["npx", "--yes", PINNED_OPENSPEC_PACKAGE, *arguments],
        cwd=str(project_root), env=environment, capture_output=True, text=True,
    )
    return OpenSpecCommandResult(completed.returncode, completed.stdout, completed.stderr)
