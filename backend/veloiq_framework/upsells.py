"""Single source of truth for VeloIQ upsell/promo messaging.

Loaded from upsells.json (packaged data) so `veloiq build`, `veloiq check`,
`veloiq list-extensions`, and VeloIQ Studio (Extensions page, Command Panel)
all render identical copy instead of independently hand-edited duplicates.
"""
from __future__ import annotations

import json
import textwrap
from functools import lru_cache
from importlib import resources
from typing import Any


@lru_cache(maxsize=1)
def load_upsell_messages() -> dict[str, Any]:
    text = resources.files("veloiq_framework").joinpath("upsells.json").read_text(encoding="utf-8")
    return json.loads(text)


def _entry_line(entry: dict[str, Any]) -> str:
    line = entry["text"]
    extras = []
    if entry.get("install_cmd"):
        extras.append(entry["install_cmd"])
    if entry.get("link"):
        extras.append(entry["link"]["label"])
    if extras:
        line += "   " + "   ·   ".join(extras)
    return line


def render_cli_advisory(indent: str = "   ", width: int = 78) -> tuple[str, str]:
    """Render the two dim advisory blocks shown by `veloiq build`, `veloiq
    check`, and `veloiq list-extensions` when no extensions are enabled.

    Returns (extensions_block, commercial_apps_block), each prefixed with a
    leading blank line to match the surrounding click.echo spacing.
    """
    data = load_upsell_messages()

    def _render(entries: list[dict[str, Any]]) -> str:
        paragraphs = [
            textwrap.fill(_entry_line(e), width=width, initial_indent=indent, subsequent_indent=indent)
            for e in entries
        ]
        return "\n" + "\n".join(paragraphs)

    return _render(data["extensions_advisory"]), _render(data["commercial_apps_advisory"])
