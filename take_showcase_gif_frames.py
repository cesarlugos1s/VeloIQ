#!/usr/bin/env python3
"""Capture frames for the 'build an app with Studio' showcase GIF.

Drives VeloIQ Studio against the throwaway tests/showcase-demo app to scaffold
a Project model and a Task model (with a relation), wire them into the
dashboard + search, then generate/build. Frames are saved numbered so they can
be stitched into a GIF in order. The "running app with data" tail of the GIF
reuses existing docs/images screenshots from the task-manager sample instead
of re-capturing — see assemble_showcase_gif.py.
"""

import time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:8010/veloiq-studio/"
USERNAME = "admin"
PASSWORD = "admin"

OUT_DIR = Path(__file__).parent / "website/showcase-assets/demo-gif/frames"
OUT_DIR.mkdir(parents=True, exist_ok=True)

_n = [0]
def shot(page, label: str, hold_frames: int = 1):
    """Save a frame; hold_frames>1 repeats the frame so the GIF pauses on it."""
    for _ in range(hold_frames):
        _n[0] += 1
        path = OUT_DIR / f"{_n[0]:03d}_{label}.png"
        page.screenshot(path=str(path))
        print(f"  -> {path.name}")

def wait(ms: int):
    time.sleep(ms / 1000)

def wait_for_options(select_locator, min_options: int, timeout_ms: int = 10000):
    deadline = time.time() + timeout_ms / 1000
    while time.time() < deadline:
        if select_locator.locator("option").count() >= min_options:
            return
        time.sleep(0.3)
    raise TimeoutError(f"select never reached {min_options} options")

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={"width": 1680, "height": 980}, device_scale_factor=2)
        page = ctx.new_page()

        # ── Login ──────────────────────────────────────────────────────────
        page.goto(BASE_URL)
        wait(1200)
        shot(page, "login_empty", 2)
        page.fill("input[type='text'], input[name='username']", USERNAME)
        wait(150)
        page.fill("input[type='password']", PASSWORD)
        wait(150)
        shot(page, "login_filled", 2)
        page.click("button[type='submit']")
        wait(2000)
        shot(page, "summary", 2)

        # ── Command Panel: Add Module x2 ──────────────────────────────────────
        page.click("text=Command Panel")
        wait(1200)
        shot(page, "command_panel")

        def add_module(name: str):
            card = page.locator(".vs-cmd-card", has=page.locator(".vs-cmd-card-title", has_text="Add Module")).first
            card.scroll_into_view_if_needed()
            inp = card.locator("input").first
            inp.click()
            inp.fill("")
            for ch in name:
                inp.type(ch, delay=20)
            shot(page, f"add_module_{name}_typed")
            card.locator("button.vs-btn-run").click()
            wait(400)
            shot(page, f"add_module_{name}_running")
            page.wait_for_selector(".vs-cmd-card .vs-terminal", timeout=20000)
            wait(2500)
            shot(page, f"add_module_{name}_done", 2)

        add_module("projects")
        add_module("tasks")

        # ── Command Panel: Add Model x2 ────────────────────────────────────────
        # CommandPanel doesn't resync its local schema copy on invalidation, so reload
        # the page to pick up the modules we just created (fresh fetch on mount).
        def add_model(name: str, module: str):
            page.reload()
            wait(1500)
            page.click("text=Command Panel")
            wait(1200)
            card = page.locator(".vs-cmd-card", has=page.locator(".vs-cmd-card-title", has_text="Add Model")).first
            card.scroll_into_view_if_needed()
            wait_for_options(card.locator("select"), 1)
            name_inp = card.locator("input").first
            name_inp.click()
            name_inp.fill("")
            for ch in name:
                name_inp.type(ch, delay=20)
            shot(page, f"add_model_{name}_name_typed")
            card.locator("select").select_option(module)
            shot(page, f"add_model_{name}_module_selected")
            card.locator("button.vs-btn-run").click()
            wait(400)
            shot(page, f"add_model_{name}_running")
            wait(2500)
            shot(page, f"add_model_{name}_done", 2)

        add_model("Project", "projects")
        add_model("Task", "tasks")

        # ── Schema Browser: open Project, add a status field ───────────────────
        def open_model_in_tree(module_name: str, model_name: str):
            page.click("text=Schema Browser")
            wait(1200)
            hdrs = page.locator(".vs-tree-module-hdr")
            target_hdr = None
            for i in range(hdrs.count()):
                h = hdrs.nth(i)
                if module_name.lower() in (h.inner_text() or "").lower():
                    target_hdr = h
                    break
            assert target_hdr is not None, f"module header not found: {module_name}"

            def model_row():
                rows = page.locator(".vs-tree-model")
                for i in range(rows.count()):
                    r = rows.nth(i)
                    if model_name.lower() in (r.inner_text() or "").lower():
                        return r
                return None

            # The module may already be auto-expanded (first module on a fresh schema
            # fetch); a single click could toggle it closed instead of open. Click,
            # check, and click again if the row didn't appear.
            target_hdr.click()
            wait(500)
            row = model_row()
            if row is None:
                target_hdr.click()
                wait(500)
                row = model_row()
            assert row is not None, f"model row not found: {model_name}"
            row.click()
            wait(800)

        open_model_in_tree("projects", "Project")
        shot(page, "schema_project_fields", 2)

        def add_field(resource_label: str, name: str, ftype: str, literals: str = "", default: str = ""):
            # "resource" is locked/prefilled (disabled input) since we're on the model's
            # own detail panel — only name(input), type(select), literals/default(input) are live.
            card = page.locator(".vs-cmd-card", has=page.locator(".vs-cmd-card-title", has_text="Add Field")).first
            card.scroll_into_view_if_needed()
            name_inp = card.locator("input").nth(1)
            name_inp.click(); name_inp.fill("")
            for ch in name:
                name_inp.type(ch, delay=20)
            shot(page, f"add_field_{resource_label}_{name}_typed")
            card.locator("select").nth(0).select_option(ftype)
            if literals:
                lit_inp = card.locator("input").nth(2)
                lit_inp.click(); lit_inp.fill(literals)
            if default:
                def_inp = card.locator("input").nth(3)
                def_inp.click(); def_inp.fill(default)
            shot(page, f"add_field_{resource_label}_{name}_configured")
            card.locator("button.vs-btn-run").click()
            wait(400)
            shot(page, f"add_field_{resource_label}_{name}_running")
            wait(2200)
            shot(page, f"add_field_{resource_label}_{name}_done", 2)

        add_field("project", "status", "select", "active,on_hold,completed", "active")

        open_model_in_tree("tasks", "Task")
        shot(page, "schema_task_fields")
        add_field("task", "status", "select", "todo,in_progress,done", "todo")
        add_field("task", "due_date", "date")

        # ── Schema Browser: relation Task -> Project ────────────────────────────
        # "From model" is locked/prefilled to Task (we're on Task's panel); only "To model" is live.
        open_model_in_tree("tasks", "Task")
        rel_card = page.locator(".vs-cmd-card", has=page.locator(".vs-cmd-card-title", has_text="Add Relation")).first
        rel_card.scroll_into_view_if_needed()
        shot(page, "add_relation_empty")
        target_select = rel_card.locator("select").first
        wait_for_options(target_select, 2)
        target_select.select_option(label="Project")
        shot(page, "add_relation_configured")
        rel_card.locator("button.vs-btn-run").click()
        wait(400)
        shot(page, "add_relation_running")
        wait(2500)
        shot(page, "add_relation_done", 2)

        # ── Relation graph ───────────────────────────────────────────────────
        open_model_in_tree("tasks", "Task")
        page.evaluate("""
            const detail = document.querySelector('.vs-detail');
            if (detail) {
                const graphSection = Array.from(detail.querySelectorAll('.vs-section-title'))
                    .find(el => el.textContent.includes('Relation Graph'));
                if (graphSection) graphSection.scrollIntoView({behavior: 'instant', block: 'start'});
            }
        """)
        wait(600)
        shot(page, "relation_graph", 3)

        # ── Dashboard: add both resources ───────────────────────────────────────
        page.click("text=Dashboard")
        wait(1000)
        shot(page, "dashboard_before")

        def toggle_dashboard(resource: str):
            card = page.locator(".vs-cmd-card", has=page.locator(".vs-cmd-card-title", has_text="Toggle Dashboard Model")).first
            card.scroll_into_view_if_needed()
            wait_for_options(card.locator("select").nth(0), 1)
            card.locator("select").nth(0).select_option(resource)
            card.locator("select").nth(1).select_option("add")
            shot(page, f"dashboard_add_{resource.replace('/', '_')}_configured")
            card.locator("button.vs-btn-run").click()
            wait(2500)
            shot(page, f"dashboard_add_{resource.replace('/', '_')}_done", 2)

        toggle_dashboard("project")
        page.click("text=Dashboard")
        wait(800)
        toggle_dashboard("task")
        page.click("text=Dashboard")
        wait(800)
        shot(page, "dashboard_after", 2)

        # ── Search: add both models ─────────────────────────────────────────────
        page.click("text=Search")
        wait(1000)
        shot(page, "search_before")

        def toggle_search(model: str):
            card = page.locator(".vs-cmd-card", has=page.locator(".vs-cmd-card-title", has_text="Toggle Search Model")).first
            card.scroll_into_view_if_needed()
            wait_for_options(card.locator("select").nth(0), 1)
            card.locator("select").nth(0).select_option(model)
            card.locator("select").nth(1).select_option("add")
            shot(page, f"search_add_{model}_configured")
            card.locator("button.vs-btn-run").click()
            wait(2200)
            shot(page, f"search_add_{model}_done", 2)

        toggle_search("Project")
        page.click("text=Search")
        wait(800)
        toggle_search("Task")
        page.click("text=Search")
        wait(800)
        shot(page, "search_after", 2)

        # ── Command Panel: Build Frontend ────────────────────────────────────────
        page.click("text=Command Panel")
        wait(1000)
        build_card = page.locator(".vs-cmd-card", has=page.locator(".vs-cmd-card-title", has_text="Build Frontend")).first
        build_card.scroll_into_view_if_needed()
        shot(page, "build_before")
        build_card.locator("button.vs-btn-run").click()
        wait(800)
        shot(page, "build_running")
        wait(6000)
        shot(page, "build_done", 3)

        browser.close()
    print("\nDone. Frames in", OUT_DIR)

if __name__ == "__main__":
    run()
