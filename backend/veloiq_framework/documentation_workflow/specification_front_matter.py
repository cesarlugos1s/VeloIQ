"""Read and write the YAML front matter of specification files."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

FRONT_MATTER_FENCE = "---"


def split_front_matter(file_text: str) -> tuple[dict[str, Any], str]:
    """Return (front matter as a dict, the body after it). A file without front matter gives ({}, whole text)."""
    if not file_text.startswith(FRONT_MATTER_FENCE + "\n"):
        return {}, file_text
    closing_index = file_text.find("\n" + FRONT_MATTER_FENCE, len(FRONT_MATTER_FENCE))
    if closing_index == -1:
        return {}, file_text
    front_matter_text = file_text[len(FRONT_MATTER_FENCE) + 1:closing_index]
    body_start = closing_index + len(FRONT_MATTER_FENCE) + 1
    body_text = file_text[body_start:].lstrip("\n")
    loaded = yaml.safe_load(front_matter_text) or {}
    return (loaded if isinstance(loaded, dict) else {}), body_text


def join_front_matter(front_matter: dict[str, Any], body_text: str) -> str:
    """Return the file text for a front matter dict followed by the body."""
    if not front_matter:
        return body_text
    dumped = yaml.safe_dump(front_matter, sort_keys=False, allow_unicode=True, default_flow_style=False).rstrip("\n")
    return f"{FRONT_MATTER_FENCE}\n{dumped}\n{FRONT_MATTER_FENCE}\n{body_text}"


def read_front_matter_of_file(file_path: Path) -> dict[str, Any]:
    front_matter, _ = split_front_matter(file_path.read_text(encoding="utf-8"))
    return front_matter


def write_front_matter_of_file(file_path: Path, front_matter: dict[str, Any]) -> None:
    _, body_text = split_front_matter(file_path.read_text(encoding="utf-8"))
    file_path.write_text(join_front_matter(front_matter, body_text), encoding="utf-8")
