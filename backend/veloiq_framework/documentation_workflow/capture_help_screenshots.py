"""Capture the screenshots a help draft lists (`veloiq docs help screenshots`), using Playwright against a running app."""
from __future__ import annotations

import json
import urllib.request
from pathlib import Path

from veloiq_framework.documentation_workflow.draft_help_documents_from_features import HELP_DRAFTS_FOLDER_NAME
from veloiq_framework.documentation_workflow.help_document_contract import (
    SCREENSHOTS_FOLDER_IN_FRONTEND, SCREENSHOTS_HEADING, SCREENSHOTS_URL_PREFIX, SECTION_PATTERN,
)
from veloiq_framework.documentation_workflow.specification_front_matter import join_front_matter, split_front_matter
from veloiq_framework.documentation_workflow.workflow_constants import OPENSPEC_FOLDER_NAME

ACCESS_TOKEN_STORAGE_KEY = "jm_access_token"
VIEWPORT = {"width": 1400, "height": 900}


class PlaywrightUnavailableError(RuntimeError):
    """Raised when the playwright package or its browser is not installed."""


def obtain_access_token(base_url: str, username: str, password: str) -> str:
    """Log in to the running application and return its access token."""
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/auth/login", data=json.dumps({"username": username, "password": password}).encode("utf-8"),
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read())["access_token"]


def render_screenshots_section(screenshot_specs: list[dict]) -> str:
    return "\n".join(f"![{spec.get('caption', spec['file'])}]({SCREENSHOTS_URL_PREFIX}{spec['file']})" for spec in screenshot_specs)


def replace_screenshots_section(draft_text: str, screenshot_specs: list[dict]) -> str:
    """Put image lines for the specs under `## Screenshots`, replacing what was there."""
    front_matter, body_text = split_front_matter(draft_text)
    start = body_text.find(SCREENSHOTS_HEADING + "\n")
    new_section = f"{SCREENSHOTS_HEADING}\n\n{render_screenshots_section(screenshot_specs)}\n"
    if start == -1:
        body_text = body_text.rstrip("\n") + "\n\n" + new_section
    else:
        following = SECTION_PATTERN.search(body_text, start + len(SCREENSHOTS_HEADING) + 1)
        end = following.start() if following else len(body_text)
        body_text = body_text[:start] + new_section + ("\n" + body_text[end:] if following else "")
    return join_front_matter(front_matter, body_text)


def capture_help_screenshots(project_root: Path, base_url: str, username: str, password: str) -> list[str]:
    """Capture every screenshot listed in the drafts' front matter; return the files written."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as error:
        raise PlaywrightUnavailableError("Playwright is not installed: run `pip install playwright` and `playwright install chromium`.") from error
    drafts_folder = project_root / OPENSPEC_FOLDER_NAME / HELP_DRAFTS_FOLDER_NAME
    draft_files = sorted(drafts_folder.glob("*.md")) if drafts_folder.exists() else []
    specs_by_draft = {}
    for draft_file in draft_files:
        specs = split_front_matter(draft_file.read_text(encoding="utf-8"))[0].get("screenshots") or []
        if specs:
            specs_by_draft[draft_file] = specs
    if not specs_by_draft:
        return []
    token = obtain_access_token(base_url, username, password)
    output_folder = project_root.joinpath(*SCREENSHOTS_FOLDER_IN_FRONTEND)
    output_folder.mkdir(parents=True, exist_ok=True)
    written: list[str] = []
    with sync_playwright() as playwright:
        try:
            browser = playwright.chromium.launch()
        except Exception as error:  # the browser binary is missing
            raise PlaywrightUnavailableError(f"Could not start Chromium: {error}. Run `playwright install chromium`.") from error
        context = browser.new_context(viewport=VIEWPORT)
        context.add_init_script(f"window.localStorage.setItem('{ACCESS_TOKEN_STORAGE_KEY}', {json.dumps(token)});")
        page = context.new_page()
        for draft_file, specs in specs_by_draft.items():
            for spec in specs:
                page.goto(f"{base_url.rstrip('/')}{spec['route']}")
                page.wait_for_load_state("networkidle")
                target = output_folder / spec["file"]
                page.screenshot(path=str(target))
                written.append(target.relative_to(project_root).as_posix())
            draft_file.write_text(replace_screenshots_section(draft_file.read_text(encoding="utf-8"), specs), encoding="utf-8")
        browser.close()
    return written
