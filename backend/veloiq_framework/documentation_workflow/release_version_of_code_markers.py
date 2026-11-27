"""Find the product version in which a code marker first shipped, from the git history.

The version is evidence, not an entry: it is the oldest git tag that contains the commit which added the marker line.
A marker that is not committed yet, or that no tag contains, belongs to the unreleased version.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

from veloiq_framework.documentation_workflow.workflow_constants import UNRELEASED_VERSION_LABEL


def _git_output(project_root: Path, arguments: list[str]) -> list[str] | None:
    """Return the output lines of a git command, or None when git is missing, fails, or the folder is not in a repository."""
    try:
        completed = subprocess.run(["git", *arguments], cwd=project_root, capture_output=True, text=True)
    except OSError:
        return None
    if completed.returncode != 0:
        return None
    return [line for line in completed.stdout.splitlines() if line.strip()]


def release_tags_oldest_first(project_root: Path) -> list[str]:
    """Return the git tags of the repository, the oldest release first."""
    return _git_output(project_root, ["for-each-ref", "--sort=creatordate", "--format=%(refname:short)", "refs/tags"]) or []


def release_version_of_marker(project_root: Path, source_path_from_project_root: str, marker_text: str) -> str:
    """Return the oldest tag that contains the commit which added `marker_text` to the file, or the unreleased label."""
    adding_commits = _git_output(project_root, ["log", "-S" + marker_text, "--format=%H", "--reverse", "--", source_path_from_project_root])
    if not adding_commits:
        return UNRELEASED_VERSION_LABEL
    tags_containing_commit = _git_output(project_root, ["tag", "--contains", adding_commits[0], "--sort=creatordate"])
    return tags_containing_commit[0] if tags_containing_commit else UNRELEASED_VERSION_LABEL


def latest_release_version(versions: list[str], tags_oldest_first: list[str]) -> str:
    """Return the most recent of the versions: unreleased is the newest, then the tag created last."""
    if not versions or UNRELEASED_VERSION_LABEL in versions:
        return UNRELEASED_VERSION_LABEL
    return max(versions, key=lambda version: tags_oldest_first.index(version) if version in tags_oldest_first else len(tags_oldest_first))


def earliest_release_version(versions: list[str], tags_oldest_first: list[str]) -> str:
    """Return the oldest of the versions: the tag created first; unreleased only when every version is unreleased."""
    released = [version for version in versions if version != UNRELEASED_VERSION_LABEL]
    if not released:
        return UNRELEASED_VERSION_LABEL
    return min(released, key=lambda version: tags_oldest_first.index(version) if version in tags_oldest_first else len(tags_oldest_first))
