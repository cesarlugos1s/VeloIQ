#!/usr/bin/env python3
"""Capture VeloIQ Studio screenshots for docs and website showcase."""

import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:8000/veloiq-studio/"
USERNAME = "admin"
PASSWORD = "admin"

DOCS_DIR = Path(__file__).parent / "docs/images/studio"
WEB_DIR = Path(__file__).parent / "website/showcase-assets/studio"
DOCS_DIR.mkdir(parents=True, exist_ok=True)
WEB_DIR.mkdir(parents=True, exist_ok=True)

def save(page, name: str):
    docs_path = DOCS_DIR / f"{name}.png"
    web_path = WEB_DIR / f"{name}.png"
    page.screenshot(path=str(docs_path), full_page=False)
    import shutil
    shutil.copy(docs_path, web_path)
    print(f"  ✓ {name}.png")

def wait(ms: int):
    time.sleep(ms / 1000)

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            viewport={"width": 1680, "height": 940},
            device_scale_factor=2,
        )
        page = ctx.new_page()
        page.goto(BASE_URL)
        wait(1500)

        # ── Login ──────────────────────────────────────────────────────────────
        page.fill("input[placeholder*='sername'], input[name='username'], input[type='text']", USERNAME)
        page.fill("input[type='password']", PASSWORD)
        page.click("button[type='submit']")
        wait(2500)

        # ── Summary page ───────────────────────────────────────────────────────
        print("Taking: summary")
        save(page, "studio-summary")

        # ── Schema browser — navigate to schema page ───────────────────────────
        print("Taking: schema browser")
        page.click("text=Schema", timeout=5000)
        wait(2000)
        # Open the first module in the tree
        module_hdrs = page.locator(".vs-tree-module-hdr")
        if module_hdrs.count() > 0:
            module_hdrs.first.click()
            wait(800)
            # Click the first model
            models = page.locator(".vs-tree-model")
            if models.count() > 0:
                # Try to find a model with relations (pick 2nd if available)
                target = models.nth(1) if models.count() > 1 else models.first
                target.click()
                wait(1200)
        save(page, "studio-schema-fields")

        # Scroll detail panel down to show relations section
        page.evaluate("""
            const detail = document.querySelector('.vs-detail');
            if (detail) detail.scrollTop = 300;
        """)
        wait(400)
        save(page, "studio-schema-relations")

        # Scroll further to reveal relation graph
        page.evaluate("""
            const detail = document.querySelector('.vs-detail');
            if (detail) detail.scrollTop = 800;
        """)
        wait(400)
        save(page, "studio-relation-graph")

        # Back to top to get a clean full-panel shot (fields + relations table)
        page.evaluate("""
            const detail = document.querySelector('.vs-detail');
            if (detail) detail.scrollTop = 0;
        """)
        wait(200)

        # Try to find a model with more relations for a better graph shot
        # Try modules until we find one with relations
        all_modules = page.locator(".vs-tree-module-hdr")
        best_found = False
        for i in range(all_modules.count()):
            mod = all_modules.nth(i)
            mod.click()
            wait(500)
            model_items = page.locator(".vs-tree-model")
            for j in range(model_items.count()):
                model_items.nth(j).click()
                wait(800)
                # Check if this model has a relation graph with nodes
                nodes = page.locator(".vs-detail svg circle")
                if nodes.count() > 2:  # center + at least 2 satellites
                    best_found = True
                    print(f"  Found good graph model at module={i} model={j}")
                    break
            if best_found:
                break

        if best_found:
            # Scroll to relation graph
            page.evaluate("""
                const detail = document.querySelector('.vs-detail');
                if (detail) {
                    const graphSection = Array.from(detail.querySelectorAll('.vs-section-title'))
                        .find(el => el.textContent.includes('Relation Graph'));
                    if (graphSection) {
                        graphSection.scrollIntoView({behavior: 'instant', block: 'start'});
                        detail.scrollTop = Math.max(0, detail.scrollTop - 20);
                    }
                }
            """)
            wait(600)
            save(page, "studio-relation-graph")

        # ── Dashboard config ───────────────────────────────────────────────────
        print("Taking: dashboard config")
        page.click("text=Dashboard", timeout=5000)
        wait(2000)
        save(page, "studio-dashboard")

        # ── Search config ──────────────────────────────────────────────────────
        print("Taking: search config")
        page.click("text=Search", timeout=5000)
        wait(1500)
        save(page, "studio-search")

        # ── Extensions ────────────────────────────────────────────────────────
        print("Taking: extensions")
        page.click("text=Extensions", timeout=5000)
        wait(1500)
        save(page, "studio-extensions")

        # ── Schema browser with Add Field card expanded ────────────────────────
        print("Taking: add field command")
        page.click("text=Schema", timeout=5000)
        wait(1500)
        # Navigate to first module/model with dev commands
        all_modules = page.locator(".vs-tree-module-hdr")
        if all_modules.count() > 0:
            all_modules.first.click()
            wait(500)
            models = page.locator(".vs-tree-model")
            if models.count() > 0:
                models.first.click()
                wait(1000)
        # Scroll to dev commands section (Add Field)
        page.evaluate("""
            const detail = document.querySelector('.vs-detail');
            if (detail) detail.scrollTop = detail.scrollHeight;
        """)
        wait(500)
        save(page, "studio-add-field")

        browser.close()
    print("\nDone.")

if __name__ == "__main__":
    run()
